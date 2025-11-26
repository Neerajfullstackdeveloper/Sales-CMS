import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CompanyCard from "@/components/CompanyCard";
import { Loader2, Calendar, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface TodayDataViewProps {
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

const TodayDataView = ({ userId, userRole }: TodayDataViewProps) => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayData();
  }, [userId]);

  const fetchTodayData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    
    // First get all companies assigned to the user with their comments
    const { data: userCompanies, error: companiesError } = await supabase
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

    if (!companiesError && userCompanies) {
      // Filter companies that have comments from today
      const todayCompanies = userCompanies.filter(company => {
        if (!company.comments || company.comments.length === 0) return false;
        return company.comments.some((comment: any) => 
          comment.created_at.startsWith(today)
        );
      });

      // Sort comments by created_at descending for each company
      const companiesWithSortedComments = todayCompanies.map(company => ({
        ...company,
        comments: company.comments?.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ) || []
      }));

      setCompanies(companiesWithSortedComments);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Calendar className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold text-white">Today's Data</h2>
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
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Today's Data</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Companies with comments added today
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
            <h3 className="text-lg font-semibold mb-2">No activity today</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              There are no companies with comments added today. Start adding comments to see them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company: any) => (
            <CompanyCard
              key={company.id}
              company={company}
              onUpdate={fetchTodayData}
              canDelete={true}
              userRole={userRole}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TodayDataView;
