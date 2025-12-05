


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
    let isMounted = true;
    let hasFetched = false;
    
    const loadAndRefresh = async () => {
      // Show cached data immediately for faster perceived performance
      const stored = localStorage.getItem(`assignedCompanies_${userId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.data && parsed?.timestamp) {
            const cacheAge = Date.now() - parsed.timestamp;
            // Use cache if less than 2 minutes old
            if (cacheAge < 120000) {
              if (isMounted) {
                setCompanies(parsed.data);
                setLoading(false);
              }
              // Only refresh in background if tab is visible and not recently fetched
              if (document.visibilityState === "visible" && !hasFetched) {
                hasFetched = true;
                fetchAssignedCompanies().finally(() => {
                  hasFetched = false;
                });
              }
              return;
            }
          }
        } catch {}
      }

      // Fetch fresh data only if not already fetched
      if (!hasFetched && isMounted) {
        hasFetched = true;
        await fetchAssignedCompanies();
        hasFetched = false;
      }
    };

    loadAndRefresh();

    // Handle visibility change - don't reload if data is fresh
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isMounted && !hasFetched) {
        const stored = localStorage.getItem(`assignedCompanies_${userId}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed?.timestamp) {
              const cacheAge = Date.now() - parsed.timestamp;
              // Only refresh if cache is older than 2 minutes
              if (cacheAge > 120000) {
                hasFetched = true;
                fetchAssignedCompanies().finally(() => {
                  hasFetched = false;
                });
              }
            }
          } catch {}
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId]);

  const fetchAssignedCompanies = async () => {
    setLoading(true);
    
    // Calculate 24 hours ago timestamp for database filtering
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Optimized query: only fetch latest comment per company, filter in database
    const query = supabase
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
      .order("created_at", { ascending: true })
      .limit(100); // Limit to prevent loading too much data

    const { data, error } = await query;

    if (!error && data) {
      // Filter out companies with deletion_state (if column exists)
      let filteredData = data.filter((company: any) => !company.deletion_state);
      
      // Filter out companies assigned for more than 24 hours
      const now = Date.now();
      const validCompanies: any[] = [];
      const outdatedIds: string[] = [];

      filteredData.forEach((company: any) => {
        if (!company.assigned_at) {
          validCompanies.push(company);
          return;
        }
        const assignedAt = new Date(company.assigned_at).getTime();
        const hoursSinceAssignment = (now - assignedAt) / (1000 * 60 * 60);
        if (hoursSinceAssignment < 24) {
          validCompanies.push(company);
        } else {
          outdatedIds.push(company.id);
        }
      });

      // Unassign outdated companies in parallel (non-blocking)
      if (outdatedIds.length > 0) {
        supabase
          .from("companies")
          .update({ assigned_to_id: null, assigned_at: null })
          .in("id", outdatedIds)
          .then(() => {
            // Silently handle - don't block UI
          })
          .catch(() => {
            // Silently handle - don't block UI
          });
      }

      // Sort comments once per company (only if needed)
      const companiesWithSortedComments = validCompanies.map((company) => ({
        ...company,
        comments:
          company.comments?.sort(
            (a: any, b: any) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          ) || [],
      }));

      // For employees: filter out companies that have comments (already categorized)
      // They should only appear in category views, not in Assigned Data section
      // For admins: show all assigned companies regardless of comments
      const finalCompanies = userRole === "admin" 
        ? companiesWithSortedComments
        : companiesWithSortedComments.filter((company: any) => {
            // Keep only companies with no comments (uncategorized)
            return !company.comments || company.comments.length === 0;
          });

      setCompanies(finalCompanies);

      // 👇 Save fetched data and timestamp in localStorage
      localStorage.setItem(
        `assignedCompanies_${userId}`,
        JSON.stringify({
          timestamp: Date.now(),
          data: finalCompanies,
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
          <h2 className="text-3xl font-bold text-white">Assigned Data</h2>
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
            <h2 className="text-3xl font-bold tracking-tight text-white">Assigned Data</h2>
            <p className="text-sm text-muted-foreground mt-1 text-white">
              Companies assigned to you (auto-unassigned after 24 hours)
            </p>
          </div>
        </div>
        {companies.length > 0 && (
          <div className="px-4 py-2 bg-primary/10 rounded-full">
            <span className="text-sm font-semibold text-primary text-white">{companies.length} {companies.length === 1 ? 'company' : 'companies'}</span>
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-stretch">
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
