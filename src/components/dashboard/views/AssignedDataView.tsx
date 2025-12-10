


import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CompanyCard from "@/components/CompanyCard";
import FacebookDataCard from "./FacebookDataCard";
import { Loader2, UserCheck, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface AssignedDataViewProps {
  userId: string;
  userRole?: string;
}

const AssignedDataView = ({ userId, userRole }: AssignedDataViewProps) => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [facebookData, setFacebookData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let hasFetched = false;
    
    const loadAndRefresh = async () => {
      // Show cached data immediately for faster perceived performance
      const stored = localStorage.getItem(`assignedData_${userId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.companies && parsed?.facebookData && parsed?.timestamp) {
            const cacheAge = Date.now() - parsed.timestamp;
            // Use cache if less than 2 minutes old
            if (cacheAge < 120000) {
              if (isMounted) {
                setCompanies(parsed.companies || []);
                setFacebookData(parsed.facebookData || []);
                setLoading(false);
              }
              // Only refresh in background if tab is visible and not recently fetched
              if (document.visibilityState === "visible" && !hasFetched) {
                hasFetched = true;
                fetchAssignedData().finally(() => {
                  hasFetched = false;
                });
              }
              return;
            }
          }
        } catch {}
      }

      // Fetch fresh data only if not already fetched
      if (!hasFetched && isMounted) {
        hasFetched = true;
        await fetchAssignedData();
        hasFetched = false;
      }
    };

    loadAndRefresh();

    // Handle visibility change - refresh when tab becomes visible to catch new assignments
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isMounted) {
        const stored = localStorage.getItem(`assignedData_${userId}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed?.timestamp) {
              const cacheAge = Date.now() - parsed.timestamp;
              // Refresh if cache is older than 30 seconds (more aggressive refresh)
              // This ensures newly assigned data appears when user switches back to tab
              if (cacheAge > 30000) {
                if (!hasFetched) {
                  hasFetched = true;
                  console.log("🔄 AssignedDataView - Tab became visible, refreshing data (cache age:", (cacheAge / 1000).toFixed(0), "seconds)");
                  fetchAssignedData().finally(() => {
                    hasFetched = false;
                  });
                }
              }
            } else {
              // No cache, fetch fresh data
              if (!hasFetched) {
                hasFetched = true;
                fetchAssignedData().finally(() => {
                  hasFetched = false;
                });
              }
            }
          } catch {
            // If cache is corrupted, fetch fresh data
            if (!hasFetched) {
              hasFetched = true;
              fetchAssignedData().finally(() => {
                hasFetched = false;
              });
            }
          }
        } else {
          // No cache, fetch fresh data
          if (!hasFetched) {
            hasFetched = true;
            fetchAssignedData().finally(() => {
              hasFetched = false;
            });
          }
        }
      }
    };

    // Listen for data update events to refresh when companies or Facebook data are assigned
    const handleCompanyDataUpdate = () => {
      console.log("🔄 AssignedDataView - Received companyDataUpdated event, refreshing...", {
        userId,
        isMounted,
        hasFetched
      });
      // Clear cache and refresh immediately when data is updated
      localStorage.removeItem(`assignedData_${userId}`);
      // Force refresh even if currently fetching
      if (isMounted) {
        hasFetched = true;
        // Add a longer delay to ensure database update is committed and visible
        // Also try multiple times to handle potential race conditions
        setTimeout(() => {
          console.log("🔄 AssignedDataView - Executing refresh after companyDataUpdated event");
          fetchAssignedData().finally(() => {
            hasFetched = false;
            console.log("✅ AssignedDataView - Refresh completed after companyDataUpdated event");
          });
        }, 800);
        
        // Also try again after a longer delay as a fallback
        setTimeout(() => {
          if (isMounted) {
            console.log("🔄 AssignedDataView - Executing second refresh attempt after companyDataUpdated event");
            fetchAssignedData();
          }
        }, 2000);
      }
    };

    const handleFacebookDataUpdate = () => {
      console.log("🔄 AssignedDataView - Received facebookDataUpdated event, refreshing...", {
        userId,
        isMounted,
        hasFetched
      });
      // Clear cache and refresh immediately when data is updated
      localStorage.removeItem(`assignedData_${userId}`);
      // Force refresh even if currently fetching
      if (isMounted) {
        hasFetched = true;
        // Add a longer delay to ensure database update is committed and visible
        setTimeout(() => {
          console.log("🔄 AssignedDataView - Executing refresh after facebookDataUpdated event");
          fetchAssignedData().finally(() => {
            hasFetched = false;
            console.log("✅ AssignedDataView - Refresh completed after facebookDataUpdated event");
          });
        }, 800);
        
        // Also try again after a longer delay as a fallback
        setTimeout(() => {
          if (isMounted) {
            console.log("🔄 AssignedDataView - Executing second refresh attempt after facebookDataUpdated event");
            fetchAssignedData();
          }
        }, 2000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("companyDataUpdated", handleCompanyDataUpdate);
    window.addEventListener("facebookDataUpdated", handleFacebookDataUpdate);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("companyDataUpdated", handleCompanyDataUpdate);
      window.removeEventListener("facebookDataUpdated", handleFacebookDataUpdate);
    };
  }, [userId]);

  const fetchAssignedData = async () => {
    setLoading(true);
    
    // Fetch both companies and Facebook data in parallel
    await Promise.all([
      fetchAssignedCompanies(),
      fetchAssignedFacebookData()
    ]);
    
    setLoading(false);
  };
  
  // Save to cache whenever companies or facebookData changes
  useEffect(() => {
    if (companies.length > 0 || facebookData.length > 0) {
      localStorage.setItem(
        `assignedData_${userId}`,
        JSON.stringify({
          timestamp: Date.now(),
          companies: companies,
          facebookData: facebookData,
        })
      );
      
      // Automatically clear from UI and localStorage after 15 mins
      const timeoutId = setTimeout(() => {
        setCompanies([]);
        setFacebookData([]);
        localStorage.removeItem(`assignedData_${userId}`);
      }, 15 * 60 * 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [companies, facebookData, userId]);

  const fetchAssignedCompanies = async () => {
    // Calculate 24 hours ago timestamp for database filtering
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Get current authenticated user to verify
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    // Use authenticated user ID if prop doesn't match (fixes user ID mismatch issue)
    const effectiveUserId = authUser?.id || userId;
    
    console.log("🔍 AssignedDataView - Fetching assigned companies:", {
      userIdProp: userId,
      userRole,
      authenticatedUserId: authUser?.id,
      effectiveUserId,
      userIdMatches: userId === authUser?.id,
      twentyFourHoursAgo,
      now: new Date().toISOString()
    });
    
    if (userId !== authUser?.id) {
      console.warn("⚠️ WARNING: userId prop doesn't match authenticated user! Using authenticated user ID instead.");
    }
    
    // First, let's check if there are ANY companies assigned to this user (without time filter)
    // This helps debug if it's a time filtering issue or a data issue
    const { data: allAssigned, error: checkError } = await supabase
      .from("companies")
      .select("id, company_name, assigned_to_id, assigned_at, deleted_at, deletion_state")
      .eq("assigned_to_id", effectiveUserId)
      .is("deleted_at", null)
      .limit(10);
    
    console.log("🔍 AssignedDataView - All companies assigned to user (no time filter):", {
      count: allAssigned?.length || 0,
      companies: allAssigned?.map((c: any) => ({
        id: c.id,
        company_name: c.company_name,
        assigned_to_id: c.assigned_to_id,
        assigned_at: c.assigned_at,
        hoursSinceAssignment: c.assigned_at ? 
          ((Date.now() - new Date(c.assigned_at).getTime()) / (1000 * 60 * 60)).toFixed(2) : 'N/A',
        deletion_state: c.deletion_state
      })),
      error: checkError?.message
    });
    
    // Optimized query: only fetch latest comment per company, filter in database
    const query = supabase
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
      .eq("assigned_to_id", effectiveUserId)
      .is("deleted_at", null)
      .order("assigned_at", { ascending: false, nullsFirst: false }) // Changed nullsFirst to false to prioritize companies with assigned_at
      .limit(100); // Limit to prevent loading too much data - order by assigned_at to show newest first

    const { data, error } = await query;
    
    console.log("📊 AssignedDataView - Query result:", {
      dataCount: data?.length || 0,
      error: error?.message,
      sampleIds: data?.slice(0, 10).map((c: any) => ({
        id: c.id,
        company_name: c.company_name,
        assigned_at: c.assigned_at,
        assigned_to_id: c.assigned_to_id,
        deletion_state: c.deletion_state,
        hoursSinceAssignment: c.assigned_at ? 
          ((Date.now() - new Date(c.assigned_at).getTime()) / (1000 * 60 * 60)).toFixed(2) : 'N/A'
      }))
    });

    if (!error && data) {
      // Filter out companies with deletion_state (if column exists)
      let filteredData = data.filter((company: any) => !company.deletion_state);
      
      // Filter out companies assigned for more than 24 hours
      const now = Date.now();
      const validCompanies: any[] = [];
      const outdatedIds: string[] = [];

      filteredData.forEach((company: any) => {
        if (!company.assigned_at) {
          // Include companies without assigned_at (legacy data)
          validCompanies.push(company);
          return;
        }
        const assignedAt = new Date(company.assigned_at).getTime();
        const hoursSinceAssignment = (now - assignedAt) / (1000 * 60 * 60);
        if (hoursSinceAssignment < 24) {
          validCompanies.push(company);
          // Log newly assigned companies (within last hour) for debugging
          if (hoursSinceAssignment < 1) {
            console.log("✅ AssignedDataView - Including newly assigned company:", {
              companyId: company.id,
              companyName: company.company_name,
              assignedAt: company.assigned_at,
              assigned_to_id: company.assigned_to_id,
              hoursSinceAssignment: hoursSinceAssignment.toFixed(2),
              minutesSinceAssignment: (hoursSinceAssignment * 60).toFixed(2)
            });
          }
        } else {
          outdatedIds.push(company.id);
          // Debug: Log why company is being filtered out
          console.log(`⏰ Company ${company.id} filtered as outdated:`, {
            companyId: company.id,
            companyName: company.company_name,
            assignedAt: company.assigned_at,
            assigned_to_id: company.assigned_to_id,
            hoursSinceAssignment: hoursSinceAssignment.toFixed(2),
            now: new Date(now).toISOString()
          });
        }
      });

      // Unassign outdated companies in parallel (non-blocking)
      // Only attempt if user has permission (admin or team_lead)
      // For employees, we'll just filter them out from the view
      if (outdatedIds.length > 0 && (userRole === "admin" || userRole === "team_lead")) {
        supabase
          .from("companies")
          .update({ assigned_to_id: null, assigned_at: null })
          .in("id", outdatedIds)
          .then(() => {
            // Silently handle - don't block UI
          })
          .catch((error) => {
            // Log error but don't block UI
            console.warn("Could not unassign outdated companies:", error);
          });
      } else if (outdatedIds.length > 0 && userRole === "employee") {
        // For employees, we can't unassign companies due to RLS policies
        // They will just be filtered out from the view
        console.log(`Filtered out ${outdatedIds.length} outdated companies from view (employee cannot unassign)`);
      }

      // Sort comments once per company (only if needed)
      // Create a copy of the array before sorting to avoid mutation
      const companiesWithSortedComments = validCompanies.map((company) => ({
        ...company,
        comments:
          company.comments && company.comments.length > 0
            ? [...company.comments].sort(
                (a: any, b: any) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              )
            : [],
      }));

      // Sort companies by assigned_at (most recent first) to ensure newly reassigned appear at top
      companiesWithSortedComments.sort((a: any, b: any) => {
        if (!a.assigned_at && !b.assigned_at) return 0;
        if (!a.assigned_at) return 1; // Companies without assigned_at go to end
        if (!b.assigned_at) return -1;
        return new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime();
      });

      // For employees: filter out companies that have comments (already categorized)
      // They should only appear in category views, not in Assigned Data section
      // For admins: show all assigned companies regardless of comments
      const companiesBeforeCommentFilter = companiesWithSortedComments;
      const finalCompanies = userRole === "admin" 
        ? companiesWithSortedComments
        : companiesWithSortedComments.filter((company: any) => {
            // Keep only companies with no comments (uncategorized)
            const hasComments = company.comments && company.comments.length > 0;
            if (hasComments) {
              console.log(`⏭️ Filtered out company ${company.id} (${company.company_name}) - has ${company.comments.length} comment(s):`, 
                company.comments.map((c: any) => ({ id: c.id, category: c.category, created_at: c.created_at }))
              );
            }
            return !hasComments;
          });

      console.log("✅ AssignedDataView - Final filtered companies:", {
        beforeCommentFilter: companiesBeforeCommentFilter.length,
        afterCommentFilter: finalCompanies.length,
        filteredOutByComments: companiesBeforeCommentFilter.length - finalCompanies.length,
        top5Companies: finalCompanies.slice(0, 5).map((c: any) => ({
          id: c.id,
          company_name: c.company_name,
          assigned_at: c.assigned_at,
          hasComments: c.comments && c.comments.length > 0,
          hoursSinceAssignment: c.assigned_at ? 
            ((Date.now() - new Date(c.assigned_at).getTime()) / (1000 * 60 * 60)).toFixed(2) : 'N/A'
        }))
      });

      setCompanies(finalCompanies);
    } else {
      // On error, set empty array
      if (error) {
        console.error("Error fetching assigned companies:", error);
      }
      setCompanies([]);
    }
  };

  const fetchAssignedFacebookData = async () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Get current authenticated user to use correct ID
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const effectiveUserId = authUser?.id || userId;
    
    console.log("🔍 AssignedDataView - Fetching assigned Facebook data:", {
      userIdProp: userId,
      effectiveUserId,
      now: new Date().toISOString(),
      twentyFourHoursAgo
    });

    try {
      // First, get shares for this employee within the last 24 hours
      const { data: shares, error: sharesError } = await (supabase
        .from("facebook_data_shares" as any)
        .select("facebook_data_id, created_at")
        .eq("employee_id", effectiveUserId)
        .gte("created_at", twentyFourHoursAgo)
        .order("created_at", { ascending: false }) as any);

      console.log("📦 AssignedDataView - Facebook shares query result:", {
        sharesCount: shares?.length || 0,
        shares: shares,
        error: sharesError?.message,
        twentyFourHoursAgo
      });

      if (sharesError) {
        console.error("❌ Error fetching Facebook data shares:", sharesError);
        setFacebookData([]);
        return;
      }

      if (!shares || shares.length === 0) {
        console.log("ℹ️ No recent Facebook data shares found (within 24 hours)");
        setFacebookData([]);
        return;
      }

      // Get the Facebook data IDs
      const fbIds = shares.map((s: any) => s.facebook_data_id);
      const shareDateMap: Record<number, string> = {};
      shares.forEach((share: any) => {
        shareDateMap[share.facebook_data_id] = share.created_at;
      });

      // Fetch the actual Facebook data
      const { data: fbData, error: fbError } = await (supabase
        .from("facebook_data" as any)
        .select("*")
        .in("id", fbIds)
        .is("deletion_state", null) as any);

      if (fbError) {
        console.error("Error fetching Facebook data:", fbError);
        setFacebookData([]);
        return;
      }

      if (!fbData || fbData.length === 0) {
        setFacebookData([]);
        return;
      }

      // Fetch comments for these Facebook data items
      let commentsMap = new Map();
      try {
        const { data: comments } = await (supabase
          .from("facebook_data_comments" as any)
          .select("facebook_data_id")
          .in("facebook_data_id", fbIds) as any);

        if (comments) {
          comments.forEach((comment: any) => {
            if (!commentsMap.has(comment.facebook_data_id)) {
              commentsMap.set(comment.facebook_data_id, []);
            }
            commentsMap.get(comment.facebook_data_id).push(comment);
          });
        }
      } catch (commentsError) {
        console.warn("Could not fetch comments:", commentsError);
      }

      // Filter out Facebook data with comments (for employees) or deletion_state
      const now = Date.now();
      const validFbData = fbData
        .filter((item: any) => {
          // Exclude items with deletion_state
          if (item.deletion_state) {
            console.log(`⏭️ Filtered out Facebook data ${item.id} - has deletion_state:`, item.deletion_state);
            return false;
          }
          
          // For employees: exclude items with comments (already categorized)
          if (userRole !== "admin") {
            const hasComments = commentsMap.has(item.id) && commentsMap.get(item.id).length > 0;
            if (hasComments) {
              console.log(`⏭️ Filtered out Facebook data ${item.id} - has comments (already categorized)`);
              return false;
            }
          }
          
          // Filter by 24 hours using share date
          const shareDate = shareDateMap[item.id];
          if (!shareDate) {
            console.log(`⏭️ Filtered out Facebook data ${item.id} - no share date found`);
            return false;
          }
          
          const shareTime = new Date(shareDate).getTime();
          const hoursSinceShare = (now - shareTime) / (1000 * 60 * 60);
          if (hoursSinceShare >= 24) {
            console.log(`⏭️ Filtered out Facebook data ${item.id} - older than 24 hours (${hoursSinceShare.toFixed(2)} hours)`);
            return false;
          }
          
          console.log(`✅ Including Facebook data ${item.id} - shared ${hoursSinceShare.toFixed(2)} hours ago`);
          return true;
        })
        .map((item: any) => ({
          ...item,
          shared_at: shareDateMap[item.id],
          comments: commentsMap.get(item.id) || [],
        }))
        .sort((a: any, b: any) => {
          // Sort by share date (most recent first)
          const aTime = new Date(a.shared_at).getTime();
          const bTime = new Date(b.shared_at).getTime();
          return bTime - aTime;
        });

      console.log("✅ AssignedDataView - Final filtered Facebook data:", {
        totalCount: validFbData.length,
        top5: validFbData.slice(0, 5).map((fb: any) => ({
          id: fb.id,
          name: fb.name,
          shared_at: fb.shared_at,
          hasComments: fb.comments && fb.comments.length > 0,
        }))
      });

      setFacebookData(validFbData);
    } catch (error) {
      console.error("Error in fetchAssignedFacebookData:", error);
      setFacebookData([]);
    }
  };

  const CompanyCardSkeleton = () => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-10" />
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <UserCheck className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold text-white">Assigned Data</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <CompanyCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <UserCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Assigned Data</h2>
            <p className="text-sm text-muted-foreground mt-1 text-white">
              Companies and Facebook data assigned to you (auto-unassigned after 24 hours)
            </p>
          </div>
        </div>
        {(companies.length > 0 || facebookData.length > 0) && (
          <div className="px-4 py-2 bg-primary/10 rounded-full">
            <span className="text-sm font-semibold text-primary text-white">
              {companies.length + facebookData.length} {companies.length + facebookData.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        )}
      </div>
      {companies.length === 0 && facebookData.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-muted rounded-full mb-4">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No assigned data</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              You don't have any companies or Facebook data assigned to you at the moment. Data will appear here once it's assigned to you.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-stretch">
          {companies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onUpdate={fetchAssignedData}
              canDelete={true}
              userRole={userRole}
            />
          ))}
          {facebookData.map((fb) => (
            <FacebookDataCard
              key={fb.id}
              data={fb}
              onUpdate={fetchAssignedData}
              userRole={userRole}
              onDelete={() => {
                fetchAssignedData();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AssignedDataView;
