import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addMinutes, startOfDay, isBefore, isAfter, set } from 'date-fns';
import { Calendar, Clock, Plus, MapPin, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface SlotGeneratorProps {
  onSlotsGenerated?: () => void;
}

export function SlotGenerator({ onSlotsGenerated }: SlotGeneratorProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '17:00',
    slotDuration: 30,
    providerId: '',
    locationId: ''
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

  // Fetch clinic hours for validation
  const { data: clinicHours } = useQuery({
    queryKey: ['clinic-hours', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from('clinic_hours')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .order('dow');
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  const generateSlotsMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.clinic_id || !formData.providerId) {
        throw new Error('Missing required fields');
      }

      const selectedDate = new Date(formData.date);
      const dayOfWeek = selectedDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Check if clinic is open on this day
      const dayHours = clinicHours?.find(h => h.dow === dayOfWeek);
      
      // Parse time strings to minutes from midnight
      const parseTime = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const startTimeMin = parseTime(formData.startTime);
      const endTimeMin = parseTime(formData.endTime);

      // Validate against clinic hours if available
      if (dayHours) {
        if (startTimeMin < dayHours.open_min || endTimeMin > dayHours.close_min) {
          throw new Error(`Selected time is outside clinic hours (${Math.floor(dayHours.open_min / 60)}:${(dayHours.open_min % 60).toString().padStart(2, '0')} - ${Math.floor(dayHours.close_min / 60)}:${(dayHours.close_min % 60).toString().padStart(2, '0')})`);
        }
      }

      // Validate time range
      if (startTimeMin >= endTimeMin) {
        throw new Error('End time must be after start time');
      }

      // Check for existing slots to prevent overlaps
      const startDateTime = set(selectedDate, {
        hours: Math.floor(startTimeMin / 60),
        minutes: startTimeMin % 60,
        seconds: 0,
        milliseconds: 0
      });
      
      const endDateTime = set(selectedDate, {
        hours: Math.floor(endTimeMin / 60),
        minutes: endTimeMin % 60,
        seconds: 0,
        milliseconds: 0
      });

      const { data: existingSlots } = await supabase
        .from('slots')
        .select('starts_at, ends_at')
        .eq('clinic_id', profile.clinic_id)
        .eq('provider_id', formData.providerId)
        .gte('starts_at', startDateTime.toISOString())
        .lt('starts_at', endDateTime.toISOString());

      if (existingSlots && existingSlots.length > 0) {
        throw new Error('Overlapping slots found for this provider and time range');
      }

      // Generate slots
      const slots = [];
      let currentTime = startTimeMin;

      while (currentTime + formData.slotDuration <= endTimeMin) {
        const slotStart = set(selectedDate, {
          hours: Math.floor(currentTime / 60),
          minutes: currentTime % 60,
          seconds: 0,
          milliseconds: 0
        });

        const slotEnd = addMinutes(slotStart, formData.slotDuration);

        slots.push({
          clinic_id: profile.clinic_id,
          provider_id: formData.providerId,
          location_id: formData.locationId || null,
          starts_at: slotStart.toISOString(),
          ends_at: slotEnd.toISOString(),
          status: 'open'
        });

        currentTime += formData.slotDuration;
      }

      if (slots.length === 0) {
        throw new Error('No slots could be generated with the selected parameters');
      }

      // Insert slots in transaction
      const { error } = await supabase
        .from('slots')
        .insert(slots);

      if (error) throw error;

      return slots;
    },
    onSuccess: (slots) => {
      toast.success(`Generated ${slots.length} time slots successfully`);
      setOpen(false);
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '09:00',
        endTime: '17:00',
        slotDuration: 30,
        providerId: '',
        locationId: ''
      });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      onSlotsGenerated?.();
    },
    onError: (error) => {
      toast.error(`Failed to generate slots: ${error.message}`);
    },
  });

  const handleGenerate = () => {
    generateSlotsMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Generate Slots
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Generate Time Slots
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div>
              <Label htmlFor="duration">Slot Duration (minutes) *</Label>
              <Select
                value={formData.slotDuration.toString()}
                onValueChange={(value) => setFormData(prev => ({ ...prev, slotDuration: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-time">Start Time *</Label>
              <Input
                id="start-time"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="end-time">End Time *</Label>
              <Input
                id="end-time"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Provider *
            </Label>
            <Select
              value={formData.providerId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, providerId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {providers?.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                    {provider.specialty && (
                      <span className="text-muted-foreground"> - {provider.specialty}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location (Optional)
            </Label>
            <Select
              value={formData.locationId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, locationId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No specific location</SelectItem>
                {locations?.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Show clinic hours info if available */}
          {clinicHours && clinicHours.length > 0 && (
            <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Clinic Hours:</p>
              {clinicHours.map((hours) => (
                <div key={hours.dow} className="flex justify-between">
                  <span>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][hours.dow]}</span>
                  <span>
                    {Math.floor(hours.open_min / 60)}:{(hours.open_min % 60).toString().padStart(2, '0')} - {Math.floor(hours.close_min / 60)}:{(hours.close_min % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!formData.providerId || !formData.date || generateSlotsMutation.isPending}
            className="w-full"
          >
            <Clock className="h-4 w-4 mr-2" />
            {generateSlotsMutation.isPending ? 'Generating...' : 'Generate Slots'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}