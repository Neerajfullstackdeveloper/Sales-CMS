import { User } from "@supabase/supabase-js";
import { useState } from "react";
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

interface EmployeeDashboardProps {
  user: User;
}

const EmployeeDashboard = ({ user }: EmployeeDashboardProps) => {
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
      {currentView === "today" && <TodayDataView userId={user.id} userRole="employee" />}
      {currentView === "followup" && <FollowUpDataView userId={user.id} userRole="employee" />}
      {currentView === "hot" && <HotDataView userId={user.id} userRole="employee" />}
      {currentView === "block" && <BlockDataView userId={user.id} userRole="employee" />}
      {currentView === "general" && <GeneralDataView userId={user.id} userRole="employee" />}
      {currentView === "add" && <AddNewDataView userId={user.id} />}
      {currentView === "request" && <RequestDataView userId={user.id} />}
    </DashboardLayout>
  );
};

export default EmployeeDashboard;
