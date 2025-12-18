import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, User, Building2, Mail, Phone, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface EmployeeInfo {
  id: string;
  name: string | null;
  email: string | null;
}

interface SearchResult {
  id: string | number;
  type: "company" | "facebook";
  company_name?: string;
  name?: string;
  email: string | null;
  phone: string | null;
  owner_name?: string | null;
  assigned_to_id: string | null;
  employee_name?: string;
  employee_email?: string;
  employees?: EmployeeInfo[]; // Multiple employees who have this data
}

const SearchDataView = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [companiesFoundButFiltered, setCompaniesFoundButFiltered] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setSearchResults([]);

    try {
      const query = searchQuery.trim().toLowerCase();
      const results: SearchResult[] = [];

      // Search in companies table - search ALL companies regardless of assignment
      // Include owner_name in the search query
      // Try multiple search approaches to ensure we find all matches
      let companies: any[] | null = null;
      let companiesError: any = null;
      
      // Approach 1: Standard .or() query
      const { data: companiesData1, error: error1 } = await supabase
        .from("companies")
        .select(`
          id,
          company_name,
          email,
          phone,
          owner_name,
          assigned_to_id
        `)
        .is("deleted_at", null)
        .or(`company_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,owner_name.ilike.%${query}%`);
      
      companies = companiesData1;
      companiesError = error1;
      
      // Approach 2: If we got results but want to be thorough, also try searching each field separately
      // This helps catch cases where .or() might miss due to RLS or other issues
      if (!companiesError && companies) {
        console.log(`✅ Primary search found ${companies.length} companies`);
        
        // Try individual field searches as a backup to catch any missed results
        const [nameResults, emailResults, phoneResults, ownerResults] = await Promise.all([
          supabase.from("companies").select("id, company_name, email, phone, owner_name, assigned_to_id").is("deleted_at", null).ilike("company_name", `%${query}%`),
          supabase.from("companies").select("id, company_name, email, phone, owner_name, assigned_to_id").is("deleted_at", null).ilike("email", `%${query}%`),
          supabase.from("companies").select("id, company_name, email, phone, owner_name, assigned_to_id").is("deleted_at", null).ilike("phone", `%${query}%`),
          supabase.from("companies").select("id, company_name, email, phone, owner_name, assigned_to_id").is("deleted_at", null).ilike("owner_name", `%${query}%`),
        ]);
        
        // Combine all results
        const allCompanyIds = new Set(companies.map((c: any) => c.id));
        
        [nameResults.data, emailResults.data, phoneResults.data, ownerResults.data].forEach((data: any) => {
          if (data) {
            data.forEach((company: any) => {
              if (!allCompanyIds.has(company.id)) {
                allCompanyIds.add(company.id);
                companies!.push(company);
              }
            });
          }
        });
        
        if (companies.length > (companiesData1?.length || 0)) {
          console.log(`✅ Found ${companies.length - (companiesData1?.length || 0)} additional companies with individual field searches`);
        }
      }

      if (companiesError) {
        console.error("Error searching companies:", companiesError);
        console.error("Full error details:", JSON.stringify(companiesError, null, 2));
        toast.error("Error searching companies");
      } else if (companies) {
        // Check if we got 0 results - might be RLS filtering
        if (companies.length === 0) {
          console.warn(`⚠️ No companies found for query "${query}". This might be due to RLS policies filtering results.`);
          console.warn("💡 Tip: Employees may only see companies assigned to them. Team leads/admins can see all companies.");
          console.warn("💡 Note: Facebook data search works because it has different RLS policies that allow cross-employee visibility.");
          console.warn("💡 Solution: Update RLS policies for 'companies' table to allow employees to search all companies (similar to facebook_data).");
          // Set flag to show helpful message in UI
          setCompaniesFoundButFiltered(true);
        } else {
          setCompaniesFoundButFiltered(false);
        }
        console.log(`🔍 Found ${companies.length} companies matching search query: "${query}"`);
        console.log("📋 Companies details:", companies.map((c: any) => ({
          id: c.id,
          name: c.company_name,
          assigned_to_id: c.assigned_to_id,
          email: c.email,
          phone: c.phone,
          owner_name: c.owner_name
        })));
        
        // Check if we're missing companies - log all unique assigned_to_ids found
        const foundAssignedIds = companies
          .filter((c: any) => c.assigned_to_id)
          .map((c: any) => c.assigned_to_id);
        const uniqueFoundIds = Array.from(new Set(foundAssignedIds));
        console.log(`👥 Found companies assigned to ${uniqueFoundIds.length} different employee(s):`, uniqueFoundIds);
        
        // Get all unique assigned_to_ids
        const assignedToIds = companies
          .filter((c: any) => c.assigned_to_id)
          .map((c: any) => c.assigned_to_id);
        const uniqueAssignedToIds = Array.from(new Set(assignedToIds));
        
        console.log(`👥 Found ${uniqueAssignedToIds.length} unique assigned employees:`, uniqueAssignedToIds);
        
        // Fetch employee profiles separately (more reliable than joins with RLS)
        let employeeProfilesMap = new Map<string, EmployeeInfo>();
        if (uniqueAssignedToIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, display_name, email")
            .in("id", uniqueAssignedToIds);
          
          if (profilesError) {
            console.warn("Error fetching employee profiles:", profilesError);
          } else if (profiles) {
            console.log(`✅ Fetched ${profiles.length} employee profiles:`, profiles.map((p: any) => ({
              id: p.id,
              name: p.display_name,
              email: p.email
            })));
            profiles.forEach((profile: any) => {
              employeeProfilesMap.set(profile.id, {
                id: profile.id,
                name: profile.display_name || null,
                email: profile.email || null,
              });
            });
          }
        }
        
        // Group companies by company name (normalized) to show all employees who have the same data
        // Use a more flexible grouping - primarily by company name
        const companyMap = new Map<string, {
          company: any;
          employees: EmployeeInfo[];
          allCompanyIds: string[];
        }>();

        companies.forEach((company: any) => {
          // Normalize company name for grouping (trim, lowercase)
          const normalizedName = (company.company_name || '').trim().toLowerCase();
          
          // Use company name as primary key, but also consider email/phone if name is empty
          const key = normalizedName || `${company.email || ''}_${company.phone || ''}`.toLowerCase();
          
          if (!companyMap.has(key)) {
            companyMap.set(key, {
              company: company,
              employees: [],
              allCompanyIds: []
            });
          }

          const entry = companyMap.get(key)!;
          
          // Track all company IDs with this name
          if (!entry.allCompanyIds.includes(company.id)) {
            entry.allCompanyIds.push(company.id);
          }
          
          // Add employee if assigned (use the profile map we fetched)
          if (company.assigned_to_id) {
            console.log(`  Processing company ${company.id}: assigned_to_id = ${company.assigned_to_id}`);
            const employeeProfile = employeeProfilesMap.get(company.assigned_to_id);
            if (employeeProfile) {
              console.log(`    Found employee profile: ${employeeProfile.name} (${employeeProfile.id})`);
              const employeeExists = entry.employees.some(emp => emp.id === company.assigned_to_id);
              if (!employeeExists) {
                entry.employees.push(employeeProfile);
                console.log(`    Added employee to group. Total employees now: ${entry.employees.length}`);
              } else {
                console.log(`    Employee already exists in group`);
              }
            } else {
              console.warn(`    ⚠️ No employee profile found for assigned_to_id: ${company.assigned_to_id}`);
            }
          } else {
            console.log(`  Company ${company.id} has no assigned_to_id`);
          }
        });

        console.log(`📊 Grouped into ${companyMap.size} unique companies`);
        companyMap.forEach((entry, key) => {
          console.log(`  - "${entry.company.company_name}": ${entry.employees.length} employee(s)`, entry.employees.map(e => e.name));
        });

        // Convert map to results
        companyMap.forEach((entry, key) => {
          const company = entry.company;
          results.push({
            id: company.id,
            type: "company",
            company_name: company.company_name,
            email: company.email,
            phone: company.phone,
            owner_name: company.owner_name,
            assigned_to_id: entry.employees.length > 0 ? entry.employees[0].id : null,
            employee_name: entry.employees.length > 0 ? entry.employees[0].name || null : null,
            employee_email: entry.employees.length > 0 ? entry.employees[0].email || null : null,
            employees: entry.employees.length > 0 ? entry.employees : undefined,
          });
        });
      }

      // Search in facebook_data table
      const { data: facebookData, error: facebookError } = await (supabase
        .from("facebook_data" as any)
        .select(`
          id,
          email,
          phone,
          company_name,
          owner_name,
          deletion_state
        `)
        .is("deletion_state", null)
        .or(`email.ilike.%${query}%,phone.ilike.%${query}%,company_name.ilike.%${query}%,owner_name.ilike.%${query}%`) as any);

      if (facebookError) {
        console.error("Error searching Facebook data:", facebookError);
        toast.error("Error searching Facebook data");
      } else if (facebookData) {
        // For Facebook data, we need to find which employees have it shared
        // Use all Facebook data that matched the Supabase query (already filtered)
        const fbIds = facebookData.map((fb: any) => fb.id);

        if (fbIds.length > 0) {
          // Get shares for these Facebook data items - try multiple FK approaches
          let shares: any[] = [];
          let sharesError: any = null;

          // First try with the standard FK
          const { data: sharesData1, error: error1 } = await (supabase
            .from("facebook_data_shares" as any)
            .select(`
              facebook_data_id,
              employee_id
            `)
            .in("facebook_data_id", fbIds) as any);

          if (error1) {
            console.warn("Error fetching shares (method 1):", error1);
            sharesError = error1;
          } else if (sharesData1) {
            shares = sharesData1;
          }

          // Build employee map
          const fbEmployeeMap: Record<number, any[]> = {};
          const employeeIds = new Set<string>();

          if (shares && shares.length > 0) {
            shares.forEach((share: any) => {
              if (!fbEmployeeMap[share.facebook_data_id]) {
                fbEmployeeMap[share.facebook_data_id] = [];
              }
              if (share.employee_id) {
                employeeIds.add(share.employee_id);
                fbEmployeeMap[share.facebook_data_id].push({
                  id: share.employee_id,
                  display_name: null, // Will be filled from profiles
                  email: null,
                });
              }
            });

            // Fetch all employee profiles separately (more reliable than joins)
            if (employeeIds.size > 0) {
              const { data: profiles, error: profilesError } = await supabase
                .from("profiles")
                .select("id, display_name, email")
                .in("id", Array.from(employeeIds));

              if (profilesError) {
                console.warn("Error fetching profiles:", profilesError);
              } else if (profiles) {
                // Create profile map
                const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

                // Update employee map with profile data
                Object.keys(fbEmployeeMap).forEach((fbIdStr) => {
                  const fbId = parseInt(fbIdStr);
                  fbEmployeeMap[fbId] = fbEmployeeMap[fbId].map((emp: any) => {
                    const profile = profileMap.get(emp.id);
                    return profile || emp;
                  });
                });
              }
            }
          }

          console.log("Facebook shares lookup:", {
            fbIdsCount: fbIds.length,
            sharesCount: shares.length,
            employeeMapSize: Object.keys(fbEmployeeMap).length,
            sampleMap: Object.keys(fbEmployeeMap).slice(0, 3).reduce((acc: any, key) => {
              acc[key] = fbEmployeeMap[parseInt(key)];
              return acc;
            }, {})
          });

          // Add Facebook data results - group by data and show all employees
          // Group Facebook data by their identifying information to show all employees together
          const fbDataMap = new Map<number, {
            fb: any;
            employees: EmployeeInfo[];
          }>();

          facebookData.forEach((fb: any) => {
            const employees = fbEmployeeMap[fb.id] || [];
            console.log(`Facebook data ${fb.id} employees:`, employees);
            
            if (!fbDataMap.has(fb.id)) {
              fbDataMap.set(fb.id, {
                fb: fb,
                employees: []
              });
            }

            const entry = fbDataMap.get(fb.id)!;
            
            // Add all employees who have this Facebook data
            employees.forEach((employee: any) => {
              if (employee && employee.id) {
                const employeeExists = entry.employees.some(emp => emp.id === employee.id);
                if (!employeeExists) {
                  entry.employees.push({
                    id: employee.id,
                    name: employee.display_name || null,
                    email: employee.email || null,
                  });
                }
              }
            });
          });

          // Convert map to results
          fbDataMap.forEach((entry, fbId) => {
            const fb = entry.fb;
            results.push({
              id: fb.id,
              type: "facebook",
              company_name: fb.company_name,
              email: fb.email,
              phone: fb.phone,
              owner_name: fb.owner_name,
              assigned_to_id: entry.employees.length > 0 ? entry.employees[0].id : null,
              employee_name: entry.employees.length > 0 ? entry.employees[0].name || null : null,
              employee_email: entry.employees.length > 0 ? entry.employees[0].email || null : null,
              employees: entry.employees.length > 0 ? entry.employees : undefined,
            });
          });
        }
      }

      setSearchResults(results);
      
      if (results.length === 0) {
        // Check if we found companies/facebook data but they were filtered
        const foundCompanies = companies && companies.length > 0;
        const foundFacebook = facebookData && facebookData.length > 0;
        
        if (foundCompanies || foundFacebook) {
          toast.warning("Found data but no results to display. This might be due to access restrictions.");
        } else {
          toast.info("No results found. Try a different search term.");
        }
      } else {
        toast.success(`Found ${results.length} result(s)`);
      }
    } catch (error: any) {
      console.error("Error in search:", error);
      toast.error(error.message || "Error performing search");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Search className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Search Data</h2>
          <p className="text-sm text-muted-foreground mt-1 text-white">
            Search by company name, email, or phone number
          </p>
        </div>
      </div>

      <Card className="shadow-lg border-2">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold text-black/80">Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Enter company name, email, or phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 text-white placeholder:text-white/50 h-11"
            />
            <Button onClick={handleSearch} disabled={loading || !searchQuery.trim()} className="h-11 px-6">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasSearched && (
        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </Card>
          ) : searchResults.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No results found</h3>
                {companiesFoundButFiltered ? (
                  <div className="text-sm text-muted-foreground text-center space-y-2 max-w-md">
                    <p>
                      The search didn't find any companies matching "{searchQuery}".
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Note: If this data exists but is assigned to another employee, 
                      you may not be able to see it due to access restrictions. 
                      Team leads and admins can search all companies.
                    </p>
                    <p className="text-xs">
                      Facebook data search works differently and shows all employees who have the data.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center">
                    Try searching with a different term
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground text-white">
                  Found {searchResults.length} result(s)
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {searchResults.map((result) => (
                  <Card key={result.id} className="hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/50 h-full flex flex-col">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-3">
                            {result.type === "company" ? (
                              <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
                            ) : (
                              <User className="h-5 w-5 text-blue-500 flex-shrink-0" />
                            )}
                            <Badge variant={result.type === "company" ? "default" : "secondary"} className="text-xs">
                              {result.type === "company" ? "Company" : "Facebook Data"}
                            </Badge>
                          </div>
                          <CardTitle className="text-lg font-bold leading-tight mb-2 line-clamp-2">
                            {result.type === "company" ? result.company_name : result.name || result.company_name}
                          </CardTitle>
                          {result.owner_name && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                              Owner: {result.owner_name}
                            </p>
                          )}
                          {(result.email || result.phone) && (
                            <div className="mt-3 space-y-1.5">
                              {result.email && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground truncate">{result.email}</span>
                                </div>
                              )}
                              {result.phone && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground">{result.phone}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 pb-5 space-y-3 flex-1 flex flex-col">
                      {result.employees && result.employees.length > 0 ? (
                        <div className="pt-4 border-t space-y-2.5 flex-1">
                          <p className="text-sm font-semibold text-primary mb-2">
                            Assigned to {result.employees.length} employee{result.employees.length > 1 ? 's' : ''}:
                          </p>
                          <div className="space-y-2">
                            {result.employees.map((employee, index) => (
                              <div key={employee.id} className="flex items-center gap-2.5 p-2 rounded-md bg-muted/50">
                                <User className="h-4 w-4 text-primary flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-primary truncate">
                                    {employee.name || 'Unknown'}
                                  </p>
                                  {employee.email && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {employee.email}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : result.assigned_to_id && result.employee_name ? (
                        <div className="pt-4 border-t flex-1">
                          <div className="flex items-center gap-2.5 p-2 rounded-md bg-muted/50">
                            <User className="h-4 w-4 text-primary flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-primary truncate">
                                Assigned to: {result.employee_name}
                              </p>
                              {result.employee_email && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {result.employee_email}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-4 border-t flex-1 flex items-center">
                          <p className="text-sm text-muted-foreground">
                            Not assigned to any employee
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchDataView;

