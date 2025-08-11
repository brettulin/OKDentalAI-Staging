import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Phone, Clock, Target } from "lucide-react";

const OUTCOME_COLORS = {
  'appointment_booked': '#22c55e',
  'transferred': '#3b82f6',
  'voicemail': '#f59e0b',
  'no_answer': '#ef4444',
  'completed': '#8b5cf6',
  'cancelled': '#6b7280',
  'failed': '#dc2626',
};

export default function CallsAnalytics() {
  const { profile } = useAuth();
  const last30Days = subDays(new Date(), 30);

  const { data: callsData } = useQuery({
    queryKey: ['calls-analytics', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return { calls: [], daily: [], outcomes: [] };

      // Get calls from last 30 days
      const { data: calls, error } = await supabase
        .from('calls')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .gte('started_at', last30Days.toISOString())
        .order('started_at', { ascending: false });

      if (error) throw error;

      // Process daily data
      const dailyMap = new Map();
      const outcomeMap = new Map();

      calls?.forEach(call => {
        const day = format(new Date(call.started_at), 'yyyy-MM-dd');
        dailyMap.set(day, (dailyMap.get(day) || 0) + 1);

        const outcome = call.outcome || 'unknown';
        outcomeMap.set(outcome, (outcomeMap.get(outcome) || 0) + 1);
      });

      // Generate daily array for last 7 days
      const daily = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), i);
        const day = format(date, 'yyyy-MM-dd');
        return {
          date: format(date, 'MMM d'),
          calls: dailyMap.get(day) || 0,
        };
      }).reverse();

      // Generate outcomes array
      const outcomes = Array.from(outcomeMap.entries()).map(([outcome, count]) => ({
        name: outcome.replace('_', ' ').toUpperCase(),
        value: count,
        color: OUTCOME_COLORS[outcome as keyof typeof OUTCOME_COLORS] || '#6b7280',
      }));

      return { calls: calls || [], daily, outcomes };
    },
    enabled: !!profile?.clinic_id,
  });

  const totalCalls = callsData?.calls.length || 0;
  const avgDuration = callsData?.calls.reduce((acc, call) => {
    if (!call.ended_at) return acc;
    const duration = (new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000;
    return acc + duration;
  }, 0) / totalCalls || 0;

  const successfulCalls = callsData?.calls.filter(call => 
    call.outcome === 'appointment_booked' || call.outcome === 'completed'
  ).length || 0;

  const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">Total Calls</div>
            </div>
            <div className="text-2xl font-bold">{totalCalls}</div>
            <div className="text-xs text-muted-foreground">Last 30 days</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">Avg Duration</div>
            </div>
            <div className="text-2xl font-bold">
              {Math.round(avgDuration)}s
            </div>
            <div className="text-xs text-muted-foreground">Per call</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">Success Rate</div>
            </div>
            <div className="text-2xl font-bold">{Math.round(successRate)}%</div>
            <div className="text-xs text-muted-foreground">Bookings + Completed</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">This Week</div>
            </div>
            <div className="text-2xl font-bold">
              {callsData?.daily.slice(-7).reduce((acc, day) => acc + day.calls, 0) || 0}
            </div>
            <div className="text-xs text-muted-foreground">7 day total</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Calls Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Call Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={callsData?.daily || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="calls" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Outcomes Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Call Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={callsData?.outcomes || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {callsData?.outcomes?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}