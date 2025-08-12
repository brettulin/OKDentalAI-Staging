import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, Eye, Clock, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSecurity } from '@/components/security/SecurityProvider';

interface SecurityMetric {
  metric: string;
  value: number;
  status: 'normal' | 'warning' | 'critical';
  description: string;
}

interface RecentActivity {
  id: string;
  action_type: string;
  resource_type: string;
  risk_level: string;
  created_at: string;
  metadata: any;
}

export const SecurityMonitoringDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { hasPermission } = useSecurity();

  // Fetch security metrics
  const { data: metrics } = useQuery({
    queryKey: ['security-metrics', profile?.clinic_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_audit_log')
        .select('action_type, risk_level, created_at')
        .eq('clinic_id', profile?.clinic_id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      if (error) throw error;

      // Calculate metrics
      const total = data.length;
      const elevated = data.filter(item => item.risk_level === 'elevated').length;
      const high = data.filter(item => item.risk_level === 'high').length;
      const recentHour = data.filter(item => 
        new Date(item.created_at) > new Date(Date.now() - 60 * 60 * 1000)
      ).length;

      return [
        {
          metric: 'Total Security Events (24h)',
          value: total,
          status: total > 100 ? 'warning' : 'normal',
          description: 'All security-related actions logged in the past 24 hours'
        },
        {
          metric: 'High-Risk Activities',
          value: elevated + high,
          status: (elevated + high) > 10 ? 'critical' : (elevated + high) > 5 ? 'warning' : 'normal',
          description: 'Elevated and high-risk security events that require attention'
        },
        {
          metric: 'Activity (Last Hour)',
          value: recentHour,
          status: recentHour > 20 ? 'warning' : 'normal',
          description: 'Security events in the last hour indicating current system activity'
        }
      ] as SecurityMetric[];
    },
    enabled: !!profile?.clinic_id && hasPermission('view_audit_logs')
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
    enabled: !!profile?.clinic_id && hasPermission('view_audit_logs')
  });

  const getMetricIcon = (metric: string) => {
    if (metric.includes('Total')) return <Eye className="h-4 w-4" />;
    if (metric.includes('Risk')) return <AlertTriangle className="h-4 w-4" />;
    if (metric.includes('Hour')) return <Clock className="h-4 w-4" />;
    return <Shield className="h-4 w-4" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-green-100 text-green-800 border-green-200';
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

  if (!hasPermission('view_audit_logs')) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to view security monitoring data. Contact your administrator.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Security Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics?.map((metric) => (
          <Card key={metric.metric} className={`border ${getStatusColor(metric.status)}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {getMetricIcon(metric.metric)}
                {metric.metric}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent High-Risk Activities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Recent High-Risk Activities
          </CardTitle>
          <CardDescription>
            Latest elevated and high-risk security events requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivities?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No high-risk activities detected recently</p>
              <p className="text-sm">This is a good sign for your system security</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivities?.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
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

      {/* Security Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Production Security Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Password Protection:</strong> Enable leaked password protection in Supabase Auth settings 
                to prevent users from using compromised passwords.
              </AlertDescription>
            </Alert>
            
            <Alert className="border-blue-200 bg-blue-50">
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-blue-800">
                <strong>Regular Monitoring:</strong> Review security alerts daily and investigate any unusual patterns 
                in user access or high-risk activities.
              </AlertDescription>
            </Alert>

            <Alert className="border-green-200 bg-green-50">
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-green-800">
                <strong>Enhanced Security:</strong> All critical security policies have been implemented. 
                Patient data access is now restricted by role and assignment.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};