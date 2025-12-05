import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Building2, Phone, Mail, MapPin, RotateCcw, Trash2, Search, Calendar, User, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import FacebookDataCard from "./FacebookDataCard";

interface RecycleBinViewProps {
  userRole?: string;
  userId?: string;
}

interface DeletedCompany {
  id: string;
  company_name: string;
  owner_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  products_services: string | null;
  deleted_at: string;
  deletion_state?: string | null;
  deleted_by: {
    display_name: string;
    email: string;
  } | null;
  assigned_to: {
    display_name: string;
    email: string;
  } | null;
  comments: Array<{
    id: string;
    comment_text: string;
    category: string;
    created_at: string;
    user: {
      display_name: string;
      email: string;
    };
  }>;
}

interface DeletedFacebookData {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  owner_name: string | null;
  products: string | null;
  services: string | null;
  deleted_at: string;
  deletion_state: string;
  deleted_by: {
    display_name: string;
    email: string;
  } | null;
  comments: Array<{
    id: string;
    comment_text: string;
    category: string;
    created_at: string;
    user: {
      display_name: string;
      email: string;
    };
  }>;
}

const RecycleBinView = ({ userRole, userId }: RecycleBinViewProps) => {
  const [companies, setCompanies] = useState<DeletedCompany[]>([]);
  const [facebookData, setFacebookData] = useState<DeletedFacebookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [restoring, setRestoring] = useState<string | null>(null);
  const [permanentlyDeleting, setPermanentlyDeleting] = useState<string | null>(null);
  const [restoringFb, setRestoringFb] = useState<number | null>(null);
  const [permanentlyDeletingFb, setPermanentlyDeletingFb] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(userId);

  // Get userId from auth if not provided
  useEffect(() => {
    if (!currentUserId && userRole === "team_lead") {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setCurrentUserId(user.id);
        }
      });
    } else if (userId) {
      setCurrentUserId(userId);
    }
  }, [userId, userRole]);

  const fetchDeletedCompanies = async () => {
    try {
      setLoading(true);
      
      let query: any;
      
      // Filter based on role and deletion_state
      if (userRole === "team_lead" && currentUserId) {
        // Team Lead sees companies with deletion_state='team_lead_recycle' deleted by their team members
        // First, get the team_id for this team lead from teams table
        const { data: teamData, error: teamError } = await (supabase
          .from("teams" as any)
          .select("id")
          .eq("team_lead_id", currentUserId)
          .maybeSingle() as any);
        
        if (teamError || !teamData) {
          console.error("Error fetching team or no team found:", teamError);
          setCompanies([]);
          setLoading(false);
          return;
        }
        
        // Then get all team member IDs for this team
        const { data: teamMembers, error: teamMemberError } = await (supabase
          .from("team_members" as any)
          .select("employee_id")
          .eq("team_id", teamData.id) as any);
        
        if (teamMemberError) {
          console.error("Error fetching team members:", teamMemberError);
          setCompanies([]);
          setLoading(false);
          return;
        }
        
        teamMemberIds = teamMembers?.map((tm: any) => tm.employee_id) || [];
        
        if (teamMemberIds.length > 0) {
          // Build query with team member filter
          query = supabase
            .from("companies")
            .select(`
              *,
              deleted_by:profiles!companies_deleted_by_id_fkey(display_name, email),
              assigned_to:profiles!companies_assigned_to_id_fkey(display_name, email),
              comments(
                id,
                comment_text,
                category,
                created_at,
                user:profiles(display_name, email)
              )
            `)
            .eq("deletion_state", "team_lead_recycle")
            .in("deleted_by_id", teamMemberIds);
        } else {
          // No team members, return empty array
          setCompanies([]);
          setLoading(false);
          return;
        }
      } else if (userRole === "admin") {
        // Admin sees companies with deletion_state='admin_recycle'
        query = supabase
          .from("companies")
          .select(`
            *,
            deleted_by:profiles!companies_deleted_by_id_fkey(display_name, email),
            assigned_to:profiles!companies_assigned_to_id_fkey(display_name, email),
            comments(
              id,
              comment_text,
              category,
              created_at,
              user:profiles(display_name, email)
            )
          `)
          .eq("deletion_state", "admin_recycle");
      } else {
        // Fallback: show all deleted companies (for backward compatibility)
        query = supabase
          .from("companies")
          .select(`
            *,
            deleted_by:profiles!companies_deleted_by_id_fkey(display_name, email),
            assigned_to:profiles!companies_assigned_to_id_fkey(display_name, email),
            comments(
              id,
              comment_text,
              category,
              created_at,
              user:profiles(display_name, email)
            )
          `)
          .not("deleted_at", "is", null);
      }

      const { data, error } = await (query.order("deleted_at", { ascending: false }) as any);

      if (error) {
        // If deletion_state column doesn't exist, fall back to old behavior
        if (error.message?.includes("deletion_state")) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("companies")
            .select(`
              *,
              deleted_by:profiles!companies_deleted_by_id_fkey(display_name, email),
              assigned_to:profiles!companies_assigned_to_id_fkey(display_name, email),
              comments(
                id,
                comment_text,
                category,
                created_at,
                user:profiles(display_name, email)
              )
            `)
            .not("deleted_at", "is", null)
            .order("deleted_at", { ascending: false });

          if (fallbackError) {
            toast.error("Database migration not applied yet. Please run the migration first.");
            setCompanies([]);
            return;
          }
          setCompanies(fallbackData || []);
          return;
        }
        
        // If the columns don't exist yet, show a helpful message
        if (error.message.includes("deleted_by_id") || error.message.includes("deleted_at")) {
          toast.error("Database migration not applied yet. Please run the migration first.");
          setCompanies([]);
          return;
        }
        throw error;
      }
      setCompanies(data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch deleted companies");
    } finally {
      setLoading(false);
    }
  };

  const fetchDeletedFacebookData = async () => {
    try {
      let query: any;
      let teamMemberIds: string[] = []; // Store for error handling
      
      // Filter based on role and deletion_state
      if (userRole === "team_lead" && currentUserId) {
        // Team Lead sees Facebook data with deletion_state='team_lead_recycle' deleted by their team members
        // First, get the team_id for this team lead from teams table
        const { data: teamData, error: teamError } = await (supabase
          .from("teams" as any)
          .select("id")
          .eq("team_lead_id", currentUserId)
          .maybeSingle() as any);
        
        if (teamError || !teamData) {
          console.error("Error fetching team or no team found:", teamError);
          setFacebookData([]);
          return;
        }
        
        // Then get all team member IDs for this team
        const { data: teamMembers, error: teamMemberError } = await (supabase
          .from("team_members" as any)
          .select("employee_id")
          .eq("team_id", teamData.id) as any);
        
        if (teamMemberError) {
          console.error("Error fetching team members:", teamMemberError);
          setFacebookData([]);
          return;
        }
        
        teamMemberIds = teamMembers?.map((tm: any) => tm.employee_id) || [];
        
        if (teamMemberIds.length > 0) {
          // Fetch without join first to avoid foreign key issues
          query = supabase
            .from("facebook_data" as any)
            .select("*")
            .eq("deletion_state", "team_lead_recycle")
            .in("deleted_by_id", teamMemberIds);
        } else {
          setFacebookData([]);
          return;
        }
      } else if (userRole === "admin") {
        // Admin sees Facebook data with deletion_state='admin_recycle'
        // Fetch without join first to avoid foreign key issues
        query = supabase
          .from("facebook_data" as any)
          .select("*")
          .eq("deletion_state", "admin_recycle");
      } else {
        // No Facebook data for other roles
        setFacebookData([]);
        return;
      }

      const { data, error } = await (query.order("deleted_at", { ascending: false }) as any);

      if (error) {
        console.error("Error fetching deleted Facebook data:", error);
        console.error("Full error details:", JSON.stringify(error, null, 2));
        
        // Try fetching without the deleted_by join if foreign key doesn't exist
        if (error.message?.includes("foreign key") || error.message?.includes("relation") || error.code === "PGRST204" || error.code === "42703") {
          console.warn("Foreign key reference failed, trying without deleted_by join");
          
          // Retry without the deleted_by join
          let retryQuery: any;
          if (userRole === "team_lead" && currentUserId && teamMemberIds.length > 0) {
            retryQuery = supabase
              .from("facebook_data" as any)
              .select("*")
              .eq("deletion_state", "team_lead_recycle")
              .in("deleted_by_id", teamMemberIds);
          } else if (userRole === "admin") {
            retryQuery = supabase
              .from("facebook_data" as any)
              .select("*")
              .eq("deletion_state", "admin_recycle");
          }
          
          if (retryQuery) {
            const { data: retryData, error: retryError } = await (retryQuery.order("deleted_at", { ascending: false }) as any);
            
            if (retryError) {
              console.error("Retry query also failed:", retryError);
              setFacebookData([]);
              return;
            }
            
            // Fetch deleted_by profiles separately
            if (retryData && retryData.length > 0) {
              const deletedByIds = retryData.map((fb: any) => fb.deleted_by_id).filter(Boolean);
              if (deletedByIds.length > 0) {
                const { data: profiles } = await supabase
                  .from("profiles")
                  .select("id, display_name, email")
                  .in("id", deletedByIds);
                
                const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));
                
                const dataWithProfiles = retryData.map((fb: any) => ({
                  ...fb,
                  deleted_by: fb.deleted_by_id ? profilesMap.get(fb.deleted_by_id) || null : null
                }));
                
                // Continue with comments fetch
                const fbIds = dataWithProfiles.map((fb: any) => fb.id);
                try {
                  const { data: comments } = await (supabase
                    .from("facebook_data_comments" as any)
                    .select(`
                      id,
                      facebook_data_id,
                      comment_text,
                      category,
                      created_at,
                      user:profiles!user_id(display_name, email)
                    `)
                    .in("facebook_data_id", fbIds) as any);

                  if (comments) {
                    const commentsMap = new Map();
                    comments.forEach((comment: any) => {
                      if (!commentsMap.has(comment.facebook_data_id)) {
                        commentsMap.set(comment.facebook_data_id, []);
                      }
                      commentsMap.get(comment.facebook_data_id).push(comment);
                    });

                    const fbWithComments = dataWithProfiles.map((fb: any) => ({
                      ...fb,
                      comments: (commentsMap.get(fb.id) || []).sort((a: any, b: any) => 
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                      )
                    }));

                    setFacebookData(fbWithComments);
                    return;
                  } else {
                    setFacebookData(dataWithProfiles.map((fb: any) => ({ ...fb, comments: [] })));
                    return;
                  }
                } catch (commentsError) {
                  console.warn("Could not fetch Facebook comments:", commentsError);
                  setFacebookData(dataWithProfiles.map((fb: any) => ({ ...fb, comments: [] })));
                  return;
                }
              } else {
                // No deleted_by_id, just set data without profiles
                setFacebookData(retryData.map((fb: any) => ({ ...fb, deleted_by: null, comments: [] })));
                return;
              }
            } else {
              setFacebookData([]);
              return;
            }
          }
        }
        
        // If deletion_state column doesn't exist, return empty array
        if (error.message?.includes("deletion_state") || 
            error.message?.includes("deleted_at") ||
            error.message?.includes("deleted_by_id") ||
            error.code === "PGRST204") {
          console.warn("Migration not applied or columns don't exist yet");
          setFacebookData([]);
          return;
        }
        
        setFacebookData([]);
        return;
      }

      console.log("Fetched deleted Facebook data:", data?.length || 0, "items");

      // Fetch deleted_by profiles separately
      if (data && data.length > 0) {
        try {
          // Get unique deleted_by_ids
          const deletedByIds = [...new Set(data.map((fb: any) => fb.deleted_by_id).filter(Boolean))];
          
          // Fetch profiles for deleted_by
          let profilesMap = new Map();
          if (deletedByIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, display_name, email")
              .in("id", deletedByIds);
            
            if (profiles) {
              profilesMap = new Map(profiles.map((p: any) => [p.id, p]));
            }
          }
          
          // Attach deleted_by profiles to data
          const dataWithProfiles = data.map((fb: any) => ({
            ...fb,
            deleted_by: fb.deleted_by_id ? profilesMap.get(fb.deleted_by_id) || null : null
          }));
          
          // Fetch comments for Facebook data
          const fbIds = dataWithProfiles.map((fb: any) => fb.id);
          const { data: comments } = await (supabase
            .from("facebook_data_comments" as any)
            .select(`
              id,
              facebook_data_id,
              comment_text,
              category,
              created_at,
              user_id
            `)
            .in("facebook_data_id", fbIds) as any);

          if (comments && comments.length > 0) {
            // Fetch user profiles for comments
            const commentUserIds = [...new Set(comments.map((c: any) => c.user_id).filter(Boolean))];
            let commentUsersMap = new Map();
            
            if (commentUserIds.length > 0) {
              const { data: commentUsers } = await supabase
                .from("profiles")
                .select("id, display_name, email")
                .in("id", commentUserIds);
              
              if (commentUsers) {
                commentUsersMap = new Map(commentUsers.map((u: any) => [u.id, u]));
              }
            }
            
            // Attach user profiles to comments
            const commentsWithUsers = comments.map((comment: any) => ({
              ...comment,
              user: comment.user_id ? commentUsersMap.get(comment.user_id) || null : null
            }));
            
            const commentsMap = new Map();
            commentsWithUsers.forEach((comment: any) => {
              if (!commentsMap.has(comment.facebook_data_id)) {
                commentsMap.set(comment.facebook_data_id, []);
              }
              commentsMap.get(comment.facebook_data_id).push(comment);
            });

            const fbWithComments = dataWithProfiles.map((fb: any) => ({
              ...fb,
              comments: (commentsMap.get(fb.id) || []).sort((a: any, b: any) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )
            }));

            setFacebookData(fbWithComments);
          } else {
            setFacebookData(dataWithProfiles.map((fb: any) => ({ ...fb, comments: [] })));
          }
        } catch (error) {
          console.warn("Error fetching profiles or comments:", error);
          // Set data without profiles/comments if fetch fails
          setFacebookData(data.map((fb: any) => ({ 
            ...fb, 
            deleted_by: null,
            comments: [] 
          })));
        }
      } else {
        setFacebookData([]);
      }
    } catch (error: any) {
      console.error("Error fetching deleted Facebook data:", error);
      setFacebookData([]);
    }
  };

  useEffect(() => {
    if (userRole === "team_lead" && !currentUserId) {
      // Wait for userId to be fetched
      return;
    }
    
    fetchDeletedCompanies();
    fetchDeletedFacebookData();
    
    // Listen for data update events to refresh the view
    const handleDataUpdate = () => {
      fetchDeletedCompanies();
      fetchDeletedFacebookData();
    };
    
    window.addEventListener('companyDataUpdated', handleDataUpdate);
    window.addEventListener('facebookDataUpdated', handleDataUpdate);
    
    return () => {
      window.removeEventListener('companyDataUpdated', handleDataUpdate);
      window.removeEventListener('facebookDataUpdated', handleDataUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, userRole]);

  const handleRestore = async (companyId: string) => {
    try {
      setRestoring(companyId);
      
      // Restore company: clear deletion_state and deleted_at
      const updateData: any = {
        deleted_at: null,
        deleted_by_id: null,
        deletion_state: null
      };

      const { error } = await supabase
        .from("companies")
        .update(updateData)
        .eq("id", companyId);

      if (error) {
        // Fallback if deletion_state column doesn't exist
        if (error.message?.includes("deletion_state")) {
          const { error: fallbackError } = await supabase
            .from("companies")
            .update({
              deleted_at: null,
              deleted_by_id: null
            })
            .eq("id", companyId);
          
          if (fallbackError) throw fallbackError;
        } else {
          throw error;
        }
      }

      toast.success("Company restored successfully!");
      fetchDeletedCompanies();
    } catch (error: any) {
      toast.error(error.message || "Failed to restore company");
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async (companyId: string) => {
    try {
      // Find the company to check its deletion_state
      const company = companies.find((c) => c.id === companyId);
      
      // For team leads deleting from recycle bin → move to admin recycle
      if (userRole === "team_lead" && company?.deletion_state === 'team_lead_recycle') {
        if (!confirm("Are you sure you want to move this company to Admin's recycle bin?")) {
          return;
        }

        const { data: userData } = await supabase.auth.getUser();
        
        if (!userData.user) {
          throw new Error("Not authenticated");
        }

        const { error } = await supabase
          .from("companies")
          .update({
            deletion_state: 'admin_recycle' as any,
            deleted_at: new Date().toISOString(),
            deleted_by_id: userData.user.id
          } as any)
          .eq("id", companyId);

        if (error) {
          // Fallback if deletion_state column doesn't exist
          if (error.message?.includes("deletion_state")) {
            const { error: fallbackError } = await supabase
              .from("companies")
              .update({
                deleted_at: new Date().toISOString(),
                deleted_by_id: userData.user.id
              })
              .eq("id", companyId);
            
            if (fallbackError) throw fallbackError;
          } else {
            throw error;
          }
        }

        toast.success("Company moved to Admin's recycle bin");
        
        // Dispatch event to refresh admin's recycle bin if they're viewing it
        window.dispatchEvent(new CustomEvent('companyDataUpdated'));
        
        fetchDeletedCompanies();
        return;
      }

      // For admins deleting from recycle bin → permanent delete
      if (userRole === "admin") {
        if (!confirm("Are you sure you want to permanently delete this company? This action cannot be undone.")) {
          return;
        }

        setPermanentlyDeleting(companyId);
        const { error } = await supabase
          .from("companies")
          .delete()
          .eq("id", companyId);

        if (error) throw error;

        toast.success("Company permanently deleted!");
        fetchDeletedCompanies();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete company");
    } finally {
      setPermanentlyDeleting(null);
    }
  };

  const handleRestoreFacebookData = async (fbId: number) => {
    try {
      setRestoringFb(fbId);
      
      // Restore Facebook data: clear deletion_state and deleted_at
      const updateData: any = {
        deleted_at: null,
        deleted_by_id: null,
        deletion_state: null
      };

      const { error } = await (supabase
        .from("facebook_data" as any)
        .update(updateData)
        .eq("id", fbId) as any);

      if (error) {
        // Fallback if deletion_state column doesn't exist
        if (error.message?.includes("deletion_state")) {
          const { error: fallbackError } = await (supabase
            .from("facebook_data" as any)
            .update({
              deleted_at: null,
              deleted_by_id: null
            })
            .eq("id", fbId) as any);
          
          if (fallbackError) throw fallbackError;
        } else {
          throw error;
        }
      }

      toast.success("Facebook data restored successfully!");
      fetchDeletedFacebookData();
    } catch (error: any) {
      toast.error(error.message || "Failed to restore Facebook data");
    } finally {
      setRestoringFb(null);
    }
  };

  const handlePermanentDeleteFacebookData = async (fbId: number) => {
    try {
      // Find the Facebook data to check its deletion_state
      const fbData = facebookData.find((fb) => fb.id === fbId);
      
      // For team leads deleting from recycle bin → move to admin recycle
      if (userRole === "team_lead" && fbData?.deletion_state === 'team_lead_recycle') {
        if (!confirm("Are you sure you want to move this Facebook data to Admin's recycle bin?")) {
          return;
        }

        const { data: userData } = await supabase.auth.getUser();
        
        if (!userData.user) {
          throw new Error("Not authenticated");
        }

        const { error } = await (supabase
          .from("facebook_data" as any)
          .update({
            deletion_state: 'admin_recycle' as any,
            deleted_at: new Date().toISOString(),
            deleted_by_id: userData.user.id
          })
          .eq("id", fbId) as any);

        if (error) {
          // Check if columns don't exist (migration not run)
          if (error.message?.includes("deleted_at") || 
              error.message?.includes("deletion_state") ||
              error.message?.includes("deleted_by_id") ||
              error.code === "PGRST204") {
            toast.error(
              "Database migration not applied. Please run the migration: 20250120000003_add_deletion_state_to_facebook_data.sql in Supabase SQL Editor.",
              { duration: 10000 }
            );
            return;
          }
          
          throw error;
        }

        toast.success("Facebook data moved to Admin's recycle bin");
        
        // Dispatch event to refresh admin's recycle bin if they're viewing it
        window.dispatchEvent(new CustomEvent('facebookDataUpdated'));
        
        fetchDeletedFacebookData();
        return;
      }

      // For admins deleting from recycle bin → permanent delete
      if (userRole === "admin") {
        if (!confirm("Are you sure you want to permanently delete this Facebook data? This action cannot be undone.")) {
          return;
        }

        setPermanentlyDeletingFb(fbId);
        const { error } = await (supabase
          .from("facebook_data" as any)
          .delete()
          .eq("id", fbId) as any);

        if (error) throw error;

        toast.success("Facebook data permanently deleted!");
        fetchDeletedFacebookData();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete Facebook data");
    } finally {
      setPermanentlyDeletingFb(null);
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (company.email && company.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredFacebookData = facebookData.filter(fb =>
    (fb.name && fb.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (fb.company_name && fb.company_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (fb.email && fb.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (fb.owner_name && fb.owner_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'hot': return 'bg-red-100 text-red-800 border-red-200';
      case 'follow_up': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'block': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'general': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'hot': return '🔥';
      case 'follow_up': return '📅';
      case 'block': return '🚫';
      case 'general': return '📋';
      default: return '📄';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Recycle Bin</h2>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading deleted items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Recycle Bin</h2>
        <Badge variant="secondary" className="text-sm">
          {companies.length + facebookData.length} deleted {companies.length + facebookData.length === 1 ? 'item' : 'items'}
        </Badge>
      </div>

      <div className="flex items-center space-x-2 ">
        <div className="relative flex-1 max-w-sm ">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 text-white/80" />
          <Input
            placeholder="Search deleted items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-white"
          />
        </div>
      </div>

      {filteredCompanies.length === 0 && filteredFacebookData.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Trash2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? "No matching items found" : "No deleted items"}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? "Try adjusting your search terms" 
                : "Deleted items will appear here"
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredCompanies.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold mb-4 text-white">Deleted Companies</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredCompanies.map((company) => {
            const lastComment = company.comments?.[0];
            
            return (
              <Card key={company.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {company.company_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{company.owner_name}</p>
                    </div>
                    {lastComment && (
                      <Badge className={cn("ml-2", getCategoryColor(lastComment.category))}>
                        {getCategoryIcon(lastComment.category)} {lastComment.category.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {company.phone}
                    </div>
                    {company.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {company.email}
                      </div>
                    )}
                    {company.address && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {company.address}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="font-medium">Assigned to:</span>
                      {company.assigned_to ? (
                        company.assigned_to.display_name
                      ) : (
                        <span className="text-orange-600 font-medium">Unassigned</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">Deleted:</span>
                      {new Date(company.deleted_at).toLocaleString()}
                    </div>
                    {company.deleted_by && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span className="font-medium">Deleted by:</span>
                        {company.deleted_by.display_name}
                      </div>
                    )}
                  </div>

                  {lastComment && (
                    <div className="border-t pt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Last Comment</p>
                      <p className="text-sm">{lastComment.comment_text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Added: {new Date(lastComment.created_at).toLocaleString()}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleRestore(company.id)}
                      disabled={restoring === company.id}
                      className="flex-1"
                      variant="outline"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {restoring === company.id ? "Restoring..." : "Restore"}
                    </Button>
                    <Button
                      onClick={() => handlePermanentDelete(company.id)}
                      disabled={permanentlyDeleting === company.id}
                      variant="destructive"
                      size="icon"
                      title={userRole === "team_lead" ? "Move to Admin's recycle bin" : "Permanently delete"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
              </div>
            </div>
          )}

          {filteredFacebookData.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold mb-4 text-white">Deleted Facebook Data</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredFacebookData.map((fb) => (
                  <Card key={fb.id} className="relative">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            <Share2 className="h-5 w-5 text-primary" />
                            {fb.name || fb.company_name || "Unknown"}
                          </CardTitle>
                          {fb.owner_name && (
                            <p className="text-sm text-muted-foreground mt-1">{fb.owner_name}</p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2 text-sm">
                        {fb.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            {fb.phone}
                          </div>
                        )}
                        {fb.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            {fb.email}
                          </div>
                        )}
                        {fb.company_name && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="h-4 w-4" />
                            {fb.company_name}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span className="font-medium">Deleted:</span>
                          {new Date(fb.deleted_at).toLocaleString()}
                        </div>
                        {fb.deleted_by && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span className="font-medium">Deleted by:</span>
                            {fb.deleted_by.display_name}
                          </div>
                        )}
                      </div>

                      {fb.comments && fb.comments.length > 0 && (
                        <div className="border-t pt-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Last Comment</p>
                          <p className="text-sm">{fb.comments[0].comment_text}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Added: {new Date(fb.comments[0].created_at).toLocaleString()}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleRestoreFacebookData(fb.id)}
                          disabled={restoringFb === fb.id}
                          className="flex-1"
                          variant="outline"
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          {restoringFb === fb.id ? "Restoring..." : "Restore"}
                        </Button>
                        {userRole === "admin" && (
                          <Button
                            onClick={() => handlePermanentDeleteFacebookData(fb.id)}
                            disabled={permanentlyDeletingFb === fb.id}
                            variant="destructive"
                            size="icon"
                            title={userRole === "team_lead" ? "Move to Admin's recycle bin" : "Permanently delete"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecycleBinView;
