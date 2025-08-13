import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Users,
  Database,
  Lock
} from 'lucide-react';

interface SecurityMetric {
  name: string;
  value: number;
  target: number;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
}

interface SecurityIncident {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  created_at: string;
  resolved: boolean;
}

export const EnhancedSecurityDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<SecurityMetric[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile?.clinic_id) return;

    const fetchSecurityData = async () => {
      try {
        setIsLoading(true);

        // Fetch security metrics
        const [
          auditLogsResponse,
          securityAlertsResponse,
          activeUsersResponse,
          patientAccessResponse
        ] = await Promise.all([
          supabase
            .from('security_audit_log')
            .select('*')
            .eq('clinic_id', profile.clinic_id)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

          supabase
            .from('security_alerts')
            .select('*')
            .eq('clinic_id', profile.clinic_id)
            .eq('resolved', false),

          supabase
            .from('profiles')
            .select('user_id')
            .eq('clinic_id', profile.clinic_id),

          supabase
            .from('security_audit_log')
            .select('*')
            .eq('clinic_id', profile.clinic_id)
            .eq('resource_type', 'patient')
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        ]);

        // Calculate security metrics
        const auditLogs = auditLogsResponse.data || [];
        const securityAlerts = securityAlertsResponse.data || [];
        const activeUsers = activeUsersResponse.data || [];
        const patientAccess = patientAccessResponse.data || [];

        const calculatedMetrics: SecurityMetric[] = [
          {
            name: 'Security Score',
            value: Math.max(0, 100 - (securityAlerts.length * 10)),
            target: 90,
            status: securityAlerts.length === 0 ? 'good' : securityAlerts.length < 3 ? 'warning' : 'critical',
            trend: 'stable'
          },
          {
            name: 'Failed Access Attempts',
            value: auditLogs.filter(log => log.action_type.includes('denied')).length,
            target: 5,
            status: auditLogs.filter(log => log.action_type.includes('denied')).length <= 5 ? 'good' : 'warning',
            trend: 'down'
          },
          {
            name: 'Patient Data Access',
            value: patientAccess.length,
            target: 50,
            status: patientAccess.length <= 50 ? 'good' : patientAccess.length <= 100 ? 'warning' : 'critical',
            trend: 'stable'
          },
          {
            name: 'Active Users',
            value: activeUsers.length,
            target: 10,
            status: 'good',
            trend: 'up'
          }
        ];

        setMetrics(calculatedMetrics);
        setIncidents(securityAlerts.map(alert => ({
          id: alert.id,
          type: alert.alert_type,
          severity: alert.severity as any,
          description: alert.description,
          created_at: alert.created_at,
          resolved: alert.resolved
        })));

      } catch (error) {
        console.error('Failed to fetch security data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSecurityData();

    // Set up real-time updates
    const subscription = supabase
      .channel('security_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'security_alerts',
        filter: `clinic_id=eq.${profile.clinic_id}`
      }, () => {
        fetchSecurityData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile?.clinic_id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'good': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'destructive';
      default: return 'secondary';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'secondary';
      case 'medium': return 'warning';
      case 'high': return 'destructive';
      case 'critical': return 'destructive';
      default: return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <div>Loading security data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.name}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {metric.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className={`text-2xl font-bold ${getStatusColor(metric.status)}`}>
                      {metric.name === 'Security Score' ? `${metric.value}%` : metric.value}
                    </p>
                    {metric.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
                  </div>
                </div>
                <Badge variant={getStatusBadge(metric.status) as any}>
                  {metric.status}
                </Badge>
              </div>
              
              {metric.name === 'Security Score' && (
                <div className="mt-2">
                  <Progress value={metric.value} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Target: {metric.target}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Security Incidents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Active Security Incidents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
              <div className="text-lg font-medium text-green-600">All Clear</div>
              <div className="text-sm text-muted-foreground">No active security incidents</div>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map((incident) => (
                <Alert key={incident.id} variant={getSeverityColor(incident.severity) as any}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{incident.description}</div>
                        <div className="text-sm opacity-75 flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3" />
                          {new Date(incident.created_at).toLocaleString()}
                          <span>•</span>
                          <span>{incident.type}</span>
                        </div>
                      </div>
                      <Badge variant={getSeverityColor(incident.severity) as any}>
                        {incident.severity}
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                Review User Permissions
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                Audit User Activity
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data Protection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                Patient Data Audit
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                Export Security Report
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lock className="h-4 w-4" />
              System Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                Security Configuration
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                Incident Response
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};