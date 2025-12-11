import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, Building2, TrendingUp, Calendar, ChevronDown, ChevronRight, Eye, Phone, Mail, MapPin, MessageSquare, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface EmployeeDataOverviewViewProps {
  userId: string;
}

interface TeamMember {
  id: string;
  display_name: string;
  email: string;
  company_count: number;
  companies: any[];
  hot_data_count: number;
  follow_up_count: number;
  block_count: number;
  general_count: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const EmployeeDataOverviewView = ({ userId }: EmployeeDataOverviewViewProps) => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [teamLeadData, setTeamLeadData] = useState<TeamMember | null>(null);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [selectedCompanyComments, setSelectedCompanyComments] = useState<any>(null);

  useEffect(() => {
    fetchTeamDataOverview();
  }, [userId]);

  const fetchTeamDataOverview = async () => {
    setLoading(true);
    
    try {
      // Get team information
      const { data: teamData } = await supabase
        .from("teams")
        .select("id, name")
        .eq("team_lead_id", userId)
        .single();

      if (!teamData) {
        setLoading(false);
        return;
      }

      // Get team members
      const { data: membersData } = await supabase
        .from("team_members")
        .select("*, employee:profiles!employee_id(*)")
        .eq("team_id", teamData.id);

      // Get team lead profile
      const { data: teamLeadProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      // Get all team member IDs (including team lead)
      const memberIds = [
        userId,
        ...(membersData || []).map((m) => m.employee_id)
      ];

      // Get all companies assigned to team members
      const { data: companiesData } = await supabase
        .from("companies")
        .select(`
          *,
          comments (
            id,
            comment_text,
            category,
            created_at,
            user_id,
            user:profiles!user_id (
              display_name,
              email
            )
          )
        `)
        .in("assigned_to_id", memberIds);

      // Get facebook shares for team members (to include FB counts like employee dashboard)
      const { data: fbShares } = await (supabase
        .from("facebook_data_shares" as any)
        .select("facebook_data_id, employee_id")
        .in("employee_id", memberIds) as any);

      // Build latest comment map per facebook_data_id
      let fbLatestMap = new Map<number, any>();
      if (fbShares && fbShares.length > 0) {
        const fbIds = fbShares.map((s: any) => s.facebook_data_id);
        const { data: fbComments } = await (supabase
          .from("facebook_data_comments" as any)
          .select("facebook_data_id, category, created_at")
          .in("facebook_data_id", fbIds) as any);

        if (fbComments) {
          fbComments.forEach((comment: any) => {
            const existing = fbLatestMap.get(comment.facebook_data_id);
            if (!existing || new Date(comment.created_at) > new Date(existing.created_at)) {
              fbLatestMap.set(comment.facebook_data_id, comment);
            }
          });
        }
      }

      if (!companiesData) {
        setLoading(false);
        return;
      }

      // Helper to get facebook latest comments for an employee
      const getFbLatestForEmployee = (employeeId: string) => {
        if (!fbShares) return [];
        const fbIds = fbShares.filter((s: any) => s.employee_id === employeeId).map((s: any) => s.facebook_data_id);
        return fbIds.map((id: number) => fbLatestMap.get(id)).filter(Boolean);
      };

      // Process team lead data
      const teamLeadCompanies = companiesData.filter(c => c.assigned_to_id === userId);
      const teamLeadFbLatest = getFbLatestForEmployee(userId);
      const teamLeadStats = calculateEmployeeStats(teamLeadCompanies, teamLeadProfile, teamLeadFbLatest);
      setTeamLeadData(teamLeadStats);

      // Process team members data
      const membersWithStats = (membersData || []).map(member => {
        const memberCompanies = companiesData.filter(c => c.assigned_to_id === member.employee_id);
        const memberFbLatest = getFbLatestForEmployee(member.employee_id);
        return calculateEmployeeStats(memberCompanies, member.employee, memberFbLatest);
      });

      setTeamMembers(membersWithStats);
      setTotalCompanies(companiesData.length);

    } catch (error) {
      console.error("Error fetching team data overview:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMemberExpansion = (memberId: string) => {
    const newExpanded = new Set(expandedMembers);
    if (newExpanded.has(memberId)) {
      newExpanded.delete(memberId);
    } else {
      newExpanded.add(memberId);
    }
    setExpandedMembers(newExpanded);
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'hot': return '🔥';
      case 'follow_up': return '📅';
      case 'block': return '🚫';
      case 'general': return '📋';
      default: return '📄';
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'hot': return 'Prime Pool';
      case 'follow_up': return 'Active Pool';
      case 'block': return 'Inactive Pool';
      case 'general': return 'General';
      default: return 'General';
    }
  };

  const groupCompaniesByCategory = (companies: any[]) => {
    const grouped: Record<string, any[]> = {
      hot: [],
      follow_up: [],
      block: [],
      general: []
    };

    companies.forEach((company) => {
      const latestComment = company.comments?.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      const category = latestComment?.category || 'general';
      grouped[category] = grouped[category] || [];
      grouped[category].push(company);
    });

    return grouped;
  };

  const renderCompanyCard = (company: any) => {
    const latestComment = company.comments?.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    const category = latestComment?.category || 'general';
    
    return (
      <Card key={company.id} className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h5 className="font-medium text-sm">{company.company_name}</h5>
            <p className="text-xs text-muted-foreground">{company.owner_name}</p>
          </div>
          <Badge className={`text-xs ${getCategoryColor(category)}`}>
            {getCategoryIcon(category)} {getCategoryName(category)}
          </Badge>
        </div>
        
        <div className="space-y-1 text-xs text-muted-foreground">
          {company.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              <span>{company.phone}</span>
            </div>
          )}
          {company.email && (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span>{company.email}</span>
            </div>
          )}
          {company.address && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{company.address}</span>
            </div>
          )}
        </div>

        {company.products_services && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground">
              <strong>Services:</strong> {company.products_services}
            </p>
          </div>
        )}

        {company.comments && company.comments.length > 0 && (
          <div className="mt-2">
            <div className="mb-2">
              <p className="font-medium text-xs">Latest Comment:</p>
              <div className="p-2 bg-gray-50 rounded text-xs">
                <p className="text-muted-foreground">{latestComment.comment_text}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(latestComment.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 mt-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-xs h-7"
                    onClick={() => setSelectedCompanyComments(company)}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    View All Comments ({company.comments.length})
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
                        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
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
                                {getCategoryIcon(comment.category)} {getCategoryName(comment.category)}
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
            </div>
          </div>
        )}
      </Card>
    );
  };

  const calculateEmployeeStats = (companies: any[], profile: any, fbLatest: any[] = []): TeamMember => {
    let hotDataCount = 0;
    let followUpCount = 0;
    let blockCount = 0;

    companies.forEach((company) => {
      // Inactive if deletion_state='inactive'
      if (company.deletion_state === "inactive") {
        blockCount += 1;
        return;
      }
      const latestComment = company.comments && company.comments.length > 0
        ? [...company.comments].sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]
        : null;
      const category = latestComment?.category || null;
      if (category === "hot") hotDataCount += 1;
      else if (category === "follow_up") followUpCount += 1;
      else if (category === "block") blockCount += 1;
      // general handled after via remainder
    });

    // Include Facebook data latest categories (mirror EmployeeDashboard category counts)
    const fbHot = fbLatest.filter((c: any) => c?.category === "hot").length;
    const fbFollowUp = fbLatest.filter((c: any) => c?.category === "follow_up").length;
    const fbBlock = fbLatest.filter((c: any) => c?.category === "block").length;

    hotDataCount += fbHot;
    followUpCount += fbFollowUp;
    blockCount += fbBlock;

    const generalCount =
      companies.filter((company) => {
        if (company.deletion_state === "inactive") return false;
        if (!company.comments || company.comments.length === 0) return false; // only current (categorized) data
        const latestComment = [...company.comments].sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        return latestComment?.category === "general";
      }).length +
      fbLatest.filter((c: any) => c?.category === "general").length;

    return {
      id: profile.id,
      display_name: profile.display_name,
      email: profile.email,
      company_count: companies.length,
      companies: companies,
      hot_data_count: hotDataCount,
      follow_up_count: followUpCount,
      block_count: blockCount,
      general_count: generalCount,
    };
  };

  const prepareChartData = () => {
    const chartData = [];
    
    if (teamLeadData) {
      chartData.push({
        name: teamLeadData.display_name,
        total: teamLeadData.company_count,
        hot: teamLeadData.hot_data_count,
        followUp: teamLeadData.follow_up_count,
        block: teamLeadData.block_count,
        general: teamLeadData.general_count,
        isTeamLead: true
      });
    }

    teamMembers.forEach(member => {
      chartData.push({
        name: member.display_name,
        total: member.company_count,
        hot: member.hot_data_count,
        followUp: member.follow_up_count,
        block: member.block_count,
        general: member.general_count,
        isTeamLead: false
      });
    });

    return chartData;
  };

  const preparePieData = () => {
    const pieData = [
      { name: 'Prime Pool', value: (teamLeadData?.hot_data_count || 0) + teamMembers.reduce((sum, m) => sum + m.hot_data_count, 0) },
      { name: 'Active Pool', value: (teamLeadData?.follow_up_count || 0) + teamMembers.reduce((sum, m) => sum + m.follow_up_count, 0) },
      { name: 'Inactive Pool', value: (teamLeadData?.block_count || 0) + teamMembers.reduce((sum, m) => sum + m.block_count, 0) },
      { name: 'General', value: (teamLeadData?.general_count || 0) + teamMembers.reduce((sum, m) => sum + m.general_count, 0) },
    ];
    return pieData.filter(item => item.value > 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const chartData = prepareChartData();
  const pieData = preparePieData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white">Team Data Overview</h2>
        <div className="flex items-center gap-2 text-sm text-white">
          <Building2 className="h-4 w-4" />
          <span>Total Companies: {totalCompanies}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMembers.length + (teamLeadData ? 1 : 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompanies}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prime Pool</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(teamLeadData?.hot_data_count || 0) + teamMembers.reduce((sum, m) => sum + m.hot_data_count, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Pool</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(teamLeadData?.follow_up_count || 0) + teamMembers.reduce((sum, m) => sum + m.follow_up_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Companies per Team Member</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Team Member Data */}
      <Card>
        <CardHeader>
          <CardTitle>Team Member Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Team Lead */}
            {teamLeadData && (
              <div className="border rounded-lg p-4 bg-blue-50">
                <Collapsible 
                  open={expandedMembers.has(teamLeadData.id)}
                  onOpenChange={(open) => {
                    if (open) {
                      setExpandedMembers(prev => new Set(prev).add(teamLeadData.id));
                    } else {
                      setExpandedMembers(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(teamLeadData.id);
                        return newSet;
                      });
                    }
                  }}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between mb-3 cursor-pointer hover:bg-blue-100 p-2 rounded">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{teamLeadData.display_name}</h3>
                        <Badge variant="secondary">Team Lead</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-muted-foreground">
                          {teamLeadData.email}
                        </div>
                        {expandedMembers.has(teamLeadData.id) ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRight className="h-4 w-4" />
                        }
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{teamLeadData.company_count}</div>
                      <div className="text-sm text-muted-foreground">Total Companies</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{teamLeadData.hot_data_count}</div>
                      <div className="text-sm text-muted-foreground">Prime Pool</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{teamLeadData.follow_up_count}</div>
                      <div className="text-sm text-muted-foreground">Active Pool</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">{teamLeadData.block_count}</div>
                      <div className="text-sm text-muted-foreground">Inactive Pool</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{teamLeadData.general_count}</div>
                      <div className="text-sm text-muted-foreground">General</div>
                    </div>
                  </div>

                  <CollapsibleContent>
                    <div className="space-y-3">
                      {teamLeadData.companies.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No companies assigned</p>
                      ) : (
                        <Tabs defaultValue="all" className="w-full">
                          <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="all">All ({teamLeadData.companies.length})</TabsTrigger>
                            <TabsTrigger value="prime">Prime Pool ({teamLeadData.hot_data_count})</TabsTrigger>
                            <TabsTrigger value="active">Active Pool ({teamLeadData.follow_up_count})</TabsTrigger>
                            <TabsTrigger value="block">Inactive Pool ({teamLeadData.block_count})</TabsTrigger>
                            <TabsTrigger value="general">General ({teamLeadData.general_count})</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="all" className="mt-4">
                            <div className="grid gap-3 md:grid-cols-2">
                              {teamLeadData.companies.map((company: any) => renderCompanyCard(company))}
                            </div>
                          </TabsContent>
                          
                          {(() => {
                            const grouped = groupCompaniesByCategory(teamLeadData.companies);
                            return (
                              <>
                                <TabsContent value="prime" className="mt-4">
                                  {grouped.hot.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic text-center py-4">No companies in Prime Pool</p>
                                  ) : (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      {grouped.hot.map((company: any) => renderCompanyCard(company))}
                                    </div>
                                  )}
                                </TabsContent>
                                
                                <TabsContent value="active" className="mt-4">
                                  {grouped.follow_up.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic text-center py-4">No companies in Active Pool</p>
                                  ) : (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      {grouped.follow_up.map((company: any) => renderCompanyCard(company))}
                                    </div>
                                  )}
                                </TabsContent>
                                
                                <TabsContent value="block" className="mt-4">
                                  {grouped.block.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic text-center py-4">No companies in Inactive Pool</p>
                                  ) : (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      {grouped.block.map((company: any) => renderCompanyCard(company))}
                                    </div>
                                  )}
                                </TabsContent>
                                
                                <TabsContent value="general" className="mt-4">
                                  {grouped.general.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic text-center py-4">No companies in General</p>
                                  ) : (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      {grouped.general.map((company: any) => renderCompanyCard(company))}
                                    </div>
                                  )}
                                </TabsContent>
                              </>
                            );
                          })()}
                        </Tabs>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Team Members */}
            {teamMembers.map((member) => (
              <div key={member.id} className="border rounded-lg p-4">
                <Collapsible
                  open={expandedMembers.has(member.id)}
                  onOpenChange={(open) => {
                    if (open) {
                      setExpandedMembers(prev => new Set(prev).add(member.id));
                    } else {
                      setExpandedMembers(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(member.id);
                        return newSet;
                      });
                    }
                  }}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between mb-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{member.display_name}</h3>
                        <Badge variant="outline">Team Member</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-muted-foreground">
                          {member.email}
                        </div>
                        {expandedMembers.has(member.id) ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRight className="h-4 w-4" />
                        }
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{member.company_count}</div>
                      <div className="text-sm text-muted-foreground">Total Companies</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{member.hot_data_count}</div>
                      <div className="text-sm text-muted-foreground">Prime Pool</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{member.follow_up_count}</div>
                      <div className="text-sm text-muted-foreground">Active Pool</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">{member.block_count}</div>
                      <div className="text-sm text-muted-foreground">Inactive Pool</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{member.general_count}</div>
                      <div className="text-sm text-muted-foreground">General</div>
                    </div>
                  </div>

                  <CollapsibleContent>
                    <div className="space-y-3">
                      {member.companies.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No companies assigned</p>
                      ) : (
                        <Tabs defaultValue="all" className="w-full">
                          <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="all">All ({member.companies.length})</TabsTrigger>
                            <TabsTrigger value="prime">Prime Pool ({member.hot_data_count})</TabsTrigger>
                            <TabsTrigger value="active">Active Pool ({member.follow_up_count})</TabsTrigger>
                            <TabsTrigger value="block">Inactive Pool ({member.block_count})</TabsTrigger>
                            <TabsTrigger value="general">General ({member.general_count})</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="all" className="mt-4">
                            <div className="grid gap-3 md:grid-cols-2">
                              {member.companies.map((company: any) => renderCompanyCard(company))}
                            </div>
                          </TabsContent>
                          
                          {(() => {
                            const grouped = groupCompaniesByCategory(member.companies);
                            return (
                              <>
                                <TabsContent value="prime" className="mt-4">
                                  {grouped.hot.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic text-center py-4">No companies in Prime Pool</p>
                                  ) : (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      {grouped.hot.map((company: any) => renderCompanyCard(company))}
                                    </div>
                                  )}
                                </TabsContent>
                                
                                <TabsContent value="active" className="mt-4">
                                  {grouped.follow_up.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic text-center py-4">No companies in Active Pool</p>
                                  ) : (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      {grouped.follow_up.map((company: any) => renderCompanyCard(company))}
                                    </div>
                                  )}
                                </TabsContent>
                                
                                <TabsContent value="block" className="mt-4">
                                  {grouped.block.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic text-center py-4">No companies in Inactive Pool</p>
                                  ) : (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      {grouped.block.map((company: any) => renderCompanyCard(company))}
                                    </div>
                                  )}
                                </TabsContent>
                                
                                <TabsContent value="general" className="mt-4">
                                  {grouped.general.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic text-center py-4">No companies in General</p>
                                  ) : (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      {grouped.general.map((company: any) => renderCompanyCard(company))}
                                    </div>
                                  )}
                                </TabsContent>
                              </>
                            );
                          })()}
                        </Tabs>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))}

            {teamMembers.length === 0 && !teamLeadData && (
              <div className="text-center py-8 text-muted-foreground">
                No team data available.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeDataOverviewView;
