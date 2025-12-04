import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AddNewDataViewProps {
  userId: string;
  userRole?: string;
}

const AddNewDataView = ({ userId, userRole }: AddNewDataViewProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: "",
    owner_name: "",
    phone: "",
    email: "",
    address: "",
    products_services: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check for duplicate company before inserting
      // A duplicate is defined as: same company_name AND same phone
      // Also check email if provided (case-insensitive)
      const trimmedCompanyName = formData.company_name.trim();
      const trimmedPhone = formData.phone.trim();
      const trimmedEmail = formData.email?.trim() || "";

      // First check: company_name + phone match
      const duplicateQuery = supabase
        .from("companies")
        .select("id, company_name, phone, email")
        .eq("company_name", trimmedCompanyName)
        .eq("phone", trimmedPhone)
        .is("deleted_at", null);

      const { data: existingCompanies, error: checkError } = await duplicateQuery;

      if (checkError) {
        throw checkError;
      }

      // If we found a match with company_name + phone, it's a duplicate
      if (existingCompanies && existingCompanies.length > 0) {
        // If email is also provided, verify it matches too
        if (trimmedEmail) {
          const emailMatch = existingCompanies.some(
            (company) => company.email && 
            company.email.toLowerCase().trim() === trimmedEmail.toLowerCase()
          );
          
          if (emailMatch) {
            toast.error("This company already exists in the database. The company name, phone number, and email match an existing entry.");
            setLoading(false);
            return;
          }
        } else {
          toast.error("This company already exists in the database. The company name and phone number match an existing entry.");
          setLoading(false);
          return;
        }
      }

      // Additional check: if email is provided, also check for email-only duplicates
      // (in case someone enters same email with different company name/phone)
      if (trimmedEmail) {
        const emailDuplicateQuery = supabase
          .from("companies")
          .select("id, company_name, phone, email")
          .ilike("email", trimmedEmail)
          .is("deleted_at", null);

        const { data: emailMatches, error: emailCheckError } = await emailDuplicateQuery;

        if (!emailCheckError && emailMatches && emailMatches.length > 0) {
          // Check if it's the same company (same name or phone)
          const isSameCompany = emailMatches.some(
            (company) => 
              (company.company_name && company.company_name.trim().toLowerCase() === trimmedCompanyName.toLowerCase()) ||
              (company.phone && company.phone.trim() === trimmedPhone)
          );

          if (isSameCompany) {
            toast.error("This company already exists in the database. The email address matches an existing entry.");
            setLoading(false);
            return;
          }
        }
      }

      // No duplicate found, proceed with insertion
      // If created by employee, set approval_status to 'pending'
      // If created by admin, leave approval_status as NULL (no approval needed)
      const insertData: any = {
        ...formData,
        created_by_id: userId,
        assigned_to_id: null, // Company is not assigned until admin assigns it
      };

      // Set approval_status to 'pending' if created by employee or team_lead
      const needsApproval = userRole === "employee" || userRole === "team_lead";
      if (needsApproval) {
        insertData.approval_status = "pending";
      }

      let { error } = await supabase.from("companies").insert([insertData]);

      // If error is due to missing approval_status column, retry without it
      if (error && (error.message?.includes("approval_status") || error.message?.includes("column") || error.code === "42703")) {
        console.warn("approval_status column not found, inserting without it. Please run the migration.");
        // Remove approval_status and retry
        delete insertData.approval_status;
        const retryResult = await supabase.from("companies").insert([insertData]);
        error = retryResult.error;
        
        if (!error) {
          toast.warning("Company added, but approval system is not set up. Please run the database migration.");
        }
      }

      if (error) throw error;

      if (needsApproval && insertData.approval_status) {
        toast.success("Company added successfully! It is pending admin approval.");
      } else {
        toast.success("Company added successfully! It will be assigned by an admin.");
      }
      setFormData({
        company_name: "",
        owner_name: "",
        phone: "",
        email: "",
        address: "",
        products_services: "",
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to add company");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-white">Add New Company</h2>
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2 ">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) =>
                  setFormData({ ...formData, company_name: e.target.value })
                 
                }
                 className="text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_name">Owner Name *</Label>
              <Input
                id="owner_name"
                value={formData.owner_name}
                onChange={(e) =>
                  setFormData({ ...formData, owner_name: e.target.value })
                }
                   className="text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                   className="text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                   className="text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                className="text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="products_services">Products & Services</Label>
              <Textarea
                id="products_services"
                value={formData.products_services}
                onChange={(e) =>
                  setFormData({ ...formData, products_services: e.target.value })
                }
                className="text-white"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Company"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddNewDataView;
