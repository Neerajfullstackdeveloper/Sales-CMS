


import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CompanyCard from "@/components/CompanyCard";
import { Loader2, UserCheck, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface AssignedDataViewProps {
  userId: string;
  userRole?: string;
}

const AssignedDataView = ({ userId, userRole }: AssignedDataViewProps) => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAndRefresh = async () => {
      const stored = localStorage.getItem(`assignedCompanies_${userId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.data) {
            setCompanies(parsed.data);
          }
        } catch {}
      }

      // Always revalidate with server to avoid stale cache
      await fetchAssignedCompanies();
    };

    loadAndRefresh();
  }, [userId]);

  const fetchAssignedCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select(`
        *,
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
      .eq("assigned_to_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Filter out companies assigned for more than 24 hours
      const now = Date.now();
      const filteredData = data.filter((company: any) => {
        if (!company.assigned_at) return true; // Keep companies without assigned_at
        const assignedAt = new Date(company.assigned_at).getTime();
        const hoursSinceAssignment = (now - assignedAt) / (1000 * 60 * 60);
        return hoursSinceAssignment < 24;
      });

      // If any companies are older than 24 hours, auto-unassign them
      const outdatedCompanies = data.filter((company: any) => {
        if (!company.assigned_at) return false;
        const assignedAt = new Date(company.assigned_at).getTime();
        const hoursSinceAssignment = (now - assignedAt) / (1000 * 60 * 60);
        return hoursSinceAssignment >= 24;
      });

      if (outdatedCompanies.length > 0) {
        // Unassign companies older than 24 hours
        const outdatedIds = outdatedCompanies.map((c: any) => c.id);
        await supabase
          .from("companies")
          .update({ assigned_to_id: null, assigned_at: null })
          .in("id", outdatedIds);
      }

      const companiesWithSortedComments = filteredData.map((company) => ({
        ...company,
        comments:
          company.comments?.sort(
            (a: any, b: any) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          ) || [],
      }));

      setCompanies(companiesWithSortedComments);

      // 👇 Save fetched data and timestamp in localStorage
      localStorage.setItem(
        `assignedCompanies_${userId}`,
        JSON.stringify({
          timestamp: Date.now(),
          data: companiesWithSortedComments,
        })
      );

      // 👇 Automatically clear from UI and localStorage after 15 mins
      setTimeout(() => {
        setCompanies([]);
        localStorage.removeItem(`assignedCompanies_${userId}`);
      }, 15 * 60 * 1000);
    }

    setLoading(false);
  };

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <UserCheck className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold">Assigned Data</h2>
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
          <div className="p-2 bg-primary/10 rounded-lg">
            <UserCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Assigned Data</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Companies assigned to you (auto-unassigned after 24 hours)
            </p>
          </div>
        </div>
        {companies.length > 0 && (
          <div className="px-4 py-2 bg-primary/10 rounded-full">
            <span className="text-sm font-semibold text-primary">{companies.length} {companies.length === 1 ? 'company' : 'companies'}</span>
          </div>
        )}
      </div>
      {companies.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-muted rounded-full mb-4">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No assigned companies</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              You don't have any companies assigned to you at the moment. Companies will appear here once they're assigned to you.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onUpdate={fetchAssignedCompanies}
              canDelete={true}
              userRole={userRole}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AssignedDataView;
