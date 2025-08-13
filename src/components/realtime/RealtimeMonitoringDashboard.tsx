import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useRealtimeWithResilience } from '@/hooks/useRealtimeWithResilience';
import { useAuth } from '@/hooks/useAuth';
import { 
  Wifi, 
  WifiOff, 
  RotateCcw, 
  Activity, 
  Timer, 
  Zap,
  TrendingUp,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function RealtimeMonitoringDashboard() {
  const { profile } = useAuth();
  
  // Monitor multiple real-time connections
  const callsConnection = useRealtimeWithResilience({
    table: 'calls',
    filter: `clinic_id:eq:${profile?.clinic_id}`,
    enableMetrics: true,
    enableOptimisticUpdates: true
  });

  const turnsConnection = useRealtimeWithResilience({
    table: 'turns',
    enableMetrics: true
  });

  const appointmentsConnection = useRealtimeWithResilience({
    table: 'appointments',
    filter: `clinic_id:eq:${profile?.clinic_id}`,
    enableMetrics: true
  });

  const connections = [
    { name: 'Calls', ...callsConnection },
    { name: 'Turns', ...turnsConnection },
    { name: 'Appointments', ...appointmentsConnection }
  ];

  const getConnectionIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-600" />;
      case 'reconnecting':
        return <RotateCcw className="h-4 w-4 text-yellow-600 animate-spin" />;
      default:
        return <WifiOff className="h-4 w-4 text-red-600" />;
    }
  };

  const getConnectionBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Connected
          </Badge>
        );
      case 'reconnecting':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <RotateCcw className="h-3 w-3 animate-spin" />
            Reconnecting
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Disconnected
          </Badge>
        );
    }
  };

  const totalConnections = connections.length;
  const connectedCount = connections.filter(c => c.connectionStatus === 'connected').length;
  const reconnectingCount = connections.filter(c => c.connectionStatus === 'reconnecting').length;
  const disconnectedCount = connections.filter(c => c.connectionStatus === 'disconnected').length;

  const overallHealth = (connectedCount / totalConnections) * 100;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const totalMessages = connections.reduce((sum, c) => sum + c.metrics.messagesReceived, 0);
  const totalBandwidth = connections.reduce((sum, c) => sum + c.metrics.bandwidth, 0);
  const avgLatency = connections.reduce((sum, c) => sum + c.metrics.latency, 0) / connections.length;

  return (
    <div className="space-y-6">
      {/* Overall Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {overallHealth.toFixed(0)}%
                </p>
                <p className="text-sm text-muted-foreground">System Health</p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
            <Progress value={overallHealth} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {avgLatency.toFixed(0)}ms
                </p>
                <p className="text-sm text-muted-foreground">Avg Latency</p>
              </div>
              <Timer className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {totalMessages}
                </p>
                <p className="text-sm text-muted-foreground">Messages</p>
              </div>
              <Zap className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {formatBytes(totalBandwidth)}
                </p>
                <p className="text-sm text-muted-foreground">Bandwidth</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connection Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center mb-2">
              <Wifi className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">{connectedCount}</p>
            <p className="text-sm text-muted-foreground">Connected</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center mb-2">
              <RotateCcw className="h-8 w-8 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-yellow-600">{reconnectingCount}</p>
            <p className="text-sm text-muted-foreground">Reconnecting</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center mb-2">
              <WifiOff className="h-8 w-8 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-600">{disconnectedCount}</p>
            <p className="text-sm text-muted-foreground">Disconnected</p>
          </CardContent>
        </Card>
      </div>

      {/* Individual Connection Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Connection Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {connections.map((connection, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getConnectionIcon(connection.connectionStatus)}
                  <div>
                    <p className="font-medium">{connection.name} Table</p>
                    <p className="text-sm text-muted-foreground">
                      {connection.data.length} records
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {connection.metrics.latency}ms
                    </p>
                    <p className="text-xs text-muted-foreground">latency</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {connection.metrics.messagesReceived}
                    </p>
                    <p className="text-xs text-muted-foreground">messages</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {connection.metrics.reconnectionCount}
                    </p>
                    <p className="text-xs text-muted-foreground">reconnects</p>
                  </div>

                  {getConnectionBadge(connection.connectionStatus)}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={connection.actions.reconnect}
                    disabled={connection.connectionStatus === 'connected'}
                  >
                    Reconnect
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {connections.some(c => c.error) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Connection Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {connections
                .filter(c => c.error)
                .map((connection, index) => (
                  <div key={index} className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="font-medium">{connection.name}</p>
                    <p className="text-sm text-destructive">{connection.error}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}