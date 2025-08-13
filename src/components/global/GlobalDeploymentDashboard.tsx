import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Globe, 
  MapPin, 
  Users, 
  Zap, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Wifi,
  Database,
  Shield
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface RegionMetrics {
  region: string
  country: string
  status: 'active' | 'deploying' | 'planned'
  users: number
  latency: number
  uptime: number
  revenue: number
  compliance: string[]
}

interface GlobalMetrics {
  totalRegions: number
  activeUsers: number
  totalRevenue: number
  averageLatency: number
  globalUptime: number
}

export function GlobalDeploymentDashboard() {
  const { profile } = useAuth()
  const [selectedRegion, setSelectedRegion] = useState('all')
  const [deploymentView, setDeploymentView] = useState('overview')

  const globalMetrics: GlobalMetrics = {
    totalRegions: 12,
    activeUsers: 127500,
    totalRevenue: 8750000,
    averageLatency: 47,
    globalUptime: 99.97
  }

  const regionData: RegionMetrics[] = [
    {
      region: 'North America',
      country: 'United States',
      status: 'active',
      users: 45200,
      latency: 35,
      uptime: 99.98,
      revenue: 3250000,
      compliance: ['HIPAA', 'SOC2']
    },
    {
      region: 'North America',
      country: 'Canada',
      status: 'active',
      users: 8900,
      latency: 42,
      uptime: 99.95,
      revenue: 675000,
      compliance: ['PIPEDA', 'SOC2']
    },
    {
      region: 'Europe',
      country: 'United Kingdom',
      status: 'active',
      users: 12400,
      latency: 38,
      uptime: 99.96,
      revenue: 950000,
      compliance: ['GDPR', 'ISO27001']
    },
    {
      region: 'Europe',
      country: 'Germany',
      status: 'active',
      users: 15600,
      latency: 41,
      uptime: 99.94,
      revenue: 1180000,
      compliance: ['GDPR', 'ISO27001']
    },
    {
      region: 'Asia Pacific',
      country: 'Australia',
      status: 'active',
      users: 9800,
      latency: 52,
      uptime: 99.92,
      revenue: 720000,
      compliance: ['Privacy Act', 'ISO27001']
    },
    {
      region: 'Asia Pacific',
      country: 'Japan',
      status: 'deploying',
      users: 0,
      latency: 0,
      uptime: 0,
      revenue: 0,
      compliance: ['APPI', 'ISO27001']
    },
    {
      region: 'Latin America',
      country: 'Brazil',
      status: 'planned',
      users: 0,
      latency: 0,
      uptime: 0,
      revenue: 0,
      compliance: ['LGPD']
    },
    {
      region: 'Middle East',
      country: 'UAE',
      status: 'planned',
      users: 0,
      latency: 0,
      uptime: 0,
      revenue: 0,
      compliance: ['UAE DPL']
    }
  ]

  const complianceFrameworks = [
    { code: 'GDPR', name: 'General Data Protection Regulation', regions: ['EU'] },
    { code: 'HIPAA', name: 'Health Insurance Portability Act', regions: ['US'] },
    { code: 'PIPEDA', name: 'Personal Information Protection Act', regions: ['CA'] },
    { code: 'LGPD', name: 'Lei Geral de Proteção de Dados', regions: ['BR'] },
    { code: 'PDPA', name: 'Personal Data Protection Act', regions: ['SG', 'TH'] },
    { code: 'APPI', name: 'Act on Protection of Personal Information', regions: ['JP'] }
  ]

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600'
      case 'deploying': return 'text-yellow-600'
      case 'planned': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'deploying': return 'secondary'
      case 'planned': return 'outline'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Global Deployment Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor worldwide infrastructure and regional performance
          </p>
        </div>
        <div className="flex space-x-2">
          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              <SelectItem value="na">North America</SelectItem>
              <SelectItem value="eu">Europe</SelectItem>
              <SelectItem value="apac">Asia Pacific</SelectItem>
              <SelectItem value="latam">Latin America</SelectItem>
              <SelectItem value="mea">Middle East & Africa</SelectItem>
            </SelectContent>
          </Select>
          <Button>
            <Globe className="mr-2 h-4 w-4" />
            Deploy New Region
          </Button>
        </div>
      </div>

      {/* Global Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Regions</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalMetrics.totalRegions}</div>
            <p className="text-xs text-muted-foreground">
              5 active, 2 deploying, 5 planned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Global Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalMetrics.activeUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Global Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(globalMetrics.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Annual recurring revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalMetrics.averageLatency}ms</div>
            <Progress value={100 - (globalMetrics.averageLatency / 100 * 100)} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Global Uptime</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalMetrics.globalUptime}%</div>
            <p className="text-xs text-muted-foreground">
              99.95% target
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="regions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="regions">Regions</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="deployment">Deployment</TabsTrigger>
        </TabsList>

        <TabsContent value="regions">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regionData.map((region, index) => (
              <Card key={index} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{region.country}</CardTitle>
                    <Badge variant={getStatusVariant(region.status)}>
                      {region.status}
                    </Badge>
                  </div>
                  <CardDescription>{region.region}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Users:</span>
                      <span className="font-medium">
                        {region.users > 0 ? region.users.toLocaleString() : 'N/A'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span>Latency:</span>
                      <span className="font-medium">
                        {region.latency > 0 ? `${region.latency}ms` : 'N/A'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span>Uptime:</span>
                      <span className="font-medium">
                        {region.uptime > 0 ? `${region.uptime}%` : 'N/A'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span>Revenue:</span>
                      <span className="font-medium">
                        {region.revenue > 0 ? formatCurrency(region.revenue) : 'N/A'}
                      </span>
                    </div>

                    <div className="pt-2 border-t">
                      <div className="text-sm text-muted-foreground mb-1">Compliance:</div>
                      <div className="flex flex-wrap gap-1">
                        {region.compliance.map((compliance, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {compliance}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {region.status === 'active' && (
                      <Button size="sm" variant="outline" className="w-full">
                        <BarChart3 className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                    )}
                    
                    {region.status === 'deploying' && (
                      <Button size="sm" variant="outline" className="w-full">
                        <Zap className="mr-2 h-4 w-4" />
                        Monitor Deployment
                      </Button>
                    )}
                    
                    {region.status === 'planned' && (
                      <Button size="sm" className="w-full">
                        <MapPin className="mr-2 h-4 w-4" />
                        Start Deployment
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Frameworks</CardTitle>
              <CardDescription>
                Regional data protection and healthcare compliance status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {complianceFrameworks.map((framework, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Shield className="h-5 w-5 text-green-600" />
                      <div>
                        <h3 className="font-medium">{framework.code}</h3>
                        <p className="text-sm text-muted-foreground">{framework.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-sm text-muted-foreground">
                        Regions: {framework.regions.join(', ')}
                      </div>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Regional Performance</CardTitle>
                <CardDescription>Latency and uptime by region</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {regionData.filter(r => r.status === 'active').map((region, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{region.country}</span>
                        <span className="text-sm text-muted-foreground">{region.latency}ms</span>
                      </div>
                      <Progress value={100 - (region.latency / 100 * 100)} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Distribution</CardTitle>
                <CardDescription>Revenue contribution by region</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {regionData.filter(r => r.revenue > 0).map((region, index) => {
                    const percentage = (region.revenue / globalMetrics.totalRevenue) * 100
                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{region.country}</span>
                          <span className="text-sm text-muted-foreground">
                            {formatCurrency(region.revenue)} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="deployment">
          <Card>
            <CardHeader>
              <CardTitle>Deployment Pipeline</CardTitle>
              <CardDescription>Current and planned deployments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Production Regions</h3>
                      <p className="text-sm text-muted-foreground">5 regions fully operational</p>
                    </div>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Clock className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Deploying: Japan</h3>
                      <p className="text-sm text-muted-foreground">Infrastructure setup in progress</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Progress value={75} className="w-20" />
                    <span className="text-sm text-muted-foreground">75%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Planned: Brazil, UAE, Singapore</h3>
                      <p className="text-sm text-muted-foreground">Q2 2024 deployment targets</p>
                    </div>
                  </div>
                  <Badge variant="outline">Planned</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}