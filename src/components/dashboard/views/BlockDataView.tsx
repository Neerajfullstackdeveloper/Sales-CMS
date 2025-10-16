import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CompanyCard from "@/components/CompanyCard";
import { Loader2 } from "lucide-react";

interface BlockDataViewProps {
  userId: string;
  userRole?: string;
}

const BlockDataView = ({ userId, userRole }: BlockDataViewProps) => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockData();
  }, [userId]);

  const fetchBlockData = async () => {
    setLoading(true);
    
    // First get all companies assigned to the user
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
      // Filter companies where the latest comment has "block" category
      const blockCompanies = userCompanies.filter(company => {
        if (!company.comments || company.comments.length === 0) return false;
        // Sort comments by created_at descending and get the latest
        const latestComment = company.comments.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        return latestComment.category === "block";
      });
      
      // Ensure comments are properly sorted for each company
      const companiesWithSortedComments = blockCompanies.map(company => ({
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
      <h2 className="text-3xl font-bold mb-6">Block Data</h2>
      {companies.length === 0 ? (
        <p className="text-muted-foreground">No blocked companies.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company: any) => (
            <CompanyCard
              key={company.id}
              company={company}
              onUpdate={fetchBlockData}
              canDelete={userRole === "admin"}
              userRole={userRole}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BlockDataView;
