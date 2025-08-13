import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface VoicePerformanceMetrics {
  operationType: 'synthesis' | 'transcription' | 'latency_test';
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
  voiceModel?: string;
  voiceId?: string;
  textLength?: number;
  audioDurationMs?: number;
  metadata?: Record<string, any>;
}

export const useVoicePerformance = () => {
  const { profile } = useAuth();

  const logPerformance = useCallback(async (metrics: VoicePerformanceMetrics) => {
    if (!profile?.clinic_id) return;

    try {
      await supabase.rpc('log_voice_performance', {
        p_operation_type: metrics.operationType,
        p_latency_ms: metrics.latencyMs,
        p_success: metrics.success,
        p_error_message: metrics.errorMessage,
        p_voice_model: metrics.voiceModel,
        p_voice_id: metrics.voiceId,
        p_text_length: metrics.textLength,
        p_audio_duration_ms: metrics.audioDurationMs,
        p_metadata: metrics.metadata || {}
      });
    } catch (error) {
      console.error('Error logging voice performance:', error);
    }
  }, [profile]);

  const getPerformanceMetrics = useCallback(async (
    operationType?: string,
    hours: number = 24
  ) => {
    if (!profile?.clinic_id) return null;

    try {
      let query = supabase
        .from('voice_performance_metrics')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (operationType) {
        query = query.eq('operation_type', operationType);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      return null;
    }
  }, [profile]);

  const getAverageLatency = useCallback(async (operationType: string, hours: number = 24) => {
    const metrics = await getPerformanceMetrics(operationType, hours);
    if (!metrics || metrics.length === 0) return null;

    const validMetrics = metrics.filter(m => m.success && m.latency_ms);
    if (validMetrics.length === 0) return null;

    const totalLatency = validMetrics.reduce((sum, m) => sum + m.latency_ms, 0);
    return Math.round(totalLatency / validMetrics.length);
  }, [getPerformanceMetrics]);

  const getSuccessRate = useCallback(async (operationType: string, hours: number = 24) => {
    const metrics = await getPerformanceMetrics(operationType, hours);
    if (!metrics || metrics.length === 0) return null;

    const successCount = metrics.filter(m => m.success).length;
    return Math.round((successCount / metrics.length) * 100);
  }, [getPerformanceMetrics]);

  return {
    logPerformance,
    getPerformanceMetrics,
    getAverageLatency,
    getSuccessRate
  };
};