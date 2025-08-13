import { supabase } from '@/integrations/supabase/client';

// Weekly cleanup of old security data
export const cleanupSecurityData = async () => {
  try {
    // Call the cleanup function
    const { error } = await supabase.rpc('cleanup_old_data');
    if (error) throw error;
    
    console.log('Security data cleanup completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Security cleanup failed:', error);
    return { success: false, error };
  }
};

// Create cleanup edge function
export const scheduleSecurityCleanup = () => {
  // This would typically be handled by a Supabase cron job
  // For now, we'll run cleanup weekly on client side
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  
  const runCleanup = async () => {
    await cleanupSecurityData();
    // Schedule next cleanup
    setTimeout(runCleanup, WEEK_MS);
  };
  
  // Start cleanup cycle
  setTimeout(runCleanup, WEEK_MS);
};