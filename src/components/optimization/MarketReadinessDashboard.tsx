import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Zap,
  TrendingUp,
  DollarSign,
  Users,
  Globe,
  Target,
  Award,
  Rocket,
  BarChart3,
  Clock,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Star
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  uptime: number;
  errorRate: number;
  customerSat: number;
  revenueGrowth: number;
}

interface MarketMetrics {
  totalCustomers: number;
  arr: number;
  churnRate: number;
  nps: number;
  marketShare: number;
  cac: number;
  ltv: number;
}

export function MarketReadinessDashboard() {
  const { profile } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('30');

  // Mock performance data
  const performanceMetrics: PerformanceMetrics = {
    responseTime: 45,
    throughput: 12500,
    uptime: 99.98,
    errorRate: 0.02,
    customerSat: 97,
    revenueGrowth: 245
  };

  // Mock market data
  const marketMetrics: MarketMetrics = {
    totalCustomers: 847,
    arr: 4200000,
    churnRate: 3.2,
    nps: 73,
    marketShare: 12.5,
    cac: 1850,
    ltv: 52000
  };

  const getMetricTrend = (value: number, target: number) => {
    const isPositive = value >= target;
    const difference = Math.abs(((value - target) / target) * 100);
    return {
      isPositive,
      percentage: difference.toFixed(1),
      icon: isPositive ? ArrowUp : ArrowDown,
      color: isPositive ? 'text-green-600' : 'text-red-600'
    };
  };

  const getPerformanceStatus = (value: number, excellent: number, good: number) => {
    if (value >= excellent) return { status: 'excellent', color: 'bg-green-500' };
    if (value >= good) return { status: 'good', color: 'bg-yellow-500' };
    return { status: 'needs-improvement', color: 'bg-red-500' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Rocket className="h-8 w-8" />
            Market Readiness Dashboard
          </h1>
          <p className="text-muted-foreground">
            Production optimization and commercial launch metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 Days</SelectItem>
              <SelectItem value="30">30 Days</SelectItem>
              <SelectItem value="90">90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="default" className="bg-green-100 text-green-800">
            Production Ready
          </Badge>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Response Time</p>
                <p className="text-3xl font-bold">{performanceMetrics.responseTime}ms</p>
                <div className="flex items-center gap-1 mt-1">
                  <ArrowUp className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-600">55% faster</p>
                </div>
              </div>
              <Zap className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monthly ARR</p>
                <p className="text-3xl font-bold">${(marketMetrics.arr / 1000000).toFixed(1)}M</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-600">245% growth</p>
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Enterprise Customers</p>
                <p className="text-3xl font-bold">{marketMetrics.totalCustomers}</p>
                <div className="flex items-center gap-1 mt-1">
                  <ArrowUp className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-600">12% this month</p>
                </div>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Market Share</p>
                <p className="text-3xl font-bold">{marketMetrics.marketShare}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <Target className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-blue-600">Top 3 position</p>
                </div>
              </div>
              <Globe className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="market">Market Position</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  System Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">API Response Time</span>
                      <span className="text-sm text-muted-foreground">{performanceMetrics.responseTime}ms</span>
                    </div>
                    <Progress value={100 - (performanceMetrics.responseTime / 2)} className="h-2" />
                    <p className="text-xs text-green-600 mt-1">Industry leading performance</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">System Uptime</span>
                      <span className="text-sm text-muted-foreground">{performanceMetrics.uptime}%</span>
                    </div>
                    <Progress value={performanceMetrics.uptime} className="h-2" />
                    <p className="text-xs text-green-600 mt-1">Exceeds SLA requirements</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Throughput</span>
                      <span className="text-sm text-muted-foreground">{performanceMetrics.throughput}/min</span>
                    </div>
                    <Progress value={85} className="h-2" />
                    <p className="text-xs text-blue-600 mt-1">High capacity utilization</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Error Rate</span>
                      <span className="text-sm text-muted-foreground">{performanceMetrics.errorRate}%</span>
                    </div>
                    <Progress value={100 - (performanceMetrics.errorRate * 50)} className="h-2" />
                    <p className="text-xs text-green-600 mt-1">Minimal error rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quality Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Quality Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Customer Satisfaction</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{performanceMetrics.customerSat}%</Badge>
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">AI Accuracy</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">98.7%</Badge>
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Voice Quality</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">99.2%</Badge>
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Security Score</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">96%</Badge>
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Compliance Rate</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">100%</Badge>
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Revenue Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Annual Recurring Revenue</span>
                    <span className="text-lg font-bold">${(marketMetrics.arr / 1000000).toFixed(1)}M</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Customer Lifetime Value</span>
                    <span className="text-lg font-bold">${(marketMetrics.ltv / 1000).toFixed(0)}K</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Customer Acquisition Cost</span>
                    <span className="text-lg font-bold">${marketMetrics.cac.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">LTV:CAC Ratio</span>
                    <span className="text-lg font-bold text-green-600">{(marketMetrics.ltv / marketMetrics.cac).toFixed(1)}:1</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Monthly Churn Rate</span>
                    <span className="text-lg font-bold text-green-600">{marketMetrics.churnRate}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Growth Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Growth Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-semibold text-green-900">Excellent Growth</h4>
                    <p className="text-sm text-green-700 mt-1">
                      245% year-over-year revenue growth exceeds industry benchmarks
                    </p>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-900">Market Leadership</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Top 3 market position with 12.5% market share
                    </p>
                  </div>

                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-semibold text-purple-900">Customer Success</h4>
                    <p className="text-sm text-purple-700 mt-1">
                      97% customer satisfaction with 73 NPS score
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="market" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Market Position */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Market Position
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Market Share</span>
                    <div className="flex items-center gap-2">
                      <Progress value={marketMetrics.marketShare * 8} className="w-24 h-2" />
                      <span className="text-sm font-bold">{marketMetrics.marketShare}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Industry Ranking</span>
                    <Badge variant="default">#3</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Brand Recognition</span>
                    <Badge variant="default">Top 5</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Innovation Score</span>
                    <Badge variant="default">96/100</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Customer NPS</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">{marketMetrics.nps}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Competitive Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Competitive Advantage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 border-l-4 border-green-500 bg-green-50">
                    <h4 className="font-semibold text-green-900">AI Voice Quality</h4>
                    <p className="text-sm text-green-700">50% faster response times than competitors</p>
                  </div>

                  <div className="p-3 border-l-4 border-blue-500 bg-blue-50">
                    <h4 className="font-semibold text-blue-900">Feature Completeness</h4>
                    <p className="text-sm text-blue-700">Only platform with full enterprise suite</p>
                  </div>

                  <div className="p-3 border-l-4 border-purple-500 bg-purple-50">
                    <h4 className="font-semibold text-purple-900">Security & Compliance</h4>
                    <p className="text-sm text-purple-700">Advanced security exceeds industry standards</p>
                  </div>

                  <div className="p-3 border-l-4 border-orange-500 bg-orange-50">
                    <h4 className="font-semibold text-orange-900">Global Scalability</h4>
                    <p className="text-sm text-orange-700">Multi-region deployment capability</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Production Optimization Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">Performance Optimizations</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Redis caching implemented</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Database query optimization</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">CDN integration active</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Memory management optimized</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Market Readiness</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Sales enablement tools ready</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Partner portal active</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Subscription management live</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">24/7 support infrastructure</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-5 w-5 text-green-600" />
                  <h4 className="font-semibold text-green-900">Market Launch Ready</h4>
                </div>
                <p className="text-sm text-green-700">
                  All optimization targets achieved. Platform ready for full commercial launch and market leadership positioning.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}