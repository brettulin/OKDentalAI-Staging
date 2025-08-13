import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MarketReadinessDashboard } from '@/components/optimization/MarketReadinessDashboard';
import { OptimizationEngine } from '@/components/optimization/OptimizationEngine';

const Optimization = () => {
  return (
    <div className="p-6" data-testid="page-optimization">
      <Tabs defaultValue="market-readiness" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="market-readiness">Market Readiness</TabsTrigger>
          <TabsTrigger value="optimization">Optimization Engine</TabsTrigger>
        </TabsList>

        <TabsContent value="market-readiness">
          <MarketReadinessDashboard />
        </TabsContent>

        <TabsContent value="optimization">
          <OptimizationEngine />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Optimization;