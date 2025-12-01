import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const AdminDataAssignmentView = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch all employees and team leads
    const { data: employeesData } = await supabase
      .from("profiles")
      .select("*, user_roles(role)")
      .in("user_roles.role", ["employee", "team_lead"]);

    if (employeesData) {
      setEmployees(employeesData);
    }

    // Fetch unassigned companies
    const { data: companiesData } = await supabase
      .from("companies")
      .select("*")
      .is("assigned_to_id", null)
      .is("deleted_at", null);

    if (companiesData) {
      setCompanies(companiesData);
    }
  };

  const handleAssign = async () => {
    if (!selectedCompany || !selectedEmployee) {
      toast.error("Please select both company and employee");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ assigned_to_id: selectedEmployee })
        .eq("id", selectedCompany);

      if (error) throw error;

      toast.success("Company assigned successfully!");
      setSelectedCompany("");
      setSelectedEmployee("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to assign company");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-white">Assign Data to Employees</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Assign Company</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-white">
            <label className="text-sm font-medium text-black/80">Select Company</label>
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

          <div className="space-y-2 text-white">
            <label className="text-sm font-medium text-black/80">Select Employee/Team Lead</label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an employee or team lead" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.display_name} ({employee.user_roles?.[0]?.role || 'No Role'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleAssign} className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign Company"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDataAssignmentView;
