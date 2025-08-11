import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const CallsPage = () => {
  const { user } = useAuth();

  // Get user profile to check clinic setup
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch calls data
  const { data: calls, isLoading: callsLoading, error } = useQuery({
    queryKey: ['calls', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      
      const { data, error } = await supabase
        .from('calls')
        .select('id, started_at, ended_at, outcome')
        .eq('clinic_id', profile.clinic_id)
        .order('started_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.clinic_id,
  });

  if (profileLoading) {
    return <PageSkeleton />;
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

  if (callsLoading) {
    return (
      <div className="p-6">
        <div className="space-y-2 mb-6">
          <h1 className="text-2xl font-semibold">Recent Calls</h1>
          <p className="text-muted-foreground">Loading call history...</p>
        </div>
        <PageSkeleton />
      </div>
    );
  }

  if (!calls?.length) {
    return (
      <div className="p-6" data-testid="page-calls">
        <div className="space-y-2 mb-6">
          <h1 className="text-2xl font-semibold">Recent Calls</h1>
          <p className="text-muted-foreground">Track and manage your AI receptionist calls</p>
        </div>
        <EmptyState
          title="No calls yet"
          description="When your AI receptionist starts handling calls, they'll appear here."
          icon={<Phone className="h-12 w-12 text-muted-foreground" />}
        />
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="page-calls">
      <div className="space-y-2 mb-6">
        <h1 className="text-2xl font-semibold">Recent Calls</h1>
        <p className="text-muted-foreground">Track and manage your AI receptionist calls</p>
      </div>
      
      <div className="space-y-4">
        {calls.map((call) => (
          <Card key={call.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Call #{call.id.slice(-8)}
                </CardTitle>
                <Badge variant={call.outcome ? 'default' : 'secondary'}>
                  {call.outcome || 'In Progress'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Started:</span>
                  <p className="font-medium">
                    {new Date(call.started_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Ended:</span>
                  <p className="font-medium">
                    {call.ended_at 
                      ? new Date(call.ended_at).toLocaleString() 
                      : 'Ongoing'
                    }
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <p className="font-medium">
                    {call.ended_at 
                      ? `${Math.round((new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 60000)} min`
                      : 'Ongoing'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CallsPage;