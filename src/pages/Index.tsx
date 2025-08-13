import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CallSimulator } from '@/components/ai/CallSimulator';
import { PatientLookup } from '@/components/patients/PatientLookup';
import { SecurityMonitor } from '@/components/security/SecurityMonitor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Bot, Users, Calendar, Settings, Shield } from 'lucide-react';

export default function Index() {
  const { user } = useAuth();
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');

  // Fetch user profile to get clinic_id
  const { data: profile, isLoading: userProfileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch offices for PMS integration
  const { data: offices } = useQuery({
    queryKey: ['offices', profile?.clinic_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offices')
        .select('*')
        .eq('clinic_id', profile?.clinic_id || '');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  // Auto-select first office if available
  if (offices && offices.length > 0 && !selectedOfficeId) {
    setSelectedOfficeId(offices[0].id);
  }

  if (userProfileLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!profile?.clinic_id) {
    return (
      <EmptyState 
        title="Setup Required"
        description="Please complete your clinic setup to use the AI receptionist."
        action={{
          label: "Setup Clinic",
          onClick: () => window.location.href = "/settings"
        }}
      />
    );
  }

  return (
    <ErrorBoundary>
      <div className="container mx-auto py-8 space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">AI Dental Receptionist</h1>
          <p className="text-xl text-muted-foreground">
            Intelligent patient management and appointment booking
          </p>
          {offices && offices.length > 0 && (
            <Badge variant="secondary" className="text-sm">
              Connected to {offices[0].name} ({offices[0].pms_type})
            </Badge>
          )}
        </div>

        <Tabs defaultValue="ai-chat" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ai-chat" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              AI Chat
            </TabsTrigger>
            <TabsTrigger value="patient-lookup" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Patient Lookup
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai-chat" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <CallSimulator officeId={selectedOfficeId} />
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    AI Features
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-medium text-sm">Voice AI</h3>
                      <p className="text-xs text-muted-foreground">Speech-to-text & Text-to-speech</p>
                      <Badge variant="secondary" className="mt-2">Ready</Badge>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-medium text-sm">Smart Booking</h3>
                      <p className="text-xs text-muted-foreground">Automated appointment scheduling</p>
                      <Badge variant="secondary" className="mt-2">Ready</Badge>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-medium text-sm">Patient Lookup</h3>
                      <p className="text-xs text-muted-foreground">PMS integration for patient data</p>
                      <Badge variant="secondary" className="mt-2">Ready</Badge>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-medium text-sm">Call Recording</h3>
                      <p className="text-xs text-muted-foreground">Full conversation transcripts</p>
                      <Badge variant="outline" className="mt-2">Coming Soon</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="patient-lookup" className="space-y-6">
            <PatientLookup 
              officeId={selectedOfficeId}
              onPatientSelected={(patient) => console.log('Patient selected:', patient)}
              onAppointmentBooked={(appointment) => console.log('Appointment booked:', appointment)}
            />
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Recent Calls</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">This week</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Appointments Booked</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8</div>
                  <p className="text-xs text-muted-foreground">This week</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">94%</div>
                  <p className="text-xs text-muted-foreground">Call resolution</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <SecurityMonitor />
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
}