import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface VoiceSettings {
  voice: string;
  language: string;
  autoRecord: boolean;
  interruptionEnabled: boolean;
  vadThreshold: number;
}

interface AudioQueueItem {
  id: string;
  audioData: string;
  mimeType: string;
  text?: string;
}

export const useAdvancedVoiceInterface = () => {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [canInterrupt, setCanInterrupt] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<AudioQueueItem[]>([]);
  const isPlayingQueueRef = useRef(false);

  // Voice Activity Detection
  const startVoiceActivityDetection = useCallback(() => {
    if (!audioContextRef.current || !analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const checkVoiceActivity = () => {
      if (!analyserRef.current || !isRecording) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      setAudioLevel(average);
      
      // Voice activity detection threshold
      const threshold = 30; // Adjust based on environment
      if (average > threshold) {
        // Voice detected - reset timeout
        if (vadTimeoutRef.current) {
          clearTimeout(vadTimeoutRef.current);
        }
        
        vadTimeoutRef.current = setTimeout(() => {
          // Auto-stop recording after silence
          if (isRecording) {
            stopRecording();
          }
        }, 2000); // 2 seconds of silence
      }
      
      if (isRecording) {
        requestAnimationFrame(checkVoiceActivity);
      }
    };
    
    checkVoiceActivity();
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    try {
      // Stop any current playback to allow interruption
      if (isPlaying && canInterrupt) {
        stopPlayback();
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Set up audio context for VAD
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // Record in smaller chunks for responsiveness
      setIsRecording(true);
      
      // Start voice activity detection
      startVoiceActivityDetection();
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  }, [toast, isPlaying, canInterrupt, startVoiceActivityDetection]);

  const stopRecording = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current || !isRecording) {
        reject(new Error('Not currently recording'));
        return;
      }

      // Clear VAD timeout
      if (vadTimeoutRef.current) {
        clearTimeout(vadTimeoutRef.current);
        vadTimeoutRef.current = null;
      }

      mediaRecorderRef.current.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = (reader.result as string).split(',')[1];
            resolve(base64Audio);
          };
          reader.readAsDataURL(audioBlob);
          
          // Stop all tracks
          if (mediaRecorderRef.current?.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
          }
          
          // Clean up audio context
          if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
          }
        } catch (error) {
          reject(error);
        }
      };

      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel(0);
    });
  }, [isRecording]);

  const transcribeAudio = useCallback(async (audioBase64: string, mime = 'audio/webm'): Promise<string> => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('voice-transcribe', {
        body: { audioBase64, mime }
      });

      if (error) throw error;
      
      return data.text || '';
    } catch (error) {
      console.error('Transcription error:', error);
      toast({
        title: "Transcription Error",
        description: "Could not convert speech to text. Please try again.",
        variant: "destructive",
      });
      return '';
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  // Audio queue management
  const addToAudioQueue = useCallback((audioData: string, mimeType: string, text?: string) => {
    const item: AudioQueueItem = {
      id: crypto.randomUUID(),
      audioData,
      mimeType,
      text
    };
    audioQueueRef.current.push(item);
    
    if (!isPlayingQueueRef.current) {
      processAudioQueue();
    }
  }, []);

  const processAudioQueue = useCallback(async () => {
    if (isPlayingQueueRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingQueueRef.current = true;
    setIsPlaying(true);
    setCanInterrupt(true);
    
    while (audioQueueRef.current.length > 0) {
      const item = audioQueueRef.current.shift()!;
      setCurrentPlayingId(item.id);
      
      try {
        await playAudioItem(item);
      } catch (error) {
        console.error('Error playing audio item:', error);
        // Continue with next item even if current fails
      }
      
      // Check if playback was interrupted
      if (!isPlayingQueueRef.current) break;
    }
    
    isPlayingQueueRef.current = false;
    setIsPlaying(false);
    setCanInterrupt(false);
    setCurrentPlayingId(null);
  }, []);

  const playAudioItem = useCallback((item: AudioQueueItem): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const audioBlob = new Blob([
          Uint8Array.from(atob(item.audioData), c => c.charCodeAt(0))
        ], { type: item.mimeType || 'audio/mpeg' });
        
        const audio = new Audio(URL.createObjectURL(audioBlob));
        currentAudioRef.current = audio;
        
        audio.onended = () => {
          URL.revokeObjectURL(audio.src);
          currentAudioRef.current = null;
          resolve();
        };
        
        audio.onerror = () => {
          URL.revokeObjectURL(audio.src);
          currentAudioRef.current = null;
          reject(new Error('Audio playback failed'));
        };
        
        audio.play();
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  const stopPlayback = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      URL.revokeObjectURL(currentAudioRef.current.src);
      currentAudioRef.current = null;
    }
    
    // Clear queue
    audioQueueRef.current = [];
    isPlayingQueueRef.current = false;
    setIsPlaying(false);
    setCanInterrupt(false);
    setCurrentPlayingId(null);
  }, []);

  const synthesizeSpeech = useCallback(async (text: string, voiceId?: string, model?: string): Promise<void> => {
    try {
      const { data, error } = await supabase.functions.invoke('voice-synthesize', {
        body: { text, voiceId, model }
      });

      if (error) throw error;

      // Add to queue instead of playing immediately
      addToAudioQueue(data.audioBase64, data.mime || 'audio/mpeg', text);
      
    } catch (error) {
      console.error('Speech synthesis error:', error);
      toast({
        title: "Speech Error",
        description: "Could not synthesize speech. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast, addToAudioQueue]);

  const interruptSpeech = useCallback(() => {
    if (canInterrupt) {
      stopPlayback();
      toast({
        title: "Speech Interrupted",
        description: "Voice playback has been stopped.",
      });
    }
  }, [canInterrupt, stopPlayback, toast]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (vadTimeoutRef.current) {
        clearTimeout(vadTimeoutRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (currentAudioRef.current) {
        URL.revokeObjectURL(currentAudioRef.current.src);
      }
    };
  }, []);

  return {
    isRecording,
    isPlaying,
    isProcessing,
    canInterrupt,
    currentPlayingId,
    audioLevel,
    startRecording,
    stopRecording,
    transcribeAudio,
    synthesizeSpeech,
    interruptSpeech,
    stopPlayback
  };
};