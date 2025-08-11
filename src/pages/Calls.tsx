import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Phone, Filter, Eye, Clock, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CallThreadDrawer } from '@/components/calls/CallThreadDrawer';
import { formatDistanceToNow } from 'date-fns';

const CallsPage = () => {
  const { user } = useAuth();
  const [calls, setCalls] = useState<any[]>([]);
  const [filteredCalls, setFilteredCalls] = useState<any[]>([]);
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

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

  // Fetch initial calls data
  const fetchCalls = async () => {
    if (!profile?.clinic_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('calls')
        .select(`
          id, 
          started_at, 
          ended_at, 
          outcome,
          transcript_json,
          office_id,
          twilio_call_sid
        `)
        .eq('clinic_id', profile.clinic_id)
        .order('started_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setCalls(data || []);
      setFilteredCalls(data || []);
    } catch (error) {
      console.error('Error fetching calls:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.clinic_id) {
      fetchCalls();
    }
  }, [profile?.clinic_id]);

  // Set up real-time subscription for new calls
  useEffect(() => {
    if (!profile?.clinic_id) return;

    const channel = supabase
      .channel(`calls-${profile.clinic_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `clinic_id=eq.${profile.clinic_id}`,
        },
        (payload) => {
          const newCall = payload.new;
          setCalls(prev => [newCall, ...prev]);
          setFilteredCalls(prev => [newCall, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `clinic_id=eq.${profile.clinic_id}`,
        },
        (payload) => {
          const updatedCall = payload.new;
          setCalls(prev => prev.map(call => 
            call.id === updatedCall.id ? updatedCall : call
          ));
          setFilteredCalls(prev => prev.map(call => 
            call.id === updatedCall.id ? updatedCall : call
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.clinic_id]);

  // Filter calls by outcome
  useEffect(() => {
    if (outcomeFilter === 'all') {
      setFilteredCalls(calls);
    } else if (outcomeFilter === 'ongoing') {
      setFilteredCalls(calls.filter(call => !call.ended_at));
    } else {
      setFilteredCalls(calls.filter(call => call.outcome === outcomeFilter));
    }
  }, [calls, outcomeFilter]);

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

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-2 mb-6">
          <h1 className="text-2xl font-semibold">Live Call Monitor</h1>
          <p className="text-muted-foreground">Loading call history...</p>
        </div>
        <PageSkeleton />
      </div>
    );
  }

  if (!filteredCalls?.length) {
    return (
      <div className="p-6" data-testid="page-calls">
        <div className="space-y-2 mb-6">
          <h1 className="text-2xl font-semibold">Live Call Monitor</h1>
          <p className="text-muted-foreground">Track and manage your AI receptionist calls in real-time</p>
        </div>
        <EmptyState
          title="No calls yet"
          description="When your AI receptionist starts handling calls, they'll appear here."
          icon={<Phone className="h-12 w-12 text-muted-foreground" />}
        />
      </div>
    );
  }

  const getCallDuration = (call: any) => {
    const start = new Date(call.started_at);
    const end = call.ended_at ? new Date(call.ended_at) : new Date();
    const duration = Math.round((end.getTime() - start.getTime()) / 60000);
    return `${duration} min`;
  };

  const getCallStatus = (call: any) => {
    if (call.outcome) return call.outcome;
    return call.ended_at ? 'completed' : 'ongoing';
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'appointment_booked':
        return 'default';
      case 'ongoing':
        return 'secondary';
      case 'transferred':
        return 'outline';
      case 'voicemail':
        return 'outline';
      case 'completed':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getPatientInfo = (call: any) => {
    const transcript = call.transcript_json;
    if (transcript?.from_number) {
      return transcript.from_number;
    }
    if (transcript?.patient_name) {
      return transcript.patient_name;
    }
    return 'Unknown caller';
  };

  return (
    <div className="p-6" data-testid="page-calls">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Live Call Monitor</h1>
          <p className="text-muted-foreground">Track and manage your AI receptionist calls in real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by outcome" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All calls</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              <SelectItem value="appointment_booked">Appointments booked</SelectItem>
              <SelectItem value="transferred">Transferred</SelectItem>
              <SelectItem value="voicemail">Voicemail</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredCalls.map((call) => (
          <Card key={call.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Call #{call.id.slice(-8)}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {getPatientInfo(call)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusVariant(getCallStatus(call))}>
                    {getCallStatus(call)}
                  </Badge>
                  <CallThreadDrawer call={call}>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      View Thread
                    </Button>
                  </CallThreadDrawer>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Started:
                  </span>
                  <p className="font-medium">
                    {formatDistanceToNow(new Date(call.started_at), { addSuffix: true })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Ended:</span>
                  <p className="font-medium">
                    {call.ended_at 
                      ? formatDistanceToNow(new Date(call.ended_at), { addSuffix: true })
                      : 'Ongoing'
                    }
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <p className="font-medium">
                    {getCallDuration(call)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Outcome:</span>
                  <p className="font-medium">
                    {call.outcome || 'In progress'}
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