import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Phone, Mail, MapPin, MessageSquare, Loader2, Calendar, User, DollarSign, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaidClientPoolViewProps {
  userRole?: string;
}

const PaidClientPoolView = ({ userRole }: PaidClientPoolViewProps) => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [savingComments, setSavingComments] = useState<Record<string, boolean>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchPaidClients();
    
    // Listen for company data updates (e.g., when a company is marked as paid)
    const handleDataUpdate = () => {
      fetchPaidClients();
    };
    
    window.addEventListener('companyDataUpdated', handleDataUpdate);
    
    return () => {
      window.removeEventListener('companyDataUpdated', handleDataUpdate);
    };
  }, []);

  const fetchPaidClients = async () => {
    setLoading(true);
    try {
      // First, try to fetch companies with is_paid = true
      // @ts-ignore - Supabase type inference issue with nested queries
      const { data: paidByField, error: paidByFieldError } = await (supabase
        .from("companies")
        .select(`
          *,
          assigned_to:profiles!assigned_to_id(display_name, email),
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
        .is("deleted_at", null)
        .eq("is_paid", true)
        .order("payment_date", { ascending: false }) as any);

      // Also fetch companies with "paid" comment category
      const { data: paidByComment, error: paidByCommentError } = await supabase
        .from("companies")
        .select(`
          *,
          assigned_to:profiles!assigned_to_id(display_name, email),
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
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      let allCompanies: any[] = [];
      
      // Handle is_paid field query
      if (!paidByFieldError && paidByField) {
        allCompanies = [...paidByField];
      } else if (paidByFieldError && (paidByFieldError.message?.includes("is_paid") || paidByFieldError.code === "PGRST204")) {
        // Column doesn't exist, skip this query
        console.warn("is_paid column doesn't exist, using comment-based filtering only");
      } else if (paidByFieldError) {
        throw paidByFieldError;
      }

      // Filter companies with "paid" comment category
      if (!paidByCommentError && paidByComment) {
        // Debug: Check a few companies to see their comments
        const sampleCompanies = paidByComment.slice(0, 5);
        sampleCompanies.forEach((company: any) => {
          if (company.comments && company.comments.length > 0) {
            console.log(`🔍 Sample company: ${company.company_name}`, {
              commentCount: company.comments.length,
              categories: company.comments.map((c: any) => c.category),
              allComments: company.comments
            });
          }
        });
        
        const companiesWithPaidComment = paidByComment.filter((company: any) => {
          // Check if any comment has category "paid"
          const hasPaidComment = company.comments?.some((comment: any) => {
            const matches = comment.category === "paid";
            if (matches) {
              console.log(`✅ Found paid comment in company: ${company.company_name}`, comment);
            }
            return matches;
          });
          return hasPaidComment;
        });
        
        console.log(`📊 Companies with paid comments: ${companiesWithPaidComment.length} out of ${paidByComment.length} total companies`);

        // Merge and deduplicate by company id
        const companyMap = new Map<string, any>();
        
        // Add companies from is_paid field
        allCompanies.forEach(company => {
          companyMap.set(company.id, company);
        });

        // Add companies from paid comments
        companiesWithPaidComment.forEach(company => {
          if (!companyMap.has(company.id)) {
            companyMap.set(company.id, company);
          }
        });

        allCompanies = Array.from(companyMap.values());
        
        // Sort by payment_date if available, otherwise by latest paid comment date
        allCompanies.sort((a, b) => {
          if (a.payment_date && b.payment_date) {
            return new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime();
          }
          if (a.payment_date) return -1;
          if (b.payment_date) return 1;
          
          // Sort by latest paid comment date
          const aPaidComment = a.comments?.find((c: any) => c.category === "paid");
          const bPaidComment = b.comments?.find((c: any) => c.category === "paid");
          if (aPaidComment && bPaidComment) {
            return new Date(bPaidComment.created_at).getTime() - new Date(aPaidComment.created_at).getTime();
          }
          return 0;
        });
      } else if (paidByCommentError) {
        throw paidByCommentError;
      }

      // Sort comments by created_at descending for each company
      const companiesWithSortedComments = allCompanies.map(company => ({
        ...company,
        comments: company.comments?.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ) || []
      }));
      
      console.log(`💰 Paid Client Pool: Displaying ${companiesWithSortedComments.length} paid companies`);
      setCompanies(companiesWithSortedComments);
    } catch (error: any) {
      console.error("Error fetching paid clients:", error);
      toast.error(error.message || "Failed to fetch paid clients");
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (companyId: string) => {
    const commentText = commentTexts[companyId]?.trim();
    if (!commentText) {
      toast.error("Please enter a comment");
      return;
    }

    setSavingComments(prev => ({ ...prev, [companyId]: true }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("comments")
        .insert([
          {
            company_id: companyId,
            user_id: user.id,
            comment_text: commentText,
            category: "general",
            comment_date: new Date().toISOString(),
          },
        ]);

      if (error) throw error;

      // Clear the comment text for this company
      setCommentTexts(prev => {
        const newTexts = { ...prev };
        delete newTexts[companyId];
        return newTexts;
      });

      toast.success("Comment added successfully");
      fetchPaidClients(); // Refresh to show new comment
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast.error(error.message || "Failed to add comment");
    } finally {
      setSavingComments(prev => {
        const newSaving = { ...prev };
        delete newSaving[companyId];
        return newSaving;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-primary" />
            Paid Client Pool
          </h2>
          <p className="text-muted-foreground mt-1 text-white">
            View and manage clients who have made payments
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {companies.length} {companies.length === 1 ? "Client" : "Clients"}
        </Badge>
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-white mb-2">No Paid Clients</p>
            <p className="text-sm text-muted-foreground">
              No clients have been marked as paid yet. Mark clients as paid to see them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => {
            const lastComment = company.comments?.[0];
            const commentText = commentTexts[company.id] || "";
            const isSaving = savingComments[company.id] || false;

            return (
              <Card key={company.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="truncate">{company.company_name}</span>
                      </CardTitle>
                      {company.owner_name && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {company.owner_name}
                        </p>
                      )}
                    </div>
                    <Badge className="bg-green-600 text-white flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Paid
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    {company.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{company.phone}</span>
                      </div>
                    )}
                    {company.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{company.email}</span>
                      </div>
                    )}
                    {company.address && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{company.address}</span>
                      </div>
                    )}
                    {company.payment_date && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>Paid on: {new Date(company.payment_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {company.payment_amount && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <DollarSign className="h-4 w-4 flex-shrink-0" />
                        <span>Amount: ${Number(company.payment_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {company.assigned_to && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4 flex-shrink-0" />
                        <span>Assigned to: {company.assigned_to.display_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Comments Section */}
                  <div className="border-t pt-3">
                    <button
                      onClick={() => {
                        setExpandedComments(prev => ({
                          ...prev,
                          [company.id]: !prev[company.id]
                        }));
                      }}
                      className="flex items-center justify-between w-full mb-2 hover:bg-muted/50 rounded p-2 -m-2 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <p className="text-xs font-medium text-white">
                          Comments
                        </p>
                        {company.comments && company.comments.length > 0 && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            {company.comments.length}
                          </Badge>
                        )}
                      </div>
                      {company.comments && company.comments.length > 0 && (
                        expandedComments[company.id] ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )
                      )}
                    </button>
                    {expandedComments[company.id] && company.comments && company.comments.length > 0 && (
                      <div className="space-y-2 max-h-64 overflow-y-auto mt-2">
                        {company.comments.map((comment: any) => (
                          <div key={comment.id} className="bg-muted/50 p-3 rounded-lg border border-muted">
                            {comment.comment_text ? (
                              <p className="text-sm text-foreground leading-relaxed mb-2 break-words font-medium">
                                {comment.comment_text}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground italic mb-2">No comment text</p>
                            )}
                            <div className="text-muted-foreground text-[10px] space-y-0.5 border-t border-muted pt-2 mt-2">
                              <p>
                                <span className="font-medium text-foreground">{comment.user?.display_name || comment.user?.email || "Unknown"}</span>
                                {comment.user?.email && comment.user?.display_name && (
                                  <span className="text-muted-foreground/70"> ({comment.user.email})</span>
                                )}
                              </p>
                              <p className="text-muted-foreground/80">
                                {new Date(comment.created_at).toLocaleDateString()} {new Date(comment.created_at).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {expandedComments[company.id] && (!company.comments || company.comments.length === 0) && (
                      <p className="text-xs text-muted-foreground mt-2">No comments yet.</p>
                    )}
                  </div>

                  {/* Comment Input Box */}
                  <div className="border-t pt-3 space-y-2">
                    <label className="text-xs font-medium text-white flex items-center gap-2">
                      <MessageSquare className="h-3 w-3" />
                      Add Comment
                    </label>
                    <Textarea
                      placeholder="Type your comment here..."
                      value={commentText}
                      onChange={(e) =>
                        setCommentTexts((prev) => ({
                          ...prev,
                          [company.id]: e.target.value,
                        }))
                      }
                      className="min-h-[80px] text-sm resize-none bg-background text-white placeholder:text-white/60"
                      disabled={isSaving}
                    />
                    <Button
                      onClick={() => handleAddComment(company.id)}
                      disabled={!commentText.trim() || isSaving}
                      size="sm"
                      className="w-full"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Add Comment
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PaidClientPoolView;

