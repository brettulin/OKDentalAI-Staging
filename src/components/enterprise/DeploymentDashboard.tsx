import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Server,
  Globe,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Users,
  Database,
  Cloud,
  Monitor,
  Zap,
  Settings,
  BarChart3
} from 'lucide-react';

interface DeploymentMetrics {
  uptime: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  activeUsers: number;
  regionStatus: Record<string, 'healthy' | 'degraded' | 'down'>;
}

export function DeploymentDashboard() {
  const { profile } = useAuth();
  const [selectedRegion, setSelectedRegion] = useState('global');

  // Fetch deployment metrics
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['deployment-metrics', profile?.clinic_id],
    queryFn: async () => {
      // Mock data - in production, this would come from monitoring systems
      const mockMetrics: DeploymentMetrics = {
        uptime: 99.97,
        responseTime: 145,
        errorRate: 0.03,
        throughput: 1247,
        activeUsers: 342,
        regionStatus: {
          'us-east': 'healthy',
          'us-west': 'healthy',
          'eu-west': 'healthy',
          'ap-southeast': 'degraded',
          'global': 'healthy'
        }
      };
      return mockMetrics;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!profile?.clinic_id,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'degraded': return <Badge className="bg-yellow-100 text-yellow-800">Degraded</Badge>;
      case 'down': return <Badge className="bg-red-100 text-red-800">Down</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading deployment metrics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Cloud className="h-8 w-8" />
            Deployment Dashboard
          </h1>
          <p className="text-muted-foreground">
            Real-time monitoring and deployment status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">Live Monitoring</span>
          </div>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">System Uptime</p>
                <p className="text-3xl font-bold">{metrics?.uptime}%</p>
                <div className="mt-2">
                  <Progress value={metrics?.uptime} className="h-2" />
                </div>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Response Time</p>
                <p className="text-3xl font-bold">{metrics?.responseTime}ms</p>
                <p className="text-sm text-muted-foreground mt-1">Avg last 24h</p>
              </div>
              <Zap className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                <p className="text-3xl font-bold">{metrics?.activeUsers}</p>
                <p className="text-sm text-green-600 mt-1">+12% from yesterday</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Requests/min</p>
                <p className="text-3xl font-bold">{metrics?.throughput}</p>
                <p className="text-sm text-muted-foreground mt-1">Current load</p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="infrastructure" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
          <TabsTrigger value="regions">Global Status</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="infrastructure" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Service Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Service Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">API Gateway</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Operational</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Database</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Operational</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">AI Services</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Operational</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium">Voice Processing</span>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800">Degraded</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Real-time Engine</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Operational</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resource Utilization */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Resource Utilization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">CPU Usage</span>
                      <span className="text-sm text-muted-foreground">34%</span>
                    </div>
                    <Progress value={34} className="h-2" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Memory Usage</span>
                      <span className="text-sm text-muted-foreground">67%</span>
                    </div>
                    <Progress value={67} className="h-2" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Storage Usage</span>
                      <span className="text-sm text-muted-foreground">23%</span>
                    </div>
                    <Progress value={23} className="h-2" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Network I/O</span>
                      <span className="text-sm text-muted-foreground">45%</span>
                    </div>
                    <Progress value={45} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Deployments */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Deployments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">v2.4.1 - Security Updates</p>
                      <p className="text-sm text-muted-foreground">Deployed 2 hours ago</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Success</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">v2.4.0 - Analytics Enhancement</p>
                      <p className="text-sm text-muted-foreground">Deployed 1 day ago</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Success</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">v2.3.9 - Performance Improvements</p>
                      <p className="text-sm text-muted-foreground">Deployed 3 days ago</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Success</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Global Deployment Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(metrics?.regionStatus || {}).map(([region, status]) => (
                  <div key={region} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium capitalize">
                        {region.replace('-', ' ').replace('_', ' ')}
                      </h4>
                      {getStatusBadge(status)}
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Latency:</span>
                        <span>23ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Load:</span>
                        <span>Low</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Uptime:</span>
                        <span>99.9%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">SSL Certificates</span>
                    <Badge className="bg-green-100 text-green-800">Valid</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Firewall Status</span>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">DDoS Protection</span>
                    <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Intrusion Detection</span>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Vulnerability Scans</span>
                    <Badge className="bg-blue-100 text-blue-800">Scheduled</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Security Score</span>
                      <span className="text-sm text-muted-foreground">94/100</span>
                    </div>
                    <Progress value={94} className="h-2" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>✓ No critical vulnerabilities detected</p>
                    <p>✓ All security patches applied</p>
                    <p>⚠ 2 low-priority recommendations</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Performance Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Response Time</span>
                    <span className="text-sm text-green-600">↓ 15% this week</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Error Rate</span>
                    <span className="text-sm text-green-600">↓ 23% this week</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Throughput</span>
                    <span className="text-sm text-blue-600">↑ 8% this week</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">User Satisfaction</span>
                    <span className="text-sm text-green-600">↑ 12% this week</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SLA Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Uptime SLA (99.9%)</span>
                      <span className="text-sm text-green-600">✓ Met</span>
                    </div>
                    <Progress value={99.97} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Response Time SLA (&lt;500ms)</span>
                      <span className="text-sm text-green-600">✓ Met</span>
                    </div>
                    <Progress value={85} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Error Rate SLA (&lt;0.1%)</span>
                      <span className="text-sm text-green-600">✓ Met</span>
                    </div>
                    <Progress value={97} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}