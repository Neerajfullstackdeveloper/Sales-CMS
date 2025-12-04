import { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Calendar,
  TrendingUp,
  Flame,
  Ban,
  Database,
  Plus,
  MessageSquarePlus,
  LogOut,
  Share2,
} from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import AssignedDataView from "./views/AssignedDataView";
import FacebookDataView from "./views/FacebookDataView";
import TodayDataView from "./views/TodayDataView";
import FollowUpDataView from "./views/FollowUpDataView";
import HotDataView from "./views/HotDataView";
import BlockDataView from "./views/BlockDataView";
import GeneralDataView from "./views/GeneralDataView";
import AddNewDataView from "./views/AddNewDataView";
import RequestDataView from "./views/RequestDataView";

interface EmployeeDashboardProps {
  user: User;
}

const EmployeeDashboard = ({ user }: EmployeeDashboardProps) => {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState("assigned");
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const fetchCategoryCounts = async () => {
    try {
      const counts: Record<string, number> = {};

      // Fetch assigned companies count (without comments, within 24 hours)
      const { data: assignedCompanies } = await supabase
        .from("companies")
        .select(`
          id,
          assigned_at,
          comments (id)
        `)
        .eq("assigned_to_id", user.id)
        .is("deleted_at", null);

      if (assignedCompanies) {
        const now = Date.now();
        const assignedCount = assignedCompanies.filter((company: any) => {
          if (!company.assigned_at) return false;
          const assignedAt = new Date(company.assigned_at).getTime();
          const hoursSinceAssignment = (now - assignedAt) / (1000 * 60 * 60);
          if (hoursSinceAssignment >= 24) return false;
          // Only count companies without comments
          return !company.comments || company.comments.length === 0;
        }).length;
        counts.assigned = assignedCount;
      }

      // Fetch Facebook data count (shared to employee, without comments)
      const { data: shares } = await (supabase
        .from("facebook_data_shares" as any)
        .select("facebook_data_id")
        .eq("employee_id", user.id) as any);

      if (shares && shares.length > 0) {
        const fbIds = shares.map((s: any) => s.facebook_data_id);
        const { data: fbData } = await (supabase
          .from("facebook_data" as any)
          .select("id")
          .in("id", fbIds) as any);

        if (fbData) {
          const { data: comments } = await (supabase
            .from("facebook_data_comments" as any)
            .select("facebook_data_id")
            .in("facebook_data_id", fbIds) as any);

          // Get set of Facebook data IDs that have comments
          const fbIdsWithComments = new Set((comments || []).map((c: any) => c.facebook_data_id));

          // Count only items without comments (matching FacebookDataView logic)
          const fbWithoutComments = fbData.filter((fb: any) => !fbIdsWithComments.has(fb.id));
          counts.facebook = fbWithoutComments.length;
        }
      } else {
        counts.facebook = 0;
      }

      // Fetch today data count (companies/facebook data with comments from today)
      const today = new Date().toISOString().split('T')[0];
      
      const { data: todayCompanies } = await supabase
        .from("companies")
        .select(`
          id,
          comments (id, created_at)
        `)
        .eq("assigned_to_id", user.id)
        .is("deleted_at", null);

      let todayCount = 0;
      if (todayCompanies) {
        const todayCompaniesCount = todayCompanies.filter((company: any) => {
          if (!company.comments || company.comments.length === 0) return false;
          return company.comments.some((comment: any) => comment.created_at.startsWith(today));
        }).length;
        todayCount += todayCompaniesCount;
      }

      if (shares && shares.length > 0) {
        const fbIds = shares.map((s: any) => s.facebook_data_id);
        const { data: todayFbComments } = await (supabase
          .from("facebook_data_comments" as any)
          .select("facebook_data_id")
          .in("facebook_data_id", fbIds)
          .gte("created_at", `${today}T00:00:00`)
          .lt("created_at", `${today}T23:59:59`) as any);

        if (todayFbComments) {
          const uniqueFbIds = new Set(todayFbComments.map((c: any) => c.facebook_data_id));
          todayCount += uniqueFbIds.size;
        }
      }
      counts.today = todayCount;

      // Fetch category counts (companies + facebook data with latest comment in each category)
      const categories = ['follow_up', 'hot', 'block', 'general'];
      
      for (const category of categories) {
        let categoryCount = 0;

        // Count companies with latest comment in this category
        const { data: categoryCompanies } = await supabase
          .from("companies")
          .select(`
            id,
            comments (id, category, created_at)
          `)
          .eq("assigned_to_id", user.id)
          .is("deleted_at", null);

        if (categoryCompanies) {
          const categoryCompaniesCount = categoryCompanies.filter((company: any) => {
            if (!company.comments || company.comments.length === 0) return false;
            const sortedComments = [...company.comments].sort((a: any, b: any) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            const latestComment = sortedComments[0];
            return latestComment && latestComment.category === category;
          }).length;
          categoryCount += categoryCompaniesCount;
        }

        // Count Facebook data with latest comment in this category
        if (shares && shares.length > 0) {
          const fbIds = shares.map((s: any) => s.facebook_data_id);
          const { data: categoryFbComments } = await (supabase
            .from("facebook_data_comments" as any)
            .select("facebook_data_id, category, created_at")
            .in("facebook_data_id", fbIds) as any);

          if (categoryFbComments) {
            // Group by facebook_data_id and get latest comment for each
            const fbLatestComments: Record<number, any> = {};
            categoryFbComments.forEach((comment: any) => {
              const fbId = comment.facebook_data_id;
              if (!fbLatestComments[fbId] || 
                  new Date(comment.created_at) > new Date(fbLatestComments[fbId].created_at)) {
                fbLatestComments[fbId] = comment;
              }
            });

            const categoryFbCount = Object.values(fbLatestComments).filter(
              (comment: any) => comment.category === category
            ).length;
            categoryCount += categoryFbCount;
          }
        }

        // Map category to menu id
        const categoryMap: Record<string, string> = {
          'follow_up': 'followup',
          'hot': 'hot',
          'block': 'block',
          'general': 'general'
        };
        counts[categoryMap[category]] = categoryCount;
      }

      setCategoryCounts(counts);
    } catch (error) {
      console.error("Error fetching category counts:", error);
    }
  };

  useEffect(() => {
    fetchCategoryCounts();
    // Refresh counts periodically
    const interval = setInterval(fetchCategoryCounts, 30000); // Every 30 seconds
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Listen for data update events
  useEffect(() => {
    const handleDataUpdate = () => {
      fetchCategoryCounts();
    };

    window.addEventListener('facebookDataUpdated', handleDataUpdate);
    window.addEventListener('companyDataUpdated', handleDataUpdate);
    
    return () => {
      window.removeEventListener('facebookDataUpdated', handleDataUpdate);
      window.removeEventListener('companyDataUpdated', handleDataUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const menuItems = [
    { id: "assigned", label: "Assigned Data", icon: LayoutDashboard, count: categoryCounts.assigned },
    { id: "facebook", label: "Facebook Data", icon: Share2, count: categoryCounts.facebook },
    { id: "today", label: "Today Data", icon: Calendar, count: categoryCounts.today },
    { id: "followup", label: "Active Pool", icon: TrendingUp, count: categoryCounts.followup },
    { id: "hot", label: "Prime Pool", icon: Flame, count: categoryCounts.hot },
    { id: "block", label: "Inactive Pool", icon: Ban, count: categoryCounts.block },
    { id: "general", label: "General Data", icon: Database, count: categoryCounts.general },
    { id: "add", label: "Add New Data", icon: Plus },
    { id: "request", label: "Request Data", icon: MessageSquarePlus },
  ];

  return (
    <DashboardLayout
      menuItems={menuItems}
      currentView={currentView}
      onViewChange={setCurrentView}
      user={user}
      onLogout={handleLogout}
    >
      {currentView === "assigned" && <AssignedDataView userId={user.id} userRole="employee" />}
      {currentView === "facebook" && <FacebookDataView userId={user.id} userRole="employee" />}
      {currentView === "today" && <TodayDataView userId={user.id} userRole="employee" />}
      {currentView === "followup" && <FollowUpDataView userId={user.id} userRole="employee" />}
      {currentView === "hot" && <HotDataView userId={user.id} userRole="employee" />}
      {currentView === "block" && <BlockDataView userId={user.id} userRole="employee" />}
      {currentView === "general" && <GeneralDataView userId={user.id} userRole="employee" />}
      {currentView === "add" && <AddNewDataView userId={user.id} userRole="employee" />}
      {currentView === "request" && <RequestDataView userId={user.id} />}
    </DashboardLayout>
  );
};

export default EmployeeDashboard;
