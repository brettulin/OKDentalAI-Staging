import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Loader2, Shield, Database, Key, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ReadinessCheck {
  check_name: string;
  status: string;
  details: string;
}

export const ProductionReadinessCheck: React.FC = () => {
  const { profile } = useAuth();

  const { data: checks, isLoading, refetch } = useQuery({
    queryKey: ['production-readiness', profile?.clinic_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('validate_production_readiness');
      if (error) throw error;
      return data as ReadinessCheck[];
    },
    enabled: !!profile?.clinic_id
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASS':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'FAIL':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return <Badge variant="default" className="bg-green-100 text-green-800">PASS</Badge>;
      case 'FAIL':
        return <Badge variant="destructive">FAIL</Badge>;
      default:
        return <Badge variant="secondary">WARNING</Badge>;
    }
  };

  const getCategoryIcon = (checkName: string) => {
    switch (checkName) {
      case 'RLS_ENABLED':
        return <Shield className="h-4 w-4" />;
      case 'ADMIN_USERS':
        return <Users className="h-4 w-4" />;
      case 'PMS_CONFIGURATION':
        return <Key className="h-4 w-4" />;
      default:
        return <Database className="h-4 w-4" />;
    }
  };

  const getCheckTitle = (checkName: string) => {
    switch (checkName) {
      case 'RLS_ENABLED':
        return 'Row Level Security';
      case 'ADMIN_USERS':
        return 'Administrative Users';
      case 'PMS_CONFIGURATION':
        return 'PMS Integration';
      default:
        return checkName.replace('_', ' ');
    }
  };

  const failedChecks = checks?.filter(check => check.status === 'FAIL') || [];
  const overallStatus = failedChecks.length === 0 ? 'READY' : 'NOT READY';

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Checking Production Readiness...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Production Readiness Status
            </span>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Re-check
            </Button>
          </CardTitle>
          <CardDescription>
            Comprehensive security and configuration validation for production deployment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Alert className={`border ${overallStatus === 'READY' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-center gap-2">
                {overallStatus === 'READY' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <AlertDescription className={overallStatus === 'READY' ? 'text-green-800' : 'text-red-800'}>
                  <strong>Status: {overallStatus}</strong>
                  {overallStatus === 'NOT READY' && (
                    <span className="block mt-1">
                      {failedChecks.length} critical issue{failedChecks.length !== 1 ? 's' : ''} must be resolved before going live
                    </span>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          </div>

          <div className="space-y-4">
            {checks?.map((check) => (
              <div key={check.check_name} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getCategoryIcon(check.check_name)}
                  <div>
                    <h3 className="font-medium">{getCheckTitle(check.check_name)}</h3>
                    <p className="text-sm text-muted-foreground">{check.details}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(check.status)}
                  {getStatusBadge(check.status)}
                </div>
              </div>
            ))}
          </div>

          {failedChecks.length > 0 && (
            <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
              <h3 className="font-medium text-red-800 mb-2">Critical Issues to Resolve:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                {failedChecks.map((check) => (
                  <li key={check.check_name}>
                    <strong>{getCheckTitle(check.check_name)}:</strong> {check.details}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};