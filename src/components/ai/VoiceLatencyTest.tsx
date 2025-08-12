import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVoiceInterface } from '@/hooks/useVoiceInterface';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Timer, Play, CheckCircle, XCircle } from 'lucide-react';

export function VoiceLatencyTest() {
  const { profile } = useAuth();
  const { synthesizeSpeech } = useVoiceInterface();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<{
    latency: number;
    success: boolean;
    error?: string;
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

    const testText = "Thank you for calling. This is a latency test for our voice synthesis system.";
    const startTime = performance.now();

    try {
      await synthesizeSpeech(
        testText,
        (aiSettings as any)?.voice_id,
        aiSettings?.voice_model
      );
      
      const endTime = performance.now();
      const latency = endTime - startTime;

      setResults({
        latency,
        success: latency < 1200, // Target: first byte < 1.2s
      });

      console.log(`Voice synthesis latency test: ${latency.toFixed(0)}ms`);
    } catch (error) {
      console.error('Latency test error:', error);
      setResults({
        latency: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsRunning(false);
    }
  };

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Voice Latency Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Test the voice synthesis latency. Target: first byte response under 1.2 seconds.
        </p>

        <div className="flex items-center gap-4">
          <Button
            onClick={runLatencyTest}
            disabled={isRunning || !aiSettings}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {isRunning ? 'Testing...' : 'Run Test'}
          </Button>

          {results && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {results.latency.toFixed(0)}ms
              </span>
              {getLatencyBadge()}
            </div>
          )}
        </div>

        {results?.error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{results.error}</p>
          </div>
        )}

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