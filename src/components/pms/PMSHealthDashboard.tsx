import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Zap,
  TrendingUp,
  RefreshCw,
  X
} from 'lucide-react';
import { usePMSHealthMonitoring } from '@/hooks/usePMSHealthMonitoring';

export const PMSHealthDashboard = () => {
  const {
    healthStatus,
    performanceMetrics,
    isMonitoring,
    alerts,
    checkPMSHealth,
    testConnection,
    clearAlert,
    getOverallHealthScore
  } = usePMSHealthMonitoring();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'unhealthy':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      healthy: 'default',
      unhealthy: 'secondary',
      error: 'destructive',
      unknown: 'outline'
    };
    
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const overallHealthScore = getOverallHealthScore();

  return (
    <div className="space-y-6">
      {/* Overall Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallHealthScore}%</div>
            <Progress value={overallHealthScore} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              PMS adapters operational
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Adapters</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(healthStatus).length}
            </div>
            <p className="text-xs text-muted-foreground">
              {Object.values(healthStatus).filter(h => h.status === 'healthy').length} healthy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(performanceMetrics).length > 0
                ? Math.round(
                    Object.values(performanceMetrics).reduce((sum, metrics) => sum + metrics.avgResponseTime, 0) /
                    Object.values(performanceMetrics).length
                  )
                : 0}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Last hour average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {alerts.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Alerts</CardTitle>
            <CardDescription>
              Critical issues requiring immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert) => (
              <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex justify-between items-center">
                  <span>
                    <strong>{alert.adapter}:</strong> {alert.message}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearAlert(alert.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* PMS Adapter Status */}
      <Card>
        <CardHeader>
          <CardTitle>PMS Adapter Status</CardTitle>
          <CardDescription>
            Real-time health status of all configured PMS adapters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(healthStatus).map((status) => (
              <Card key={status.adapter} className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{status.adapter}</CardTitle>
                    {getStatusIcon(status.status)}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(status.status)}
                    {status.responseTime && (
                      <Badge variant="outline">{status.responseTime}ms</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Last Check: {new Date(status.lastCheck).toLocaleTimeString()}
                  </div>
                  <div className="text-sm">
                    Uptime: {status.uptime} checks
                  </div>
                  <div className="text-sm">
                    Errors: {status.errorCount}
                  </div>
                  
                  {status.details.lastError && (
                    <div className="text-sm text-destructive">
                      Error: {status.details.lastError}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => checkPMSHealth(status.adapter)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Check
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testConnection(status.adapter)}
                    >
                      Test
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      {Object.keys(performanceMetrics).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>
              Detailed performance statistics for each PMS adapter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(performanceMetrics).map((metrics) => (
                <Card key={metrics.adapter}>
                  <CardHeader>
                    <CardTitle className="text-lg">{metrics.adapter}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Success Rate:</span>
                      <span className="font-medium">{metrics.successRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Avg Response:</span>
                      <span className="font-medium">{metrics.avgResponseTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total Requests:</span>
                      <span className="font-medium">{metrics.totalRequests}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Failed Requests:</span>
                      <span className="font-medium text-destructive">{metrics.failedRequests}</span>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <h4 className="text-sm font-medium mb-2">Last Hour</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Requests:</span>
                          <span>{metrics.lastHourMetrics.requests}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Failures:</span>
                          <span>{metrics.lastHourMetrics.failures}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg Latency:</span>
                          <span>{metrics.lastHourMetrics.avgLatency}ms</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monitoring Status */}
      <Card>
        <CardHeader>
          <CardTitle>Monitoring Status</CardTitle>
          <CardDescription>
            Real-time monitoring system status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {isMonitoring ? (
              <>
                <div className="h-2 w-2 bg-success rounded-full animate-pulse" />
                <span className="text-sm text-success">Monitoring Active</span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 bg-muted rounded-full" />
                <span className="text-sm text-muted-foreground">Monitoring Inactive</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};