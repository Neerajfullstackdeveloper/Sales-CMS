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
import { Building2, Phone, Mail, MapPin, MessageSquare, Trash2, Clock } from "lucide-react";
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
  
  // Set default category based on the last comment
  React.useEffect(() => {
    if (lastComment?.category) {
      setCategory(lastComment.category);
    }
  }, [lastComment?.category]);

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // Check if category is changing
      const isCategoryChanging = lastComment?.category && lastComment.category !== category;
      
      const { error } = await supabase.from("comments").insert([
        {
          company_id: company.id,
          user_id: userData.user?.id,
          comment_text: commentText,
          category: category as "follow_up" | "hot" | "block" | "general",
          comment_date: commentDate || null,
        },
      ]);

      if (error) throw error;

      if (isCategoryChanging) {
        toast.success(`Comment added successfully! Company moved from ${lastComment.category.replace('_', ' ')} to ${category.replace('_', ' ')} category.`);
      } else {
        toast.success("Comment added successfully!");
      }
      
      setCommentText("");
      setCommentDate("");
      setOpen(false);
      onUpdate();
    } catch (error: any) {
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
    <Card>
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
            <Badge className={cn("ml-2", categoryColors[lastComment.category as keyof typeof categoryColors])}>
              {lastComment.category.replace("_", " ")}
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
          {company.products_services && (
            <div className="text-muted-foreground">
              <span className="font-medium">Products & Services:</span>{" "}
              <span>{company.products_services}</span>
            </div>
          )}
          {showAssignedTo && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-medium">Assigned to:</span>
              {company.assigned_to ? (
                company.assigned_to.display_name
              ) : (
                <span className="text-orange-600 font-medium">Unassigned</span>
              )}
            </div>
          )}
        </div>

        {lastComment && (
          <div className="border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Last Comment</p>
            <p className="text-sm">{lastComment.comment_text}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Added: {lastComment.comment_date
                ? new Date(lastComment.comment_date).toLocaleDateString()
                : new Date(lastComment.created_at).toLocaleString()}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1">
                <MessageSquare className="mr-2 h-4 w-4" />
                Add Comment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Comment - {company.company_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Comment</label>
                  <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Enter your comment..."
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date (optional)</label>
                  <Input
                    type="date"
                    value={commentDate}
                    onChange={(e) => setCommentDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="follow_up">Follow Up</SelectItem>
                      <SelectItem value="hot">Hot</SelectItem>
                      <SelectItem value="block">Block</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddComment} disabled={loading} className="w-full">
                  Add Comment
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {company.comments && company.comments.length > 0 && (
            <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <MessageSquare className="mr-1 h-3 w-3" />
                  View All ({company.comments.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Comments for {company.company_name}
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[60vh] pr-4">
                  <div className="space-y-4">
                    {company.comments
                      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((comment: any) => (
                      <Card key={comment.id} className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium text-blue-600">
                                {comment.user?.display_name?.charAt(0) || 'U'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {comment.user?.display_name || 'Unknown User'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {comment.user?.email}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`text-xs ${getCategoryColor(comment.category)}`}>
                              {getCategoryIcon(comment.category)} {comment.category.replace('_', ' ')}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(comment.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {comment.comment_text}
                        </p>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          )}

          {canDelete && userRole === "admin" && (
            <Button variant="destructive" size="icon" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CompanyCard;
