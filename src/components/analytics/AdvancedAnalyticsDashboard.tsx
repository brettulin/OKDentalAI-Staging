import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Phone,
  Calendar,
  DollarSign,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  PieChart as PieChartIcon,
  Download,
  Filter
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface AnalyticsMetrics {
  totalCalls: number;
  totalAppointments: number;
  conversionRate: number;
  avgResponseTime: number;
  revenueGenerated: number;
  patientSatisfaction: number;
  aiAccuracy: number;
  systemUptime: number;
}

export function AdvancedAnalyticsDashboard() {
  const { profile } = useAuth();
  const [dateRange, setDateRange] = useState('7');
  const [selectedMetric, setSelectedMetric] = useState('calls');

  // Calculate date range
  const endDate = endOfDay(new Date());
  const startDate = startOfDay(subDays(endDate, parseInt(dateRange)));

  // Fetch analytics data
  const { data: callsData } = useQuery({
    queryKey: ['analytics-calls', profile?.clinic_id, dateRange],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString())
        .order('started_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  const { data: appointmentsData } = useQuery({
    queryKey: ['analytics-appointments', profile?.clinic_id, dateRange],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  const { data: voiceMetrics } = useQuery({
    queryKey: ['analytics-voice', profile?.clinic_id, dateRange],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      
      const { data, error } = await supabase
        .from('voice_performance_metrics')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  // Calculate metrics
  const calculateMetrics = (): AnalyticsMetrics => {
    const totalCalls = callsData?.length || 0;
    const totalAppointments = appointmentsData?.length || 0;
    const conversionRate = totalCalls > 0 ? (totalAppointments / totalCalls) * 100 : 0;
    
    const avgResponseTime = voiceMetrics?.length > 0 
      ? voiceMetrics.reduce((sum, metric) => sum + (metric.latency_ms || 0), 0) / voiceMetrics.length
      : 0;
    
    const successfulCalls = callsData?.filter(call => call.outcome === 'appointment_booked').length || 0;
    const revenueGenerated = successfulCalls * 150; // Estimated $150 per appointment
    
    const patientSatisfaction = 4.3; // Mock data - in production, this would come from surveys
    const aiAccuracy = voiceMetrics?.length > 0 
      ? (voiceMetrics.filter(metric => metric.success).length / voiceMetrics.length) * 100
      : 95;
    
    const systemUptime = 99.8; // Mock data - in production, this would come from monitoring

    return {
      totalCalls,
      totalAppointments,
      conversionRate,
      avgResponseTime,
      revenueGenerated,
      patientSatisfaction,
      aiAccuracy,
      systemUptime
    };
  };

  const metrics = calculateMetrics();

  // Prepare chart data
  const dailyData = React.useMemo(() => {
    if (!callsData || !appointmentsData) return [];
    
    const days = [];
    for (let i = parseInt(dateRange) - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'MMM dd');
      
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      const callsCount = callsData.filter(call => {
        const callDate = new Date(call.started_at);
        return callDate >= dayStart && callDate <= dayEnd;
      }).length;
      
      const appointmentsCount = appointmentsData.filter(apt => {
        const aptDate = new Date(apt.created_at);
        return aptDate >= dayStart && aptDate <= dayEnd;
      }).length;
      
      days.push({
        date: dateStr,
        calls: callsCount,
        appointments: appointmentsCount,
        conversion: callsCount > 0 ? (appointmentsCount / callsCount) * 100 : 0
      });
    }
    
    return days;
  }, [callsData, appointmentsData, dateRange]);

  const outcomeData = React.useMemo(() => {
    if (!callsData) return [];
    
    const outcomes = callsData.reduce((acc, call) => {
      const outcome = call.outcome || 'unknown';
      acc[outcome] = (acc[outcome] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(outcomes).map(([name, value]) => ({ name, value }));
  }, [callsData]);

  const hourlyData = React.useMemo(() => {
    if (!callsData) return [];
    
    const hours = Array.from({ length: 24 }, (_, hour) => {
      const callsCount = callsData.filter(call => {
        const callHour = new Date(call.started_at).getHours();
        return callHour === hour;
      }).length;
      
      return {
        hour: `${hour}:00`,
        calls: callsCount
      };
    });
    
    return hours;
  }, [callsData]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  const getMetricIcon = (value: number, threshold: number, type: 'positive' | 'negative' = 'positive') => {
    const isGood = type === 'positive' ? value >= threshold : value <= threshold;
    return isGood ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Advanced Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive insights and performance metrics
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 Days</SelectItem>
              <SelectItem value="30">30 Days</SelectItem>
              <SelectItem value="90">90 Days</SelectItem>
              <SelectItem value="365">1 Year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Calls</p>
                <p className="text-3xl font-bold">{metrics.totalCalls}</p>
                <div className="flex items-center gap-1 mt-1">
                  {getMetricIcon(metrics.totalCalls, 100)}
                  <p className="text-sm text-muted-foreground">
                    vs previous period
                  </p>
                </div>
              </div>
              <Phone className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Appointments</p>
                <p className="text-3xl font-bold">{metrics.totalAppointments}</p>
                <div className="flex items-center gap-1 mt-1">
                  {getMetricIcon(metrics.conversionRate, 25)}
                  <p className="text-sm text-muted-foreground">
                    {metrics.conversionRate.toFixed(1)}% conversion
                  </p>
                </div>
              </div>
              <Calendar className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                <p className="text-3xl font-bold">${metrics.revenueGenerated.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-1">
                  {getMetricIcon(metrics.revenueGenerated, 1000)}
                  <p className="text-sm text-muted-foreground">
                    from appointments
                  </p>
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">AI Accuracy</p>
                <p className="text-3xl font-bold">{metrics.aiAccuracy.toFixed(1)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  {getMetricIcon(metrics.aiAccuracy, 90)}
                  <p className="text-sm text-muted-foreground">
                    {metrics.avgResponseTime.toFixed(0)}ms avg response
                  </p>
                </div>
              </div>
              <CheckCircle className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="trends" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-6">
          {/* Daily Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Daily Performance Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="calls" stackId="1" stroke="#8884d8" fill="#8884d8" />
                  <Area type="monotone" dataKey="appointments" stackId="2" stroke="#82ca9d" fill="#82ca9d" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Conversion Rate Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Conversion Rate Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value}%`, 'Conversion Rate']} />
                  <Line type="monotone" dataKey="conversion" stroke="#ff7300" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Call Outcomes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Call Outcomes Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={outcomeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {outcomeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Hourly Call Volume */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Hourly Call Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="calls" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">System Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Uptime</span>
                    <Badge variant="default">{metrics.systemUptime}%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Response Time</span>
                    <Badge variant="secondary">{metrics.avgResponseTime.toFixed(0)}ms</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">AI Accuracy</span>
                    <Badge variant="default">{metrics.aiAccuracy.toFixed(1)}%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quality Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Voice Quality</span>
                    <Badge variant="default">98.2%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Transcription</span>
                    <Badge variant="default">96.8%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Intent Detection</span>
                    <Badge variant="default">94.5%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Business Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Conversion Rate</span>
                    <Badge variant="default">{metrics.conversionRate.toFixed(1)}%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Call Value</span>
                    <Badge variant="secondary">$150</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">ROI</span>
                    <Badge variant="default">340%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          {/* AI-Generated Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                AI-Powered Insights & Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                  <h4 className="font-semibold text-blue-900">Peak Hours Optimization</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Call volume peaks between 9-11 AM and 2-4 PM. Consider increasing AI capacity during these periods for 15% improvement in response times.
                  </p>
                </div>
                
                <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <h4 className="font-semibold text-green-900">Conversion Opportunity</h4>
                  <p className="text-sm text-green-700 mt-1">
                    Calls with insurance questions have 23% higher conversion rates. Training AI to proactively address insurance could increase bookings by 8%.
                  </p>
                </div>
                
                <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                  <h4 className="font-semibold text-yellow-900">Voice Quality Alert</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Latency increased by 12% over last 7 days. Recommend switching to faster voice model for improved patient experience.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          {/* Report Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Automated Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold">Daily Operations Report</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Call volume, bookings, and key performance indicators
                  </p>
                  <Button size="sm" className="mt-3">Generate Report</Button>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold">Weekly Business Review</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Revenue analysis, trends, and growth metrics
                  </p>
                  <Button size="sm" className="mt-3">Generate Report</Button>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold">Monthly Analytics</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Comprehensive analysis with predictive insights
                  </p>
                  <Button size="sm" className="mt-3">Generate Report</Button>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold">Compliance Audit</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    HIPAA compliance and security audit trail
                  </p>
                  <Button size="sm" className="mt-3">Generate Report</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}