import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Bug, Eye, EyeOff } from 'lucide-react';

interface DebugPanelProps {
  mode: 'mock' | 'sandbox' | 'live';
  baseUrl: string;
  credentialsPresent: {
    vendorKey: boolean;
    accountKey: boolean;
    accountId: boolean;
  };
  recentRequests: Array<{
    method: string;
    path: string;
    status: number;
    timestamp: string;
    duration?: number;
  }>;
  circuitBreakers?: Record<string, any>;
}

export function CareStackDebugPanel({
  mode,
  baseUrl,
  credentialsPresent,
  recentRequests,
  circuitBreakers = {}
}: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const getModeVariant = (mode: string) => {
    switch (mode) {
      case 'mock':
        return 'secondary';
      case 'sandbox':
        return 'default';
      case 'live':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const maskValue = (value: boolean, placeholder: string) => {
    return showDetails ? (value ? '✓ Present' : '✗ Missing') : (value ? placeholder : '✗ Missing');
  };

  return (
    <Card className="mt-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Debug Information
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getModeVariant(mode)} className="text-xs">
                  {mode.toUpperCase()}
                </Badge>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {/* Configuration Overview */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Configuration</h4>
                  <div className="space-y-1 text-xs">
                    <div>Mode: <Badge variant={getModeVariant(mode)} className="text-xs">{mode}</Badge></div>
                    <div>Base URL: <code className="text-xs bg-muted px-1 rounded">{baseUrl}</code></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">Credentials</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDetails(!showDetails)}
                      className="h-6 w-6 p-0"
                    >
                      {showDetails ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div>Vendor Key: {maskValue(credentialsPresent.vendorKey, '••••••••')}</div>
                    <div>Account Key: {maskValue(credentialsPresent.accountKey, '••••••••')}</div>
                    <div>Account ID: {maskValue(credentialsPresent.accountId, '••••••••')}</div>
                  </div>
                </div>
              </div>

              {/* Recent Requests */}
              {recentRequests.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Recent Requests</h4>
                  <div className="space-y-1">
                    {recentRequests.slice(-3).map((request, index) => (
                      <div key={index} className="flex justify-between items-center text-xs bg-muted/50 p-2 rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {request.method}
                          </Badge>
                          <code className="text-xs">{request.path}</code>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={request.status < 300 ? 'default' : request.status < 500 ? 'secondary' : 'destructive'}
                            className="text-xs"
                          >
                            {request.status}
                          </Badge>
                          {request.duration && (
                            <span className="text-muted-foreground">{request.duration}ms</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Circuit Breakers */}
              {Object.keys(circuitBreakers).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Circuit Breakers</h4>
                  <div className="space-y-1">
                    {Object.entries(circuitBreakers).map(([endpoint, state]) => (
                      <div key={endpoint} className="flex justify-between items-center text-xs bg-muted/50 p-2 rounded">
                        <code className="text-xs">{endpoint.replace(/^https?:\/\/[^\/]+/, '')}</code>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={state.state === 'closed' ? 'default' : state.state === 'half-open' ? 'secondary' : 'destructive'}
                            className="text-xs"
                          >
                            {state.state}
                          </Badge>
                          {state.failures > 0 && (
                            <span className="text-muted-foreground">{state.failures} failures</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mock Mode Banner */}
              {mode === 'mock' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-amber-800">
                    <Bug className="h-4 w-4" />
                    <span className="text-sm font-medium">Mock Mode Active</span>
                  </div>
                  <p className="text-xs text-amber-700 mt-1">
                    All requests are using simulated data. Switch to Sandbox when your API keys arrive.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}