import { User } from "@supabase/supabase-js";
import { useState } from "react";
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
  Users,
  UserPlus,
  BarChart3,
  Trash2,
} from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import AssignedDataView from "./views/AssignedDataView";
import TodayDataView from "./views/TodayDataView";
import FollowUpDataView from "./views/FollowUpDataView";
import HotDataView from "./views/HotDataView";
import BlockDataView from "./views/BlockDataView";
import GeneralDataView from "./views/GeneralDataView";
import AddNewDataView from "./views/AddNewDataView";
import RequestDataView from "./views/RequestDataView";
import TeamManagementView from "./views/TeamManagementView";
import DataAssignmentView from "./views/DataAssignmentView";
import EmployeeDataOverviewView from "./views/EmployeeDataOverviewView";
import RecycleBinView from "./views/RecycleBinView";

interface TeamLeadDashboardProps {
  user: User;
}

const TeamLeadDashboard = ({ user }: TeamLeadDashboardProps) => {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState("assigned");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const menuItems = [
    { id: "assigned", label: "Assigned Data", icon: LayoutDashboard },
    { id: "today", label: "Today Data", icon: Calendar },
    { id: "followup", label: "Follow Up Data", icon: TrendingUp },
    { id: "hot", label: "Hot Data", icon: Flame },
    { id: "block", label: "Block Data", icon: Ban },
    { id: "general", label: "General Data", icon: Database },
    { id: "add", label: "Add New Data", icon: Plus },
    { id: "request", label: "Request Data", icon: MessageSquarePlus },
    { id: "team", label: "Team Management", icon: Users },
    { id: "assign", label: "Assign Data", icon: UserPlus },
    { id: "overview", label: "Data Overview", icon: BarChart3 },
    { id: "recycle", label: "Recycle Bin", icon: Trash2 },
  ];

  return (
    <DashboardLayout
      menuItems={menuItems}
      currentView={currentView}
      onViewChange={setCurrentView}
      user={user}
      onLogout={handleLogout}
    >
      {currentView === "assigned" && <AssignedDataView userId={user.id} userRole="team_lead" />}
      {currentView === "today" && <TodayDataView userId={user.id} userRole="team_lead" />}
      {currentView === "followup" && <FollowUpDataView userId={user.id} userRole="team_lead" />}
      {currentView === "hot" && <HotDataView userId={user.id} userRole="team_lead" />}
      {currentView === "block" && <BlockDataView userId={user.id} userRole="team_lead" />}
      {currentView === "general" && <GeneralDataView userId={user.id} userRole="team_lead" />}
      {currentView === "add" && <AddNewDataView userId={user.id} />}
      {currentView === "request" && <RequestDataView userId={user.id} />}
      {currentView === "team" && <TeamManagementView userId={user.id} />}
      {currentView === "assign" && <DataAssignmentView userId={user.id} />}
      {currentView === "overview" && <EmployeeDataOverviewView userId={user.id} />}
      {currentView === "recycle" && <RecycleBinView userRole="team_lead" />}
    </DashboardLayout>
  );
};

export default TeamLeadDashboard;
