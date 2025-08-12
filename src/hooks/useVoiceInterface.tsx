import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface VoiceSettings {
  voice: string;
  language: string;
  autoRecord: boolean;
}

export const useVoiceInterface = () => {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

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

      mediaRecorder.start(250); // Record in 250ms chunks
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current || !isRecording) {
        reject(new Error('Not currently recording'));
        return;
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
        } catch (error) {
          reject(error);
        }
      };

      mediaRecorderRef.current.stop();
      setIsRecording(false);
    });
  }, [isRecording]);

  const transcribeAudio = useCallback(async (audioBase64: string, language = 'en'): Promise<string> => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: audioBase64, language }
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

  const synthesizeSpeech = useCallback(async (text: string, voice = 'alloy'): Promise<void> => {
    setIsPlaying(true);
    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text, voice }
      });

      if (error) throw error;

      // Convert base64 to audio and play
      const audioData = data.audioContent;
      const audioBlob = new Blob([
        Uint8Array.from(atob(audioData), c => c.charCodeAt(0))
      ], { type: 'audio/mpeg' });
      
      const audio = new Audio(URL.createObjectURL(audioBlob));
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audio.src);
      };
      
      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audio.src);
        throw new Error('Audio playback failed');
      };
      
      await audio.play();
    } catch (error) {
      console.error('Speech synthesis error:', error);
      setIsPlaying(false);
      toast({
        title: "Speech Error",
        description: "Could not play audio response. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const recordAndTranscribe = useCallback(async (language = 'en'): Promise<string> => {
    try {
      await startRecording();
      
      // Record for a few seconds (you can make this configurable)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const audioBase64 = await stopRecording();
      return await transcribeAudio(audioBase64, language);
    } catch (error) {
      console.error('Record and transcribe error:', error);
      return '';
    }
  }, [startRecording, stopRecording, transcribeAudio]);

  return {
    isRecording,
    isPlaying,
    isProcessing,
    startRecording,
    stopRecording,
    transcribeAudio,
    synthesizeSpeech,
    recordAndTranscribe
  };
};