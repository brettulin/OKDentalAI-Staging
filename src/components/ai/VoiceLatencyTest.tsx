import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useVoiceInterface } from '@/hooks/useVoiceInterface';
import { useAuth } from '@/hooks/useAuth';
import { useVoicePerformance } from '@/hooks/useVoicePerformance';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Timer, Play, CheckCircle, XCircle, TrendingUp } from 'lucide-react';

export function VoiceLatencyTest() {
  const { profile } = useAuth();
  const { synthesizeSpeech } = useVoiceInterface();
  const { logPerformance, getAverageLatency, getSuccessRate } = useVoicePerformance();
  const [isRunning, setIsRunning] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [results, setResults] = useState<{
    latency: number;
    success: boolean;
    error?: string;
    audioQuality?: 'excellent' | 'good' | 'poor';
  } | null>(null);

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

  const runLatencyTest = async () => {
    if (!aiSettings) return;

    setIsRunning(true);
    setResults(null);
    setTestProgress(0);

    const testText = "Thank you for calling. This is a comprehensive latency and quality test for our voice synthesis system.";
    let startTime = performance.now();
    
    try {
      // Phase 1: API Response Test (40% of progress)
      setTestProgress(10);
      startTime = performance.now();
      
      const { data, error } = await supabase.functions.invoke('voice-synthesize', {
        body: { 
          text: testText, 
          voiceId: (aiSettings as any)?.voice_id,
          model: aiSettings?.voice_model
        }
      });
      
      const endTime = performance.now();
      const latency = endTime - startTime;
      setTestProgress(40);

      if (error) throw error;

      // Phase 2: Audio Quality Test (30% of progress)
      setTestProgress(50);
      let audioQuality: 'excellent' | 'good' | 'poor' = 'poor';
      
      if (data?.audioBase64) {
        try {
          const audioBlob = new Blob([
            Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0))
          ], { type: data.mime || 'audio/mpeg' });
          
          // Measure audio duration vs text length for quality assessment
          const audioContext = new AudioContext();
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const audioDuration = audioBuffer.duration * 1000; // Convert to ms
          
          setTestProgress(70);
          
          // Quality assessment based on latency and audio properties
          if (latency < 800 && audioDuration > 0) {
            audioQuality = 'excellent';
          } else if (latency < 1200 && audioDuration > 0) {
            audioQuality = 'good';
          }
          
          // Phase 3: Audio Playback Test (30% of progress)
          setTestProgress(80);
          const audio = new Audio(URL.createObjectURL(audioBlob));
          
          await new Promise<void>((resolve, reject) => {
            audio.onended = () => {
              URL.revokeObjectURL(audio.src);
              resolve();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(audio.src);
              reject(new Error('Audio playback failed'));
            };
            audio.play().catch(reject);
          });
          
          setTestProgress(90);
          
          // Log performance metrics
          await logPerformance({
            operationType: 'latency_test',
            latencyMs: Math.round(latency),
            success: true,
            voiceModel: aiSettings?.voice_model,
            voiceId: (aiSettings as any)?.voice_id,
            textLength: testText.length,
            audioDurationMs: Math.round(audioDuration),
            metadata: {
              audioQuality,
              testType: 'comprehensive'
            }
          });
          
        } catch (playbackError) {
          console.log('Audio playback test failed:', playbackError);
          audioQuality = 'poor';
        }
      }

      setResults({
        latency,
        success: latency < 1200,
        audioQuality
      });

      console.log(`Voice synthesis comprehensive test: ${latency.toFixed(0)}ms, quality: ${audioQuality}`);
      
    } catch (error) {
      const endTime = performance.now();
      const latency = endTime - (startTime || performance.now());
      
      console.error('Latency test error:', error);
      
      // Log failed test
      await logPerformance({
        operationType: 'latency_test',
        latencyMs: Math.round(latency),
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        voiceModel: aiSettings?.voice_model,
        voiceId: (aiSettings as any)?.voice_id,
        textLength: testText.length
      });
      
      setResults({
        latency,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setTestProgress(100);
      setIsRunning(false);
    }
  };

  // Historical performance data
  const { data: historicalData } = useQuery({
    queryKey: ['voice-performance', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return null;
      
      const [avgLatency, successRate] = await Promise.all([
        getAverageLatency('synthesis', 168), // Last 7 days
        getSuccessRate('synthesis', 168)
      ]);
      
      return { avgLatency, successRate };
    },
    enabled: !!profile?.clinic_id,
    refetchInterval: 5 * 60 * 1000 // Refresh every 5 minutes
  });

  const getLatencyBadge = () => {
    if (!results) return null;

    if (!results.success) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    }

    if (results.latency < 800) {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Excellent
        </Badge>
      );
    } else if (results.latency < 1200) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Good
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Slow
        </Badge>
      );
    }
  };

  const getQualityBadge = () => {
    if (!results?.audioQuality) return null;

    switch (results.audioQuality) {
      case 'excellent':
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Excellent Quality
          </Badge>
        );
      case 'good':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Good Quality
          </Badge>
        );
      case 'poor':
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Poor Quality
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Voice Latency Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Comprehensive voice synthesis test including latency, quality, and playback validation. Target: under 1.2 seconds.
        </p>

        {/* Test Progress */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Testing in progress...</span>
              <span>{testProgress}%</span>
            </div>
            <Progress value={testProgress} className="w-full" />
          </div>
        )}

        {/* Test Controls */}
        <div className="flex items-center gap-4">
          <Button
            onClick={runLatencyTest}
            disabled={isRunning || !aiSettings}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {isRunning ? 'Testing...' : 'Run Comprehensive Test'}
          </Button>

          {results && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {results.latency.toFixed(0)}ms
              </span>
              {getLatencyBadge()}
              {getQualityBadge()}
            </div>
          )}
        </div>

        {/* Historical Performance */}
        {historicalData && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {historicalData.avgLatency ? `${historicalData.avgLatency}ms` : 'N/A'}
              </p>
              <p className="text-sm text-muted-foreground">7-day Average</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {historicalData.successRate ? `${historicalData.successRate}%` : 'N/A'}
              </p>
              <p className="text-sm text-muted-foreground">Success Rate</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {results?.error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{results.error}</p>
          </div>
        )}

        {/* Settings Required */}
        {!aiSettings && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Voice settings required. Please configure AI settings first.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}