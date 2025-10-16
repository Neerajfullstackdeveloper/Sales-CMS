import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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

      if (!companiesData) {
        setLoading(false);
        return;
      }

      // Process team lead data
      const teamLeadCompanies = companiesData.filter(c => c.assigned_to_id === userId);
      const teamLeadStats = calculateEmployeeStats(teamLeadCompanies, teamLeadProfile);
      setTeamLeadData(teamLeadStats);

      // Process team members data
      const membersWithStats = (membersData || []).map(member => {
        const memberCompanies = companiesData.filter(c => c.assigned_to_id === member.employee_id);
        return calculateEmployeeStats(memberCompanies, member.employee);
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

  const calculateEmployeeStats = (companies: any[], profile: any): TeamMember => {
    const hotDataCount = companies.filter(company => {
      if (!company.comments || company.comments.length === 0) return false;
      const latestComment = company.comments.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      return latestComment.category === "hot";
    }).length;

    const followUpCount = companies.filter(company => {
      if (!company.comments || company.comments.length === 0) return false;
      const latestComment = company.comments.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      return latestComment.category === "follow_up";
    }).length;

    const blockCount = companies.filter(company => {
      if (!company.comments || company.comments.length === 0) return false;
      const latestComment = company.comments.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      return latestComment.category === "block";
    }).length;

    const generalCount = companies.filter(company => {
      if (!company.comments || company.comments.length === 0) return true;
      const latestComment = company.comments.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      return latestComment.category === "general";
    }).length;

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
      { name: 'Hot Data', value: (teamLeadData?.hot_data_count || 0) + teamMembers.reduce((sum, m) => sum + m.hot_data_count, 0) },
      { name: 'Follow Up', value: (teamLeadData?.follow_up_count || 0) + teamMembers.reduce((sum, m) => sum + m.follow_up_count, 0) },
      { name: 'Block', value: (teamLeadData?.block_count || 0) + teamMembers.reduce((sum, m) => sum + m.block_count, 0) },
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
        <h2 className="text-3xl font-bold">Team Data Overview</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
            <CardTitle className="text-sm font-medium">Hot Data</CardTitle>
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
            <CardTitle className="text-sm font-medium">Follow Up</CardTitle>
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
                <Collapsible>
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
                      <div className="text-sm text-muted-foreground">Hot Data</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{teamLeadData.follow_up_count}</div>
                      <div className="text-sm text-muted-foreground">Follow Up</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">{teamLeadData.block_count}</div>
                      <div className="text-sm text-muted-foreground">Block</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{teamLeadData.general_count}</div>
                      <div className="text-sm text-muted-foreground">General</div>
                    </div>
                  </div>

                  <CollapsibleContent>
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-muted-foreground mb-3">Assigned Companies:</h4>
                      {teamLeadData.companies.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No companies assigned</p>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {teamLeadData.companies.map((company: any) => {
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
                                    {getCategoryIcon(category)} {category.replace('_', ' ')}
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
                                      
                                      {company.comments.length > 1 && (
                                        <details className="text-xs">
                                          <summary className="cursor-pointer font-medium text-blue-600 hover:text-blue-800">
                                            Quick Preview
                                          </summary>
                                          <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                                            {company.comments
                                              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                              .slice(0, 3)
                                              .map((comment: any) => (
                                              <div key={comment.id} className="p-2 bg-white border rounded">
                                                <div className="flex items-center justify-between mb-1">
                                                  <span className="font-medium text-xs">
                                                    {comment.user?.display_name || 'Unknown User'}
                                                  </span>
                                                  <span className="text-xs text-muted-foreground">
                                                    {new Date(comment.created_at).toLocaleDateString()}
                                                  </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mb-1">
                                                  {comment.comment_text}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                  <Badge className={`text-xs ${getCategoryColor(comment.category)}`}>
                                                    {getCategoryIcon(comment.category)} {comment.category.replace('_', ' ')}
                                                  </Badge>
                                                  <span className="text-xs text-muted-foreground">
                                                    {comment.user?.email}
                                                  </span>
                                                </div>
                                              </div>
                                            ))}
                                            {company.comments.length > 3 && (
                                              <p className="text-xs text-center text-muted-foreground italic">
                                                ... and {company.comments.length - 3} more comments
                                              </p>
                                            )}
                                          </div>
                                        </details>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Team Members */}
            {teamMembers.map((member) => (
              <div key={member.id} className="border rounded-lg p-4">
                <Collapsible>
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
                      <div className="text-sm text-muted-foreground">Hot Data</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{member.follow_up_count}</div>
                      <div className="text-sm text-muted-foreground">Follow Up</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">{member.block_count}</div>
                      <div className="text-sm text-muted-foreground">Block</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{member.general_count}</div>
                      <div className="text-sm text-muted-foreground">General</div>
                    </div>
                  </div>

                  <CollapsibleContent>
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-muted-foreground mb-3">Assigned Companies:</h4>
                      {member.companies.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No companies assigned</p>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {member.companies.map((company: any) => {
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
                                    {getCategoryIcon(category)} {category.replace('_', ' ')}
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
                                      
                                      {company.comments.length > 1 && (
                                        <details className="text-xs">
                                          <summary className="cursor-pointer font-medium text-blue-600 hover:text-blue-800">
                                            Quick Preview
                                          </summary>
                                          <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                                            {company.comments
                                              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                              .slice(0, 3)
                                              .map((comment: any) => (
                                              <div key={comment.id} className="p-2 bg-white border rounded">
                                                <div className="flex items-center justify-between mb-1">
                                                  <span className="font-medium text-xs">
                                                    {comment.user?.display_name || 'Unknown User'}
                                                  </span>
                                                  <span className="text-xs text-muted-foreground">
                                                    {new Date(comment.created_at).toLocaleDateString()}
                                                  </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mb-1">
                                                  {comment.comment_text}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                  <Badge className={`text-xs ${getCategoryColor(comment.category)}`}>
                                                    {getCategoryIcon(comment.category)} {comment.category.replace('_', ' ')}
                                                  </Badge>
                                                  <span className="text-xs text-muted-foreground">
                                                    {comment.user?.email}
                                                  </span>
                                                </div>
                                              </div>
                                            ))}
                                            {company.comments.length > 3 && (
                                              <p className="text-xs text-center text-muted-foreground italic">
                                                ... and {company.comments.length - 3} more comments
                                              </p>
                                            )}
                                          </div>
                                        </details>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </Card>
                            );
                          })}
                        </div>
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
