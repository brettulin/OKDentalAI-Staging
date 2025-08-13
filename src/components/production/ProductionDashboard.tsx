import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Clock, Shield, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ProductionCheck {
  category: string;
  check_name: string;
  status: string;
  details: string;
  priority: string;
}

interface SecurityIncident {
  id: string;
  incident_type: string;
  severity: string;
  status: string;
  description: string;
  created_at: string;
}

interface HealthMetric {
  id: string;
  metric_type: string;
  metric_value: number;
  status: string;
  recorded_at: string;
}

export const ProductionDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [checks, setChecks] = useState<ProductionCheck[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.clinic_id) {
      loadDashboardData();
    }
  }, [profile?.clinic_id]);

  const loadDashboardData = async () => {
    if (!profile?.clinic_id) return;

    try {
      setLoading(true);

      // Load production readiness checks
      const { data: checksData, error: checksError } = await supabase
        .rpc('comprehensive_production_check', { p_clinic_id: profile.clinic_id });

      if (checksError) throw checksError;
      setChecks(checksData || []);

      // Load security incidents
      const { data: incidentsData, error: incidentsError } = await supabase
        .from('security_incidents')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10);

      if (incidentsError) throw incidentsError;
      setIncidents(incidentsData || []);

      // Load health metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('system_health_metrics')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('recorded_at', { ascending: false })
        .limit(20);

      if (metricsError) throw metricsError;
      setMetrics(metricsData || []);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load production dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerEmergencyLockdown = async () => {
    const reason = prompt('Enter reason for emergency lockdown:');
    if (!reason) return;

    try {
      const { error } = await supabase.rpc('emergency_lockdown', { p_reason: reason });
      
      if (error) throw error;
      
      toast({
        title: 'Emergency Lockdown Activated',
        description: 'All non-owner access has been suspended',
        variant: 'destructive',
      });
      
      loadDashboardData();
    } catch (error) {
      console.error('Error triggering emergency lockdown:', error);
      toast({
        title: 'Error',
        description: 'Failed to activate emergency lockdown',
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASS':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'WARN':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'FAIL':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PASS':
        return 'bg-green-500';
      case 'WARN':
        return 'bg-yellow-500';
      case 'FAIL':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const passedChecks = checks.filter(c => c.status === 'PASS').length;
  const totalChecks = checks.length;
  const readinessScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Production Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor system health and production readiness
          </p>
        </div>
        
        {profile?.role === 'owner' && (
          <Button 
            variant="destructive" 
            onClick={triggerEmergencyLockdown}
            className="ml-4"
          >
            <Shield className="h-4 w-4 mr-2" />
            Emergency Lockdown
          </Button>
        )}
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Production Readiness Score
          </CardTitle>
          <CardDescription>
            System health and compliance status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold">{readinessScore}%</div>
            <div className="flex-1">
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    readinessScore >= 80 ? 'bg-green-500' :
                    readinessScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${readinessScore}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {passedChecks} of {totalChecks} checks passed
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="checks" className="w-full">
        <TabsList>
          <TabsTrigger value="checks">Readiness Checks</TabsTrigger>
          <TabsTrigger value="incidents">Security Incidents</TabsTrigger>
          <TabsTrigger value="metrics">Health Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="checks" className="space-y-4">
          {checks.map((check, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <div>
                      <h3 className="font-medium capitalize">
                        {check.check_name.replace(/_/g, ' ')}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {check.details}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={check.priority === 'high' ? 'destructive' : 'secondary'}
                      className="capitalize"
                    >
                      {check.priority} Priority
                    </Badge>
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(check.status)}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          {incidents.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-muted-foreground">No open security incidents</p>
              </CardContent>
            </Card>
          ) : (
            incidents.map((incident) => (
              <Alert key={incident.id}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{incident.incident_type}</p>
                    <p className="text-sm">{incident.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(incident.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={getSeverityColor(incident.severity)}>
                    {incident.severity}
                  </Badge>
                </AlertDescription>
              </Alert>
            ))
          )}
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.map((metric) => (
              <Card key={metric.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium capitalize">
                    {metric.metric_type.replace(/_/g, ' ')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">
                      {metric.metric_value}
                    </div>
                    <Badge 
                      variant={metric.status === 'normal' ? 'outline' : 'destructive'}
                    >
                      {metric.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(metric.recorded_at).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};