import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useRealtimeAI } from '@/hooks/useRealtimeAI';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Send, 
  Bot, 
  User, 
  Zap,
  Activity,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function RealtimeAIInterface() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [currentMessage, setCurrentMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  // Fetch AI settings for configuration
  const { data: aiSettings } = useQuery({
    queryKey: ['ai-settings', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return null;
      
      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  // Initialize realtime AI with clinic settings
  const realtimeAI = useRealtimeAI({
    voice: (aiSettings as any)?.voice_id || 'alloy',
    instructions: `You are a professional AI receptionist for a dental clinic.
                   
                   Your role is to:
                   - Help patients schedule appointments
                   - Answer questions about dental services
                   - Provide clinic information (hours, location, policies)
                   - Transfer complex requests to human staff
                   - Handle appointment changes and cancellations
                   
                   Always be warm, professional, and helpful. Ask clarifying questions 
                   when needed and provide clear, accurate information. If you cannot 
                   help with something, offer to transfer to a human team member.
                   
                   Current clinic settings:
                   - Language: ${aiSettings?.language || 'English'}
                   - Transfer number: ${aiSettings?.transfer_number || 'Front desk'}
                   - Voice enabled: ${(aiSettings?.booking_policy as any)?.voice_enabled !== false}`,
    temperature: 0.7,
    enableAudio: (aiSettings?.booking_policy as any)?.voice_enabled !== false,
    enableText: true,
  });

  // Initialize microphone access
  const initializeMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      setAudioStream(stream);
      
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && realtimeAI.isConnected) {
          // Convert blob to ArrayBuffer and send
          event.data.arrayBuffer().then(arrayBuffer => {
            realtimeAI.sendAudioData(arrayBuffer);
          });
        }
      };
      
      setMediaRecorder(recorder);
      
    } catch (error) {
      console.error('Failed to initialize microphone:', error);
      toast({
        title: 'Microphone Error',
        description: 'Could not access microphone. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  // Start/stop recording
  const toggleRecording = () => {
    if (!mediaRecorder) return;
    
    if (isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    } else {
      mediaRecorder.start(100); // Send data every 100ms
      setIsRecording(true);
    }
  };

  // Handle connection
  const handleConnect = async () => {
    await realtimeAI.connect();
    if ((aiSettings?.booking_policy as any)?.voice_enabled !== false) {
      await initializeMicrophone();
    }
    
    toast({
      title: 'AI Connected',
      description: 'Real-time AI assistant is now active.',
    });
  };

  const handleDisconnect = () => {
    realtimeAI.disconnect();
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }
    setMediaRecorder(null);
    setIsRecording(false);
    
    toast({
      title: 'AI Disconnected',
      description: 'Real-time session ended.',
    });
  };

  // Send text message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim() || !realtimeAI.isConnected) return;
    
    realtimeAI.sendTextMessage(currentMessage);
    setCurrentMessage('');
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Connection Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            OpenAI Realtime AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {!realtimeAI.isConnected ? (
              <Button 
                onClick={handleConnect}
                disabled={realtimeAI.isConnecting}
                className="flex items-center gap-2"
              >
                <Phone className="h-4 w-4" />
                {realtimeAI.isConnecting ? 'Connecting...' : 'Start AI Session'}
              </Button>
            ) : (
              <>
                <Button 
                  onClick={handleDisconnect}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <PhoneOff className="h-4 w-4" />
                  End Session
                </Button>
                
                {(aiSettings?.booking_policy as any)?.voice_enabled !== false && (
                  <Button
                    onClick={toggleRecording}
                    variant={isRecording ? "destructive" : "secondary"}
                    disabled={!mediaRecorder}
                    className="flex items-center gap-2"
                  >
                    {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                  </Button>
                )}
              </>
            )}
            
            {/* Status Indicators */}
            <div className="flex items-center gap-2">
              <Badge variant={realtimeAI.isConnected ? "default" : "secondary"}>
                {realtimeAI.isConnected ? "Connected" : "Disconnected"}
              </Badge>
              
              {realtimeAI.isAISpeaking && (
                <Badge variant="outline" className="animate-pulse">
                  <Volume2 className="h-3 w-3 mr-1" />
                  AI Speaking
                </Badge>
              )}
              
              {isRecording && (
                <Badge variant="destructive" className="animate-pulse">
                  <Activity className="h-3 w-3 mr-1" />
                  Recording
                </Badge>
              )}
            </div>
          </div>
          
          {realtimeAI.connectionError && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{realtimeAI.connectionError}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation Display */}
      {realtimeAI.isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Real-time Conversation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96 pr-4">
              <div className="space-y-4">
                {realtimeAI.conversation.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Start a conversation with the AI assistant</p>
                    <p className="text-sm">Type a message or use voice input</p>
                  </div>
                ) : (
                  realtimeAI.conversation.map((item) => (
                    <div
                      key={item.id}
                      className={`flex gap-3 ${
                        item.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`flex items-start gap-2 max-w-[80%] ${
                          item.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        <div className={`p-2 rounded-full ${
                          item.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          {item.role === 'user' ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Bot className="h-4 w-4" />
                          )}
                        </div>
                        
                        <div
                          className={`p-3 rounded-lg ${
                            item.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm">{item.content}</p>
                          <p className={`text-xs mt-1 opacity-70`}>
                            {formatTimestamp(item.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Text Input */}
            <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
              <Input
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={!realtimeAI.isConnected}
                className="flex-1"
              />
              <Button 
                type="submit" 
                disabled={!currentMessage.trim() || !realtimeAI.isConnected}
                size="sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* AI Settings Info */}
      {aiSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Current AI Configuration</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium">Voice:</p>
                <p className="text-muted-foreground">{(aiSettings as any)?.voice_id || 'Default'}</p>
              </div>
              <div>
                <p className="font-medium">Language:</p>
                <p className="text-muted-foreground">{aiSettings?.language || 'English'}</p>
              </div>
              <div>
                <p className="font-medium">Voice Enabled:</p>
                <p className="text-muted-foreground">
                  {(aiSettings?.booking_policy as any)?.voice_enabled !== false ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="font-medium">Transfer Number:</p>
                <p className="text-muted-foreground">{aiSettings?.transfer_number || 'Not set'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}