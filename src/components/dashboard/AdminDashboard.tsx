import { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Building2,
  Plus,
  MessageSquare,
  CalendarDays,
  Settings,
  UserCog,
  Trash2,
  Share2,
  Pencil,
  LogIn,
  ArrowLeft,
  FileCheck,
} from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import AllCompaniesView from "./views/AllCompaniesView";
import EmployeeManagementView from "./views/EmployeeManagementView";
import TeamCreationView from "./views/TeamCreationView";
import DataRequestsView from "./views/DataRequestsView";
import EditRequestsView from "./views/EditRequestsView";
import HolidaysView from "./views/HolidaysView";
import AddNewDataView from "./views/AddNewDataView";
import AdminDataAssignmentView from "./views/AdminDataAssignmentView";
import FacebookDataView from "./views/FacebookDataView";
import RecycleBinView from "./views/RecycleBinView";
import UserImpersonationView from "./views/UserImpersonationView";
import EmployeeDashboard from "./EmployeeDashboard";
import TeamLeadDashboard from "./TeamLeadDashboard";
import CompanyApprovalView from "./views/CompanyApprovalView";
import { Button } from "@/components/ui/button";

interface AdminDashboardProps {
  user: User;
}

const AdminDashboard = ({ user }: AdminDashboardProps) => {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState("companies");
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [impersonatedUser, setImpersonatedUser] = useState<{
    id: string;
    role: "employee" | "team_lead";
    name: string;
    email: string;
  } | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const fetchCategoryCounts = async () => {
    try {
      const counts: Record<string, number> = {};

      // Fetch All Companies count (not deleted)
      const { count: companiesCount } = await supabase
        .from("companies")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null);
      counts.companies = companiesCount || 0;

      // Fetch Facebook Data count
      const { count: facebookCount } = await (supabase
        .from("facebook_data" as any)
        .select("*", { count: "exact", head: true }) as any);
      counts.facebook = facebookCount || 0;

      // Fetch pending Data Requests count
      const { count: dataRequestsCount } = await supabase
        .from("data_requests")
        .select("*", { count: "exact", head: true });
      counts.requests = dataRequestsCount || 0;

      // Fetch pending Edit Requests count
      const { count: editRequestsCount } = await (supabase
        .from("facebook_data_edit_requests" as any)
        .select("*", { count: "exact", head: true })
        .eq("status", "pending") as any);
      counts["edit-requests"] = editRequestsCount || 0;

      // Fetch Recycle Bin count (deleted companies)
      const { count: recycleCount } = await supabase
        .from("companies")
        .select("*", { count: "exact", head: true })
        .not("deleted_at", "is", null);
      counts.recycle = recycleCount || 0;

      // Fetch pending company approvals count
      try {
        const { count: approvalCount } = await (supabase
          .from("companies" as any)
          .select("*", { count: "exact", head: true })
          .eq("approval_status", "pending")
          .is("deleted_at", null) as any);
        counts["approvals"] = approvalCount || 0;
      } catch (err) {
        counts["approvals"] = 0;
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
  }, []);

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

  const handleLoginAsUser = async (userId: string, userRole: "employee" | "team_lead", userName: string) => {
    // Fetch the user profile to create a mock User object
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!profile) {
      toast.error("User profile not found");
      return;
    }

    setImpersonatedUser({
      id: userId,
      role: userRole,
      name: userName,
      email: profile.email || "",
    });
    setCurrentView(""); // Clear current view when impersonating
  };

  const handleReturnToAdmin = () => {
    setImpersonatedUser(null);
    setCurrentView("companies");
    toast.success("Returned to Admin Dashboard");
  };

  const menuItems = [
    { id: "companies", label: "All Companies", icon: Building2, count: categoryCounts.companies },
    { id: "add", label: "Add Company", icon: Plus },
    { id: "approvals", label: "Company Approvals", icon: FileCheck, count: categoryCounts.approvals },
    { id: "assign", label: "Assign Data", icon: UserCog },
    { id: "facebook", label: "Facebook Data", icon: Share2, count: categoryCounts.facebook },
    { id: "employees", label: "Employee Management", icon: Users },
    { id: "teams", label: "Team Creation", icon: UserPlus },
    { id: "view-users", label: "View Users", icon: LogIn },
    { id: "requests", label: "Data Requests", icon: MessageSquare, count: categoryCounts.requests },
    { id: "edit-requests", label: "Edit Requests", icon: Pencil, count: categoryCounts["edit-requests"] },
    { id: "holidays", label: "Holidays", icon: CalendarDays },
    { id: "recycle", label: "Recycle Bin", icon: Trash2, count: categoryCounts.recycle },
  ];

  // If impersonating, show the appropriate dashboard
  if (impersonatedUser) {
    // Create a mock User object for the impersonated user
    const mockUser: User = {
      id: impersonatedUser.id,
      email: impersonatedUser.email,
      created_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      confirmation_sent_at: null,
      recovery_sent_at: null,
      email_confirmed_at: null,
      invited_at: null,
      action_link: "",
      phone: null,
      confirmed_at: null,
      last_sign_in_at: null,
      role: "",
      updated_at: new Date().toISOString(),
    };

    return (
      <div className="min-h-screen bg-background">
        {/* Return to Admin Banner */}
        <div className="bg-primary/10 border-b border-primary/20 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 rounded-full p-2">
              <LogIn className="h-4 w-4 text-primary text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground ">
                Viewing as: <span className="text-primary text-white">{impersonatedUser.name}</span>
              </p>
              <p className="text-xs text-muted-foreground text-white">
                {impersonatedUser.role === "employee" ? "Employee Dashboard" : "Team Lead Dashboard"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReturnToAdmin}
            className="flex items-center gap-2 text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Admin
          </Button>
        </div>

        {/* Render the appropriate dashboard */}
        {impersonatedUser.role === "employee" ? (
          <EmployeeDashboard user={mockUser} />
        ) : (
          <TeamLeadDashboard user={mockUser} />
        )}
      </div>
    );
  }

  return (
    <DashboardLayout
      menuItems={menuItems}
      currentView={currentView}
      onViewChange={setCurrentView}
      user={user}
      onLogout={handleLogout}
    >
      {currentView === "companies" && <AllCompaniesView userRole="admin" />}
      {currentView === "add" && <AddNewDataView userId={user.id} userRole="admin" />}
      {currentView === "approvals" && <CompanyApprovalView />}
      {currentView === "assign" && <AdminDataAssignmentView />}
      {currentView === "facebook" && <FacebookDataView userId={user.id} userRole="admin" />}
      {currentView === "employees" && <EmployeeManagementView />}
      {currentView === "teams" && <TeamCreationView />}
      {currentView === "view-users" && (
        <UserImpersonationView onLoginAsUser={handleLoginAsUser} />
      )}
      {currentView === "requests" && <DataRequestsView />}
      {currentView === "edit-requests" && <EditRequestsView />}
      {currentView === "holidays" && <HolidaysView />}
      {currentView === "recycle" && <RecycleBinView userRole="admin" />}
    </DashboardLayout>
  );
};

export default AdminDashboard;
