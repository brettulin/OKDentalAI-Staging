import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MarketReadinessDashboard } from '@/components/optimization/MarketReadinessDashboard';
import { OptimizationEngine } from '@/components/optimization/OptimizationEngine';
import { SubscriptionManagement } from '@/components/optimization/SubscriptionManagement';
import { RevenueOptimization } from '@/components/optimization/RevenueOptimization';

const Optimization = () => {
  return (
    <div className="p-6" data-testid="page-optimization">
      <Tabs defaultValue="market-readiness" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="market-readiness">Market Readiness</TabsTrigger>
          <TabsTrigger value="optimization">Optimization Engine</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
        </TabsList>

        <TabsContent value="market-readiness">
          <MarketReadinessDashboard />
        </TabsContent>

        <TabsContent value="optimization">
          <OptimizationEngine />
        </TabsContent>

        <TabsContent value="subscriptions">
          <SubscriptionManagement />
        </TabsContent>

        <TabsContent value="revenue">
          <RevenueOptimization />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Optimization;