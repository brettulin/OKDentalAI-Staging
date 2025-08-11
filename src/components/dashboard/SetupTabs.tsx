import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClinicSetup } from './ClinicSetup';
import { PMSSetup } from './PMSSetup';
import { ProvidersSetup } from './ProvidersSetup';
import { LocationsSetup } from './LocationsSetup';
import { AIReceptionistDashboard } from './AIReceptionistDashboard';
import { Building, Settings, Users, MapPin, Bot } from 'lucide-react';

export const SetupTabs = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Clinic Management</h1>
        <p className="text-muted-foreground">
          Set up and manage your dental practice with AI-powered features
        </p>
      </div>

      <Tabs defaultValue="clinic" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="clinic" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Clinic
          </TabsTrigger>
          <TabsTrigger value="pms" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            PMS
          </TabsTrigger>
          <TabsTrigger value="providers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Assistant
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clinic">
          <ClinicSetup />
        </TabsContent>

        <TabsContent value="pms">
          <PMSSetup />
        </TabsContent>

        <TabsContent value="providers">
          <ProvidersSetup />
        </TabsContent>

        <TabsContent value="locations">
          <LocationsSetup />
        </TabsContent>

        <TabsContent value="ai">
          <AIReceptionistDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};