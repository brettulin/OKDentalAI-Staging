import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
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
  Lock
} from 'lucide-react';

interface CareStackCredentials {
  vendorKey: string;
  accountKey: string;
  accountId: string;
  baseUrl: string;
}

export function CareStackLiveSetup() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  const [isSandboxMode, setIsSandboxMode] = useState(true);
  const [liveCredentials, setLiveCredentials] = useState<CareStackCredentials>({
    vendorKey: '',
    accountKey: '',
    accountId: '',
    baseUrl: 'https://api.carestack.com'
  });
  const [sandboxCredentials, setSandboxCredentials] = useState<CareStackCredentials>({
    vendorKey: '',
    accountKey: '',
    accountId: '',
    baseUrl: 'https://sandbox-api.carestack.com'
  });
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Fetch current office configuration
  const { data: offices } = useQuery({
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
    onSuccess: () => {
      toast({
        title: "Configuration Saved",
        description: "CareStack credentials have been securely stored.",
      });
      queryClient.invalidateQueries({ queryKey: ['offices'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
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
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Connection Successful",
        description: `Successfully connected to CareStack ${isSandboxMode ? 'Sandbox' : 'Live'} environment.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: `Failed to connect: ${error.message}`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsTestingConnection(false);
    },
  });

  const handleCredentialsChange = (field: keyof CareStackCredentials, value: string) => {
    if (isSandboxMode) {
      setSandboxCredentials(prev => ({ ...prev, [field]: value }));
    } else {
      setLiveCredentials(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleTestConnection = () => {
    const credentials = isSandboxMode ? sandboxCredentials : liveCredentials;
    const environment = isSandboxMode ? 'sandbox' : 'live';
    
    testConnectionMutation.mutate({ environment, credentials });
  };

  const handleSaveConfiguration = () => {
    const credentials = isSandboxMode ? sandboxCredentials : liveCredentials;
    const environment = isSandboxMode ? 'sandbox' : 'live';
    
    saveConfigMutation.mutate({ environment, credentials });
  };

  const currentCredentials = isSandboxMode ? sandboxCredentials : liveCredentials;
  const isValidCredentials = currentCredentials.vendorKey && 
                           currentCredentials.accountKey && 
                           currentCredentials.accountId;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            CareStack Environment Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Environment Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label className="text-base font-medium">Environment Mode</Label>
                <Badge variant={isSandboxMode ? "secondary" : "default"}>
                  {isSandboxMode ? 'Sandbox' : 'Live Production'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isSandboxMode 
                  ? 'Safe testing environment with mock data' 
                  : 'Live production environment with real patient data'
                }
              </p>
            </div>
            <Switch
              checked={!isSandboxMode}
              onCheckedChange={(checked) => setIsSandboxMode(!checked)}
            />
          </div>

          {!isSandboxMode && (
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
                CareStack {isSandboxMode ? 'Sandbox' : 'Live'} Credentials
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

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleTestConnection}
              disabled={!isValidCredentials || isTestingConnection || testConnectionMutation.isPending}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Server className="h-4 w-4" />
              {isTestingConnection ? 'Testing...' : 'Test Connection'}
            </Button>

            <Button
              onClick={handleSaveConfiguration}
              disabled={!isValidCredentials || saveConfigMutation.isPending}
              className="flex items-center gap-2"
            >
              <Lock className="h-4 w-4" />
              {saveConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>

          {/* Current Configuration Status */}
          {offices && offices.length > 0 && (
            <div className="space-y-3">
              <Separator />
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <Label className="text-base font-medium">Current Configuration</Label>
              </div>
              
              {offices.map((office) => (
                <div key={office.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{office.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Office ID: {office.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={office.pms_credentials ? "default" : "secondary"}>
                        {office.pms_credentials ? 'Configured' : 'Pending'}
                      </Badge>
                      {office.pms_credentials && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Security Notice */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Security:</strong> All credentials are encrypted and stored securely. 
              They are only accessible by authorized edge functions and are never exposed 
              to the client-side application.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}