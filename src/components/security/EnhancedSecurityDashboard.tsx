import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useEnhancedSecurity } from '@/hooks/useEnhancedSecurity';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Activity,
  Lock
} from 'lucide-react';

export function EnhancedSecurityDashboard() {
  const { profile } = useAuth();
  const { securityMetrics, refreshSecurityMetrics } = useEnhancedSecurity();

  // Fetch recent security alerts
  const { data: recentAlerts } = useQuery({
    queryKey: ['security-alerts', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.clinic_id,
    refetchInterval: 30 * 1000 // Refresh every 30 seconds
  });

  // Fetch security audit summary
  const { data: auditSummary } = useQuery({
    queryKey: ['security-audit-summary', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return null;
      
      const { data, error } = await supabase
        .from('enhanced_security_audit_log')
        .select('risk_level, created_at')
        .eq('clinic_id', profile.clinic_id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      if (error) throw error;
      
      const summary = {
        total: data?.length || 0,
        critical: data?.filter(log => log.risk_level === 'critical').length || 0,
        high: data?.filter(log => log.risk_level === 'high').length || 0,
        elevated: data?.filter(log => log.risk_level === 'elevated').length || 0,
        normal: data?.filter(log => log.risk_level === 'normal').length || 0
      };
      
      return summary;
    },
    enabled: !!profile?.clinic_id,
    refetchInterval: 60 * 1000 // Refresh every minute
  });

  const getSecurityLevelBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Critical
          </Badge>
        );
      case 'elevated':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Elevated
          </Badge>
        );
      default:
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Standard
          </Badge>
        );
    }
  };

  const getSecurityScore = () => {
    if (!securityMetrics) return 0;
    
    let score = 100;
    score -= securityMetrics.riskScore * 2; // Reduce score based on risk
    score -= securityMetrics.mfaRequired ? 20 : 0; // Reduce if MFA required but not verified
    score -= !securityMetrics.sessionValid ? 50 : 0; // Significant reduction for invalid session
    
    return Math.max(0, Math.min(100, score));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {getSecurityScore()}
                </p>
                <p className="text-sm text-muted-foreground">Security Score</p>
              </div>
              <Shield className={`h-8 w-8 ${getScoreColor(getSecurityScore())}`} />
            </div>
            <Progress value={getSecurityScore()} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {securityMetrics?.riskScore || 0}
                </p>
                <p className="text-sm text-muted-foreground">Risk Score</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {recentAlerts?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {auditSummary?.total || 0}
                </p>
                <p className="text-sm text-muted-foreground">24h Events</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Status Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Session Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Session Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Security Level</span>
              {securityMetrics && getSecurityLevelBadge(securityMetrics.securityLevel)}
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Session Valid</span>
              <Badge variant={securityMetrics?.sessionValid ? "default" : "destructive"}>
                {securityMetrics?.sessionValid ? "Active" : "Invalid"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">MFA Status</span>
              <Badge variant={securityMetrics?.mfaRequired ? "secondary" : "default"}>
                {securityMetrics?.mfaRequired ? "Required" : "Not Required"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Last Activity</span>
              <span className="text-sm text-muted-foreground">
                {securityMetrics?.lastActivity ? 
                  new Date(securityMetrics.lastActivity).toLocaleTimeString() : 
                  'Unknown'
                }
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Risk Level Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Risk Analysis (24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {auditSummary && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Critical Events</span>
                  <Badge variant="destructive">{auditSummary.critical}</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">High Risk</span>
                  <Badge variant="secondary">{auditSummary.high}</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Elevated Risk</span>
                  <Badge variant="outline">{auditSummary.elevated}</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Normal Events</span>
                  <Badge variant="default">{auditSummary.normal}</Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Security Alerts */}
      {recentAlerts && recentAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Active Security Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentAlerts.slice(0, 5).map((alert) => (
                <div 
                  key={alert.id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{alert.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge 
                    variant={
                      alert.severity === 'critical' ? 'destructive' :
                      alert.severity === 'high' ? 'secondary' : 'outline'
                    }
                  >
                    {alert.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}