import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Server, 
  TrendingUp,
  RefreshCw,
  Shield
} from 'lucide-react'
import { usePMSHealthMonitoring } from '@/hooks/usePMSHealthMonitoring'

export function PMSHealthDashboard() {
  const {
    healthStatuses,
    performanceMetrics,
    isLoading,
    checkPMSHealth,
    testConnection,
    getOverallHealthScore
  } = usePMSHealthMonitoring()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'degraded': return 'text-yellow-600'
      case 'unhealthy': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'healthy': return 'default'
      case 'degraded': return 'secondary'
      case 'unhealthy': return 'destructive'
      default: return 'outline'
    }
  }

  const overallScore = getOverallHealthScore()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall Health Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallScore}%</div>
            <Progress value={overallScore} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {healthStatuses.filter(s => s.status === 'healthy').length} of {healthStatuses.length} systems healthy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceMetrics?.avgResponseTime || 0}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Last hour average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceMetrics?.successRate || 0}%
            </div>
            <Progress value={performanceMetrics?.successRate || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceMetrics?.totalRequests || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {performanceMetrics?.failedRequests || 0} failed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Health Check Button */}
      <div className="flex items-center gap-4">
        <Button onClick={checkPMSHealth} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Check All Systems
        </Button>
      </div>

      {/* Individual System Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {healthStatuses.map((system) => (
          <Card key={system.officeId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{system.adapter}</CardTitle>
                <Badge variant={getStatusVariant(system.status)}>
                  {system.status}
                </Badge>
              </div>
              <CardDescription>Office: {system.officeId}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Last Check:</span>
                  <span>{system.lastCheck.toLocaleTimeString()}</span>
                </div>
                {system.responseTime && (
                  <div className="flex justify-between text-sm">
                    <span>Response Time:</span>
                    <span>{system.responseTime}ms</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>Uptime:</span>
                  <span>{system.uptime}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Errors:</span>
                  <span>{system.errorCount}</span>
                </div>
                {system.details && (
                  <div className="text-sm text-muted-foreground">
                    {system.details}
                  </div>
                )}
                
                <Button
                  onClick={() => testConnection(system.officeId)}
                  size="sm"
                  variant="outline"
                  className="w-full mt-2"
                >
                  <Server className="mr-2 h-4 w-4" />
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Details */}
      {performanceMetrics && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>System performance over the last hour</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Success Rate:</span>
                  <span>{performanceMetrics.lastHourMetrics.successRate}%</span>
                </div>
                <Progress value={performanceMetrics.lastHourMetrics.successRate} />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Avg Response:</span>
                  <span>{performanceMetrics.lastHourMetrics.avgResponseTime}ms</span>
                </div>
                <Progress value={Math.min(performanceMetrics.lastHourMetrics.avgResponseTime / 10, 100)} />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Requests:</span>
                  <span>{performanceMetrics.lastHourMetrics.totalRequests}</span>
                </div>
                <Progress value={Math.min(performanceMetrics.lastHourMetrics.totalRequests / 10, 100)} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Health Status Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Status Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Healthy</span>
            </div>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm">Degraded</span>
            </div>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm">Unhealthy</span>
            </div>
            <div className="flex items-center space-x-2">
              <Server className="h-4 w-4 text-gray-600" />
              <span className="text-sm">Unknown</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}