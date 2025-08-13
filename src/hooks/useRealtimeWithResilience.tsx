import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface RealtimeConfig {
  table: string;
  filter?: string;
  select?: string;
  enableOptimisticUpdates?: boolean;
  enableMetrics?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

interface ConnectionMetrics {
  latency: number;
  messagesReceived: number;
  reconnectionCount: number;
  lastConnected: Date | null;
  bandwidth: number;
}

export function useRealtimeWithResilience<T = any>(config: RealtimeConfig) {
  const [data, setData] = useState<T[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ConnectionMetrics>({
    latency: 0,
    messagesReceived: 0,
    reconnectionCount: 0,
    lastConnected: null,
    bandwidth: 0
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const lastHeartbeatRef = useRef<Date | null>(null);
  const optimisticUpdatesRef = useRef<Map<string, T>>(new Map());

  // Performance monitoring
  const updateMetrics = useCallback((messageSize: number = 0) => {
    if (!config.enableMetrics) return;

    setMetrics(prev => ({
      ...prev,
      messagesReceived: prev.messagesReceived + 1,
      bandwidth: prev.bandwidth + messageSize,
      latency: lastHeartbeatRef.current ? 
        Date.now() - lastHeartbeatRef.current.getTime() : prev.latency
    }));
  }, [config.enableMetrics]);

  // Optimistic update management
  const applyOptimisticUpdate = useCallback((id: string, update: Partial<T>) => {
    if (!config.enableOptimisticUpdates) return;

    setData(current => 
      current.map(item => 
        (item as any).id === id ? { ...item, ...update } : item
      )
    );
    
    optimisticUpdatesRef.current.set(id, update as T);
  }, [config.enableOptimisticUpdates]);

  const rollbackOptimisticUpdate = useCallback((id: string) => {
    if (!config.enableOptimisticUpdates) return;

    optimisticUpdatesRef.current.delete(id);
    // Re-fetch data to ensure consistency
    fetchInitialData();
  }, [config.enableOptimisticUpdates]);

  // Initial data fetch
  const fetchInitialData = useCallback(async () => {
    try {
      let query = (supabase as any).from(config.table).select(config.select || '*');
      
      if (config.filter) {
        const [column, operator, value] = config.filter.split(':');
        query = query[operator](column, value);
      }

      const { data: initialData, error } = await query;
      
      if (error) throw error;
      setData((initialData as T[]) || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch initial data');
    }
  }, [config.table, config.select, config.filter]);

  // Enhanced subscription setup with resilience
  const setupSubscription = useCallback(() => {
    try {
      const channelName = `realtime-${config.table}-${Date.now()}`;
      const channel = supabase.channel(channelName);

      // Configure subscription
      let subscription = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: config.table,
          filter: config.filter
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          updateMetrics(JSON.stringify(payload).length);

          setData(current => {
            switch (payload.eventType) {
              case 'INSERT':
                return [...current, payload.new];
              
              case 'UPDATE':
                return current.map(item => 
                  (item as any).id === (payload.new as any).id 
                    ? { ...item, ...payload.new }
                    : item
                );
              
              case 'DELETE':
                return current.filter(item => 
                  (item as any).id !== (payload.old as any).id
                );
              
              default:
                return current;
            }
          });

          // Clear any optimistic updates for this record
          if (config.enableOptimisticUpdates && payload.new) {
            optimisticUpdatesRef.current.delete((payload.new as any).id);
          }
        }
      );

      // Connection status monitoring
      channel.on('system', {}, (payload) => {
        if (payload.extension === 'postgres_changes') {
          switch (payload.status) {
            case 'ok':
              setConnectionStatus('connected');
              setError(null);
              retryCountRef.current = 0;
              setMetrics(prev => ({
                ...prev,
                lastConnected: new Date(),
                reconnectionCount: prev.reconnectionCount + (prev.lastConnected ? 1 : 0)
              }));
              break;
            
            case 'error':
              setConnectionStatus('disconnected');
              setError('Connection error');
              scheduleReconnection();
              break;
          }
        }
      });

      // Heartbeat monitoring
      const heartbeatInterval = setInterval(() => {
        lastHeartbeatRef.current = new Date();
        // Use broadcast for heartbeat instead of direct send
        channel.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { timestamp: Date.now() }
        });
      }, 30000); // 30 second heartbeat

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          clearInterval(heartbeatInterval);
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
          scheduleReconnection();
        }
      });

      channelRef.current = channel;
      
      // Cleanup function
      return () => {
        clearInterval(heartbeatInterval);
        channel.unsubscribe();
      };

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup subscription');
      scheduleReconnection();
    }
  }, [config, updateMetrics]);

  // Automatic reconnection with exponential backoff
  const scheduleReconnection = useCallback(() => {
    if (retryCountRef.current >= (config.maxRetries || 5)) {
      setError('Max reconnection attempts reached. Please refresh the page.');
      return;
    }

    setConnectionStatus('reconnecting');
    
    const delay = Math.min(
      (config.retryDelay || 1000) * Math.pow(2, retryCountRef.current),
      30000 // Max 30 seconds
    );

    setTimeout(() => {
      retryCountRef.current++;
      setupSubscription();
    }, delay);
  }, [config.maxRetries, config.retryDelay, setupSubscription]);

  // Setup and cleanup
  useEffect(() => {
    fetchInitialData();
    const cleanup = setupSubscription();

    return () => {
      if (cleanup) cleanup();
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [fetchInitialData, setupSubscription]);

  // Force reconnection
  const reconnect = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }
    retryCountRef.current = 0;
    setupSubscription();
  }, [setupSubscription]);

  // Manual refresh
  const refresh = useCallback(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  return {
    data,
    connectionStatus,
    error,
    metrics,
    actions: {
      reconnect,
      refresh,
      applyOptimisticUpdate,
      rollbackOptimisticUpdate
    }
  };
}