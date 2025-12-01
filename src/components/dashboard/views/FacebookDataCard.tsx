import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { User, Mail, Calendar, MessageSquare, Clock, Loader2, Edit, Pencil, Trash2, Phone, Share2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FacebookDataCardProps {
  data: {
    id: number;
    name: string | null;
    email: string | null;
    phone?: string | null;
    company_name?: string | null;
    owner_name?: string | null;
    products?: string | null;
    services?: string | null;
    created_at: string;
    shared_at?: string | null;
    comments?: any[];
  };
  onUpdate: () => void;
  userRole?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onRequestEdit?: () => void;
  canEdit?: boolean;
  approvedForEdit?: boolean;
}

// Map database category names to display names
const mapDbCategoryToDisplay = (dbCategory: string): string => {
  const mapping: Record<string, string> = {
    "hot": "prime",
    "follow_up": "active",
    "block": "inactive",
    "general": "general",
    // Also handle if already in display format
    "prime": "prime",
    "active": "active",
    "inactive": "inactive"
  };
  return mapping[dbCategory] || dbCategory;
};

// Map display category names to database names
const mapDisplayCategoryToDb = (displayCategory: string): string => {
  const mapping: Record<string, string> = {
    "prime": "hot",
    "active": "follow_up",
    "inactive": "block",
    "general": "general"
  };
  return mapping[displayCategory] || displayCategory;
};

const categoryColors = {
  prime: "bg-[hsl(var(--hot))] text-[hsl(var(--hot-foreground))]",
  active: "bg-[hsl(var(--follow-up))] text-[hsl(var(--follow-up-foreground))]",
  inactive: "bg-[hsl(var(--block))] text-[hsl(var(--block-foreground))]",
  general: "bg-[hsl(var(--general))] text-[hsl(var(--general-foreground))]",
  // Keep old names for backward compatibility
  hot: "bg-[hsl(var(--hot))] text-[hsl(var(--hot-foreground))]",
  follow_up: "bg-[hsl(var(--follow-up))] text-[hsl(var(--follow-up-foreground))]",
  block: "bg-[hsl(var(--block))] text-[hsl(var(--block-foreground))]",
};

const getCategoryIcon = (category: string) => {
  const displayCategory = mapDbCategoryToDisplay(category);
  switch (displayCategory) {
    case 'prime': return '🔥';
    case 'active': return '📅';
    case 'inactive': return '🚫';
    case 'general': return '📋';
    default: return '📄';
  }
};

const getCategoryColor = (category: string) => {
  const displayCategory = mapDbCategoryToDisplay(category);
  switch (displayCategory) {
    case 'prime': return 'bg-red-100 text-red-800 border-red-200';
    case 'active': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'general': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-blue-100 text-blue-800 border-blue-200';
  }
};

const getCategoryDisplayName = (category: string): string => {
  const displayCategory = mapDbCategoryToDisplay(category);
  switch (displayCategory) {
    case 'prime': return 'Prime Pool';
    case 'active': return 'Active Pool';
    case 'inactive': return 'Inactive Pool';
    case 'general': return 'General Data';
    default: return displayCategory.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
};

const FacebookDataCard = ({ 
  data, 
  onUpdate, 
  userRole, 
  onEdit, 
  onDelete, 
  onRequestEdit,
  canEdit = false,
  approvedForEdit = false,
}: FacebookDataCardProps) => {
  const [commentText, setCommentText] = useState("");
  const [category, setCategory] = useState("general");
  const [commentDate, setCommentDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const lastComment = data.comments?.[0];
  const comments = data.comments || [];

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      // When dialog opens, set category to last comment's category (mapped to display name) or default to general
      if (lastComment?.category) {
        setCategory(mapDbCategoryToDisplay(lastComment.category));
      } else {
        setCategory("general");
      }
      setCommentText("");
      setCommentDate("");
    } else {
      // Reset when dialog closes
      setCommentText("");
      setCommentDate("");
      // Keep category as last comment's category (mapped to display name) for next time
      if (lastComment?.category) {
        setCategory(mapDbCategoryToDisplay(lastComment.category));
      } else {
        setCategory("general");
      }
    }
  }, [open, lastComment?.category]);

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    // For employees, date is mandatory
    if (userRole !== "admin" && !commentDate) {
      toast.error("Please select a date for your comment");
      return;
    }

    // Validate category (using display names)
    const validCategories = ["active", "prime", "inactive", "general"];
    if (!validCategories.includes(category)) {
      toast.error("Please select a valid category");
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      if (!userData.user) {
        throw new Error("Not authenticated");
      }

      // Check if category is changing (compare display names)
      const lastCommentDisplayCategory = lastComment?.category ? mapDbCategoryToDisplay(lastComment.category) : null;
      const isCategoryChanging = lastCommentDisplayCategory && lastCommentDisplayCategory !== category;
      
      // Map display category name to database category name
      const commentCategory = mapDisplayCategoryToDb(category) as "follow_up" | "hot" | "block" | "general";
      
      const { error } = await (supabase
        .from("facebook_data_comments" as any)
        .insert([
          {
            facebook_data_id: data.id,
            user_id: userData.user.id,
            comment_text: commentText.trim(),
            category: commentCategory,
            comment_date: commentDate || null,
          },
        ]) as any);

      if (error) {
        console.error("Error adding comment:", error);
        
        // Check if table doesn't exist (404 error)
        const errorMessage = error.message || "";
        const errorCode = error.code || "";
        const errorStatus = (error as any).status || (error as any).statusCode;
        
        if (
          errorCode === "PGRST205" || 
          errorCode === "42P01" ||
          errorStatus === 404 ||
          errorMessage.toLowerCase().includes("could not find") || 
          errorMessage.toLowerCase().includes("does not exist") ||
          errorMessage.toLowerCase().includes("relation") && errorMessage.toLowerCase().includes("does not exist") ||
          errorMessage.includes("404")
        ) {
          toast.error(
            "The comments table is not found. Please run the SQL script: create_facebook_data_comments_table.sql in Supabase SQL Editor.",
            { duration: 12000 }
          );
          console.error("Table missing. Run the migration: 20250117000004_create_facebook_data_comments.sql");
          return;
        }
        
        throw error;
      }

      if (isCategoryChanging) {
        toast.success(`Comment added successfully! Category changed from ${getCategoryDisplayName(lastComment.category)} to ${getCategoryDisplayName(category)}.`);
      } else {
        toast.success(`Comment added successfully! Category: ${getCategoryDisplayName(category)}`);
      }
      
      setCommentText("");
      setCommentDate("");
      setOpen(false);
      // Refresh the data
      onUpdate();
    } catch (error: any) {
      console.error("Failed to add comment:", error);
      toast.error(error.message || "Failed to add comment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/20 border-2 overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold mb-2 text-foreground">
              <User className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="truncate">{data.name || data.company_name || "Unknown"}</span>
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              ID: {data.id}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onDelete && (
              <Button
                variant="destructive"
                size="icon"
                onClick={onDelete}
                className="hover:scale-110 active:scale-95 transition-transform shrink-0 h-8 w-8"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0 overflow-hidden">
        <div className="space-y-2.5 text-sm">
          {data.phone && (
            <div className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground transition-colors">
              <Phone className="h-4 w-4 flex-shrink-0 text-primary" />
              <a href={`tel:${data.phone}`} className="hover:underline truncate text-sm text-foreground">{data.phone}</a>
            </div>
          )}
          {data.email && (
            <div className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="h-4 w-4 flex-shrink-0 text-primary" />
              <a href={`mailto:${data.email}`} className="hover:underline truncate text-sm text-foreground">{data.email}</a>
            </div>
          )}
          {data.company_name && (
            <div className="text-sm text-foreground">
              <span className="font-semibold">Company:</span>{" "}
              <span className="break-words">{data.company_name}</span>
            </div>
          )}
          {data.owner_name && (
            <div className="text-sm text-foreground">
              <span className="font-semibold">Owner:</span>{" "}
              <span className="break-words">{data.owner_name}</span>
            </div>
          )}
          {data.products && (
            <div className="text-sm text-foreground">
              <span className="font-semibold">Products:</span>{" "}
              <span className="break-words whitespace-pre-wrap">{data.products}</span>
            </div>
          )}
          {data.services && (
            <div className="text-sm text-foreground">
              <span className="font-semibold">Services:</span>{" "}
              <span className="break-words whitespace-pre-wrap">{data.services}</span>
            </div>
          )}
          {lastComment && userRole !== "admin" && (
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground pt-1 border-t">
              <div>
                <span className="font-semibold text-foreground">Current Category:</span>{" "}
                <span>
                  {getCategoryIcon(lastComment.category)} {getCategoryDisplayName(lastComment.category)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-primary" />
                <span>
                  <span className="font-semibold text-foreground">Category Updated:</span>{" "}
                  {new Date(lastComment.comment_date || lastComment.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            {data.created_at && (
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Calendar className="h-4 w-4 flex-shrink-0 text-primary" />
                <span className="text-sm text-foreground">
                  <span className="font-semibold">Uploaded:</span>{" "}
                  {new Date(data.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}
            {data.shared_at && (
              <div className="flex items-center gap-2.5 text-primary">
                <Share2 className="h-4 w-4 flex-shrink-0 text-primary" />
                <span className="text-sm text-foreground">
                  <span className="font-semibold">Shared:</span>{" "}
                  {new Date(data.shared_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {lastComment && userRole === "admin" && (
          <div className="border-t pt-4 bg-muted/30 rounded-lg p-3 -mx-1 text-white">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Last Comment</p>
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                {getCategoryIcon(lastComment.category)} {getCategoryDisplayName(lastComment.category)}
              </Badge>
            </div>
            <p className="text-sm text-foreground leading-relaxed mb-2">{lastComment.comment_text}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastComment.comment_date
                ? new Date(lastComment.comment_date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })
                : new Date(lastComment.created_at).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
            </p>
          </div>
        )}

        <div className={`flex gap-2 pt-3 border-t flex-wrap w-full ${userRole !== "admin" ? "gap-1.5" : "gap-2"}`}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className={`${userRole !== "admin" ? "flex-1 h-8 text-xs px-2 min-w-0" : "flex-1 min-w-[100px] max-w-full"} bg-primary text-white hover:bg-primary hover:text-white transition-colors font-medium`}
              >
                <MessageSquare className={`${userRole !== "admin" ? "mr-1.5 h-3.5 w-3.5 flex-shrink-0" : "mr-2 h-4 w-4 flex-shrink-0"} text-white`} />
                <span className={`${userRole !== "admin" ? "text-xs " : ""} truncate text-white`}>Add Comment</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center gap-2 text-white">
                  <User className="h-5 w-5 text-primary" />
                  Add Comment - {data.name || "Unknown"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white">Comment</label>
                  <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Enter your comment..."
                    rows={5}
                    className="resize-none text-white placeholder:text-white/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-white">
                      Date {userRole !== "admin" && <span className="text-destructive">*</span>}
                    </label>
                    <Input
                      type="date"
                      value={commentDate}
                      onChange={(e) => setCommentDate(e.target.value)}
                      className="w-full text-white [color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-white">Category</label>
                      {lastComment && (
                        <span className="text-xs text-white/70">
                          Current: {getCategoryIcon(lastComment.category)} {getCategoryDisplayName(lastComment.category)}
                        </span>
                      )}
                    </div>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="w-full text-white">
                        <SelectValue>
                          <span className="flex items-center gap-2 text-white">
                            {getCategoryIcon(category)} {getCategoryDisplayName(category)}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">
                          <span className="flex items-center gap-2">
                            {getCategoryIcon('active')} Active Pool
                          </span>
                        </SelectItem>
                        <SelectItem value="prime">
                          <span className="flex items-center gap-2">
                            {getCategoryIcon('prime')} Prime Pool
                          </span>
                        </SelectItem>
                        <SelectItem value="inactive">
                          <span className="flex items-center gap-2">
                            {getCategoryIcon('inactive')} Inactive Pool
                          </span>
                        </SelectItem>
                        <SelectItem value="general">
                          <span className="flex items-center gap-2">
                            {getCategoryIcon('general')} General Data
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-white/70">
                      This will update the category to: <span className="font-semibold text-white">{getCategoryIcon(category)} {getCategoryDisplayName(category)}</span>
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={handleAddComment} 
                  disabled={loading || !commentText.trim()} 
                  className="w-full font-semibold"
                >
                  {loading ? (
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
            </DialogContent>
          </Dialog>

          {comments.length > 0 && (
            <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className={`${userRole !== "admin" ? "h-8 w-8 p-0 relative flex-shrink-0" : "flex-shrink-0"} bg-primary text-white hover:bg-primary hover:text-white transition-colors`}
                >
                  <MessageSquare className={`${userRole !== "admin" ? "h-3.5 w-3.5" : "mr-1.5 h-3.5 w-3.5"} text-white`} />
                  {userRole === "admin" && <span className="font-semibold">{comments.length}</span>}
                  {userRole !== "admin" && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full h-4 w-4 flex items-center justify-center text-[10px] font-semibold ">
                      {comments.length}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[85vh]">
                <DialogHeader>
                  <DialogTitle className="text-xl flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Comments for {data.name || "Unknown"}
                    <Badge variant="secondary" className="ml-2">{comments.length} total</Badge>
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[65vh] pr-4">
                  <div className="space-y-4">
                    {comments
                      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((comment: any) => (
                      <Card key={comment.id} className="p-4 hover:shadow-md transition-shadow border-l-4 border-l-primary/50">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20">
                              <span className="text-sm font-bold text-primary">
                                {comment.user?.display_name?.charAt(0) || 'U'}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-foreground">
                                {comment.user?.display_name || 'Unknown User'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {comment.user?.email}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {userRole === "admin" && (
                              <Badge className={`text-xs font-semibold ${getCategoryColor(mapDbCategoryToDisplay(comment.category))}`}>
                                {getCategoryIcon(comment.category)} {getCategoryDisplayName(comment.category)}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(comment.created_at).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed pl-1">
                          {comment.comment_text}
                        </p>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          )}

          {userRole === "admin" ? (
            <>
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEdit}
                  className="flex-1 min-w-[80px] max-w-full bg-primary text-white hover:bg-primary hover:text-white transition-colors font-medium"
                >
                  <Edit className="mr-2 h-4 w-4 flex-shrink-0 text-white" />
                  <span className="truncate text-white">Edit</span>
                </Button>
              )}
            </>
          ) : (
            <>
              {approvedForEdit ? (
                // When request is approved, show a non-clickable "Approved" state
                <Button
                  variant="default"
                  size="sm"
                  disabled
                  className="flex-1 h-8 text-xs px-2 bg-green-600 hover:bg-green-600 cursor-default font-medium text-white"
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-white" />
                  <span className="text-xs text-white">Edit Request Approved</span>
                </Button>
              ) : onRequestEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRequestEdit}
                  className="bg-primary text-white hover:bg-primary hover:text-white transition-colors"
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5 text-white" />
                  <span className="text-xs text-white">Request Edit</span>
                </Button>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FacebookDataCard;

