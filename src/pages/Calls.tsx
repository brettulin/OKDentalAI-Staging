import React from 'react';
import { AIReceptionistDashboard } from '@/components/dashboard/AIReceptionistDashboard';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageSkeleton } from '@/components/PageSkeleton';
import { Phone } from 'lucide-react';

const CallsPage = () => {
  const { user } = useAuth();

  // Get user profile
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6" data-testid="page-calls">
        <EmptyState
          title="Error loading calls"
          description={error instanceof Error ? error.message : 'Unknown error occurred'}
          icon={<Phone className="h-12 w-12 text-muted-foreground" />}
          action={{
            label: "Retry",
            onClick: () => window.location.reload()
          }}
        />
      </div>
    );
  }

  if (!profile?.clinic_id) {
    return (
      <div className="p-6" data-testid="page-calls">
        <EmptyState
          title="Clinic setup required"
          description="You need to create or join a clinic before accessing calls."
          icon={<Phone className="h-12 w-12 text-muted-foreground" />}
          action={{
            label: "Go to Setup",
            onClick: () => window.location.href = '/'
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="page-calls">
      <AIReceptionistDashboard />
    </div>
  );
};

export default CallsPage;