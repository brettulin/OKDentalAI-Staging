import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, User, MapPin, Stethoscope, Plus } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface BookingInterfaceProps {
  onAppointmentBooked?: (appointment: any) => void;
}

export function BookingInterface({ onAppointmentBooked }: BookingInterfaceProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [patientInfo, setPatientInfo] = useState({
    name: '',
    phone: '',
    email: '',
    isNewPatient: false
  });

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

  // Fetch services
  const { data: services } = useQuery({
    queryKey: ['services', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      const { data, error } = await supabase
        .from('services')
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

  // Fetch available slots
  const { data: availableSlots } = useQuery({
    queryKey: ['slots', profile?.clinic_id, selectedProvider, selectedLocation],
    queryFn: async () => {
      if (!profile?.clinic_id || !selectedProvider) return [];
      
      const tomorrow = addDays(new Date(), 1);
      const weekLater = addDays(new Date(), 8);
      
      const { data, error } = await supabase
        .from('slots')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .eq('provider_id', selectedProvider)
        .eq('status', 'open')
        .gte('starts_at', tomorrow.toISOString())
        .lte('starts_at', weekLater.toISOString())
        .order('starts_at');
        
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id && !!selectedProvider,
  });

  // Book appointment mutation
  const bookAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      if (!profile?.clinic_id) throw new Error('No clinic found');
      
      // First, find or create patient
      let patientId = null;
      
      // Check if patient exists
      const { data: existingPatient } = await supabase
        .from('patients')
        .select('id')
        .eq('clinic_id', profile.clinic_id)
        .eq('phone', patientInfo.phone)
        .maybeSingle();
      
      if (existingPatient) {
        patientId = existingPatient.id;
      } else {
        // Create new patient
        const { data: newPatient, error: patientError } = await supabase
          .from('patients')
          .insert({
            clinic_id: profile.clinic_id,
            full_name: patientInfo.name,
            phone: patientInfo.phone,
            email: patientInfo.email || null,
          })
          .select('id')
          .single();
          
        if (patientError) throw patientError;
        patientId = newPatient.id;
      }
      
      // Get slot details
      const { data: slot, error: slotError } = await supabase
        .from('slots')
        .select('*')
        .eq('id', selectedSlot)
        .single();
        
      if (slotError) throw slotError;
      
      // Create appointment
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          clinic_id: profile.clinic_id,
          patient_id: patientId,
          provider_id: selectedProvider,
          service_id: selectedService,
          location_id: selectedLocation || null,
          starts_at: slot.starts_at,
          ends_at: slot.ends_at,
          source: 'ai_booking'
        })
        .select('*')
        .single();
        
      if (appointmentError) throw appointmentError;
      
      // Update slot status
      await supabase
        .from('slots')
        .update({ status: 'booked' })
        .eq('id', selectedSlot);
      
      return appointment;
    },
    onSuccess: (appointment) => {
      toast({
        title: "Appointment Booked!",
        description: `Appointment scheduled for ${format(new Date(appointment.starts_at), 'PPP p')}`,
      });
      
      // Reset form
      setSelectedProvider('');
      setSelectedService('');
      setSelectedLocation('');
      setSelectedSlot('');
      setPatientInfo({ name: '', phone: '', email: '', isNewPatient: false });
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      
      // Notify parent component
      onAppointmentBooked?.(appointment);
    },
    onError: (error) => {
      toast({
        title: "Booking Failed",
        description: error instanceof Error ? error.message : 'Failed to book appointment',
        variant: "destructive",
      });
    },
  });

  const handleBookAppointment = () => {
    if (!selectedProvider || !selectedService || !selectedSlot || !patientInfo.name || !patientInfo.phone) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    bookAppointmentMutation.mutate({});
  };

  const isFormValid = selectedProvider && selectedService && selectedSlot && patientInfo.name && patientInfo.phone;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Book Appointment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Patient Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4" />
              <Label className="text-sm font-medium">Patient Information</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={patientInfo.name}
                  onChange={(e) => setPatientInfo(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter patient name"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  value={patientInfo.phone}
                  onChange={(e) => setPatientInfo(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={patientInfo.email}
                  onChange={(e) => setPatientInfo(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="patient@example.com"
                />
              </div>
            </div>
          </div>

          {/* Provider Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              <Label>Select Provider *</Label>
            </div>
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a provider" />
              </SelectTrigger>
              <SelectContent>
                {providers?.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    <div className="flex flex-col">
                      <span>{provider.name}</span>
                      {provider.specialty && (
                        <span className="text-xs text-muted-foreground">{provider.specialty}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service Selection */}
          <div className="space-y-3">
            <Label>Select Service *</Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a service" />
              </SelectTrigger>
              <SelectContent>
                {services?.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    <div className="flex flex-col">
                      <span>{service.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {service.duration_min} minutes
                        {service.code && ` • ${service.code}`}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <Label>Select Location</Label>
            </div>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a location" />
              </SelectTrigger>
              <SelectContent>
                {locations?.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    <div className="flex flex-col">
                      <span>{location.name}</span>
                      {location.address && (
                        <span className="text-xs text-muted-foreground">{location.address}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Slot Selection */}
          {selectedProvider && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <Label>Available Time Slots *</Label>
              </div>
              {availableSlots && availableSlots.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot.id}
                      variant={selectedSlot === slot.id ? "default" : "outline"}
                      className="justify-start h-auto p-3"
                      onClick={() => setSelectedSlot(slot.id)}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">
                          {format(new Date(slot.starts_at), 'EEEE, MMM d')}
                        </span>
                        <span className="text-sm">
                          {format(new Date(slot.starts_at), 'h:mm a')}
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No available slots for the selected provider</p>
                  <p className="text-sm">Try selecting a different provider or contact the office</p>
                </div>
              )}
            </div>
          )}

          {/* Book Button */}
          <div className="pt-4">
            <Button 
              onClick={handleBookAppointment}
              disabled={!isFormValid || bookAppointmentMutation.isPending}
              className="w-full"
              size="lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              {bookAppointmentMutation.isPending ? 'Booking...' : 'Book Appointment'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}