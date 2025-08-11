import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Phone, Clock, User, Bot, PhoneOff } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { PageSkeleton } from '@/components/PageSkeleton';

const CallDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: call, isLoading, error } = useQuery({
    queryKey: ['call-details', id],
    queryFn: async () => {
      if (!id) throw new Error('Call ID is required');
      
      const { data, error } = await supabase.functions.invoke('ai-call-handler', {
        body: {
          type: 'get_call_details',
          callId: id
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data.call;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error || !call) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Call Not Found</h1>
          <p className="text-muted-foreground mb-4">
            {error?.message || 'The requested call could not be found.'}
          </p>
          <Button onClick={() => navigate('/calls')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Calls
          </Button>
        </div>
      </div>
    );
  }

  const getCallDuration = () => {
    const start = new Date(call.started_at);
    const end = call.ended_at ? new Date(call.ended_at) : new Date();
    return Math.round((end.getTime() - start.getTime()) / 60000);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'appointment_booked':
        return 'default';
      case 'transferred':
        return 'outline';
      case 'voicemail':
        return 'outline';
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => navigate('/calls')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Calls
        </Button>
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Phone className="h-6 w-6" />
            Call #{call.id.slice(-8)}
          </h1>
          <p className="text-muted-foreground">
            Detailed call transcript and information
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Call Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="mt-1">
                <Badge variant={getStatusVariant(call.outcome || 'unknown')}>
                  {call.outcome || 'Unknown'}
                </Badge>
              </div>
            </div>
            
            <div>
              <span className="text-sm text-muted-foreground">Started</span>
              <p className="font-medium">
                {format(new Date(call.started_at), 'PPp')}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(call.started_at), { addSuffix: true })}
              </p>
            </div>

            {call.ended_at && (
              <div>
                <span className="text-sm text-muted-foreground">Ended</span>
                <p className="font-medium">
                  {format(new Date(call.ended_at), 'PPp')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(call.ended_at), { addSuffix: true })}
                </p>
              </div>
            )}

            <div>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Duration
              </span>
              <p className="font-medium">{getCallDuration()} minutes</p>
            </div>

            {call.twilio_call_sid && (
              <div>
                <span className="text-sm text-muted-foreground">Twilio Call SID</span>
                <p className="font-mono text-xs">{call.twilio_call_sid}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Call Transcript */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Conversation Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {call.turns?.length > 0 ? (
                  call.turns.map((turn: any, index: number) => (
                    <div 
                      key={turn.id || index}
                      className={`flex gap-3 ${
                        turn.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div className={`flex gap-2 max-w-[85%] ${
                        turn.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                      }`}>
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          turn.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {turn.role === 'user' ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Bot className="h-4 w-4" />
                          )}
                        </div>
                        <div className={`rounded-lg p-3 ${
                          turn.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}>
                          <p className="text-sm">{turn.text}</p>
                          {turn.meta?.intent && (
                            <div className="mt-2 flex gap-1 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                Intent: {turn.meta.intent}
                              </Badge>
                              {turn.meta.actions?.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  Actions: {turn.meta.actions.join(', ')}
                                </Badge>
                              )}
                            </div>
                          )}
                          <p className="text-xs opacity-70 mt-1">
                            {format(new Date(turn.at), 'HH:mm:ss')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <PhoneOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No conversation turns recorded for this call.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CallDetailsPage;