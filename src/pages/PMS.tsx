import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { EmptyState } from '@/components/EmptyState';
import { PMSSetup } from '@/components/dashboard/PMSSetup';
import { PMSHealthDashboard } from '@/components/pms/PMSHealthDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Database, Shield, CheckCircle, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export default function PMS() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (!profile?.clinic_id) {
    return (
      <div className="container mx-auto p-6" data-testid="page-pms">
        <EmptyState
          title="Create a clinic first"
          description="You need to set up your clinic before configuring PMS integrations"
          icon={<Database className="h-12 w-12 text-muted-foreground" />}
          action={{
            label: "Go to Setup",
            onClick: () => window.location.href = "/?tab=clinic"
          }}
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="container mx-auto p-6 space-y-6" data-testid="page-pms">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">PMS Integration</h1>
            <p className="text-muted-foreground">
              Connect your Practice Management System to enable AI receptionist features
            </p>
          </div>
        </div>

        {/* Benefits Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Patient Lookup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Search and verify patient information automatically
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Appointment Booking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Book appointments directly into your PMS system
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                Secure Integration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                HIPAA-compliant connection to your practice data
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main PMS Management Interface */}
        <Tabs defaultValue="setup" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="setup">
              <Settings className="mr-2 h-4 w-4" />
              Setup & Configuration
            </TabsTrigger>
            <TabsTrigger value="monitoring">
              <Activity className="mr-2 h-4 w-4" />
              Health Monitoring
            </TabsTrigger>
          </TabsList>

          <TabsContent value="setup">
            <PMSSetup />
          </TabsContent>

          <TabsContent value="monitoring">
            <Card>
              <CardHeader>
                <CardTitle>PMS System Health Monitor</CardTitle>
                <p className="text-muted-foreground">
                  Monitor the health and performance of your Practice Management System integrations
                </p>
              </CardHeader>
              <CardContent>
                <PMSHealthDashboard />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
}