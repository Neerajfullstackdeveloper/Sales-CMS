import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CompanyCard from "@/components/CompanyCard";
import { Loader2 } from "lucide-react";

interface AllCompaniesViewProps {
  userRole?: string;
}

const AllCompaniesView = ({ userRole }: AllCompaniesViewProps) => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllCompanies();
  }, []);

  const fetchAllCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
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
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Sort comments by created_at descending for each company to ensure latest comment is first
      const companiesWithSortedComments = data.map(company => ({
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
      <h2 className="text-3xl font-bold mb-6">All Companies</h2>
      {companies.length === 0 ? (
        <p className="text-muted-foreground">No companies in the system yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onUpdate={fetchAllCompanies}
              showAssignedTo
              canDelete={userRole === "admin"}
              userRole={userRole}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AllCompaniesView;
