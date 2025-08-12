import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useRealtimeCallMonitoring } from '@/hooks/useRealtimeCallMonitoring';
import { useAuth } from '@/hooks/useAuth';
import { 
  Phone, 
  PhoneCall, 
  Clock, 
  Users, 
  Activity,
  PhoneOff,
  Pause,
  Play,
  UserCheck,
  Signal
} from 'lucide-react';
import { format } from 'date-fns';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'incoming': return 'bg-red-500';
    case 'in_progress': return 'bg-green-500';
    case 'on_hold': return 'bg-yellow-500';
    case 'completed': return 'bg-blue-500';
    case 'failed': return 'bg-gray-500';
    case 'transferred': return 'bg-purple-500';
    default: return 'bg-gray-500';
  }
};

const getPresenceColor = (status: string) => {
  switch (status) {
    case 'online': return 'bg-green-500';
    case 'busy': return 'bg-red-500';
    case 'away': return 'bg-yellow-500';
    case 'offline': return 'bg-gray-500';
    default: return 'bg-gray-500';
  }
};

export function RealtimeCallDashboard() {
  const { profile } = useAuth();
  const { 
    activeCalls, 
    staffPresence, 
    callEvents, 
    isConnected,
    updateStatus,
    assignCall,
    updateCallStatus 
  } = useRealtimeCallMonitoring();
  
  const [userStatus, setUserStatus] = useState<'online' | 'busy' | 'away'>('online');

  const handleStatusChange = async (newStatus: 'online' | 'busy' | 'away') => {
    setUserStatus(newStatus);
    await updateStatus(newStatus);
  };

  const handleAssignCall = async (callId: string) => {
    if (!profile?.user_id) return;
    await assignCall(callId, profile.user_id);
    await updateStatus('busy', callId);
  };

  const handleCallAction = async (callId: string, action: string) => {
    switch (action) {
      case 'hold':
        await updateCallStatus(callId, 'on_hold');
        break;
      case 'resume':
        await updateCallStatus(callId, 'in_progress');
        break;
      case 'complete':
        await updateCallStatus(callId, 'completed', { ended_at: new Date().toISOString() });
        await updateStatus('online');
        break;
      case 'transfer':
        await updateCallStatus(callId, 'transferred');
        await updateStatus('online');
        break;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Connection Status & User Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Real-time Call Monitor
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-muted-foreground">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-2">
                <span className="text-sm">Status:</span>
                <select 
                  value={userStatus} 
                  onChange={(e) => handleStatusChange(e.target.value as any)}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="online">Online</option>
                  <option value="busy">Busy</option>
                  <option value="away">Away</option>
                </select>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Calls */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5" />
              Active Calls ({activeCalls.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {activeCalls.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No active calls</p>
                  </div>
                ) : (
                  activeCalls.map((call) => (
                    <Card key={call.id} className="border-l-4" style={{borderLeftColor: getStatusColor(call.status).replace('bg-', '')}}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span className="font-medium">
                              {call.caller_phone || 'Unknown'}
                            </span>
                            <Badge className={getStatusColor(call.status)}>
                              {call.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(call.started_at), 'HH:mm:ss')}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-sm space-y-1">
                            {call.assigned_to && (
                              <div className="flex items-center gap-2">
                                <UserCheck className="h-3 w-3" />
                                <span>Assigned to staff</span>
                              </div>
                            )}
                            {call.call_duration_seconds && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                <span>{formatDuration(call.call_duration_seconds)}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            {call.status === 'incoming' && (
                              <Button 
                                size="sm" 
                                onClick={() => handleAssignCall(call.id)}
                              >
                                Answer
                              </Button>
                            )}
                            {call.status === 'in_progress' && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleCallAction(call.id, 'hold')}
                                >
                                  <Pause className="h-3 w-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  onClick={() => handleCallAction(call.id, 'complete')}
                                >
                                  <PhoneOff className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            {call.status === 'on_hold' && (
                              <Button 
                                size="sm"
                                onClick={() => handleCallAction(call.id, 'resume')}
                              >
                                <Play className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {call.ai_confidence_score && (
                          <div className="mt-2 pt-2 border-t">
                            <div className="flex items-center gap-2 text-sm">
                              <Signal className="h-3 w-3" />
                              <span>AI Confidence: {(call.ai_confidence_score * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Staff Presence & Recent Events */}
        <div className="space-y-6">
          {/* Staff Presence */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Staff Online ({Object.keys(staffPresence).length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(staffPresence).map(([userId, presence]) => (
                  <div key={userId} className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {presence.display_name?.slice(0, 2).toUpperCase() || 'UN'}
                        </AvatarFallback>
                      </Avatar>
                      <div 
                        className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getPresenceColor(presence.status)}`} 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {presence.display_name || 'Anonymous'}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {presence.status}
                        {presence.current_call_id && ' • On call'}
                      </p>
                    </div>
                  </div>
                ))}
                {Object.keys(staffPresence).length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No staff online
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {callEvents.slice(0, 10).map((event, index) => (
                    <div key={index} className="text-xs p-2 rounded bg-muted">
                      <div className="flex justify-between items-start">
                        <span className="font-medium">{event.event_type}</span>
                        <span className="text-muted-foreground">
                          {format(new Date(event.created_at), 'HH:mm:ss')}
                        </span>
                      </div>
                      {event.event_data && (
                        <div className="mt-1 text-muted-foreground">
                          Status: {event.event_data.old_status} → {event.event_data.new_status}
                        </div>
                      )}
                    </div>
                  ))}
                  {callEvents.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No recent events
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}