import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Building2, Phone, Mail, MapPin, RotateCcw, Trash2, Search, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecycleBinViewProps {
  userRole?: string;
}

interface DeletedCompany {
  id: string;
  company_name: string;
  owner_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  products_services: string | null;
  deleted_at: string;
  deleted_by: {
    display_name: string;
    email: string;
  } | null;
  assigned_to: {
    display_name: string;
    email: string;
  } | null;
  comments: Array<{
    id: string;
    comment_text: string;
    category: string;
    created_at: string;
    user: {
      display_name: string;
      email: string;
    };
  }>;
}

const RecycleBinView = ({ userRole }: RecycleBinViewProps) => {
  const [companies, setCompanies] = useState<DeletedCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [restoring, setRestoring] = useState<string | null>(null);
  const [permanentlyDeleting, setPermanentlyDeleting] = useState<string | null>(null);

  const fetchDeletedCompanies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("companies")
        .select(`
          *,
          deleted_by:profiles!companies_deleted_by_id_fkey(display_name, email),
          assigned_to:profiles!companies_assigned_to_id_fkey(display_name, email),
          comments(
            id,
            comment_text,
            category,
            created_at,
            user:profiles(display_name, email)
          )
        `)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        // If the columns don't exist yet, show a helpful message
        if (error.message.includes("deleted_by_id") || error.message.includes("deleted_at")) {
          toast.error("Database migration not applied yet. Please run the migration first.");
          setCompanies([]);
          return;
        }
        throw error;
      }
      setCompanies(data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch deleted companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedCompanies();
  }, []);

  const handleRestore = async (companyId: string) => {
    try {
      setRestoring(companyId);
      const { error } = await supabase
        .from("companies")
        .update({
          deleted_at: null,
          deleted_by_id: null
        })
        .eq("id", companyId);

      if (error) throw error;

      toast.success("Company restored successfully!");
      fetchDeletedCompanies();
    } catch (error: any) {
      toast.error(error.message || "Failed to restore company");
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async (companyId: string) => {
    if (!confirm("Are you sure you want to permanently delete this company? This action cannot be undone.")) {
      return;
    }

    try {
      setPermanentlyDeleting(companyId);
      const { error } = await supabase
        .from("companies")
        .delete()
        .eq("id", companyId);

      if (error) throw error;

      toast.success("Company permanently deleted!");
      fetchDeletedCompanies();
    } catch (error: any) {
      toast.error(error.message || "Failed to permanently delete company");
    } finally {
      setPermanentlyDeleting(null);
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (company.email && company.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'hot': return 'bg-red-100 text-red-800 border-red-200';
      case 'follow_up': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'block': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'general': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'hot': return '🔥';
      case 'follow_up': return '📅';
      case 'block': return '🚫';
      case 'general': return '📋';
      default: return '📄';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Recycle Bin</h2>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading deleted companies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Recycle Bin</h2>
        <Badge variant="secondary" className="text-sm">
          {companies.length} deleted companies
        </Badge>
      </div>

      <div className="flex items-center space-x-2 ">
        <div className="relative flex-1 max-w-sm ">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 text-white/80" />
          <Input
            placeholder="Search deleted companies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-white"
          />
        </div>
      </div>

      {filteredCompanies.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Trash2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? "No matching companies found" : "No deleted companies"}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? "Try adjusting your search terms" 
                : "Deleted companies will appear here"
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCompanies.map((company) => {
            const lastComment = company.comments?.[0];
            
            return (
              <Card key={company.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {company.company_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{company.owner_name}</p>
                    </div>
                    {lastComment && (
                      <Badge className={cn("ml-2", getCategoryColor(lastComment.category))}>
                        {getCategoryIcon(lastComment.category)} {lastComment.category.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {company.phone}
                    </div>
                    {company.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {company.email}
                      </div>
                    )}
                    {company.address && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {company.address}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="font-medium">Assigned to:</span>
                      {company.assigned_to ? (
                        company.assigned_to.display_name
                      ) : (
                        <span className="text-orange-600 font-medium">Unassigned</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">Deleted:</span>
                      {new Date(company.deleted_at).toLocaleString()}
                    </div>
                    {company.deleted_by && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span className="font-medium">Deleted by:</span>
                        {company.deleted_by.display_name}
                      </div>
                    )}
                  </div>

                  {lastComment && (
                    <div className="border-t pt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Last Comment</p>
                      <p className="text-sm">{lastComment.comment_text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Added: {new Date(lastComment.created_at).toLocaleString()}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleRestore(company.id)}
                      disabled={restoring === company.id}
                      className="flex-1"
                      variant="outline"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {restoring === company.id ? "Restoring..." : "Restore"}
                    </Button>
                    <Button
                      onClick={() => handlePermanentDelete(company.id)}
                      disabled={permanentlyDeleting === company.id}
                      variant="destructive"
                      size="icon"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecycleBinView;
