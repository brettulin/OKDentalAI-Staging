import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAICallHandler } from '@/hooks/useAICallHandler';
import { usePMSIntegration } from '@/hooks/usePMSIntegration';
import { Phone, PhoneOff, Send, Bot, User } from 'lucide-react';

interface CallSimulatorProps {
  officeId: string;
}

export function CallSimulator({ officeId }: CallSimulatorProps) {
  const [callId, setCallId] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [callContext, setCallContext] = useState<any>({});
  
  const { 
    startCall, 
    endCall, 
    processMessage, 
    useCallHistory,
    isStartingCall,
    isProcessingMessage,
    isEndingCall 
  } = useAICallHandler();

  const { data: callHistory } = useCallHistory(callId || '');

  // Start a new call
  const handleStartCall = async () => {
    try {
      const newCallId = crypto.randomUUID();
      const result = await startCall({
        callId: newCallId,
        officeId,
        fromNumber: '+1234567890',
        toNumber: '+1987654321'
      });
      
      setCallId(newCallId);
      setConversationHistory([{
        role: 'assistant',
        text: result.initialResponse,
        timestamp: new Date().toISOString()
      }]);
      setCallContext({ conversationState: 'greeting' });
    } catch (error) {
      console.error('Error starting call:', error);
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
      setCallContext({});
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  // Send message to AI
  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !callId) return;

    const userMessage = {
      role: 'user',
      text: currentMessage,
      timestamp: new Date().toISOString()
    };

    setConversationHistory(prev => [...prev, userMessage]);
    setCurrentMessage('');

    try {
      const result = await processMessage({
        callId,
        officeId,
        userMessage: currentMessage,
        conversationHistory: conversationHistory,
        context: callContext
      });

      const aiMessage = {
        role: 'assistant',
        text: result.response,
        timestamp: new Date().toISOString(),
        intent: result.intent,
        actions: result.actions
      };

      setConversationHistory(prev => [...prev, aiMessage]);
      setCallContext(result.context);
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage = {
        role: 'assistant',
        text: 'I apologize, but I encountered an error. Let me transfer you to a human representative.',
        timestamp: new Date().toISOString()
      };
      setConversationHistory(prev => [...prev, errorMessage]);
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
            {callContext.conversationState && (
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
                Start Call
              </Button>
            ) : (
              <Button 
                onClick={handleEndCall} 
                disabled={isEndingCall}
                variant="destructive"
                className="gap-2"
              >
                <PhoneOff className="h-4 w-4" />
                End Call
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
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div className={`flex gap-2 max-w-[80%] ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {message.role === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div className={`rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}>
                    <p className="text-sm">{message.text}</p>
                    {message.intent && (
                      <div className="mt-2 flex gap-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          Intent: {message.intent}
                        </Badge>
                        {message.actions?.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            Actions: {message.actions.join(', ')}
                          </Badge>
                        )}
                      </div>
                    )}
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
            <div className="flex gap-2">
              <Input
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={isProcessingMessage}
                className="flex-1"
              />
              <Button 
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() || isProcessingMessage}
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