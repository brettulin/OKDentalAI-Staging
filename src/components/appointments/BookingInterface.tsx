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
import { Calendar, Clock, User, MapPin, Stethoscope, Plus, ExternalLink } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { PatientSelector } from '@/components/ui/patient-selector';

interface Patient {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
}

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
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [lastBookedAppointment, setLastBookedAppointment] = useState<any>(null);

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

  // Fetch available slots with proper filtering
  const { data: availableSlots } = useQuery({
    queryKey: ['available-slots', profile?.clinic_id, selectedProvider, selectedLocation],
    queryFn: async () => {
      if (!profile?.clinic_id || !selectedProvider) return [];
      
      const tomorrow = addDays(new Date(), 1);
      const weekLater = addDays(new Date(), 8);
      
      let query = supabase
        .from('slots')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .eq('provider_id', selectedProvider)
        .eq('status', 'open')
        .gte('starts_at', tomorrow.toISOString())
        .lte('starts_at', weekLater.toISOString());

      if (selectedLocation) {
        query = query.eq('location_id', selectedLocation);
      }
        
      const { data, error } = await query.order('starts_at');
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id && !!selectedProvider,
  });

  // Book appointment mutation
  const bookAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      if (!profile?.clinic_id) throw new Error('No clinic found');
      
      // Get patient ID (either selected or newly created)
      if (!selectedPatient) {
        throw new Error('No patient selected');
      }
      
      const patientId = selectedPatient.id;
      
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
          source: 'manual'
        })
        .select('*')
        .single();
        
      if (appointmentError) throw appointmentError;
      
      // Update slot status
      await supabase
        .from('slots')
        .update({ status: 'booked' })
        .eq('id', selectedSlot);

      // Sync with PMS (with retry logic)
      let syncStatus = 'pending';
      let externalRef = null;
      
      try {
        // Get office for PMS sync
        const { data: offices } = await supabase
          .from('offices')
          .select('id')
          .eq('clinic_id', profile.clinic_id)
          .limit(1);
          
        if (offices && offices.length > 0) {
          const { data: pmsResult } = await supabase.functions.invoke('pms-integrations', {
            body: {
              action: 'bookAppointment',
              officeId: offices[0].id,
              appointmentData: {
                patient_id: patientId,
                provider_id: selectedProvider,
                service_id: selectedService,
                starts_at: slot.starts_at,
                ends_at: slot.ends_at
              }
            }
          });
          
          if (pmsResult?.success) {
            syncStatus = 'synced';
            externalRef = pmsResult.data?.external_id || null;
          } else {
            syncStatus = 'failed';
          }
        }
      } catch (pmsError) {
        console.error('PMS sync failed:', pmsError);
        syncStatus = 'failed';
      }
      
      // Note: Sync status would be stored in a separate tracking table in production
      // For now, just log the sync attempt

      // Write audit log
      await supabase
        .from('audit_log')
        .insert({
          clinic_id: profile.clinic_id,
          entity: 'appointment',
          entity_id: appointment.id,
          action: 'appointment.booked',
          actor: 'ai_booking',
          diff_json: { 
            patient_name: selectedPatient.full_name,
            provider_id: selectedProvider,
            service_id: selectedService,
            slot_id: selectedSlot,
            sync_status: syncStatus
          }
        });
      
      return { ...appointment, sync_status: syncStatus };
    },
    onSuccess: (appointment) => {
      setLastBookedAppointment(appointment);
      toast({
        title: "Appointment Booked!",
        description: `Appointment scheduled for ${format(new Date(appointment.starts_at), 'PPP p')}`,
      });
      
      // Reset form
      setSelectedProvider('');
      setSelectedService('');
      setSelectedLocation('');
      setSelectedSlot('');
      setSelectedPatient(null);
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      
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

  const handlePatientCreate = async (patientData: { name: string; phone: string; email?: string }) => {
    if (!profile?.clinic_id) return;

    try {
      const { data: newPatient, error } = await supabase
        .from('patients')
        .insert({
          clinic_id: profile.clinic_id,
          full_name: patientData.name,
          phone: patientData.phone,
          email: patientData.email || null,
        })
        .select('id, full_name, phone, email')
        .single();

      if (error) throw error;
      
      setSelectedPatient(newPatient as Patient);
      toast({
        title: "Patient Created",
        description: `${newPatient.full_name} has been added to your patient database`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to create patient: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleBookAppointment = () => {
    if (!selectedProvider || !selectedService || !selectedSlot || !selectedPatient) {
      toast({
        title: "Missing Information",
        description: "Please select all required fields including a patient",
        variant: "destructive",
      });
      return;
    }
    
    bookAppointmentMutation.mutate({});
  };

  const isFormValid = selectedProvider && selectedService && selectedSlot && selectedPatient;

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
          {/* Success Message */}
          {lastBookedAppointment && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
              <h4 className="font-medium text-green-800">Appointment Successfully Booked!</h4>
              <p className="text-sm text-green-700">
                Appointment for {selectedPatient?.full_name} on {format(new Date(lastBookedAppointment.starts_at), 'PPP p')}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/patients/${selectedPatient?.id}`, '_blank')}
                  className="gap-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Patient
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLastBookedAppointment(null)}
                >
                  Book Another
                </Button>
              </div>
            </div>
          )}

          {/* Patient Selection */}
          <PatientSelector
            selectedPatient={selectedPatient}
            onPatientSelect={setSelectedPatient}
            onCreateNew={handlePatientCreate}
          />

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