import React, { useState } from 'react';
import { BookingInterface } from '@/components/appointments/BookingInterface';
import { SlotManager } from '@/components/appointments/SlotManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Clock, Users, Plus, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AppointmentsPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('book');

  // Get user's clinic
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch recent appointments
  const { data: recentAppointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['recent-appointments', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patients(full_name, phone),
          providers(name),
          services(name, duration_min),
          locations(name)
        `)
        .eq('clinic_id', profile.clinic_id)
        .order('starts_at', { ascending: true })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['appointment-stats', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return null;
      
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Today's appointments
      const { data: todayAppointments, error: todayError } = await supabase
        .from('appointments')
        .select('id')
        .eq('clinic_id', profile.clinic_id)
        .gte('starts_at', today.toISOString().split('T')[0])
        .lt('starts_at', tomorrow.toISOString().split('T')[0]);

      if (todayError) throw todayError;

      // Open slots
      const { data: openSlots, error: slotsError } = await supabase
        .from('slots')
        .select('id')
        .eq('clinic_id', profile.clinic_id)
        .eq('status', 'open')
        .gte('starts_at', new Date().toISOString());

      if (slotsError) throw slotsError;

      // This week's appointments
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const { data: weekAppointments, error: weekError } = await supabase
        .from('appointments')
        .select('id')
        .eq('clinic_id', profile.clinic_id)
        .gte('starts_at', weekStart.toISOString())
        .lt('starts_at', weekEnd.toISOString());

      if (weekError) throw weekError;

      return {
        todayCount: todayAppointments?.length || 0,
        openSlotsCount: openSlots?.length || 0,
        weekCount: weekAppointments?.length || 0,
      };
    },
    enabled: !!profile?.clinic_id,
  });

  if (!user) {
    return (
      <div className="p-6" data-testid="page-appointments">
        <EmptyState
          title="Authentication required"
          description="Please sign in to access appointments."
          icon={<Calendar className="h-12 w-12 text-muted-foreground" />}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-appointments">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Appointments</h1>
          <p className="text-muted-foreground">Manage appointments and availability</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Scheduled for {format(new Date(), 'EEEE, MMM d')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Slots</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.openSlotsCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Open slots for booking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.weekCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Appointments this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two-column layout: Left = calendar/slots, Right = booking form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Slot Management & Calendar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Slot Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SlotManager 
                onSlotsUpdated={() => {
                  // Refresh stats when slots are updated
                  // This will be handled by React Query automatically
                }}
              />
            </CardContent>
          </Card>

          {/* Recent Appointments List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Recent Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appointmentsLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading appointments...
                </div>
              ) : recentAppointments && recentAppointments.length > 0 ? (
                <div className="space-y-3">
                  {recentAppointments.slice(0, 5).map((appointment) => (
                    <div 
                      key={appointment.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {appointment.patients?.full_name || 'Unknown Patient'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {appointment.services?.name || 'Unknown Service'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-medium">
                          {format(new Date(appointment.starts_at), 'MMM d, h:mm a')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {appointment.providers?.name || 'No provider'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {recentAppointments.length > 5 && (
                    <Button variant="outline" size="sm" className="w-full">
                      View All Appointments
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No appointments found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Booking Interface */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Book New Appointment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BookingInterface 
                onAppointmentBooked={(appointment) => {
                  // Refresh all related queries when appointment is booked
                  console.log('Appointment booked:', appointment);
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AppointmentsPage;