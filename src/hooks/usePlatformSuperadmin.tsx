import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function usePlatformSuperadmin() {
  const { user } = useAuth();
  const [isSuperadmin, setIsSuperadmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkSuperadminStatus() {
      if (!user) {
        setIsSuperadmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('is_platform_superadmin');
        
        if (error) {
          console.error('Error checking superadmin status:', error);
          setIsSuperadmin(false);
        } else {
          setIsSuperadmin(data || false);
        }
      } catch (error) {
        console.error('Error checking superadmin status:', error);
        setIsSuperadmin(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkSuperadminStatus();
  }, [user]);

  return { isSuperadmin, isLoading };
}