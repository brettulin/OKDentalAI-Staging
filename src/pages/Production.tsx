import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductionDashboard } from '@/components/production/ProductionDashboard';
import { SecurityIncidentManager } from '@/components/production/SecurityIncidentManager';
import { ProductionReadinessCheck } from '@/components/production/ProductionReadinessCheck';
import { SecurityMonitoringDashboard } from '@/components/production/SecurityMonitoringDashboard';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

export default function Production() {
  const { profile } = useAuth();

  // Only owners and technical admins can access production features
  const canAccess = profile?.role === 'owner' || 
    (profile?.admin_role && ['technical_admin', 'clinic_admin'].includes(profile.admin_role));

  if (!canAccess) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Access denied. Only clinic owners and technical administrators can access production management features.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="readiness">Readiness Check</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <ProductionDashboard />
        </TabsContent>

        <TabsContent value="readiness" className="mt-6">
          <ProductionReadinessCheck />
        </TabsContent>

        <TabsContent value="incidents" className="mt-6">
          <SecurityIncidentManager />
        </TabsContent>

        <TabsContent value="monitoring" className="mt-6">
          <SecurityMonitoringDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}