import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, Phone, PhoneOff, Send, Volume2, Bot, User } from 'lucide-react';
import { useAICallHandler } from '@/hooks/useAICallHandler';
import { useAdvancedVoiceInterface } from '@/hooks/useAdvancedVoiceInterface';
import { useEnhancedSecurity } from '@/hooks/useEnhancedSecurity';
import { useVoicePerformance } from '@/hooks/useVoicePerformance';
import { VoiceControls } from './VoiceControls';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

interface CallSimulatorProps {
  officeId: string;
}

export function CallSimulator({ officeId }: CallSimulatorProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [callId, setCallId] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [useVoice, setUseVoice] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{
    speaker: 'user' | 'ai';
    message: string;
    timestamp: string;
  }>>([]);
  const [callContext, setCallContext] = useState<any>(null);

  // Fetch AI settings for voice configuration
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

  const {
    startCall,
    endCall,
    processMessage,
    isStartingCall,
    isEndingCall,
    isProcessingMessage
  } = useAICallHandler();

  const {
    isRecording,
    isPlaying,
    isProcessing,
    canInterrupt,
    audioLevel,
    startRecording,
    stopRecording,
    transcribeAudio,
    synthesizeSpeech,
    interruptSpeech
  } = useAdvancedVoiceInterface();

  const { validateAccess, logSecurityEvent, securityMetrics } = useEnhancedSecurity();
  const { logPerformance } = useVoicePerformance();

  const handleStartCall = async () => {
    try {
      // Validate access to AI call simulation
      const accessValidation = await validateAccess('ai_call', officeId, 'simulate', 'internal');
      if (!accessValidation.isValid) {
        toast({
          title: "Access Denied",
          description: accessValidation.reason || "Cannot start call simulation",
          variant: "destructive",
        });
        return;
      }

      const newCallId = crypto.randomUUID();
      const result = await startCall({
        callId: newCallId,
        officeId
      });
      
      setCallId(newCallId);
      setConversationHistory([{
        speaker: 'ai',
        message: result.initialResponse || "Hello! Thank you for calling. How can I help you today?",
        timestamp: new Date().toISOString()
      }]);
      setCallContext(result.context);

      // Log security event
      await logSecurityEvent('call_simulation_started', 'ai_call', newCallId, 'normal', {
        officeId,
        voiceEnabled: useVoice,
        sessionId: newCallId
      });

      // If voice mode is enabled, speak the initial greeting using clinic settings
      if (useVoice) {
        const startTime = performance.now();
        const greeting = result.initialResponse || "Hello! Thank you for calling. How can I help you today?";
        
        try {
          await synthesizeSpeech(
            greeting,
            (aiSettings as any)?.voice_id,
            aiSettings?.voice_model
          );
          
          const latency = performance.now() - startTime;
          await logPerformance({
            operationType: 'synthesis',
            latencyMs: Math.round(latency),
            success: true,
            voiceModel: aiSettings?.voice_model,
            voiceId: (aiSettings as any)?.voice_id,
            textLength: greeting.length,
            metadata: {
              context: 'call_greeting',
              callId: newCallId
            }
          });
        } catch (voiceError) {
          console.error('Voice synthesis error:', voiceError);
          await logPerformance({
            operationType: 'synthesis',
            latencyMs: Math.round(performance.now() - startTime),
            success: false,
            errorMessage: voiceError instanceof Error ? voiceError.message : 'Unknown error',
            voiceModel: aiSettings?.voice_model,
            voiceId: (aiSettings as any)?.voice_id,
            textLength: greeting.length
          });
        }
      }
    } catch (error) {
      console.error('Error starting call:', error);
      await logSecurityEvent('call_simulation_failed', 'ai_call', undefined, 'high', {
        error: error instanceof Error ? error.message : 'Unknown error',
        officeId
      });
      
      toast({
        title: "Error",
        description: "Failed to start call. Please try again.",
        variant: "destructive",
      });
    }
  };

  // End the current call
  const handleEndCall = async () => {
    if (!callId) return;
    
    try {
      await endCall({
        callId,
        outcome: 'completed'
      });
      
      setCallId(null);
      setConversationHistory([]);
      setCallContext(null);
    } catch (error) {
      console.error('Error ending call:', error);
      toast({
        title: "Error",
        description: "Failed to end call properly.",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const message = messageText || currentMessage.trim();
    if (!message || !callId) return;

    const userMessage = {
      speaker: 'user' as const,
      message: message,
      timestamp: new Date().toISOString()
    };

    setConversationHistory(prev => [...prev, userMessage]);
    setCurrentMessage('');

    try {
      const response = await processMessage({
        callId,
        officeId,
        userMessage: message
      });

      if (response.ai_response) {
        const aiMessage = {
          speaker: 'ai' as const,
          message: response.ai_response,
          timestamp: new Date().toISOString()
        };
        setConversationHistory(prev => [...prev, aiMessage]);

        // If voice mode is enabled, synthesize the AI response using clinic settings
        if (useVoice) {
          const startTime = performance.now();
          try {
            await synthesizeSpeech(
              response.ai_response,
              (aiSettings as any)?.voice_id,
              aiSettings?.voice_model
            );
            
            const latency = performance.now() - startTime;
            await logPerformance({
              operationType: 'synthesis',
              latencyMs: Math.round(latency),
              success: true,
              voiceModel: aiSettings?.voice_model,
              voiceId: (aiSettings as any)?.voice_id,
              textLength: response.ai_response.length,
              metadata: {
                context: 'ai_response',
                callId
              }
            });
          } catch (voiceError) {
            console.error('Voice synthesis error:', voiceError);
            await logPerformance({
              operationType: 'synthesis',
              latencyMs: Math.round(performance.now() - startTime),
              success: false,
              errorMessage: voiceError instanceof Error ? voiceError.message : 'Unknown error',
              voiceModel: aiSettings?.voice_model,
              voiceId: (aiSettings as any)?.voice_id,
              textLength: response.ai_response.length
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
      toast({
        title: "Error",
        description: "Failed to process message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleVoiceRecord = async () => {
    const startTime = performance.now();
    try {
      const audioBase64 = await stopRecording();
      const transcription = await transcribeAudio(audioBase64, 'audio/webm');
      
      const latency = performance.now() - startTime;
      await logPerformance({
        operationType: 'transcription',
        latencyMs: Math.round(latency),
        success: !!transcription.trim(),
        metadata: {
          audioLength: audioBase64.length,
          transcriptionLength: transcription.length,
          callId,
          context: 'user_voice_input'
        }
      });
      
      if (transcription.trim()) {
        // Log security event for voice input
        await logSecurityEvent('voice_input_processed', 'call_transcript', callId, 'normal', {
          transcriptionLength: transcription.length,
          audioLength: audioBase64.length
        });
        
        console.log('Voice input transcribed:', { transcription, audioLength: audioBase64.length });
        await handleSendMessage(transcription);
      }
    } catch (error) {
      console.error('Voice recording error:', error);
      
      const latency = performance.now() - startTime;
      await logPerformance({
        operationType: 'transcription',
        latencyMs: Math.round(latency),
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          callId,
          context: 'user_voice_input_failed'
        }
      });
      
      toast({
        title: "Voice Error",
        description: "Failed to process voice input. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleStartVoiceRecording = async () => {
    try {
      await startRecording();
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            AI Call Simulator
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => setUseVoice(!useVoice)}
              variant={useVoice ? "default" : "outline"}
              size="sm"
              disabled={!aiSettings || !(aiSettings?.booking_policy as any)?.voice_enabled}
            >
              <Volume2 className="w-4 h-4 mr-2" />
              {useVoice ? 'Voice On' : 'Voice Off'}
            </Button>
            {(!aiSettings || !(aiSettings?.booking_policy as any)?.voice_enabled) && (
              <span className="text-xs text-muted-foreground">
                Voice disabled in settings
              </span>
            )}
            
            {callContext?.conversationState && (
              <Badge variant="outline">
                {callContext.conversationState.replace('_', ' ').toUpperCase()}
              </Badge>
            )}
            
            {!callId ? (
              <Button 
                onClick={handleStartCall} 
                disabled={isStartingCall}
                className="gap-2"
              >
                <Phone className="h-4 w-4" />
                {isStartingCall ? 'Starting...' : 'Start Call'}
              </Button>
            ) : (
              <Button 
                onClick={handleEndCall} 
                disabled={isEndingCall}
                variant="destructive"
                className="gap-2"
              >
                <PhoneOff className="h-4 w-4" />
                {isEndingCall ? 'Ending...' : 'End Call'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Conversation Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {conversationHistory.map((message, index) => (
              <div 
                key={index}
                className={`flex gap-3 ${
                  message.speaker === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div className={`flex gap-2 max-w-[80%] ${
                  message.speaker === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.speaker === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {message.speaker === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div className={`rounded-lg p-3 ${
                    message.speaker === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}>
                    <p className="text-sm">{message.message}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {isProcessingMessage && (
              <div className="flex gap-3 justify-start">
                <div className="flex gap-2">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-lg p-3 bg-muted">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        {callId && (
          <div className="p-4 border-t">
            <div className="flex space-x-2">
              <Input
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                placeholder={useVoice ? "Use voice or type your message..." : "Type your message..."}
                onKeyPress={handleKeyPress}
                disabled={!callId || isProcessingMessage}
                className="flex-1"
              />
              
              {useVoice && (
                <VoiceControls
                  isRecording={isRecording}
                  isPlaying={isPlaying}
                  isProcessing={isProcessing}
                  canInterrupt={canInterrupt}
                  audioLevel={audioLevel}
                  onStartRecording={handleStartVoiceRecording}
                  onStopRecording={handleVoiceRecord}
                  onInterrupt={interruptSpeech}
                  disabled={!callId || isProcessingMessage}
                />
              )}
              
              <Button 
                onClick={() => handleSendMessage()}
                disabled={!callId || !currentMessage.trim() || isProcessingMessage}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {!callId && (
          <div className="p-4 text-center text-muted-foreground">
            Click "Start Call" to begin testing the AI receptionist
          </div>
        )}
      </CardContent>
    </Card>
  );
}