import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useVoicePerformance } from '@/hooks/useVoicePerformance';

interface RealtimeAIConfig {
  voice?: string;
  instructions?: string;
  temperature?: number;
  enableAudio?: boolean;
  enableText?: boolean;
}

interface ConversationItem {
  id: string;
  type: 'message' | 'function_call';
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  audioData?: ArrayBuffer;
}

export function useRealtimeAI(config: RealtimeAIConfig = {}) {
  const { profile } = useAuth();
  const { logPerformance } = useVoicePerformance();
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const sessionIdRef = useRef<string | null>(null);

  // Initialize audio context
  const initializeAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    }
    return audioContextRef.current;
  }, []);

  // Connect to OpenAI Realtime API via our edge function
  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return;
    
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      // First, get the WebSocket URL from our edge function
      const { data, error } = await supabase.functions.invoke('openai-realtime-session', {
        body: { action: 'create_session' }
      });

      if (error) throw error;

      // Connect to the WebSocket
      const wsUrl = data.websocket_url.replace('/openai-realtime-session', '/openai-realtime-session');
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = async () => {
        console.log('Connected to OpenAI Realtime API');
        setIsConnected(true);
        setIsConnecting(false);
        sessionIdRef.current = data.session_id;
        
        // Initialize audio context
        await initializeAudioContext();
        
        // Send initial session configuration
        const sessionConfig = {
          type: 'session.create',
          session: {
            modalities: config.enableAudio ? ['text', 'audio'] : ['text'],
            instructions: config.instructions || 
              'You are a helpful AI assistant for a medical clinic. Be professional and helpful.',
            voice: config.voice || 'alloy',
            temperature: config.temperature || 0.7,
            max_response_output_tokens: 4096,
          }
        };
        
        ws.send(JSON.stringify(sessionConfig));
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          await handleRealtimeMessage(message);
        } catch (error) {
          console.error('Error processing realtime message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Connection error occurred');
        setIsConnected(false);
        setIsConnecting(false);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setIsConnected(false);
        setIsConnecting(false);
        websocketRef.current = null;
      };

      websocketRef.current = ws;

    } catch (error) {
      console.error('Failed to connect to realtime API:', error);
      setConnectionError(error instanceof Error ? error.message : 'Failed to connect');
      setIsConnecting(false);
    }
  }, [isConnecting, isConnected, config, initializeAudioContext]);

  // Handle incoming realtime messages
  const handleRealtimeMessage = useCallback(async (message: any) => {
    switch (message.type) {
      case 'session.created':
        console.log('Session created:', message.session);
        break;
        
      case 'conversation.item.created':
        const item = message.item;
        setConversation(prev => [...prev, {
          id: item.id,
          type: 'message',
          role: item.role,
          content: item.content?.[0]?.text || '[Audio content]',
          timestamp: new Date(),
        }]);
        break;
        
      case 'response.audio.delta':
        if (config.enableAudio && message.delta) {
          // Decode base64 audio and queue for playback
          const audioData = Uint8Array.from(atob(message.delta), c => c.charCodeAt(0));
          audioQueueRef.current.push(audioData.buffer);
          await playAudioQueue();
        }
        break;
        
      case 'response.text.delta':
        // Update the last conversation item with streaming text
        setConversation(prev => {
          const lastItem = prev[prev.length - 1];
          if (lastItem && lastItem.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { ...lastItem, content: lastItem.content + message.delta }
            ];
          } else {
            return [...prev, {
              id: crypto.randomUUID(),
              type: 'message',
              role: 'assistant',
              content: message.delta,
              timestamp: new Date(),
            }];
          }
        });
        break;
        
      case 'response.audio_transcript.delta':
        // Update transcript
        console.log('Audio transcript:', message.delta);
        break;
        
      case 'response.done':
        setIsAISpeaking(false);
        await logPerformance({
          operationType: 'synthesis',
          latencyMs: 0, // TODO: Calculate actual latency
          success: true,
          voiceModel: 'openai-realtime',
          metadata: { sessionId: sessionIdRef.current }
        });
        break;
        
      case 'error':
        console.error('OpenAI Realtime error:', message.error);
        setConnectionError(message.error.message);
        break;
        
      default:
        console.log('Unhandled message type:', message.type);
    }
  }, [config.enableAudio, logPerformance]);

  // Play audio queue
  const playAudioQueue = useCallback(async () => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) return;
    
    try {
      const audioData = audioQueueRef.current.shift();
      if (audioData) {
        const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.start();
        
        setIsAISpeaking(true);
        source.onended = () => {
          if (audioQueueRef.current.length === 0) {
            setIsAISpeaking(false);
          }
        };
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }, []);

  // Send text message
  const sendTextMessage = useCallback((text: string) => {
    if (!websocketRef.current || !isConnected) return;
    
    const message = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }]
      }
    };
    
    websocketRef.current.send(JSON.stringify(message));
    
    // Add to conversation
    setConversation(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'message',
      role: 'user',
      content: text,
      timestamp: new Date(),
    }]);
    
    // Trigger response
    websocketRef.current.send(JSON.stringify({ type: 'response.create' }));
  }, [isConnected]);

  // Send audio data
  const sendAudioData = useCallback((audioData: ArrayBuffer) => {
    if (!websocketRef.current || !isConnected || !config.enableAudio) return;
    
    // Convert to base64 and send
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioData)));
    const message = {
      type: 'input_audio_buffer.append',
      audio: base64Audio
    };
    
    websocketRef.current.send(JSON.stringify(message));
  }, [isConnected, config.enableAudio]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    sessionIdRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [disconnect]);

  return {
    // Connection state
    isConnected,
    isConnecting,
    connectionError,
    
    // Conversation state
    conversation,
    isAISpeaking,
    
    // Actions
    connect,
    disconnect,
    sendTextMessage,
    sendAudioData,
    
    // Session info
    sessionId: sessionIdRef.current,
  };
}