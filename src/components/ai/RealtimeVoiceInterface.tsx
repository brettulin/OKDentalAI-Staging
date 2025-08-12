import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { RealtimeVoiceChat } from '@/utils/RealtimeVoiceChat';
import { 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff, 
  Volume2, 
  VolumeX,
  Signal,
  Bot,
  User,
  Square
} from 'lucide-react';

interface ConversationItem {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  audio?: boolean;
}

const SUPPORTED_VOICES = [
  { id: 'alloy', name: 'Alloy' },
  { id: 'ash', name: 'Ash' },
  { id: 'ballad', name: 'Ballad' },
  { id: 'coral', name: 'Coral' },
  { id: 'echo', name: 'Echo' },
  { id: 'sage', name: 'Sage' },
  { id: 'shimmer', name: 'Shimmer' },
  { id: 'verse', name: 'Verse' },
];

interface RealtimeVoiceInterfaceProps {
  clinicInstructions?: string;
  onCallStart?: () => void;
  onCallEnd?: () => void;
}

export function RealtimeVoiceInterface({ 
  clinicInstructions, 
  onCallStart, 
  onCallEnd 
}: RealtimeVoiceInterfaceProps) {
  const { toast } = useToast();
  const chatRef = useRef<RealtimeVoiceChat | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');

  const handleMessage = useCallback((event: any) => {
    console.log('Received message type:', event.type);
    
    switch (event.type) {
      case 'session.created':
        console.log('Session created successfully');
        break;
        
      case 'response.audio_transcript.delta':
        // Update current transcript as it comes in
        setCurrentTranscript(prev => prev + (event.delta || ''));
        break;
        
      case 'response.audio_transcript.done':
        // Finalize transcript and add to conversation
        if (currentTranscript.trim()) {
          setConversation(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'assistant',
            content: currentTranscript.trim(),
            timestamp: new Date().toISOString(),
            audio: true
          }]);
        }
        setCurrentTranscript('');
        break;
        
      case 'input_audio_buffer.speech_started':
        setIsListening(true);
        break;
        
      case 'input_audio_buffer.speech_stopped':
        setIsListening(false);
        break;
        
      case 'response.audio.delta':
        setIsSpeaking(true);
        break;
        
      case 'response.audio.done':
        setIsSpeaking(false);
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        // Add user's transcribed speech to conversation
        if (event.transcript?.trim()) {
          setConversation(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'user',
            content: event.transcript.trim(),
            timestamp: new Date().toISOString(),
            audio: true
          }]);
        }
        break;
        
      case 'response.function_call_arguments.done':
        // Handle function calls (appointments, transfers, etc.)
        console.log('Function call:', event.name, event.arguments);
        toast({
          title: "AI Action",
          description: `AI is calling function: ${event.name}`,
        });
        break;
        
      case 'error':
        console.error('OpenAI error:', event.error);
        toast({
          title: "AI Error",
          description: event.error?.message || 'An error occurred',
          variant: "destructive",
        });
        break;
    }
  }, [currentTranscript, toast]);

  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsConnected(connected);
    setIsConnecting(false);
    
    if (connected) {
      toast({
        title: "Connected",
        description: "Real-time voice interface is ready",
      });
      onCallStart?.();
    } else {
      toast({
        title: "Disconnected",
        description: "Voice interface disconnected",
      });
      onCallEnd?.();
    }
  }, [toast, onCallStart, onCallEnd]);

  const startConversation = async () => {
    try {
      setIsConnecting(true);
      
      chatRef.current = new RealtimeVoiceChat(handleMessage, handleConnectionChange);
      
      const instructions = clinicInstructions || `You are a helpful AI dental receptionist assistant. You can:
- Help patients schedule appointments
- Answer basic questions about dental services  
- Transfer calls to appropriate staff when needed
- Provide general information about the dental practice

Be friendly, professional, and concise in your responses. If you cannot help with something, offer to transfer the call to a human staff member.`;

      await chatRef.current.init(instructions, selectedVoice);
      
      // Clear conversation history for new session
      setConversation([]);
      setCurrentTranscript('');
      
    } catch (error) {
      console.error('Error starting conversation:', error);
      setIsConnecting(false);
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : 'Failed to start conversation',
        variant: "destructive",
      });
    }
  };

  const endConversation = () => {
    chatRef.current?.disconnect();
    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setIsListening(false);
  };

  const interruptAI = () => {
    chatRef.current?.interrupt();
    setIsSpeaking(false);
    toast({
      title: "Interrupted",
      description: "AI speech has been interrupted",
    });
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      chatRef.current?.disconnect();
    };
  }, []);

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Signal className="h-5 w-5" />
            OpenAI Realtime Voice Interface
          </CardTitle>
          
          <div className="flex items-center gap-3">
            {/* Voice Selection */}
            <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={isConnected}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_VOICES.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Indicators */}
            <div className="flex items-center gap-2">
              {isListening && (
                <Badge variant="destructive" className="animate-pulse">
                  <Mic className="w-3 h-3 mr-1" />
                  Listening
                </Badge>
              )}
              {isSpeaking && (
                <Badge className="animate-pulse">
                  <Volume2 className="w-3 h-3 mr-1" />
                  Speaking
                </Badge>
              )}
              {isConnected && (
                <Badge variant="outline">
                  <Signal className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>

            {/* Control Buttons */}
            {!isConnected ? (
              <Button 
                onClick={startConversation}
                disabled={isConnecting}
                className="flex items-center gap-2"
              >
                <Phone className="h-4 w-4" />
                {isConnecting ? 'Connecting...' : 'Start Call'}
              </Button>
            ) : (
              <div className="flex gap-2">
                {isSpeaking && (
                  <Button 
                    onClick={interruptAI}
                    variant="outline"
                    size="sm"
                  >
                    <Square className="h-3 w-3" />
                  </Button>
                )}
                <Button 
                  onClick={endConversation}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <PhoneOff className="h-4 w-4" />
                  End Call
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Conversation Display */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {conversation.map((item) => (
              <div 
                key={item.id}
                className={`flex gap-3 ${
                  item.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div className={`flex gap-2 max-w-[80%] ${
                  item.type === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    item.type === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {item.type === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div className={`rounded-lg p-3 ${
                    item.type === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}>
                    <p className="text-sm">{item.content}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs opacity-70">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </p>
                      {item.audio && (
                        <Badge variant="outline" className="text-xs">
                          <Volume2 className="w-2 h-2 mr-1" />
                          Audio
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Live transcript display */}
            {currentTranscript && (
              <div className="flex gap-3 justify-start">
                <div className="flex gap-2">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-lg p-3 bg-muted">
                    <p className="text-sm opacity-75">{currentTranscript}...</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      <Volume2 className="w-2 h-2 mr-1" />
                      Live
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Status Display */}
        {!isConnected && (
          <div className="p-4 text-center text-muted-foreground border-t">
            {isConnecting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Connecting to OpenAI Realtime API...</span>
              </div>
            ) : (
              <span>Click "Start Call" to begin voice conversation with AI</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}