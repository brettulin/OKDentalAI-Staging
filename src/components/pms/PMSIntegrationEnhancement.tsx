import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings, 
  Shield, 
  Zap, 
  Clock, 
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PMSConfig {
  adapter: string;
  circuitBreakerEnabled: boolean;
  circuitBreakerThreshold: number;
  retryAttempts: number;
  timeoutSeconds: number;
  cachingEnabled: boolean;
  cacheTTL: number;
  rateLimitEnabled: boolean;
  rateLimitPerMinute: number;
  connectionPoolSize: number;
}

export const PMSIntegrationEnhancement = () => {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<Record<string, PMSConfig>>({
    dentrix: {
      adapter: 'Dentrix',
      circuitBreakerEnabled: true,
      circuitBreakerThreshold: 5,
      retryAttempts: 3,
      timeoutSeconds: 30,
      cachingEnabled: true,
      cacheTTL: 300,
      rateLimitEnabled: true,
      rateLimitPerMinute: 60,
      connectionPoolSize: 5
    },
    eaglesoft: {
      adapter: 'Eaglesoft',
      circuitBreakerEnabled: true,
      circuitBreakerThreshold: 5,
      retryAttempts: 3,
      timeoutSeconds: 30,
      cachingEnabled: true,
      cacheTTL: 300,
      rateLimitEnabled: true,
      rateLimitPerMinute: 60,
      connectionPoolSize: 5
    }
  });

  const [testResults, setTestResults] = useState<Record<string, {
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
    latency?: number;
  }>>({});

  const updateConfig = (adapter: string, key: keyof PMSConfig, value: any) => {
    setConfigs(prev => ({
      ...prev,
      [adapter]: {
        ...prev[adapter],
        [key]: value
      }
    }));
  };

  const saveConfiguration = async (adapter: string) => {
    try {
      // In a real implementation, this would save to the backend
      toast({
        title: "Configuration Saved",
        description: `${configs[adapter].adapter} settings have been updated.`,
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save configuration. Please try again.",
        variant: "destructive",
      });
    }
  };

  const testIntegration = async (adapter: string) => {
    setTestResults(prev => ({
      ...prev,
      [adapter]: { status: 'testing', message: 'Testing connection...' }
    }));

    try {
      const startTime = Date.now();
      
      // Simulate API test
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      const latency = Date.now() - startTime;
      const success = Math.random() > 0.2; // 80% success rate for demo
      
      if (success) {
        setTestResults(prev => ({
          ...prev,
          [adapter]: {
            status: 'success',
            message: 'Connection successful',
            latency
          }
        }));
        
        toast({
          title: "Test Successful",
          description: `${configs[adapter].adapter} connection test passed (${latency}ms)`,
        });
      } else {
        throw new Error('Connection failed');
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [adapter]: {
          status: 'error',
          message: 'Connection failed: ' + (error as Error).message
        }
      }));
      
      toast({
        title: "Test Failed",
        description: `${configs[adapter].adapter} connection test failed`,
        variant: "destructive",
      });
    }
  };

  const getTestStatusIcon = (status: string) => {
    switch (status) {
      case 'testing':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">PMS Integration Enhancement</h2>
          <p className="text-muted-foreground">
            Configure advanced settings for Dentrix and Eaglesoft integrations
          </p>
        </div>
      </div>

      {Object.entries(configs).map(([adapterKey, config]) => (
        <Card key={adapterKey}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  {config.adapter} Configuration
                </CardTitle>
                <CardDescription>
                  Advanced integration settings for {config.adapter} PMS
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {testResults[adapterKey] && (
                  <Badge variant={testResults[adapterKey].status === 'success' ? 'default' : 
                                 testResults[adapterKey].status === 'error' ? 'destructive' : 'secondary'}>
                    {getTestStatusIcon(testResults[adapterKey].status)}
                    <span className="ml-1">{testResults[adapterKey].message}</span>
                    {testResults[adapterKey].latency && (
                      <span className="ml-1">({testResults[adapterKey].latency}ms)</span>
                    )}
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testIntegration(adapterKey)}
                  disabled={testResults[adapterKey]?.status === 'testing'}
                >
                  Test Connection
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="reliability" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="reliability">
                  <Shield className="h-4 w-4 mr-1" />
                  Reliability
                </TabsTrigger>
                <TabsTrigger value="performance">
                  <Zap className="h-4 w-4 mr-1" />
                  Performance
                </TabsTrigger>
                <TabsTrigger value="caching">
                  <Database className="h-4 w-4 mr-1" />
                  Caching
                </TabsTrigger>
                <TabsTrigger value="monitoring">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Monitoring
                </TabsTrigger>
              </TabsList>

              <TabsContent value="reliability" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`circuit-breaker-${adapterKey}`}>Circuit Breaker</Label>
                      <Switch
                        id={`circuit-breaker-${adapterKey}`}
                        checked={config.circuitBreakerEnabled}
                        onCheckedChange={(checked) => updateConfig(adapterKey, 'circuitBreakerEnabled', checked)}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Automatically stop requests when failures exceed threshold
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Failure Threshold: {config.circuitBreakerThreshold}</Label>
                    <Slider
                      value={[config.circuitBreakerThreshold]}
                      onValueChange={([value]) => updateConfig(adapterKey, 'circuitBreakerThreshold', value)}
                      min={1}
                      max={10}
                      step={1}
                      disabled={!config.circuitBreakerEnabled}
                    />
                    <p className="text-sm text-muted-foreground">
                      Number of failures before circuit opens
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Retry Attempts: {config.retryAttempts}</Label>
                    <Slider
                      value={[config.retryAttempts]}
                      onValueChange={([value]) => updateConfig(adapterKey, 'retryAttempts', value)}
                      min={0}
                      max={5}
                      step={1}
                    />
                    <p className="text-sm text-muted-foreground">
                      Number of retry attempts for failed requests
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Timeout (seconds): {config.timeoutSeconds}</Label>
                    <Slider
                      value={[config.timeoutSeconds]}
                      onValueChange={([value]) => updateConfig(adapterKey, 'timeoutSeconds', value)}
                      min={5}
                      max={120}
                      step={5}
                    />
                    <p className="text-sm text-muted-foreground">
                      Request timeout duration
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="performance" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`rate-limit-${adapterKey}`}>Rate Limiting</Label>
                      <Switch
                        id={`rate-limit-${adapterKey}`}
                        checked={config.rateLimitEnabled}
                        onCheckedChange={(checked) => updateConfig(adapterKey, 'rateLimitEnabled', checked)}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Limit requests per minute to prevent overwhelming PMS
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Requests per minute: {config.rateLimitPerMinute}</Label>
                    <Slider
                      value={[config.rateLimitPerMinute]}
                      onValueChange={([value]) => updateConfig(adapterKey, 'rateLimitPerMinute', value)}
                      min={10}
                      max={200}
                      step={10}
                      disabled={!config.rateLimitEnabled}
                    />
                    <p className="text-sm text-muted-foreground">
                      Maximum requests allowed per minute
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Connection Pool Size: {config.connectionPoolSize}</Label>
                    <Slider
                      value={[config.connectionPoolSize]}
                      onValueChange={([value]) => updateConfig(adapterKey, 'connectionPoolSize', value)}
                      min={1}
                      max={20}
                      step={1}
                    />
                    <p className="text-sm text-muted-foreground">
                      Number of persistent connections to maintain
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="caching" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`caching-${adapterKey}`}>Response Caching</Label>
                      <Switch
                        id={`caching-${adapterKey}`}
                        checked={config.cachingEnabled}
                        onCheckedChange={(checked) => updateConfig(adapterKey, 'cachingEnabled', checked)}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Cache static data to reduce API calls
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Cache TTL (seconds): {config.cacheTTL}</Label>
                    <Slider
                      value={[config.cacheTTL]}
                      onValueChange={([value]) => updateConfig(adapterKey, 'cacheTTL', value)}
                      min={60}
                      max={3600}
                      step={60}
                      disabled={!config.cachingEnabled}
                    />
                    <p className="text-sm text-muted-foreground">
                      How long to keep cached responses
                    </p>
                  </div>
                </div>

                <Alert>
                  <Database className="h-4 w-4" />
                  <AlertDescription>
                    Caching improves performance by storing frequently accessed data like locations, 
                    providers, and services. Patient data is never cached for privacy.
                  </AlertDescription>
                </Alert>
              </TabsContent>

              <TabsContent value="monitoring" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Health Monitoring</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Health Check Interval:</span>
                          <Badge variant="outline">30 seconds</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Metric Collection:</span>
                          <Badge variant="outline">Real-time</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Alert Thresholds:</span>
                          <Badge variant="outline">Configurable</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Performance Tracking</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Response Time:</span>
                          <Badge variant="outline">Tracked</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Success Rate:</span>
                          <Badge variant="outline">Monitored</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Error Reporting:</span>
                          <Badge variant="outline">Automated</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end pt-4">
              <Button onClick={() => saveConfiguration(adapterKey)}>
                <Settings className="h-4 w-4 mr-2" />
                Save Configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};