import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, Clock, RefreshCw, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ReadinessCheck {
  category: string;
  check_name: string;
  status: string;
  details: string;
  priority: string;
}

export const ProductionReadinessCheck: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [checks, setChecks] = useState<ReadinessCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (profile?.clinic_id) {
      runChecks();
    }
  }, [profile?.clinic_id]);

  const runChecks = async () => {
    if (!profile?.clinic_id) return;

    try {
      setRunning(true);
      
      // Run comprehensive production check
      const { data, error } = await supabase
        .rpc('comprehensive_production_check', { p_clinic_id: profile.clinic_id });

      if (error) throw error;
      setChecks(data || []);

      toast({
        title: 'Success',
        description: 'Production readiness check completed',
      });
    } catch (error) {
      console.error('Error running production checks:', error);
      toast({
        title: 'Error',
        description: 'Failed to run production readiness check',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRunning(false);
    }
  };

  const runAutomatedSecurityScan = async () => {
    try {
      setRunning(true);
      
      const { error } = await supabase.rpc('automated_security_scan');
      
      if (error) throw error;
      
      toast({
        title: 'Security Scan Completed',
        description: 'Automated security scan has been executed',
      });
      
      // Refresh checks after security scan
      setTimeout(() => runChecks(), 2000);
    } catch (error) {
      console.error('Error running security scan:', error);
      toast({
        title: 'Error',
        description: 'Failed to run automated security scan',
        variant: 'destructive',
      });
      setRunning(false);
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

  const getStatusColor = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case 'PASS':
        return 'outline';
      case 'WARN':
        return 'secondary';
      case 'FAIL':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getPriorityColor = (priority: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (priority) {
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

  const passedChecks = checks.filter(c => c.status === 'PASS').length;
  const failedChecks = checks.filter(c => c.status === 'FAIL').length;
  const warnChecks = checks.filter(c => c.status === 'WARN').length;
  const totalChecks = checks.length;
  const successRate = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

  const isReadyForProduction = failedChecks === 0 && successRate >= 80;

  if (loading && checks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Running production readiness checks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Production Readiness Check</h1>
          <p className="text-muted-foreground">
            Comprehensive security and configuration validation for production deployment
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={runChecks}
            disabled={running}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Running...' : 'Refresh Checks'}
          </Button>
          
          <Button 
            onClick={runAutomatedSecurityScan}
            disabled={running}
          >
            <Play className="h-4 w-4 mr-2" />
            Security Scan
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Overall Readiness Status</span>
            <div className="flex items-center gap-2">
              {isReadyForProduction ? (
                <CheckCircle className="h-6 w-6 text-green-500" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-red-500" />
              )}
              <Badge 
                variant={isReadyForProduction ? 'outline' : 'destructive'}
                className="text-sm"
              >
                {isReadyForProduction ? 'READY FOR PRODUCTION' : 'NOT READY'}
              </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            System must pass all critical checks before production deployment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Success Rate</span>
                <span>{successRate}%</span>
              </div>
              <Progress value={successRate} className="h-3" />
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-500">{passedChecks}</div>
                <p className="text-sm text-muted-foreground">Passed</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-500">{warnChecks}</div>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-500">{failedChecks}</div>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Production Status Alert */}
      {!isReadyForProduction && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Production Deployment Blocked:</strong> {failedChecks} critical issues must be resolved before deploying to production. 
            Address all failed checks and ensure success rate is above 80%.
          </AlertDescription>
        </Alert>
      )}

      {isReadyForProduction && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Ready for Production Deployment! 🚀</strong> All critical checks have passed. 
            Your system meets the requirements for safe production deployment.
          </AlertDescription>
        </Alert>
      )}

      {/* Checks by Category */}
      <div className="space-y-6">
        {['security', 'backup', 'performance', 'compliance'].map(category => {
          const categoryChecks = checks.filter(c => c.category === category);
          if (categoryChecks.length === 0) return null;

          return (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="capitalize flex items-center justify-between">
                  <span>{category} Checks</span>
                  <Badge variant="outline">
                    {categoryChecks.filter(c => c.status === 'PASS').length} / {categoryChecks.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryChecks.map((check, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(check.status)}
                        <div>
                          <h4 className="font-medium capitalize">
                            {check.check_name.replace(/_/g, ' ')}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {check.details}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getPriorityColor(check.priority)}>
                          {check.priority} priority
                        </Badge>
                        <Badge variant={getStatusColor(check.status)}>
                          {check.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Production Deployment Actions */}
      {isReadyForProduction && (
        <Card>
          <CardHeader>
            <CardTitle>Production Deployment</CardTitle>
            <CardDescription>
              Your system is ready for production deployment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  All production readiness checks have passed. You can now safely deploy to production.
                  Make sure to:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Backup all critical data before deployment</li>
                    <li>Schedule deployment during low-traffic hours</li>
                    <li>Monitor system performance after deployment</li>
                    <li>Have rollback procedures ready</li>
                  </ul>
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-2">
                <Button className="flex-1">
                  <Play className="h-4 w-4 mr-2" />
                  Deploy to Production
                </Button>
                <Button variant="outline">
                  Download Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};