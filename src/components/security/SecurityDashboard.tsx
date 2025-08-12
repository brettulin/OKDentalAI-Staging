import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSecurity } from '@/components/security/SecurityProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SecurityAlert {
  id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata: any;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export const SecurityDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { hasPermission } = useSecurity();
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);

  // Only show to users with audit log permissions
  if (!hasPermission('view_audit_logs') && profile?.role !== 'owner') {
    return null;
  }

  const { data: alerts, isLoading, refetch } = useQuery({
    queryKey: ['security-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as SecurityAlert[];
    }
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['recent-security-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_audit_log')
        .select('*')
        .eq('risk_level', 'elevated')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    }
  });

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: profile?.user_id
        })
        .eq('id', alertId);

      if (error) throw error;

      toast.success('Security alert resolved');
      refetch();
    } catch (error: any) {
      toast.error('Failed to resolve alert');
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'medium':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const unresolved = alerts?.filter(alert => !alert.resolved) || [];
  const critical = unresolved.filter(alert => alert.severity === 'critical');
  const high = unresolved.filter(alert => alert.severity === 'high');

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{critical.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{high.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Unresolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unresolved.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts Warning */}
      {critical.length > 0 && (
        <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <Shield className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            <strong>Critical Security Issues Detected!</strong> You have {critical.length} critical 
            security alert{critical.length !== 1 ? 's' : ''} that require immediate attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Security Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Alerts
          </CardTitle>
          <CardDescription>
            Monitor and respond to security events and suspicious activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading security alerts...</div>
          ) : alerts?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No security alerts. Your system is secure!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts?.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    alert.resolved ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-800'
                  } ${selectedAlert?.id === alert.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedAlert(selectedAlert?.id === alert.id ? null : alert)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(alert.severity)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{alert.description}</h4>
                          <Badge variant={getSeverityColor(alert.severity) as any}>
                            {alert.severity}
                          </Badge>
                          {alert.resolved && (
                            <Badge variant="outline">Resolved</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                        
                        {selectedAlert?.id === alert.id && (
                          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded border">
                            <p className="text-sm mb-2"><strong>Type:</strong> {alert.alert_type}</p>
                            {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                              <div className="text-sm">
                                <strong>Details:</strong>
                                <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
                                  {JSON.stringify(alert.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {!alert.resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          resolveAlert(alert.id);
                        }}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent High-Risk Activity */}
      {recentActivity && recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent High-Risk Activity</CardTitle>
            <CardDescription>
              Latest elevated risk actions performed in your clinic
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivity.slice(0, 5).map((activity: any) => (
                <div key={activity.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <span className="font-medium">{activity.action_type}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {activity.resource_type}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(activity.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};