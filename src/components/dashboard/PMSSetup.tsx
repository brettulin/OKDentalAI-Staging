import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { usePMSIntegration } from '@/hooks/usePMSIntegration';
import { PMSTestModal } from './PMSTestModal';
import { Loader2, Plus, Settings, TestTube } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const PMSSetup = () => {
  const { toast } = useToast();
  const { offices, officesLoading, createOffice } = usePMSIntegration();
  const [creating, setCreating] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState<{ id: string; name: string } | null>(null);

  const [officeForm, setOfficeForm] = useState({
    name: '',
    pms_type: '',
    credentials: {} as any
  });

  const handleCreateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      // Normalize credentials based on PMS type
      let normalizedCredentials;
      switch (officeForm.pms_type) {
        case 'dummy':
          normalizedCredentials = { clinicId: `demo-${Date.now()}` };
          break;
        case 'carestack':
          normalizedCredentials = {
            clientId: officeForm.credentials.clientId,
            clientSecret: officeForm.credentials.clientSecret,
            baseUrl: officeForm.credentials.baseUrl || 'https://api.carestack.com/v1',
            useMockMode: true // Enable mock mode by default until live credentials are provided
          };
          break;
        case 'dentrix':
          normalizedCredentials = {
            username: officeForm.credentials.username,
            password: officeForm.credentials.password,
            baseUrl: officeForm.credentials.baseUrl
          };
          break;
        case 'eaglesoft':
          normalizedCredentials = {
            clientId: officeForm.credentials.clientId,
            clientSecret: officeForm.credentials.clientSecret,
            baseUrl: officeForm.credentials.baseUrl
          };
          break;
        default:
          normalizedCredentials = officeForm.credentials;
      }

      // Get current user's clinic_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.clinic_id) throw new Error('No clinic found');

      await createOffice({
        name: officeForm.name,
        pms_type: officeForm.pms_type,
        pms_credentials: normalizedCredentials,
        clinic_id: profile.clinic_id
      });

      // Reset form
      setOfficeForm({
        name: '',
        pms_type: '',
        credentials: {}
      });

      toast({
        title: "Success",
        description: "PMS integration saved successfully!",
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

  const handleTestOffice = (office: { id: string; name: string }) => {
    setSelectedOffice(office);
    setTestModalOpen(true);
  };

  const renderCredentialFields = () => {
    if (!officeForm.credentials) {
      return null;
    }

    switch (officeForm.pms_type) {
      case 'carestack':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={officeForm.credentials.apiKey || ''}
                onChange={(e) => setOfficeForm({
                  ...officeForm,
                  credentials: { ...officeForm.credentials, apiKey: e.target.value }
                })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                value={officeForm.credentials.clientId || ''}
                onChange={(e) => setOfficeForm({
                  ...officeForm,
                  credentials: { ...officeForm.credentials, clientId: e.target.value }
                })}
                placeholder="Your CareStack Client ID"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret</Label>
              <Input
                id="clientSecret"
                type="password"
                value={officeForm.credentials.clientSecret || ''}
                onChange={(e) => setOfficeForm({
                  ...officeForm,
                  credentials: { ...officeForm.credentials, clientSecret: e.target.value }
                })}
                placeholder="Your CareStack Client Secret"
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
                value={officeForm.credentials.username || ''}
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
                value={officeForm.credentials.password || ''}
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
                value={officeForm.credentials.baseUrl || ''}
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
                value={officeForm.credentials.clientId || ''}
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
                value={officeForm.credentials.clientSecret || ''}
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
                value={officeForm.credentials.baseUrl || ''}
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

  if (officesLoading) {
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
          <form onSubmit={handleCreateOffice} className="space-y-4">
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

            {officeForm.pms_type && officeForm.pms_type !== 'dummy' && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium">PMS Credentials</h4>
                {renderCredentialFields()}
              </div>
            )}
            
            {officeForm.pms_type === 'dummy' && (
              <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Demo Mode:</strong> This integration uses mock data for testing purposes. 
                  No real credentials are required.
                </p>
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
      {offices && offices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Your PMS Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {offices.map((office) => (
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
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => handleTestOffice({ id: office.id, name: office.name })}
                     >
                       <TestTube className="h-4 w-4 mr-1" />
                       Test
                     </Button>
                   </div>
                 </div>
               </div>
             ))}
           </CardContent>
         </Card>
       )}

       {/* Test Modal */}
       {selectedOffice && (
         <PMSTestModal
           open={testModalOpen}
           onClose={() => {
             setTestModalOpen(false);
             setSelectedOffice(null);
           }}
           officeId={selectedOffice.id}
           officeName={selectedOffice.name}
         />
       )}
     </div>
   );
};
