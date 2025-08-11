import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CallSimulator } from '@/components/ai/CallSimulator';
import { usePMSIntegration } from '@/hooks/usePMSIntegration';
import { useAICallHandler } from '@/hooks/useAICallHandler';
import { Phone, Settings, TestTube, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function AIReceptionistDashboard() {
  const { offices, officesLoading, testPMS, isTestingPMS } = usePMSIntegration();
  const { useCallsList } = useAICallHandler();
  const { data: calls, isLoading: callsLoading } = useCallsList();
  const navigate = useNavigate();

  const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');

  // Select first office by default
  React.useEffect(() => {
    if (offices?.length > 0 && !selectedOfficeId) {
      setSelectedOfficeId(offices[0].id);
    }
  }, [offices, selectedOfficeId]);

  const handleTestPMS = async () => {
    if (!selectedOfficeId) return;
    
    try {
      const result = await testPMS(selectedOfficeId);
      console.log('PMS Test Result:', result);
    } catch (error) {
      console.error('PMS Test Error:', error);
    }
  };

  if (officesLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!offices?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            AI Receptionist Setup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            No PMS integrations found. Please set up a PMS integration first to use the AI receptionist.
          </p>
          <Button>Set Up PMS Integration</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Receptionist</h1>
          <p className="text-muted-foreground">
            Intelligent call handling with PMS integration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={selectedOfficeId}
            onChange={(e) => setSelectedOfficeId(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            {offices.map((office) => (
              <option key={office.id} value={office.id}>
                {office.name} ({office.pms_type})
              </option>
            ))}
          </select>
          <Button 
            onClick={handleTestPMS}
            disabled={isTestingPMS || !selectedOfficeId}
            variant="outline"
            className="gap-2"
          >
            <TestTube className="h-4 w-4" />
            Test PMS
          </Button>
        </div>
      </div>

      <Tabs defaultValue="simulator" className="space-y-6">
        <TabsList>
          <TabsTrigger value="simulator" className="gap-2">
            <Phone className="h-4 w-4" />
            Call Simulator
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <Activity className="h-4 w-4" />
            Call Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simulator">
          {selectedOfficeId ? (
            <CallSimulator officeId={selectedOfficeId} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  Please select an office to start the call simulator.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-6">
            {/* Call Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold">{calls?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold">
                    {calls?.filter(c => c.outcome === 'appointment_booked').length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Appointments Booked</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold">
                    {calls?.filter(c => c.ended_at).length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Completed Calls</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold">
                    {calls?.filter(c => !c.ended_at).length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Active Calls</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Calls */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {calls?.map((call) => (
                      <div key={call.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={call.ended_at ? 'secondary' : 'default'}>
                              {call.ended_at ? 'Completed' : 'Active'}
                            </Badge>
                            {call.outcome && (
                              <Badge variant="outline">{call.outcome}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Started: {new Date(call.started_at).toLocaleString()}
                          </p>
                          {call.ended_at && (
                            <p className="text-sm text-muted-foreground">
                              Ended: {new Date(call.ended_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/calls/${call.id}`)}
                        >
                          View Details
                        </Button>
                      </div>
                    ))}
                    {!calls?.length && (
                      <p className="text-center text-muted-foreground py-8">
                        No calls found. Start a simulation to see call data.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>AI Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">PMS Integration Status</h3>
                  <div className="space-y-2">
                    {offices.map((office) => (
                      <div key={office.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{office.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {office.pms_type.toUpperCase()} Integration
                          </p>
                        </div>
                        <Badge variant="secondary">Connected</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">AI Behavior Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure how the AI receptionist handles different types of calls and requests.
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-2"
                    onClick={() => navigate('/settings/ai')}
                  >
                    Configure AI Settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}