import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CompanyCard from "@/components/CompanyCard";
import { Loader2 } from "lucide-react";

interface TodayDataViewProps {
  userId: string;
  userRole?: string;
}

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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Today's Data</h2>
      {companies.length === 0 ? (
        <p className="text-muted-foreground">No companies with comments today.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company: any) => (
            <CompanyCard
              key={company.id}
              company={company}
              onUpdate={fetchTodayData}
              userRole={userRole}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TodayDataView;
