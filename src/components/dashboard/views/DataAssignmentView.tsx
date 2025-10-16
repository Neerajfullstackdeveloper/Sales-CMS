import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface DataAssignmentViewProps {
  userId: string;
}

const DataAssignmentView = ({ userId }: DataAssignmentViewProps) => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [assignees, setAssignees] = useState<any[]>([]); // TL + members
  const [teamLeadProfile, setTeamLeadProfile] = useState<any>(null);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedMember, setSelectedMember] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    // Get TL's team
    const { data: teamData } = await supabase
      .from("teams")
      .select("id")
      .eq("team_lead_id", userId)
      .single();

    if (!teamData) {
      setCompanies([]);
      setMembers([]);
      setAssignees([]);
      return;
    }

    // Get team members
    const { data: membersData } = await supabase
      .from("team_members")
      .select("*, employee:profiles!employee_id(*)")
      .eq("team_id", teamData.id);

    if (membersData) {
      setMembers(membersData);
    }

    // Get TL profile for display name
    const { data: tlProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (tlProfile) {
      setTeamLeadProfile(tlProfile);
    }

    // Build assignees list (TL + members)
    const combinedAssignees = [
      ...(tlProfile ? [{ id: userId, display_name: tlProfile.display_name, isTL: true }] : []),
      ...((membersData || []).map((m) => ({ id: m.employee_id, display_name: m.employee.display_name, isTL: false })))
    ];
    setAssignees(combinedAssignees);

    // Fetch companies assigned to TL or any team member
    const memberIds = (membersData || []).map((m) => m.employee_id);
    const assigneeIds = [userId, ...memberIds];
    const { data: companiesData } = await supabase
      .from("companies")
      .select("*")
      .in("assigned_to_id", assigneeIds)
      .is("deleted_at", null);

    if (companiesData) {
      setCompanies(companiesData);
    }
  };

  const handleAssign = async () => {
    if (!selectedCompany || !selectedMember) {
      toast.error("Please select both company and member");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ assigned_to_id: selectedMember })
        .eq("id", selectedCompany);

      if (error) throw error;

      toast.success("Company assigned successfully!");
      setSelectedCompany("");
      setSelectedMember("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to assign company");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">Reassign Data Within Team</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Reassign Company to Team Member</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Company (Already Assigned to Team)</label>
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Select Assignee</label>
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a team member" />
              </SelectTrigger>
              <SelectContent>
                {assignees.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.display_name}{person.isTL ? " (You)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={handleAssign} className="w-full" disabled={loading || !selectedCompany || !selectedMember}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              "Reassign Company"
            )}
            </Button>

            <Button
              variant="secondary"
              onClick={async () => {
                if (!selectedCompany) {
                  toast.error("Please select a company first");
                  return;
                }
                setSelectedMember(userId);
                setLoading(true);
                try {
                  const { error } = await supabase
                    .from("companies")
                    .update({ assigned_to_id: userId })
                    .eq("id", selectedCompany);
                  if (error) throw error;
                  toast.success("Assigned to you");
                  setSelectedCompany("");
                  setSelectedMember("");
                  fetchData();
                } catch (error: any) {
                  toast.error(error.message || "Failed to assign to self");
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full"
              disabled={loading || !selectedCompany}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                teamLeadProfile ? `Assign to ${teamLeadProfile.display_name}` : "Assign to me"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataAssignmentView;
