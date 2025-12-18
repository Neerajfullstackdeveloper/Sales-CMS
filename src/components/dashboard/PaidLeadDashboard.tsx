import { User } from "@supabase/supabase-js";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DollarSign, Globe, Smile, Frown, Meh, MessageCircle } from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import PaidClientPoolView from "./views/PaidClientPoolView";
import { supabase } from "@/integrations/supabase/client";

interface PaidLeadDashboardProps {
  user: User;
}

const PaidLeadDashboard = ({ user }: PaidLeadDashboardProps) => {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState("paid-clients");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const menuItems = [
    { id: "paid-clients", label: "Paid Clients", icon: DollarSign },
    { id: "web-seo", label: "Web/SEO", icon: Globe },
    { id: "satisfied", label: "Satisfied", icon: Smile },
    { id: "dissatisfied", label: "Dissatisfied", icon: Frown },
    { id: "average", label: "Average", icon: Meh },
    { id: "no-response", label: "No Response", icon: MessageCircle },
  ];

  return (
    <DashboardLayout
      menuItems={menuItems}
      currentView={currentView}
      onViewChange={setCurrentView}
      user={user}
      userName={user.email?.split("@")[0] || "Team Lead"}
      onLogout={handleLogout}
    >
      {currentView === "paid-clients" && <PaidClientPoolView userRole="paid_team_lead" defaultTab="all" />}
      {currentView === "web-seo" && <PaidClientPoolView userRole="paid_team_lead" defaultTab="completed" />}
      {currentView === "satisfied" && <PaidClientPoolView userRole="paid_team_lead" defaultTab="satisfied" />}
      {currentView === "dissatisfied" && <PaidClientPoolView userRole="paid_team_lead" defaultTab="dissatisfied" />}
      {currentView === "average" && <PaidClientPoolView userRole="paid_team_lead" defaultTab="average" />}
      {currentView === "no-response" && <PaidClientPoolView userRole="paid_team_lead" defaultTab="no-response" />}
    </DashboardLayout>
  );
};

export default PaidLeadDashboard;

