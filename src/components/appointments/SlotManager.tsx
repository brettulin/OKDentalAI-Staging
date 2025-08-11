import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Calendar, Clock, Trash2 } from 'lucide-react';
import { format, addDays, startOfDay, setHours, setMinutes } from 'date-fns';

interface SlotManagerProps {
  onSlotsUpdated?: () => void;
}

export function SlotManager({ onSlotsUpdated }: SlotManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [slotDuration, setSlotDuration] = useState('60');

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

  // Fetch existing slots for selected date and provider
  const { data: existingSlots } = useQuery({
    queryKey: ['slots', profile?.clinic_id, selectedProvider, selectedDate],
    queryFn: async () => {
      if (!profile?.clinic_id || !selectedProvider || !selectedDate) return [];
      
      const startOfSelectedDate = startOfDay(new Date(selectedDate));
      const endOfSelectedDate = new Date(startOfSelectedDate);
      endOfSelectedDate.setDate(endOfSelectedDate.getDate() + 1);
      
      const { data, error } = await supabase
        .from('slots')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .eq('provider_id', selectedProvider)
        .gte('starts_at', startOfSelectedDate.toISOString())
        .lt('starts_at', endOfSelectedDate.toISOString())
        .order('starts_at');
        
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id && !!selectedProvider && !!selectedDate,
  });

  // Create slots mutation
  const createSlotsMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.clinic_id || !selectedProvider || !selectedDate) {
        throw new Error('Missing required fields');
      }

      const duration = parseInt(slotDuration);
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      
      const selectedDay = new Date(selectedDate);
      const startDateTime = setMinutes(setHours(selectedDay, startHour), startMinute);
      const endDateTime = setMinutes(setHours(selectedDay, endHour), endMinute);
      
      const slots = [];
      let currentTime = new Date(startDateTime);
      
      while (currentTime < endDateTime) {
        const slotEnd = new Date(currentTime.getTime() + duration * 60000);
        
        slots.push({
          clinic_id: profile.clinic_id,
          provider_id: selectedProvider,
          location_id: selectedLocation || null,
          starts_at: currentTime.toISOString(),
          ends_at: slotEnd.toISOString(),
          status: 'open'
        });
        
        currentTime = new Date(slotEnd);
      }
      
      if (slots.length === 0) {
        throw new Error('No slots to create with current settings');
      }
      
      const { data, error } = await supabase
        .from('slots')
        .insert(slots)
        .select();
        
      if (error) throw error;
      return data;
    },
    onSuccess: (slots) => {
      toast({
        title: "Slots Created",
        description: `Created ${slots.length} appointment slots`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      onSlotsUpdated?.();
    },
    onError: (error) => {
      toast({
        title: "Failed to Create Slots",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    },
  });

  // Delete slot mutation
  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase
        .from('slots')
        .delete()
        .eq('id', slotId);
        
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Slot Deleted",
        description: "Appointment slot has been removed",
      });
      
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      onSlotsUpdated?.();
    },
    onError: (error) => {
      toast({
        title: "Failed to Delete Slot",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    },
  });

  const handleCreateSlots = () => {
    if (!selectedProvider || !selectedDate) {
      toast({
        title: "Missing Information",
        description: "Please select a provider and date",
        variant: "destructive",
      });
      return;
    }
    
    createSlotsMutation.mutate();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'booked': return 'bg-blue-100 text-blue-800';
      case 'held': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Time Slots
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="provider">Provider *</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers?.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            <div>
              <Label htmlFor="duration">Slot Duration (minutes)</Label>
              <Select value={slotDuration} onValueChange={setSlotDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                  <SelectItem value="90">90 minutes</SelectItem>
                  <SelectItem value="120">120 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={handleCreateSlots}
            disabled={!selectedProvider || !selectedDate || createSlotsMutation.isPending}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {createSlotsMutation.isPending ? 'Creating...' : 'Create Slots'}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Slots */}
      {selectedProvider && selectedDate && existingSlots && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Existing Slots for {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {existingSlots.length > 0 ? (
              <div className="space-y-2">
                {existingSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium">
                          {format(new Date(slot.starts_at), 'h:mm a')} - {format(new Date(slot.ends_at), 'h:mm a')}
                        </span>
                        <Badge 
                          className={`ml-2 ${getStatusColor(slot.status)}`}
                          variant="secondary"
                        >
                          {slot.status}
                        </Badge>
                      </div>
                    </div>
                    
                    {slot.status === 'open' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSlotMutation.mutate(slot.id)}
                        disabled={deleteSlotMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No slots created for this date</p>
                <p className="text-sm">Use the form above to create appointment slots</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
