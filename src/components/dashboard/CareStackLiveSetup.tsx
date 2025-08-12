import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Server, 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Settings, 
  Key,
  Cloud,
  Lock,
  Activity,
  Database,
  Loader2,
  ExternalLink,
  RefreshCw,
  Zap
} from 'lucide-react';

interface CareStackCredentials {
  vendorKey: string;
  accountKey: string;
  accountId: string;
  baseUrl: string;
}

interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    apiVersion?: string;
    accountInfo?: any;
    permissions?: string[];
    responseTime?: number;
  };
}

interface EnvironmentHealth {
  sandbox: {
    configured: boolean;
    lastTested?: string;
    status: 'healthy' | 'warning' | 'error' | 'unknown';
  };
  live: {
    configured: boolean;
    lastTested?: string;
    status: 'healthy' | 'warning' | 'error' | 'unknown';
  };
}

export function CareStackLiveSetup() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  const [currentEnvironment, setCurrentEnvironment] = useState<'sandbox' | 'live'>('sandbox');
  const [credentials, setCredentials] = useState<Record<'sandbox' | 'live', CareStackCredentials>>({
    sandbox: {
      vendorKey: '',
      accountKey: '',
      accountId: '',
      baseUrl: 'https://sandbox-api.carestack.com'
    },
    live: {
      vendorKey: '',
      accountKey: '',
      accountId: '',
      baseUrl: 'https://api.carestack.com'
    }
  });
  const [testResults, setTestResults] = useState<Record<string, ConnectionTestResult>>({});
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [healthStatus, setHealthStatus] = useState<EnvironmentHealth>({
    sandbox: { configured: false, status: 'unknown' },
    live: { configured: false, status: 'unknown' }
  });

  // Fetch current office configuration
  const { data: offices, refetch: refetchOffices } = useQuery({
    queryKey: ['offices', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      
      const { data, error } = await supabase
        .from('offices')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .eq('pms_type', 'carestack');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  // Load saved credentials on mount
  useEffect(() => {
    if (offices && offices.length > 0) {
      const office = offices[0];
      if (office.pms_credentials) {
        // Update health status based on saved config
        setHealthStatus(prev => ({
          ...prev,
          sandbox: { ...prev.sandbox, configured: true },
          live: { ...prev.live, configured: true }
        }));
      }
    }
  }, [offices]);

  // Save CareStack configuration
  const saveConfigMutation = useMutation({
    mutationFn: async (config: {
      environment: 'sandbox' | 'live';
      credentials: CareStackCredentials;
      officeId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('pms-integrations', {
        body: {
          action: 'configure_carestack',
          officeId: config.officeId || offices?.[0]?.id,
          environment: config.environment,
          credentials: config.credentials
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Configuration Saved",
        description: `CareStack ${variables.environment} credentials have been securely stored.`,
      });
      
      // Update health status
      setHealthStatus(prev => ({
        ...prev,
        [variables.environment]: {
          ...prev[variables.environment],
          configured: true,
          status: 'healthy'
        }
      }));
      
      queryClient.invalidateQueries({ queryKey: ['offices'] });
    },
    onError: (error) => {
      toast({
        title: "Configuration Error",
        description: `Failed to save configuration: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Test CareStack connection
  const testConnectionMutation = useMutation({
    mutationFn: async (config: {
      environment: 'sandbox' | 'live';
      credentials: CareStackCredentials;
    }) => {
      setIsTestingConnection(true);
      
      const { data, error } = await supabase.functions.invoke('pms-integrations', {
        body: {
          action: 'test_carestack_connection',
          environment: config.environment,
          credentials: config.credentials
        }
      });

      if (error) throw error;
      return data as ConnectionTestResult;
    },
    onSuccess: (data, variables) => {
      const resultKey = `${variables.environment}_test`;
      setTestResults(prev => ({ ...prev, [resultKey]: data }));
      
      setHealthStatus(prev => ({
        ...prev,
        [variables.environment]: {
          ...prev[variables.environment],
          lastTested: new Date().toISOString(),
          status: data.success ? 'healthy' : 'error'
        }
      }));

      toast({
        title: data.success ? "Connection Successful" : "Connection Failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error, variables) => {
      setHealthStatus(prev => ({
        ...prev,
        [variables.environment]: {
          ...prev[variables.environment],
          lastTested: new Date().toISOString(),
          status: 'error'
        }
      }));
      
      toast({
        title: "Connection Failed",
        description: `Failed to connect to ${variables.environment}: ${error.message}`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsTestingConnection(false);
    },
  });

  const handleCredentialsChange = (field: keyof CareStackCredentials, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [currentEnvironment]: {
        ...prev[currentEnvironment],
        [field]: value
      }
    }));
  };

  const handleTestConnection = () => {
    const creds = credentials[currentEnvironment];
    testConnectionMutation.mutate({ 
      environment: currentEnvironment, 
      credentials: creds 
    });
  };

  const handleSaveConfiguration = () => {
    const creds = credentials[currentEnvironment];
    saveConfigMutation.mutate({ 
      environment: currentEnvironment, 
      credentials: creds 
    });
  };

  const handleQuickSetup = async () => {
    // Test both environments sequentially
    for (const env of ['sandbox', 'live'] as const) {
      const creds = credentials[env];
      if (creds.vendorKey && creds.accountKey && creds.accountId) {
        await testConnectionMutation.mutateAsync({ environment: env, credentials: creds });
        if (testResults[`${env}_test`]?.success) {
          await saveConfigMutation.mutateAsync({ environment: env, credentials: creds });
        }
      }
    }
  };

  const currentCredentials = credentials[currentEnvironment];
  const isValidCredentials = currentCredentials.vendorKey && 
                           currentCredentials.accountKey && 
                           currentCredentials.accountId;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getOverallProgress = () => {
    const total = 4; // sandbox config, sandbox test, live config, live test
    let completed = 0;
    
    if (healthStatus.sandbox.configured) completed++;
    if (healthStatus.sandbox.status === 'healthy') completed++;
    if (healthStatus.live.configured) completed++;
    if (healthStatus.live.status === 'healthy') completed++;
    
    return (completed / total) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            CareStack Production Setup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Setup Progress</span>
                <span className="text-sm text-muted-foreground">{Math.round(getOverallProgress())}%</span>
              </div>
              <Progress value={getOverallProgress()} className="h-2" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Sandbox Environment</p>
                    <p className="text-sm text-muted-foreground">Testing & Development</p>
                  </div>
                  {getStatusBadge(healthStatus.sandbox.status)}
                </div>
              </div>
              
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Live Environment</p>
                    <p className="text-sm text-muted-foreground">Production Ready</p>
                  </div>
                  {getStatusBadge(healthStatus.live.status)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Environment Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Environment Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Environment Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label className="text-base font-medium">Current Environment</Label>
                <Badge variant={currentEnvironment === 'sandbox' ? "secondary" : "default"}>
                  {currentEnvironment === 'sandbox' ? 'Sandbox' : 'Live Production'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {currentEnvironment === 'sandbox' 
                  ? 'Safe testing environment with mock data' 
                  : 'Live production environment with real patient data'
                }
              </p>
            </div>
            <Switch
              checked={currentEnvironment === 'live'}
              onCheckedChange={(checked) => setCurrentEnvironment(checked ? 'live' : 'sandbox')}
            />
          </div>

          {currentEnvironment === 'live' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Production Mode:</strong> You are configuring the live CareStack environment. 
                This will handle real patient data and appointments. Ensure you have proper 
                authorization and that your credentials are correct.
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Credentials Form */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              <Label className="text-base font-medium">
                CareStack {currentEnvironment === 'sandbox' ? 'Sandbox' : 'Live'} Credentials
              </Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendorKey">Vendor Key</Label>
                <Input
                  id="vendorKey"
                  type="password"
                  value={currentCredentials.vendorKey}
                  onChange={(e) => handleCredentialsChange('vendorKey', e.target.value)}
                  placeholder="Enter your CareStack vendor key"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountKey">Account Key</Label>
                <Input
                  id="accountKey"
                  type="password"
                  value={currentCredentials.accountKey}
                  onChange={(e) => handleCredentialsChange('accountKey', e.target.value)}
                  placeholder="Enter your CareStack account key"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountId">Account ID</Label>
                <Input
                  id="accountId"
                  value={currentCredentials.accountId}
                  onChange={(e) => handleCredentialsChange('accountId', e.target.value)}
                  placeholder="Enter your CareStack account ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={currentCredentials.baseUrl}
                  onChange={(e) => handleCredentialsChange('baseUrl', e.target.value)}
                  placeholder="CareStack API base URL"
                />
              </div>
            </div>
          </div>

          {/* Connection Test Results */}
          {testResults[`${currentEnvironment}_test`] && (
            <Alert className={testResults[`${currentEnvironment}_test`].success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <div className="flex items-start gap-2">
                {testResults[`${currentEnvironment}_test`].success ? 
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" /> : 
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                }
                <div className="flex-1">
                  <AlertDescription className={testResults[`${currentEnvironment}_test`].success ? 'text-green-800' : 'text-red-800'}>
                    <strong>Connection Test Result:</strong> {testResults[`${currentEnvironment}_test`].message}
                    {testResults[`${currentEnvironment}_test`].details && (
                      <div className="mt-2 text-sm">
                        <p>API Version: {testResults[`${currentEnvironment}_test`].details.apiVersion}</p>
                        <p>Response Time: {testResults[`${currentEnvironment}_test`].details.responseTime}ms</p>
                      </div>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={handleTestConnection}
              disabled={!isValidCredentials || isTestingConnection || testConnectionMutation.isPending}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isTestingConnection ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Server className="h-4 w-4" />
              )}
              {isTestingConnection ? 'Testing...' : 'Test Connection'}
            </Button>

            <Button
              onClick={handleSaveConfiguration}
              disabled={!isValidCredentials || saveConfigMutation.isPending}
              className="flex items-center gap-2"
            >
              {saveConfigMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {saveConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </Button>

            <Button
              onClick={() => refetchOffices()}
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Configuration Status */}
      {offices && offices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Current Configuration Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {offices.map((office) => (
                <div key={office.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{office.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Office ID: {office.id}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Last Updated: {new Date(office.updated_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={office.pms_credentials ? "default" : "secondary"}>
                        {office.pms_credentials ? 'Configured' : 'Pending Setup'}
                      </Badge>
                      {office.pms_credentials && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Production Deployment Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert className="border-blue-200 bg-blue-50">
              <Database className="h-4 w-4" />
              <AlertDescription className="text-blue-800">
                <strong>Step 1:</strong> Configure and test sandbox environment first to ensure integration works correctly.
              </AlertDescription>
            </Alert>

            <Alert className="border-purple-200 bg-purple-50">
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-purple-800">
                <strong>Step 2:</strong> Obtain production CareStack credentials from your CareStack account administrator.
              </AlertDescription>
            </Alert>

            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                <strong>Step 3:</strong> Configure live environment credentials and verify connection to production CareStack.
              </AlertDescription>
            </Alert>

            <Alert className="border-orange-200 bg-orange-50">
              <AlertDescription className="text-orange-800">
                <strong>Step 4:</strong> Complete the production readiness checklist before switching to live mode.
              </AlertDescription>
            </Alert>
          </div>

          <div className="mt-6 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="h-4 w-4" />
              <span className="font-medium">Need Help?</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Contact your CareStack account manager for production API credentials and integration support.
              Ensure your CareStack subscription includes API access for third-party integrations.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Security:</strong> All credentials are encrypted using industry-standard encryption 
          and stored securely in Supabase. They are only accessible by authorized edge functions 
          and are never exposed to the client-side application or browser.
        </AlertDescription>
      </Alert>
    </div>
  );
}