import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertTriangle, Clock, Eye } from 'lucide-react';

interface SecurityEvent {
  id: string;
  action_type: string;
  resource_type: string;
  risk_level: string;
  created_at: string;
  metadata: any;
}

export const SecurityMonitor: React.FC = () => {
  const { profile } = useAuth();
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.clinic_id) return;

    const fetchSecurityData = async () => {
      try {
        // Fetch recent security events
        const { data: events } = await supabase
          .from('security_audit_log')
          .select('*')
          .eq('clinic_id', profile.clinic_id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (events) setRecentEvents(events);

        // Fetch active security alerts
        const { data: alerts } = await supabase
          .from('security_alerts')
          .select('*')
          .eq('clinic_id', profile.clinic_id)
          .eq('resolved', false)
          .order('created_at', { ascending: false });

        if (alerts) setActiveAlerts(alerts);
      } catch (error) {
        console.error('Failed to fetch security data:', error);
      }
    };

    fetchSecurityData();

    // Set up real-time subscription for new alerts
    const alertsSubscription = supabase
      .channel('security_alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'security_alerts',
        filter: `clinic_id=eq.${profile.clinic_id}`
      }, (payload) => {
        setActiveAlerts(prev => [payload.new as any, ...prev]);
      })
      .subscribe();

    return () => {
      alertsSubscription.unsubscribe();
    };
  }, [profile?.clinic_id]);

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'elevated': return 'warning';
      case 'medium': return 'warning';
      default: return 'secondary';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'warning';
      default: return 'secondary';
    }
  };

  if (activeAlerts.length === 0 && recentEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Security Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Shield className="h-12 w-12 text-green-600 mx-auto mb-2" />
            <div className="text-lg font-medium text-green-600">All Clear</div>
            <div className="text-sm text-muted-foreground">No security alerts or unusual activity detected</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {activeAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Active Security Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeAlerts.map((alert) => (
              <Alert key={alert.id} variant={getSeverityColor(alert.severity) as any}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{alert.description}</div>
                      <div className="text-sm opacity-75 mt-1">
                        {alert.alert_type} • {new Date(alert.created_at).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant={getSeverityColor(alert.severity) as any}>
                      {alert.severity}
                    </Badge>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Recent Security Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {event.action_type.replace(/_/g, ' ')} • {event.resource_type}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3" />
                    {new Date(event.created_at).toLocaleString()}
                  </div>
                </div>
                <Badge variant={getRiskLevelColor(event.risk_level) as any}>
                  {event.risk_level}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};