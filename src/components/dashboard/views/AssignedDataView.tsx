// import { useEffect, useState } from "react";
// import { supabase } from "@/integrations/supabase/client";
// import CompanyCard from "@/components/CompanyCard";
// import { Loader2 } from "lucide-react";

// interface AssignedDataViewProps {
//   userId: string;
//   userRole?: string;
// }

// const AssignedDataView = ({ userId, userRole }: AssignedDataViewProps) => {
//   const [companies, setCompanies] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     fetchAssignedCompanies();
//   }, [userId]);

//   const fetchAssignedCompanies = async () => {
//     setLoading(true);
//     const { data, error } = await supabase
//       .from("companies")
//       .select(`
//         *,
//         comments (
//           id,
//           comment_text,
//           category,
//           comment_date,
//           created_at,
//           user_id,
//           user:profiles!user_id (
//             display_name,
//             email
//           )
//         )
//       `)
//       .eq("assigned_to_id", userId)
//       .is("deleted_at", null)
//       .order("created_at", { ascending: false });

//     if (!error && data) {
//       // Sort comments by created_at descending for each company to ensure latest comment is first
//       const companiesWithSortedComments = data.map(company => ({
//         ...company,
//         comments: company.comments?.sort((a: any, b: any) => 
//           new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
//         ) || []
//       }));
//       setCompanies(companiesWithSortedComments);
//     }
//     setLoading(false);
//   };

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center py-12">
//         <Loader2 className="h-8 w-8 animate-spin text-primary" />
//       </div>
//     );
//   }

//   return (
//     <div>
//       <h2 className="text-3xl font-bold mb-6">Assigned Data</h2>
//       {companies.length === 0 ? (
//         <p className="text-muted-foreground">No companies assigned to you yet.</p>
//       ) : (
//         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
//           {companies.map((company) => (
//             <CompanyCard
//               key={company.id}
//               company={company}
//               onUpdate={fetchAssignedCompanies}
//               userRole={userRole}
//             />
//           ))}
//         </div>
//       )}
//     </div>
//   );
// };

// export default AssignedDataView;


import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CompanyCard from "@/components/CompanyCard";
import { Loader2 } from "lucide-react";

interface AssignedDataViewProps {
  userId: string;
  userRole?: string;
}

const AssignedDataView = ({ userId, userRole }: AssignedDataViewProps) => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLocalData = async () => {
      const stored = localStorage.getItem(`assignedCompanies_${userId}`);

      if (stored) {
        const parsed = JSON.parse(stored);
        const timePassed = Date.now() - parsed.timestamp;

        // 👇 If less than 30 minutes, load from localStorage instead of fetching again
        if (timePassed < 30 * 60 * 1000) {
          setCompanies(parsed.data);
          setLoading(false);
          return;
        } else {
          // Remove expired data
          localStorage.removeItem(`assignedCompanies_${userId}`);
        }
      }

      // Otherwise fetch fresh data
      await fetchAssignedCompanies();
    };

    checkLocalData();
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

      // 👇 Automatically clear from UI and localStorage after 30 mins
      setTimeout(() => {
        setCompanies([]);
        localStorage.removeItem(`assignedCompanies_${userId}`);
      }, 30 * 60 * 1000);
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
      <h2 className="text-3xl font-bold mb-6">Assigned Data</h2>
      {companies.length === 0 ? (
        <p className="text-muted-foreground">
          No companies assigned to you yet.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onUpdate={fetchAssignedCompanies}
              userRole={userRole}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AssignedDataView;
