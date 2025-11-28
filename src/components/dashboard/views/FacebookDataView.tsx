import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CompanyCard from "@/components/CompanyCard";
import { Loader2, Share2, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface FacebookDataViewProps {
  userId: string;
  userRole?: string;
}

const CompanyCardSkeleton = () => (
  <Card>
    <CardHeader>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-10" />
      </div>
    </CardContent>
  </Card>
);

const FacebookDataView = ({ userId, userRole }: FacebookDataViewProps) => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFacebookData();
  }, [userId]);

  const fetchFacebookData = async () => {
    setLoading(true);
    
    let query = supabase
      .from("companies")
      .select(`
        *,
        assigned_to:profiles!assigned_to_id(display_name),
        comments (
          id,
          comment_text,
          category,
          comment_date,
          created_at,
          user_id,
          user:profiles!user_id (
            display_name,
            email
          )
        )
      `)
      .ilike("source", "%facebook%")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // For employees, only show assigned data; for admin, show all Facebook data
    if (userRole !== "admin") {
      query = query.eq("assigned_to_id", userId);
    }

    const { data, error } = await query;

    if (!error && data) {
      const companiesWithSortedComments = data.map((company) => ({
        ...company,
        comments:
          company.comments?.sort(
            (a: any, b: any) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          ) || [],
      }));

      setCompanies(companiesWithSortedComments);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Share2 className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold">Facebook Data</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <CompanyCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Share2 className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Facebook Data</h2>
            <p className="text-sm text-muted-foreground mt-1 text-white">
              {userRole === "admin" 
                ? "All companies from Facebook source" 
                : "Companies from Facebook source assigned to you"}
            </p>
          </div>
        </div>
        {companies.length > 0 && (
          <div className="px-4 py-2 bg-blue-100 rounded-full">
            <span className="text-sm font-semibold text-blue-600">{companies.length} {companies.length === 1 ? 'company' : 'companies'}</span>
          </div>
        )}
      </div>
      {companies.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-muted rounded-full mb-4">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Facebook data</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {userRole === "admin"
                ? "There are no companies from Facebook source in the system at the moment."
                : "You don't have any companies from Facebook source assigned to you at the moment."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onUpdate={fetchFacebookData}
              canDelete={userRole === "admin"}
              showAssignedTo={userRole === "admin"}
              userRole={userRole}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FacebookDataView;

