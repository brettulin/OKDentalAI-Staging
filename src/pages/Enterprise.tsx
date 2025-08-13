import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WhiteLabelConfigurator } from '@/components/enterprise/WhiteLabelConfigurator';
import { DeploymentDashboard } from '@/components/enterprise/DeploymentDashboard';

const Enterprise = () => {
  return (
    <div className="p-6" data-testid="page-enterprise">
      <Tabs defaultValue="white-label" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="white-label">White-Label</TabsTrigger>
          <TabsTrigger value="deployment">Deployment</TabsTrigger>
        </TabsList>

        <TabsContent value="white-label">
          <WhiteLabelConfigurator />
        </TabsContent>

        <TabsContent value="deployment">
          <DeploymentDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Enterprise;