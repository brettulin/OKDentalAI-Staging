import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GlobalDeploymentDashboard } from '@/components/global/GlobalDeploymentDashboard';
import { AdvancedAIDashboard } from '@/components/global/AdvancedAIDashboard';

const Global = () => {
  return (
    <div className="p-6" data-testid="page-global">
      <Tabs defaultValue="deployment" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="deployment">Global Deployment</TabsTrigger>
          <TabsTrigger value="ai">Advanced AI</TabsTrigger>
        </TabsList>

        <TabsContent value="deployment">
          <GlobalDeploymentDashboard />
        </TabsContent>

        <TabsContent value="ai">
          <AdvancedAIDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Global;