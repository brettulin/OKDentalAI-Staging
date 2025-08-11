import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BookingInterface } from "@/components/appointments/BookingInterface";
import { SlotGenerator } from "@/components/appointments/SlotGenerator";

export default function Schedule() {
  const { profile } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedProviderId, setSelectedProviderId] = useState<string>("all");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("all");
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const queryClient = useQueryClient();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday start
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Fetch providers
  const { data: providers } = useQuery({
    queryKey: ['providers', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ['locations', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  // Fetch slots and appointments for the week
  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ['schedule', profile?.clinic_id, weekStart, selectedProviderId, selectedLocationId],
    queryFn: async () => {
      if (!profile?.clinic_id) return { slots: [], appointments: [] };

      const weekEnd = addDays(weekStart, 7);

      // Build filters
      let slotsQuery = supabase
        .from('slots')
        .select(`
          *,
          providers(name),
          locations(name)
        `)
        .eq('clinic_id', profile.clinic_id)
        .gte('starts_at', weekStart.toISOString())
        .lt('starts_at', weekEnd.toISOString());

      let appointmentsQuery = supabase
        .from('appointments')
        .select(`
          *,
          patients(full_name),
          services(name),
          providers(name),
          locations(name)
        `)
        .eq('clinic_id', profile.clinic_id)
        .gte('starts_at', weekStart.toISOString())
        .lt('starts_at', weekEnd.toISOString());

      if (selectedProviderId !== "all") {
        slotsQuery = slotsQuery.eq('provider_id', selectedProviderId);
        appointmentsQuery = appointmentsQuery.eq('provider_id', selectedProviderId);
      }

      if (selectedLocationId !== "all") {
        slotsQuery = slotsQuery.eq('location_id', selectedLocationId);
        appointmentsQuery = appointmentsQuery.eq('location_id', selectedLocationId);
      }

      const [slotsResult, appointmentsResult] = await Promise.all([
        slotsQuery.order('starts_at'),
        appointmentsQuery.order('starts_at')
      ]);

      if (slotsResult.error) throw slotsResult.error;
      if (appointmentsResult.error) throw appointmentsResult.error;

      return {
        slots: slotsResult.data || [],
        appointments: appointmentsResult.data || [],
      };
    },
    enabled: !!profile?.clinic_id,
  });

  const createSlotMutation = useMutation({
    mutationFn: async (slotData: any) => {
      const { error } = await supabase
        .from('slots')
        .insert({
          ...slotData,
          clinic_id: profile?.clinic_id,
          status: 'open'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Slot created successfully');
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
    onError: (error) => {
      toast.error(`Failed to create slot: ${error.message}`);
    },
  });

  const handleSlotClick = (slot: any) => {
    if (slot.status === 'open') {
      setSelectedSlot(slot);
      setShowBookingDialog(true);
    }
  };

  const getTimeSlots = (date: Date) => {
    if (!scheduleData) return [];

    const daySlots = scheduleData.slots.filter(slot => 
      isSameDay(new Date(slot.starts_at), date)
    );

    const dayAppointments = scheduleData.appointments.filter(apt => 
      isSameDay(new Date(apt.starts_at), date)
    );

    // Combine and sort by time
    const allItems = [
      ...daySlots.map(slot => ({ ...slot, type: 'slot' })),
      ...dayAppointments.map(apt => ({ ...apt, type: 'appointment' }))
    ].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    return allItems;
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Schedule</h1>
          <p className="text-muted-foreground">
            Manage appointments and available time slots
          </p>
        </div>
        <SlotGenerator 
          onSlotsGenerated={() => {
            queryClient.invalidateQueries({ queryKey: ['schedule'] });
          }} 
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold">
                Week of {format(weekStart, 'MMM d, yyyy')}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center space-x-4">
              <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  {providers?.map(provider => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations?.map(location => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-4">
        {weekDays.map((day) => {
          const timeSlots = getTimeSlots(day);
          const isToday = isSameDay(day, new Date());

          return (
            <Card key={day.toISOString()} className={isToday ? "ring-2 ring-primary" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-center">
                  {format(day, 'EEE')}
                  <br />
                  <span className="text-lg">{format(day, 'd')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {timeSlots.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No slots
                  </p>
                ) : (
                  timeSlots.map((item) => {
                    const isSlot = item.type === 'slot';
                    const isAppointment = item.type === 'appointment';
                    
                    return (
                      <div
                        key={item.id}
                        className={`p-2 rounded text-xs cursor-pointer transition-colors ${
                          isAppointment
                            ? 'bg-primary text-primary-foreground'
                            : isSlot && (item as any).status === 'open'
                            ? 'bg-muted hover:bg-muted/80 border border-dashed'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                        onClick={() => isSlot && handleSlotClick(item)}
                      >
                        <div className="font-medium">
                          {format(new Date(item.starts_at), 'h:mm a')}
                        </div>
                        {isAppointment ? (
                          <div>
                            {(item as any).patients?.full_name}
                            <br />
                            {(item as any).services?.name}
                          </div>
                        ) : (
                          <div>
                            {item.providers?.name}
                            <br />
                            <Badge variant="secondary" className="text-xs">
                              {(item as any).status}
                            </Badge>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Booking Dialog */}
      <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Book Appointment</DialogTitle>
          </DialogHeader>
          {selectedSlot && (
            <BookingInterface
              onAppointmentBooked={() => {
                setShowBookingDialog(false);
                setSelectedSlot(null);
                queryClient.invalidateQueries({ queryKey: ['schedule'] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {(!scheduleData?.slots?.length && !scheduleData?.appointments?.length) && (
        <EmptyState
          icon={<Calendar className="h-12 w-12 text-muted-foreground" />}
          title="No schedule data"
          description="Create some time slots to start scheduling appointments"
        />
      )}
    </div>
  );
}