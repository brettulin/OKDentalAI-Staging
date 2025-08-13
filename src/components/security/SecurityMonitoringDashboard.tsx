import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useComprehensiveSecurityMonitoring } from '@/hooks/useComprehensiveSecurityMonitoring';
import { useComplianceReporting } from '@/hooks/useComplianceReporting';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Shield, Users, Activity, FileText, Settings } from 'lucide-react';

interface SecurityMetrics {
  total_users: number;
  active_alerts: number;
  failed_logins_24h: number;
  data_exports_7d: number;
  risk_score: number;
  security_level: 'excellent' | 'good' | 'moderate' | 'concerning' | 'critical';
  calculated_at: string;
}

export const SecurityMonitoringDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { securityAlerts, securityMetrics, resolveSecurityAlert, createSecurityIncident } = useComprehensiveSecurityMonitoring();
  const { generateComprehensiveReport, hasCompliancePermission, loading: reportLoading } = useComplianceReporting();
  
  const [realTimeMetrics, setRealTimeMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);

  // Calculate real-time security metrics
  const calculateMetrics = async () => {
    if (!profile?.clinic_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('calculate_security_metrics', {
        p_clinic_id: profile.clinic_id
      });

      if (error) {
        console.error('Failed to calculate security metrics:', error);
        return;
      }

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        setRealTimeMetrics(data as unknown as SecurityMetrics);
      }
    } catch (error) {
      console.error('Security metrics calculation error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Emergency access revocation
  const emergencyRevokeAccess = async (userId: string, reason: string) => {
    try {
      const { error } = await supabase.rpc('emergency_revoke_access', {
        p_user_id: userId,
        p_reason: reason
      });

      if (error) {
        console.error('Emergency revocation failed:', error);
        return false;
      }

      await createSecurityIncident(
        'emergency_action_taken',
        'critical',
        `Emergency access revocation executed for user ${userId}`,
        { revoked_user: userId, reason }
      );

      return true;
    } catch (error) {
      console.error('Emergency revocation error:', error);
      return false;
    }
  };

  // Trigger data cleanup
  const triggerDataCleanup = async () => {
    try {
      const { error } = await supabase.rpc('cleanup_old_sensitive_data');
      
      if (error) {
        console.error('Data cleanup failed:', error);
        return false;
      }

      await createSecurityIncident(
        'data_cleanup_executed',
        'low',
        'Manual data cleanup executed',
        { executed_by: profile?.user_id }
      );

      return true;
    } catch (error) {
      console.error('Data cleanup error:', error);
      return false;
    }
  };

  // Real-time updates
  useEffect(() => {
    if (!profile?.clinic_id) return;

    calculateMetrics();

    // Update metrics every 30 seconds
    const interval = setInterval(calculateMetrics, 30000);

    // Subscribe to real-time security alerts
    const alertsChannel = supabase
      .channel('security-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'security_alerts',
          filter: `clinic_id=eq.${profile.clinic_id}`
        },
        () => {
          calculateMetrics();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(alertsChannel);
    };
  }, [profile]);

  // Check for emergency conditions
  useEffect(() => {
    if (realTimeMetrics?.security_level === 'critical' || 
        realTimeMetrics?.risk_score > 80 ||
        securityAlerts.filter(a => a.severity === 'critical').length > 0) {
      setEmergencyMode(true);
    } else {
      setEmergencyMode(false);
    }
  }, [realTimeMetrics, securityAlerts]);

  const getSecurityLevelColor = (level: string) => {
    switch (level) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'moderate': return 'bg-yellow-500';
      case 'concerning': return 'bg-orange-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!hasCompliancePermission()) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access the security monitoring dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Emergency Alert */}
      {emergencyMode && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-700 font-semibold">
            🚨 SECURITY EMERGENCY DETECTED - Critical security conditions require immediate attention!
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Monitoring Dashboard</h1>
          <p className="text-muted-foreground">Real-time security monitoring and incident response</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={triggerDataCleanup} variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Data Cleanup
          </Button>
          <Button 
            onClick={() => generateComprehensiveReport()} 
            variant="outline" 
            size="sm"
            disabled={reportLoading}
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Security Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Level</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getSecurityLevelColor(realTimeMetrics?.security_level || 'good')}`} />
              <span className="text-2xl font-bold capitalize">
                {realTimeMetrics?.security_level || 'Loading...'}
              </span>
            </div>
            <Progress 
              value={realTimeMetrics ? 100 - realTimeMetrics.risk_score : 0} 
              className="mt-2" 
            />
            <p className="text-xs text-muted-foreground mt-1">
              Risk Score: {realTimeMetrics?.risk_score || 0}/100
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{realTimeMetrics?.active_alerts || 0}</div>
            <p className="text-xs text-muted-foreground">
              {securityAlerts.filter(a => a.severity === 'critical').length} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{realTimeMetrics?.total_users || 0}</div>
            <p className="text-xs text-muted-foreground">Active users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{realTimeMetrics?.failed_logins_24h || 0}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Security Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Active Security Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {securityAlerts.length === 0 ? (
            <p className="text-muted-foreground">No active security alerts</p>
          ) : (
            <div className="space-y-3">
              {securityAlerts.slice(0, 10).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={getAlertSeverityColor(alert.severity)}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <span className="font-medium">{alert.alert_type}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button 
                    onClick={() => resolveSecurityAlert(alert.id)}
                    variant="outline" 
                    size="sm"
                  >
                    Resolve
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emergency Controls */}
      {emergencyMode && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">🚨 Emergency Response Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                onClick={() => {
                  // Emergency lockdown logic would go here
                  createSecurityIncident('emergency_lockdown', 'critical', 'Emergency lockdown activated');
                }}
                variant="destructive"
                className="w-full"
              >
                🔒 Emergency Lockdown
              </Button>
              <Button 
                onClick={() => triggerDataCleanup()}
                variant="outline"
                className="w-full"
              >
                🧹 Emergency Data Cleanup
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Security Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {realTimeMetrics && (
              <div className="space-y-2">
                <p>Data exports (7 days): {realTimeMetrics.data_exports_7d}</p>
                <p>Last calculated: {new Date(realTimeMetrics.calculated_at).toLocaleString()}</p>
                <p>System status: {emergencyMode ? '🚨 Emergency Mode' : '✅ Normal Operation'}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};