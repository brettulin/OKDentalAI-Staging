import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Settings, TestTube, CheckCircle, XCircle } from 'lucide-react';

interface Office {
  id: string;
  name: string;
  pms_type: string;
  pms_credentials: any;
  created_at: string;
}

interface PMSTestResult {
  success: boolean;
  tests: Record<string, any>;
  summary: {
    passed: number;
    total: number;
  };
}

export const PMSSetup = () => {
  const { toast } = useToast();
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, PMSTestResult>>({});

  const [officeForm, setOfficeForm] = useState({
    name: '',
    pms_type: '',
    credentials: {
      apiKey: '',
      baseUrl: '',
      username: '',
      password: '',
      clientId: '',
      clientSecret: ''
    }
  });

  useEffect(() => {
    loadOffices();
  }, []);

  const loadOffices = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.clinic_id) return;

      const { data: officesData } = await supabase
        .from('offices')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .order('created_at', { ascending: false });

      setOffices(officesData || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load PMS integrations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.clinic_id) throw new Error('No clinic found');

      const { data, error } = await supabase
        .from('offices')
        .insert([{
          name: officeForm.name,
          pms_type: officeForm.pms_type,
          pms_credentials: officeForm.credentials,
          clinic_id: profile.clinic_id
        }])
        .select()
        .single();

      if (error) throw error;

      setOffices([data, ...offices]);
      setOfficeForm({
        name: '',
        pms_type: '',
        credentials: {
          apiKey: '',
          baseUrl: '',
          username: '',
          password: '',
          clientId: '',
          clientSecret: ''
        }
      });

      toast({
        title: "Success",
        description: "PMS integration created successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create PMS integration",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const testPMSIntegration = async (officeId: string) => {
    setTesting(officeId);
    
    try {
      const { data, error } = await supabase.functions.invoke('pms-test', {
        body: { officeId, testPhone: '+1234567890' }
      });

      if (error) throw error;

      setTestResults({ ...testResults, [officeId]: data });
      
      toast({
        title: data.success ? "Test Passed" : "Test Failed",
        description: `${data.summary.passed}/${data.summary.total} tests passed`,
        variant: data.success ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Test Error",
        description: error instanceof Error ? error.message : "Failed to test PMS integration",
        variant: "destructive",
      });
    } finally {
      setTesting(null);
    }
  };

  const renderCredentialFields = () => {
    switch (officeForm.pms_type) {
      case 'carestack':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={officeForm.credentials.apiKey}
                onChange={(e) => setOfficeForm({
                  ...officeForm,
                  credentials: { ...officeForm.credentials, apiKey: e.target.value }
                })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input
                id="baseUrl"
                placeholder="https://api.carestack.com"
                value={officeForm.credentials.baseUrl}
                onChange={(e) => setOfficeForm({
                  ...officeForm,
                  credentials: { ...officeForm.credentials, baseUrl: e.target.value }
                })}
                required
              />
            </div>
          </>
        );
      case 'dentrix':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={officeForm.credentials.username}
                onChange={(e) => setOfficeForm({
                  ...officeForm,
                  credentials: { ...officeForm.credentials, username: e.target.value }
                })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={officeForm.credentials.password}
                onChange={(e) => setOfficeForm({
                  ...officeForm,
                  credentials: { ...officeForm.credentials, password: e.target.value }
                })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Server URL</Label>
              <Input
                id="baseUrl"
                placeholder="http://your-dentrix-server.com"
                value={officeForm.credentials.baseUrl}
                onChange={(e) => setOfficeForm({
                  ...officeForm,
                  credentials: { ...officeForm.credentials, baseUrl: e.target.value }
                })}
                required
              />
            </div>
          </>
        );
      case 'eaglesoft':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                value={officeForm.credentials.clientId}
                onChange={(e) => setOfficeForm({
                  ...officeForm,
                  credentials: { ...officeForm.credentials, clientId: e.target.value }
                })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret</Label>
              <Input
                id="clientSecret"
                type="password"
                value={officeForm.credentials.clientSecret}
                onChange={(e) => setOfficeForm({
                  ...officeForm,
                  credentials: { ...officeForm.credentials, clientSecret: e.target.value }
                })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseUrl">API URL</Label>
              <Input
                id="baseUrl"
                placeholder="https://api.eaglesoft.com"
                value={officeForm.credentials.baseUrl}
                onChange={(e) => setOfficeForm({
                  ...officeForm,
                  credentials: { ...officeForm.credentials, baseUrl: e.target.value }
                })}
                required
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">PMS Integration Setup</h2>
        <p className="text-muted-foreground">
          Connect your Practice Management System to enable AI receptionist features
        </p>
      </div>

      {/* Create New Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add PMS Integration
          </CardTitle>
          <CardDescription>
            Set up a new connection to your practice management system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createOffice} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="office-name">Office Name</Label>
              <Input
                id="office-name"
                placeholder="Main Office"
                value={officeForm.name}
                onChange={(e) => setOfficeForm({ ...officeForm, name: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pms-type">PMS Type</Label>
              <Select 
                value={officeForm.pms_type} 
                onValueChange={(value) => setOfficeForm({ ...officeForm, pms_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your PMS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="carestack">CareStack</SelectItem>
                  <SelectItem value="dentrix">Dentrix</SelectItem>
                  <SelectItem value="eaglesoft">Eaglesoft</SelectItem>
                  <SelectItem value="dummy">Demo/Testing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {officeForm.pms_type && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium">PMS Credentials</h4>
                {renderCredentialFields()}
              </div>
            )}

            <Button type="submit" disabled={creating || !officeForm.pms_type}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Integration
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Integrations */}
      {offices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Your PMS Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {offices.map((office) => {
              const testResult = testResults[office.id];
              return (
                <div key={office.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{office.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {office.pms_type.toUpperCase()} Integration
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(office.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {testResult && (
                        <div className="flex items-center gap-1">
                          {testResult.success ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="text-sm">
                            {testResult.summary.passed}/{testResult.summary.total}
                          </span>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testPMSIntegration(office.id)}
                        disabled={testing === office.id}
                      >
                        {testing === office.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4" />
                        )}
                        Test
                      </Button>
                    </div>
                  </div>
                  
                  {testResult && (
                    <div className="mt-3 pt-3 border-t">
                      <h5 className="text-sm font-medium mb-2">Test Results:</h5>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(testResult.tests).map(([test, result]) => (
                          <div key={test} className="flex items-center gap-1">
                            {result?.success ? (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            ) : (
                              <XCircle className="h-3 w-3 text-red-600" />
                            )}
                            <span className="capitalize">{test.replace(/([A-Z])/g, ' $1')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
