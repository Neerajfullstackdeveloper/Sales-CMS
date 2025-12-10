import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Check, X, User, Building2, Clock, CheckCircle2, XCircle } from "lucide-react";

const CompanyApprovalView = () => {
  const [newListedData, setNewListedData] = useState<any[]>([]);
  const [nonshiftedData, setNonshiftedData] = useState<any[]>([]);
  const [shiftedData, setShiftedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch new listed data (pending approval)
      const { data: pendingData, error: pendingError } = await (supabase
        .from("companies" as any)
        .select(`
          *,
          created_by:profiles!created_by_id(display_name, email)
        `)
        .eq("approval_status", "pending")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }) as any);

      if (pendingError) throw pendingError;

      // Fetch shifted data (companies assigned to an employee)
      // Include all companies that have been assigned (not null and not empty string)
      const { data: shifted, error: shiftedError } = await (supabase
        .from("companies" as any)
        .select(`
          *,
          created_by:profiles!created_by_id(display_name, email),
          assigned_to:profiles!assigned_to_id(display_name, email)
        `)
        .not("assigned_to_id", "is", null)
        .is("deleted_at", null)
        .order("assigned_at", { ascending: false }) as any);

      if (shiftedError) throw shiftedError;

      // Filter out any shifted companies with empty string assigned_to_id
      const validShifted = (shifted || []).filter((c: any) => c.assigned_to_id && c.assigned_to_id.trim() !== "");

      // Get count of all companies for verification
      const { count: allCompaniesCount, error: countError } = await supabase
        .from("companies")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null);

      if (countError) throw countError;

      // Get count of shifted companies
      const { count: shiftedCount, error: shiftedCountError } = await supabase
        .from("companies")
        .select("*", { count: "exact", head: true })
        .not("assigned_to_id", "is", null)
        .is("deleted_at", null);

      if (shiftedCountError) throw shiftedCountError;

      // Fetch nonshifted data (companies not assigned to any employee)
      // Fetch all unassigned companies (NULL assigned_to_id)
      // Note: Supabase has a default limit of 1000 rows, so we need to handle pagination
      let allNonshifted: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: nonshiftedPage, error: nonshiftedError } = await (supabase
          .from("companies" as any)
          .select(`
            *,
            created_by:profiles!created_by_id(display_name, email)
          `)
          .is("deleted_at", null)
          .is("assigned_to_id", null)
          .order("created_at", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1) as any);

        if (nonshiftedError) throw nonshiftedError;

        if (nonshiftedPage && nonshiftedPage.length > 0) {
          allNonshifted = [...allNonshifted, ...nonshiftedPage];
          hasMore = nonshiftedPage.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Also fetch companies with empty string assigned_to_id (if any)
      const { data: emptyAssigned, error: emptyError } = await (supabase
        .from("companies" as any)
        .select(`
          *,
          created_by:profiles!created_by_id(display_name, email)
        `)
        .is("deleted_at", null)
        .eq("assigned_to_id", "")
        .order("created_at", { ascending: false }) as any);

      if (emptyError) {
        console.warn("Error fetching empty assigned_to_id companies:", emptyError);
      }

      // Combine NULL and empty string assigned_to_id companies
      const allNonshiftedCombined = [...allNonshifted, ...(emptyAssigned || [])];

      if (shiftedError) throw shiftedError;

      // Verify counts match
      const totalCount = (shiftedCount || 0) + allNonshiftedCombined.length;
      
      console.log("📊 Company Count Verification:", {
        shifted: shiftedCount || 0,
        shiftedFetched: validShifted.length,
        nonshifted: allNonshiftedCombined.length,
        total: totalCount,
        allCompaniesCount: allCompaniesCount || 0,
        difference: (allCompaniesCount || 0) - totalCount,
        pending: pendingData?.length || 0,
        emptyAssigned: emptyAssigned?.length || 0
      });

      setNewListedData(pendingData || []);
      setNonshiftedData(allNonshiftedCombined || []);
      setShiftedData(validShifted || []);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error(error.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (company: any) => {
    setProcessingId(company.id);
    try {
      // Approve the company and assign it to the employee who created it
      const nowIso = new Date().toISOString();
      const { error } = await (supabase
        .from("companies" as any)
        .update({
          approval_status: "approved",
          assigned_to_id: company.created_by_id,
          assigned_at: nowIso,
        })
        .eq("id", company.id) as any);

      if (error) throw error;

      toast.success(`Company "${company.company_name}" approved and assigned to ${company.created_by?.display_name || "employee"}`);
      
      // Refresh data
      await fetchData();
      
      // Notify dashboards to refresh
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("companyDataUpdated"));
      }
    } catch (error: any) {
      console.error("Error approving company:", error);
      toast.error(error.message || "Failed to approve company");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (company: any) => {
    setProcessingId(company.id);
    try {
      const { error } = await (supabase
        .from("companies" as any)
        .update({
          approval_status: "rejected",
        })
        .eq("id", company.id) as any);

      if (error) throw error;

      toast.success(`Company "${company.company_name}" rejected`);
      
      // Refresh data
      await fetchData();
    } catch (error: any) {
      console.error("Error rejecting company:", error);
      toast.error(error.message || "Failed to reject company");
    } finally {
      setProcessingId(null);
    }
  };

  const CompanyCard = ({ company, showActions = true }: { company: any; showActions?: boolean }) => (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg text-white">{company.company_name}</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="flex items-center gap-1 ">
                <User className="h-3 w-3" />
                {company.created_by?.display_name || "Unknown"}
              </Badge>
              <Badge variant="outline" className="">
                {company.created_by?.email || ""}
              </Badge>
            </div>
          </div>
          {showActions && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleApprove(company)}
                disabled={processingId === company.id}
                className="bg-green-600 hover:bg-green-700"
              >
                {processingId === company.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Approve
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleReject(company)}
                disabled={processingId === company.id}
              >
                {processingId === company.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <X className="h-4 w-4 mr-1" />
                    Reject
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm ">
          <div>
            <p className="text-muted-foreground ">Owner Name</p>
            <p className="">{company.owner_name}</p>
          </div>
          <div>
            <p className="text-muted-foreground ">Phone</p>
            <p className="">{company.phone}</p>
          </div>
          {company.email && (
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="">{company.email}</p>
            </div>
          )}
          {company.address && (
            <div>
              <p className="text-muted-foreground ">Address</p>
              <p className="">{company.address}</p>
            </div>
          )}
          {company.products_services && (
            <div className="md:col-span-2">
              <p className="text-muted-foreground ">Products & Services</p>
              <p className="">{company.products_services}</p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground ">Created At</p>
            <p className="">{new Date(company.created_at).toLocaleString()}</p>
          </div>
          {company.assigned_to && (
            <div>
              <p className="text-muted-foreground ">Assigned To</p>
              <p className="">{company.assigned_to.display_name}</p>
            </div>
          )}
          {company.assigned_at && (
            <div>
              <p className="text-muted-foreground ">Assigned At</p>
              <p className="">{new Date(company.assigned_at).toLocaleString()}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-white">Company Approval Management</h2>
      
      <Tabs defaultValue="new-listed" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="new-listed" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            New Listed Data
            {newListedData.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {newListedData.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="nonshifted" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Nonshifted
            {nonshiftedData.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {nonshiftedData.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="shifted" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Shifted
            {shiftedData.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {shiftedData.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new-listed">
          <div>
            <h3 className="text-xl font-semibold mb-4 text-white">
              New Listed Data ({newListedData.length})
            </h3>
            <p className="text-sm text-muted-foreground mb-4 text-white/70">
              Companies pending approval (these are also included in Nonshifted count)
            </p>
            {newListedData.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-white">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No new companies pending approval</p>
                </CardContent>
              </Card>
            ) : (
              newListedData.map((company) => (
                <CompanyCard key={company.id} company={company} showActions={true} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="nonshifted">
          <div>
            <h3 className="text-xl font-semibold mb-4 text-white">
              Nonshifted Data ({nonshiftedData.length})
            </h3>
            <p className="text-sm text-muted-foreground mb-4 text-white/70">
              Companies that have not been assigned/shifted to any employee
            </p>
            {nonshiftedData.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-white">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No approved companies waiting to be assigned</p>
                </CardContent>
              </Card>
            ) : (
              nonshiftedData.map((company) => (
                <CompanyCard key={company.id} company={company} showActions={false} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="shifted">
          <div>
            <h3 className="text-xl font-semibold mb-4 text-white">
              Shifted Data ({shiftedData.length})
            </h3>
            <p className="text-sm text-muted-foreground mb-4 text-white/70">
              Companies that have been assigned/shifted to employees
            </p>
            {shiftedData.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-white">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No companies have been assigned yet</p>
                </CardContent>
              </Card>
            ) : (
              shiftedData.map((company) => (
                <CompanyCard key={company.id} company={company} showActions={false} />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompanyApprovalView;

