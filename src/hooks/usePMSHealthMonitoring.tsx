import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PMSHealthStatus {
  adapter: string;
  status: 'healthy' | 'unhealthy' | 'error' | 'unknown';
  lastCheck: string;
  responseTime?: number;
  errorCount: number;
  uptime: number;
  details: {
    circuitBreakers?: Record<string, any>;
    authTokenValid?: boolean;
    sessionValid?: boolean;
    lastError?: string;
  };
}

interface PMSPerformanceMetrics {
  adapter: string;
  avgResponseTime: number;
  successRate: number;
  totalRequests: number;
  failedRequests: number;
  lastHourMetrics: {
    requests: number;
    failures: number;
    avgLatency: number;
  };
}

export const usePMSHealthMonitoring = () => {
  const { profile } = useAuth();
  const [healthStatus, setHealthStatus] = useState<Record<string, PMSHealthStatus>>({});
  const [performanceMetrics, setPerformanceMetrics] = useState<Record<string, PMSPerformanceMetrics>>({});
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [alerts, setAlerts] = useState<Array<{ id: string; adapter: string; severity: string; message: string; timestamp: string }>>([]);

  // Monitor PMS health status
  const checkPMSHealth = useCallback(async (adapter: string) => {
    if (!profile?.clinic_id) return;

    try {
      const startTime = Date.now();
      
      // Call PMS health check endpoint
      const { data, error } = await supabase.functions.invoke('pms-integrations', {
        body: {
          action: 'health_check',
          adapter,
          clinic_id: profile.clinic_id
        }
      });

      const responseTime = Date.now() - startTime;

      if (error) {
        setHealthStatus(prev => ({
          ...prev,
          [adapter]: {
            adapter,
            status: 'error',
            lastCheck: new Date().toISOString(),
            responseTime,
            errorCount: (prev[adapter]?.errorCount || 0) + 1,
            uptime: 0,
            details: {
              lastError: error.message
            }
          }
        }));
        return;
      }

      setHealthStatus(prev => ({
        ...prev,
        [adapter]: {
          adapter,
          status: data.status,
          lastCheck: data.lastCheck,
          responseTime,
          errorCount: data.status === 'healthy' ? 0 : (prev[adapter]?.errorCount || 0) + 1,
          uptime: data.status === 'healthy' ? (prev[adapter]?.uptime || 0) + 1 : 0,
          details: data.details
        }
      }));

      // Create alert if status is unhealthy
      if (data.status !== 'healthy') {
        const alertId = `${adapter}_${Date.now()}`;
        setAlerts(prev => [
          ...prev,
          {
            id: alertId,
            adapter,
            severity: data.status === 'error' ? 'critical' : 'warning',
            message: `${adapter} PMS adapter is ${data.status}`,
            timestamp: new Date().toISOString()
          }
        ]);
      }

    } catch (error) {
      console.error(`Failed to check ${adapter} health:`, error);
      setHealthStatus(prev => ({
        ...prev,
        [adapter]: {
          adapter,
          status: 'error',
          lastCheck: new Date().toISOString(),
          errorCount: (prev[adapter]?.errorCount || 0) + 1,
          uptime: 0,
          details: {
            lastError: (error as Error).message
          }
        }
      }));
    }
  }, [profile]);

  // Get performance metrics
  const getPerformanceMetrics = useCallback(async (adapter: string) => {
    if (!profile?.clinic_id) return;

    try {
      const { data, error } = await supabase.functions.invoke('pms-integrations', {
        body: {
          action: 'performance_metrics',
          adapter,
          clinic_id: profile.clinic_id
        }
      });

      if (error) {
        console.error(`Failed to get ${adapter} performance metrics:`, error);
        return;
      }

      setPerformanceMetrics(prev => ({
        ...prev,
        [adapter]: data
      }));

    } catch (error) {
      console.error(`Failed to get ${adapter} performance metrics:`, error);
    }
  }, [profile]);

  // Test PMS connection
  const testConnection = useCallback(async (adapter: string) => {
    if (!profile?.clinic_id) return false;

    try {
      const { data, error } = await supabase.functions.invoke('pms-integrations', {
        body: {
          action: 'test_connection',
          adapter,
          clinic_id: profile.clinic_id
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      return data.connected;
    } catch (error) {
      console.error(`Failed to test ${adapter} connection:`, error);
      return false;
    }
  }, [profile]);

  // Get available PMS adapters
  const getAvailableAdapters = useCallback(async () => {
    if (!profile?.clinic_id) return [];

    try {
      const { data, error } = await supabase
        .from('offices')
        .select('pms_type')
        .eq('clinic_id', profile.clinic_id)
        .not('pms_type', 'is', null);

      if (error) {
        console.error('Failed to get available adapters:', error);
        return [];
      }

      return data.map(office => office.pms_type).filter(Boolean);
    } catch (error) {
      console.error('Failed to get available adapters:', error);
      return [];
    }
  }, [profile]);

  // Start monitoring
  const startMonitoring = useCallback(async () => {
    setIsMonitoring(true);
    const adapters = await getAvailableAdapters();
    
    const monitoringInterval = setInterval(async () => {
      for (const adapter of adapters) {
        await checkPMSHealth(adapter);
        await getPerformanceMetrics(adapter);
      }
    }, 30000); // Check every 30 seconds

    // Initial check
    for (const adapter of adapters) {
      await checkPMSHealth(adapter);
      await getPerformanceMetrics(adapter);
    }

    return () => {
      clearInterval(monitoringInterval);
      setIsMonitoring(false);
    };
  }, [getAvailableAdapters, checkPMSHealth, getPerformanceMetrics]);

  // Clear alerts
  const clearAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  // Calculate overall health score
  const getOverallHealthScore = useCallback(() => {
    const adapters = Object.values(healthStatus);
    if (adapters.length === 0) return 100;

    const healthyCount = adapters.filter(adapter => adapter.status === 'healthy').length;
    return Math.round((healthyCount / adapters.length) * 100);
  }, [healthStatus]);

  // Auto-start monitoring when component mounts
  useEffect(() => {
    if (profile?.clinic_id) {
      startMonitoring();
    }
  }, [profile, startMonitoring]);

  return {
    healthStatus,
    performanceMetrics,
    isMonitoring,
    alerts,
    startMonitoring,
    checkPMSHealth,
    getPerformanceMetrics,
    testConnection,
    getAvailableAdapters,
    clearAlert,
    getOverallHealthScore
  };
};