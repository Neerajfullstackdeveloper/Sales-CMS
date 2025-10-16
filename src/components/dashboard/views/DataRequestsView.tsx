import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const DataRequestsView = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("data_requests")
      .select(`
        *,
        requested_by:profiles!requested_by_id(display_name, email)
      `)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRequests(data);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (requestId: string, status: "approved" | "rejected" | "pending") => {
    try {
      const { error } = await supabase
        .from("data_requests")
        .update({ status })
        .eq("id", requestId);

      if (error) throw error;

      toast.success(`Request ${status}`);
      fetchRequests();
    } catch (error: any) {
      toast.error(error.message || "Failed to update request");
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
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">Data Requests</h2>
      
      <div className="space-y-4">
        {requests.length === 0 ? (
          <p className="text-muted-foreground">No data requests.</p>
        ) : (
          requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {request.requested_by.display_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {request.requested_by.email}
                    </p>
                  </div>
                  <Badge
                    variant={
                      request.status === "approved"
                        ? "default"
                        : request.status === "rejected"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {request.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4">{request.message}</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Requested on {new Date(request.created_at).toLocaleString()}
                </p>
                {request.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(request.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleUpdateStatus(request.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default DataRequestsView;
