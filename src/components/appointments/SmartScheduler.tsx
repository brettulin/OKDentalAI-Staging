import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  Brain, 
  Clock, 
  Calendar as CalendarIcon, 
  Users, 
  MapPin,
  Sparkles,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { format, addDays, startOfDay, endOfDay } from 'date-fns';

interface OptimizedSlot {
  id: string;
  startTime: string;
  endTime: string;
  providerId: string;
  providerName: string;
  locationId: string;
  locationName: string;
  confidence: number;
  reasoning: string[];
  patientPreference: 'high' | 'medium' | 'low';
}

interface SchedulingPreferences {
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'any';
  preferredDayOfWeek: string[];
  urgency: 'routine' | 'urgent' | 'emergency';
  serviceType: string;
  providerId?: string;
  locationId?: string;
}

export function SmartScheduler() {
  const { toast } = useToast();
  const { profile } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [preferences, setPreferences] = useState<SchedulingPreferences>({
    preferredTimeOfDay: 'any',
    preferredDayOfWeek: [],
    urgency: 'routine',
    serviceType: '',
  });
  const [optimizedSlots, setOptimizedSlots] = useState<OptimizedSlot[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fetch providers and services for selection
  const { data: providers } = useQuery({
    queryKey: ['providers', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('clinic_id', profile.clinic_id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  const { data: services } = useQuery({
    queryKey: ['services', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('clinic_id', profile.clinic_id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];
      
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('clinic_id', profile.clinic_id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.clinic_id,
  });

  // AI-powered slot optimization
  const optimizeSlotsMutation = useMutation({
    mutationFn: async (params: {
      dateRange: { start: string; end: string };
      preferences: SchedulingPreferences;
    }) => {
      setIsAnalyzing(true);
      
      const { data, error } = await supabase.functions.invoke('ai-call-handler', {
        body: {
          type: 'optimize_appointment_slots',
          dateRange: params.dateRange,
          preferences: params.preferences,
          clinicId: profile?.clinic_id
        }
      });

      if (error) throw error;
      return data.optimizedSlots || [];
    },
    onSuccess: (slots) => {
      setOptimizedSlots(slots);
      toast({
        title: "AI Analysis Complete",
        description: `Found ${slots.length} optimized appointment slots based on your preferences.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Optimization Failed",
        description: `Could not optimize slots: ${error.message}`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsAnalyzing(false);
    },
  });

  const handleAnalyzeSlots = () => {
    if (!selectedDate) return;
    
    const dateRange = {
      start: format(startOfDay(selectedDate), 'yyyy-MM-dd HH:mm:ss'),
      end: format(endOfDay(addDays(selectedDate, 7)), 'yyyy-MM-dd HH:mm:ss') // Next 7 days
    };
    
    optimizeSlotsMutation.mutate({ dateRange, preferences });
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) return <Badge className="bg-green-500">Excellent Match</Badge>;
    if (confidence >= 75) return <Badge className="bg-blue-500">Good Match</Badge>;
    if (confidence >= 60) return <Badge className="bg-yellow-500">Fair Match</Badge>;
    return <Badge variant="secondary">Low Match</Badge>;
  };

  const getPreferenceBadge = (preference: string) => {
    const colors = {
      high: 'bg-green-500',
      medium: 'bg-blue-500',
      low: 'bg-gray-500'
    };
    return <Badge className={colors[preference as keyof typeof colors]}>{preference} preference</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI-Powered Smart Scheduler
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              This AI scheduler analyzes patient preferences, provider availability, and historical patterns 
              to suggest optimal appointment slots.
            </AlertDescription>
          </Alert>

          {/* Date Selection */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-base font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Starting Date
                </Label>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border"
                  disabled={(date) => date < new Date()}
                />
              </div>
            </div>

            {/* Preferences Panel */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Scheduling Preferences</Label>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Service Type</Label>
                  <Select
                    value={preferences.serviceType}
                    onValueChange={(value) => setPreferences(prev => ({ ...prev, serviceType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                    <SelectContent>
                      {services?.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} ({service.duration_min} min)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Preferred Time of Day</Label>
                  <Select
                    value={preferences.preferredTimeOfDay}
                    onValueChange={(value: any) => setPreferences(prev => ({ ...prev, preferredTimeOfDay: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any Time</SelectItem>
                      <SelectItem value="morning">Morning (8 AM - 12 PM)</SelectItem>
                      <SelectItem value="afternoon">Afternoon (12 PM - 5 PM)</SelectItem>
                      <SelectItem value="evening">Evening (5 PM - 8 PM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Urgency Level</Label>
                  <Select
                    value={preferences.urgency}
                    onValueChange={(value: any) => setPreferences(prev => ({ ...prev, urgency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="routine">Routine</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Preferred Provider (Optional)</Label>
                  <Select
                    value={preferences.providerId || ''}
                    onValueChange={(value) => setPreferences(prev => ({ ...prev, providerId: value || undefined }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any Provider</SelectItem>
                      {providers?.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name} - {provider.specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Preferred Location (Optional)</Label>
                  <Select
                    value={preferences.locationId || ''}
                    onValueChange={(value) => setPreferences(prev => ({ ...prev, locationId: value || undefined }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any Location</SelectItem>
                      {locations?.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleAnalyzeSlots}
                disabled={!selectedDate || !preferences.serviceType || isAnalyzing}
                className="w-full flex items-center gap-2"
              >
                <Brain className="h-4 w-4" />
                {isAnalyzing ? 'Analyzing Optimal Slots...' : 'Find Optimal Appointments'}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Optimized Slots Results */}
          {optimizedSlots.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <Label className="text-base font-medium">AI-Optimized Appointment Slots</Label>
                <Badge variant="outline">{optimizedSlots.length} slots found</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {optimizedSlots.map((slot) => (
                  <Card key={slot.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span className="font-medium">
                            {format(new Date(slot.startTime), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        {getConfidenceBadge(slot.confidence)}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3" />
                          <span>{slot.providerName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3" />
                          <span>{slot.locationName}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {getPreferenceBadge(slot.patientPreference)}
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">AI Reasoning:</Label>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {slot.reasoning.slice(0, 2).map((reason, index) => (
                            <li key={index} className="flex items-start gap-1">
                              <span className="text-primary">•</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Button size="sm" className="w-full">
                        Book This Slot
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="text-center py-8">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>AI is analyzing optimal appointment slots...</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}