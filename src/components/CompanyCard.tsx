import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Building2, Phone, Mail, MapPin, MessageSquare, Trash2, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyCardProps {
  company: any;
  onUpdate: () => void;
  canDelete?: boolean;
  showAssignedTo?: boolean;
  userRole?: string;
}

const categoryColors = {
  hot: "bg-[hsl(var(--hot))] text-[hsl(var(--hot-foreground))]",
  follow_up: "bg-[hsl(var(--follow-up))] text-[hsl(var(--follow-up-foreground))]",
  block: "bg-[hsl(var(--block))] text-[hsl(var(--block-foreground))]",
  general: "bg-[hsl(var(--general))] text-[hsl(var(--general-foreground))]",
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

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'hot': return 'bg-red-100 text-red-800 border-red-200';
    case 'follow_up': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'block': return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'general': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-blue-100 text-blue-800 border-blue-200';
  }
};

const CompanyCard = ({ company, onUpdate, canDelete, showAssignedTo, userRole }: CompanyCardProps) => {
  const [commentText, setCommentText] = useState("");
  const [category, setCategory] = useState("general");
  const [commentDate, setCommentDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const lastComment = company.comments?.[0];
  
  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      // When dialog opens, set category to last comment's category or default to general
      if (lastComment?.category) {
        setCategory(lastComment.category);
      } else {
        setCategory("general");
      }
      setCommentText("");
      setCommentDate("");
    } else {
      // Reset when dialog closes
      setCommentText("");
      setCommentDate("");
      // Keep category as last comment's category for next time
      if (lastComment?.category) {
        setCategory(lastComment.category);
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

    // Validate category
    const validCategories = ["follow_up", "hot", "block", "general"];
    if (!validCategories.includes(category)) {
      toast.error("Please select a valid category");
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // Check if category is changing
      const isCategoryChanging = lastComment?.category && lastComment.category !== category;
      
      // Ensure category is properly formatted
      const commentCategory = category as "follow_up" | "hot" | "block" | "general";
      
      const { error } = await supabase.from("comments").insert([
        {
          company_id: company.id,
          user_id: userData.user?.id,
          comment_text: commentText.trim(),
          category: commentCategory,
          comment_date: commentDate || null,
        },
      ]);

      if (error) {
        console.error("Error adding comment:", error);
        throw error;
      }

      if (isCategoryChanging) {
        toast.success(`Comment added successfully! Company moved from ${lastComment.category.replace('_', ' ')} to ${category.replace('_', ' ')} category.`);
      } else {
        toast.success(`Comment added successfully! Category: ${category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`);
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

  const handleDelete = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("companies")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by_id: userData.user?.id
        })
        .eq("id", company.id);

      if (error) {
        // If the columns don't exist yet, fall back to hard delete
        if (error.message.includes("deleted_by_id") || error.message.includes("deleted_at")) {
          const { error: deleteError } = await supabase
            .from("companies")
            .delete()
            .eq("id", company.id);
          
          if (deleteError) throw deleteError;
          toast.success("Company deleted successfully!");
        } else {
          throw error;
        }
      } else {
        toast.success("Company moved to recycle bin successfully!");
      }
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete company");
    }
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/20 border-2">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold mb-2">
              <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="truncate">{company.company_name}</span>
            </CardTitle>
            {company.owner_name && (
              <p className="text-sm text-muted-foreground font-medium">{company.owner_name}</p>
            )}
          </div>
          {lastComment && (
            <Badge 
              className={cn(
                "ml-2 flex-shrink-0 font-semibold text-xs px-2.5 py-1 shadow-sm",
                categoryColors[lastComment.category as keyof typeof categoryColors]
              )}
            >
              {getCategoryIcon(lastComment.category)} {lastComment.category.replace("_", " ").toUpperCase()}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="space-y-2.5 text-sm">
          <div className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground transition-colors">
            <Phone className="h-4 w-4 flex-shrink-0 text-primary/70" />
            <a href={`tel:${company.phone}`} className="hover:underline truncate">{company.phone}</a>
          </div>
          {company.email && (
            <div className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="h-4 w-4 flex-shrink-0 text-primary/70" />
              <a href={`mailto:${company.email}`} className="hover:underline truncate text-sm">{company.email}</a>
            </div>
          )}
          {company.address && (
            <div className="flex items-start gap-2.5 text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 text-primary/70" />
              <span className="text-sm leading-relaxed">{company.address}</span>
            </div>
          )}
          {company.products_services && (
            <div className="text-muted-foreground pt-1 border-t">
              <span className="font-semibold text-foreground">Products & Services:</span>{" "}
              <span className="text-sm">{company.products_services}</span>
            </div>
          )}
          {showAssignedTo && (
            <div className="flex items-center gap-2 text-muted-foreground pt-1 border-t">
              <span className="font-semibold text-foreground">Assigned to:</span>
              {company.assigned_to ? (
                <span className="text-sm">{company.assigned_to.display_name}</span>
              ) : (
                <span className="text-sm text-orange-600 font-medium">Unassigned</span>
              )}
            </div>
          )}
        </div>

        {lastComment && (
          <div className="border-t pt-4 bg-muted/30 rounded-lg p-3 -mx-1">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Last Comment</p>
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                {getCategoryIcon(lastComment.category)} {lastComment.category.replace('_', ' ')}
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

        <div className="flex gap-2 pt-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1 hover:bg-primary hover:text-primary-foreground transition-colors">
                <MessageSquare className="mr-2 h-4 w-4" />
                Add Comment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Add Comment - {company.company_name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Comment</label>
                  <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Enter your comment..."
                    rows={5}
                    className="resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Date (optional)</label>
                    <Input
                      type="date"
                      value={commentDate}
                      onChange={(e) => setCommentDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-foreground">Category</label>
                      {lastComment && (
                        <span className="text-xs text-muted-foreground">
                          Current: {getCategoryIcon(lastComment.category)} {lastComment.category.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          <span className="flex items-center gap-2">
                            {getCategoryIcon(category)} {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="follow_up">
                          <span className="flex items-center gap-2">
                            {getCategoryIcon('follow_up')} Active Pool
                          </span>
                        </SelectItem>
                        <SelectItem value="hot">
                          <span className="flex items-center gap-2">
                            {getCategoryIcon('hot')} Prime Pool
                          </span>
                        </SelectItem>
                        <SelectItem value="block">
                          <span className="flex items-center gap-2">
                            {getCategoryIcon('block')} Inactive Pool
                          </span>
                        </SelectItem>
                        <SelectItem value="general">
                          <span className="flex items-center gap-2">
                            {getCategoryIcon('general')} General Data
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      This will update the company's category to: <span className="font-semibold text-foreground">{getCategoryIcon(category)} {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
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

          {company.comments && company.comments.length > 0 && (
            <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="hover:bg-primary hover:text-primary-foreground transition-colors">
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                  <span className="font-semibold">{company.comments.length}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[85vh]">
                <DialogHeader>
                  <DialogTitle className="text-xl flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Comments for {company.company_name}
                    <Badge variant="secondary" className="ml-2">{company.comments.length} total</Badge>
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[65vh] pr-4">
                  <div className="space-y-4">
                    {company.comments
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
                            <Badge className={`text-xs font-semibold ${getCategoryColor(comment.category)}`}>
                              {getCategoryIcon(comment.category)} {comment.category.replace('_', ' ')}
                            </Badge>
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

          {canDelete && (
            <Button 
              variant="destructive" 
              size="icon" 
              onClick={handleDelete}
              className="hover:scale-105 transition-transform"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CompanyCard;
