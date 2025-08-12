import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, Eye, Clock, Users, Activity, Database, TrendingUp, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SecurityMetric {
  metric: string;
  value: number;
  status: 'normal' | 'warning' | 'critical';
  description: string;
  trend?: 'up' | 'down' | 'stable';
}

interface SecurityAlert {
  id: string;
  alert_type: string;
  severity: string;
  description: string;
  created_at: string;
  resolved: boolean;
  metadata: any;
}

interface RecentActivity {
  id: string;
  action_type: string;
  resource_type: string;
  risk_level: string;
  created_at: string;
  metadata: any;
  user_id: string;
}

export const SecurityMonitoringDashboard: React.FC = () => {
  const { profile } = useAuth();

  // Fetch security alerts
  const { data: alerts, refetch: refetchAlerts } = useQuery({
    queryKey: ['security-alerts', profile?.clinic_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .eq('clinic_id', profile?.clinic_id)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as SecurityAlert[];
    },
    enabled: !!profile?.clinic_id
  });

  // Fetch security metrics
  const { data: metrics, refetch: refetchMetrics } = useQuery({
    queryKey: ['security-metrics', profile?.clinic_id],
    queryFn: async () => {
      const now = new Date();
      const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const past48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const { data: current, error: currentError } = await supabase
        .from('security_audit_log')
        .select('action_type, risk_level, created_at')
        .eq('clinic_id', profile?.clinic_id)
        .gte('created_at', past24h.toISOString());

      const { data: previous, error: previousError } = await supabase
        .from('security_audit_log')
        .select('action_type, risk_level, created_at')
        .eq('clinic_id', profile?.clinic_id)
        .gte('created_at', past48h.toISOString())
        .lt('created_at', past24h.toISOString());
      
      if (currentError || previousError) throw currentError || previousError;

      // Calculate current metrics
      const total = current.length;
      const elevated = current.filter(item => item.risk_level === 'elevated').length;
      const high = current.filter(item => item.risk_level === 'high').length;
      const recentHour = current.filter(item => 
        new Date(item.created_at) > new Date(Date.now() - 60 * 60 * 1000)
      ).length;

      // Calculate previous metrics for trends
      const prevTotal = previous.length;
      const prevElevated = previous.filter(item => item.risk_level === 'elevated').length;
      const prevHigh = previous.filter(item => item.risk_level === 'high').length;

      const getTrend = (current: number, previous: number): 'up' | 'down' | 'stable' => {
        if (current > previous) return 'up';
        if (current < previous) return 'down';
        return 'stable';
      };

      return [
        {
          metric: 'Total Security Events (24h)',
          value: total,
          status: total > 100 ? 'warning' : 'normal',
          description: 'All security-related actions logged in the past 24 hours',
          trend: getTrend(total, prevTotal)
        },
        {
          metric: 'High-Risk Activities',
          value: elevated + high,
          status: (elevated + high) > 10 ? 'critical' : (elevated + high) > 5 ? 'warning' : 'normal',
          description: 'Elevated and high-risk security events that require attention',
          trend: getTrend(elevated + high, prevElevated + prevHigh)
        },
        {
          metric: 'Activity (Last Hour)',
          value: recentHour,
          status: recentHour > 20 ? 'warning' : 'normal',
          description: 'Security events in the last hour indicating current system activity',
          trend: 'stable'
        },
        {
          metric: 'Active Alerts',
          value: alerts?.length || 0,
          status: (alerts?.length || 0) > 5 ? 'critical' : (alerts?.length || 0) > 2 ? 'warning' : 'normal',
          description: 'Unresolved security alerts requiring immediate attention',
          trend: 'stable'
        }
      ] as SecurityMetric[];
    },
    enabled: !!profile?.clinic_id && !!alerts
  });

  // Fetch recent high-risk activities
  const { data: recentActivities } = useQuery({
    queryKey: ['recent-high-risk-activities', profile?.clinic_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_audit_log')
        .select('*')
        .eq('clinic_id', profile?.clinic_id)
        .in('risk_level', ['elevated', 'high'])
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as RecentActivity[];
    },
    enabled: !!profile?.clinic_id
  });

  const handleRefreshAll = () => {
    refetchAlerts();
    refetchMetrics();
  };

  const getMetricIcon = (metric: string) => {
    if (metric.includes('Total')) return <Activity className="h-4 w-4" />;
    if (metric.includes('Risk')) return <AlertTriangle className="h-4 w-4" />;
    if (metric.includes('Hour')) return <Clock className="h-4 w-4" />;
    if (metric.includes('Alerts')) return <Eye className="h-4 w-4" />;
    return <Shield className="h-4 w-4" />;
  };

  const getTrendIcon = (trend?: string) => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3 text-red-500" />;
    if (trend === 'down') return <TrendingUp className="h-3 w-3 text-green-500 rotate-180" />;
    return null;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'border-red-200 bg-red-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      default: return 'border-green-200 bg-green-50';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-800';
      case 'warning': return 'text-yellow-800';
      default: return 'text-green-800';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive" className="bg-red-600">Critical</Badge>;
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      default:
        return <Badge variant="outline">Low</Badge>;
    }
  };

  const getRiskLevelBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case 'elevated':
        return <Badge variant="destructive">Elevated</Badge>;
      case 'high':
        return <Badge variant="destructive" className="bg-red-600">High</Badge>;
      default:
        return <Badge variant="secondary">Normal</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Security Monitoring</h2>
          <p className="text-muted-foreground">Real-time security monitoring and threat detection</p>
        </div>
        <Button onClick={handleRefreshAll} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh All
        </Button>
      </div>

      {/* Security Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics?.map((metric) => (
          <Card key={metric.metric} className={`border ${getStatusColor(metric.status)}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {getMetricIcon(metric.metric)}
                {metric.metric}
                {getTrendIcon(metric.trend)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getStatusTextColor(metric.status)}`}>
                {metric.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Security Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Active Security Alerts
            {alerts && alerts.length > 0 && (
              <Badge variant="destructive" className="ml-2">{alerts.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Unresolved security alerts requiring immediate attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!alerts || alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active security alerts</p>
              <p className="text-sm">Your system security is operating normally</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <Alert key={alert.id} className="border-l-4 border-l-red-500">
                  <AlertTriangle className="h-4 w-4" />
                  <div className="flex items-start justify-between w-full">
                    <div>
                      <AlertDescription>
                        <div className="flex items-center gap-2 mb-1">
                          <strong>{alert.alert_type.replace(/_/g, ' ').toUpperCase()}</strong>
                          {getSeverityBadge(alert.severity)}
                        </div>
                        <p className="text-sm">{alert.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent High-Risk Activities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent High-Risk Activities
          </CardTitle>
          <CardDescription>
            Latest elevated and high-risk security events from the past 24 hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!recentActivities || recentActivities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No high-risk activities detected recently</p>
              <p className="text-sm">This indicates good system security</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {activity.action_type.replace(/_/g, ' ').toUpperCase()} - {activity.resource_type}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                      {activity.metadata?.user_role && (
                        <p className="text-xs text-muted-foreground">
                          User Role: {activity.metadata.user_role}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getRiskLevelBadge(activity.risk_level)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Production Security Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Alert className="border-blue-200 bg-blue-50">
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-blue-800">
                <strong>Daily Monitoring:</strong> Review security alerts and audit logs daily to identify unusual patterns or potential threats.
              </AlertDescription>
            </Alert>
            
            <Alert className="border-green-200 bg-green-50">
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-green-800">
                <strong>Enhanced RLS:</strong> All patient data is protected by role-based access controls and audit logging.
              </AlertDescription>
            </Alert>

            <Alert className="border-purple-200 bg-purple-50">
              <Users className="h-4 w-4" />
              <AlertDescription className="text-purple-800">
                <strong>User Management:</strong> Regularly review user roles and remove access for inactive staff members.
              </AlertDescription>
            </Alert>

            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-orange-800">
                <strong>Incident Response:</strong> Have a clear escalation plan for critical security alerts and breaches.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};