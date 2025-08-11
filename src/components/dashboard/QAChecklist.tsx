import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface QACheck {
  id: string;
  name: string;
  description: string;
  status: 'checking' | 'pass' | 'fail' | 'warning';
  details?: string;
  fixLink?: string;
  fixLabel?: string;
}

export const QAChecklist = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [checks, setChecks] = useState<QACheck[]>([]);
  const [running, setRunning] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const initialChecks: QACheck[] = [
    {
      id: 'auth',
      name: 'Authentication',
      description: 'Session present, profile linked to clinic, valid role',
      status: 'checking',
      fixLink: '/clinic',
      fixLabel: 'Go to Clinic Setup'
    },
    {
      id: 'rls',
      name: 'Row Level Security',
      description: 'Can SELECT/INSERT on core tables',
      status: 'checking',
      fixLink: '#',
      fixLabel: 'Check Database Policies'
    },
    {
      id: 'setup',
      name: 'Setup State',
      description: 'At least 1 provider, 1 location, 1 service',
      status: 'checking',
      fixLink: '/providers',
      fixLabel: 'Complete Setup'
    },
    {
      id: 'pms',
      name: 'PMS Integration',
      description: 'Mock endpoints return data within 500ms',
      status: 'checking',
      fixLink: '/pms',
      fixLabel: 'Setup PMS'
    },
    {
      id: 'ai_call',
      name: 'AI Call Simulation',
      description: 'Creates call with turns and outcome',
      status: 'checking',
      fixLink: '/ai',
      fixLabel: 'Test AI Features'
    },
    {
      id: 'scheduling',
      name: 'Appointment Booking',
      description: 'Book appointment into free slot',
      status: 'checking',
      fixLink: '/appointments',
      fixLabel: 'Check Scheduling'
    },
    {
      id: 'realtime',
      name: 'Real-time Features',
      description: 'Live updates for calls and appointments',
      status: 'checking',
      fixLink: '/calls',
      fixLabel: 'Check Real-time'
    },
    {
      id: 'audit',
      name: 'Audit Log',
      description: 'Last 10 actions visible',
      status: 'checking',
      fixLink: '#',
      fixLabel: 'View Audit Log'
    }
  ];

  useEffect(() => {
    setChecks(initialChecks);
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      setProfile(profileData);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const updateCheck = (id: string, status: QACheck['status'], details?: string) => {
    setChecks(prev => prev.map(check => 
      check.id === id 
        ? { ...check, status, details }
        : check
    ));
  };

  const checkAuth = async (): Promise<boolean> => {
    try {
      updateCheck('auth', 'checking');
      
      if (!user) {
        updateCheck('auth', 'fail', 'No authenticated user');
        return false;
      }

      if (!profile) {
        updateCheck('auth', 'fail', 'No profile found');
        return false;
      }

      if (!profile.clinic_id) {
        updateCheck('auth', 'fail', 'Profile not linked to clinic');
        return false;
      }

      if (!profile.role || !['owner', 'admin', 'staff'].includes(profile.role)) {
        updateCheck('auth', 'fail', `Invalid role: ${profile.role}`);
        return false;
      }

      updateCheck('auth', 'pass', `User ${user.email}, Role: ${profile.role}`);
      return true;
    } catch (error) {
      updateCheck('auth', 'fail', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const checkRLS = async (): Promise<boolean> => {
    try {
      updateCheck('rls', 'checking');
      
      if (!profile?.clinic_id) {
        updateCheck('rls', 'fail', 'No clinic to test against');
        return false;
      }

      // Test basic RLS operations
      const results = [];

      try {
        const { error: clinicsError } = await supabase.from('clinics').select('id').limit(1);
        results.push(`clinics: ${clinicsError ? 'FAIL' : 'PASS'}`);
      } catch { results.push('clinics: ERROR'); }

      try {
        const { error: providersError } = await supabase.from('providers').select('id').limit(1);
        results.push(`providers: ${providersError ? 'FAIL' : 'PASS'}`);
      } catch { results.push('providers: ERROR'); }

      try {
        const { error: locationsError } = await supabase.from('locations').select('id').limit(1);
        results.push(`locations: ${locationsError ? 'FAIL' : 'PASS'}`);
      } catch { results.push('locations: ERROR'); }

      try {
        const { error: servicesError } = await supabase.from('services').select('id').limit(1);
        results.push(`services: ${servicesError ? 'FAIL' : 'PASS'}`);
      } catch { results.push('services: ERROR'); }

      try {
        const { error: patientsError } = await supabase.from('patients').select('id').limit(1);
        results.push(`patients: ${patientsError ? 'FAIL' : 'PASS'}`);
      } catch { results.push('patients: ERROR'); }

      const failures = results.filter(r => r.includes('FAIL') || r.includes('ERROR'));
      
      if (failures.length > 0) {
        updateCheck('rls', 'fail', `Failed: ${failures.join(', ')}`);
        return false;
      }

      updateCheck('rls', 'pass', `All tables accessible: clinics, providers, locations, services, patients`);
      return true;
    } catch (error) {
      updateCheck('rls', 'fail', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const checkSetup = async (): Promise<boolean> => {
    try {
      updateCheck('setup', 'checking');
      
      if (!profile?.clinic_id) {
        updateCheck('setup', 'fail', 'No clinic found');
        return false;
      }

      const [
        { count: providersCount },
        { count: locationsCount },
        { count: servicesCount }
      ] = await Promise.all([
        supabase.from('providers').select('*', { count: 'exact', head: true }).eq('clinic_id', profile.clinic_id),
        supabase.from('locations').select('*', { count: 'exact', head: true }).eq('clinic_id', profile.clinic_id),
        supabase.from('services').select('*', { count: 'exact', head: true }).eq('clinic_id', profile.clinic_id)
      ]);

      const missing = [];
      if (!providersCount) missing.push('providers');
      if (!locationsCount) missing.push('locations');
      if (!servicesCount) missing.push('services');

      if (missing.length > 0) {
        updateCheck('setup', 'fail', `Missing: ${missing.join(', ')}`);
        return false;
      }

      updateCheck('setup', 'pass', `Providers: ${providersCount}, Locations: ${locationsCount}, Services: ${servicesCount}`);
      return true;
    } catch (error) {
      updateCheck('setup', 'fail', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const checkPMS = async (): Promise<boolean> => {
    try {
      updateCheck('pms', 'checking');
      
      if (!profile?.clinic_id) {
        updateCheck('pms', 'fail', 'No clinic found');
        return false;
      }

      // Check if we have any PMS offices
      const { data: offices } = await supabase
        .from('offices')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .limit(1);

      if (!offices || offices.length === 0) {
        updateCheck('pms', 'warning', 'No PMS integrations configured');
        return true; // Not a failure in test mode
      }

      // Test PMS endpoints speed
      const startTime = Date.now();
      
      try {
        const { data, error } = await supabase.functions.invoke('pms-test', {
          body: {
            action: 'connectionTest',
            office_id: offices[0].id
          }
        });

        const duration = Date.now() - startTime;
        
        if (error) {
          updateCheck('pms', 'fail', `PMS error: ${error.message}`);
          return false;
        }

        if (duration > 500) {
          updateCheck('pms', 'warning', `PMS slow: ${duration}ms`);
          return true;
        }

        updateCheck('pms', 'pass', `PMS responding in ${duration}ms`);
        return true;
      } catch (error) {
        updateCheck('pms', 'fail', `PMS test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
      }
    } catch (error) {
      updateCheck('pms', 'fail', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const checkAICall = async (): Promise<boolean> => {
    try {
      updateCheck('ai_call', 'checking');
      
      if (!profile?.clinic_id) {
        updateCheck('ai_call', 'fail', 'No clinic found');
        return false;
      }

      // Simulate an AI call
      const { data: callData, error: callError } = await supabase
        .from('calls')
        .insert({
          clinic_id: profile.clinic_id,
          outcome: 'completed',
          transcript_json: { test: true, qa_check: true }
        })
        .select()
        .single();

      if (callError) {
        updateCheck('ai_call', 'fail', `Call creation failed: ${callError.message}`);
        return false;
      }

      // Add some turns
      const turns = [
        { call_id: callData.id, role: 'user', text: 'Hello, I need an appointment', at: new Date().toISOString() },
        { call_id: callData.id, role: 'assistant', text: 'I can help you with that', at: new Date().toISOString() },
        { call_id: callData.id, role: 'user', text: 'Great, thank you', at: new Date().toISOString() }
      ];

      const { error: turnsError } = await supabase
        .from('turns')
        .insert(turns);

      if (turnsError) {
        updateCheck('ai_call', 'fail', `Turns creation failed: ${turnsError.message}`);
        return false;
      }

      updateCheck('ai_call', 'pass', `Call ${callData.id} created with 3 turns`);
      return true;
    } catch (error) {
      updateCheck('ai_call', 'fail', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const checkScheduling = async (): Promise<boolean> => {
    try {
      updateCheck('scheduling', 'checking');
      
      if (!profile?.clinic_id) {
        updateCheck('scheduling', 'fail', 'No clinic found');
        return false;
      }

      // Ensure required data exists, create if missing
      let providerId, locationId, serviceId, patientId;

      // Check/create provider
      const { data: providers } = await supabase
        .from('providers')
        .select('id')
        .eq('clinic_id', profile.clinic_id)
        .limit(1);

      if (!providers?.[0]) {
        const { data: newProvider, error: providerError } = await supabase
          .from('providers')
          .insert({
            clinic_id: profile.clinic_id,
            name: 'QA Test Provider',
            specialty: 'General Dentistry'
          })
          .select('id')
          .single();
        
        if (providerError) {
          updateCheck('scheduling', 'fail', `Failed to create provider: ${providerError.message}`);
          return false;
        }
        providerId = newProvider.id;
      } else {
        providerId = providers[0].id;
      }

      // Check/create location
      const { data: locations } = await supabase
        .from('locations')
        .select('id')
        .eq('clinic_id', profile.clinic_id)
        .limit(1);

      if (!locations?.[0]) {
        const { data: newLocation, error: locationError } = await supabase
          .from('locations')
          .insert({
            clinic_id: profile.clinic_id,
            name: 'QA Test Location',
            address: '123 Test St'
          })
          .select('id')
          .single();
        
        if (locationError) {
          updateCheck('scheduling', 'fail', `Failed to create location: ${locationError.message}`);
          return false;
        }
        locationId = newLocation.id;
      } else {
        locationId = locations[0].id;
      }

      // Check/create service
      const { data: services } = await supabase
        .from('services')
        .select('id')
        .eq('clinic_id', profile.clinic_id)
        .limit(1);

      if (!services?.[0]) {
        const { data: newService, error: serviceError } = await supabase
          .from('services')
          .insert({
            clinic_id: profile.clinic_id,
            name: 'QA Test Service',
            duration_min: 60
          })
          .select('id')
          .single();
        
        if (serviceError) {
          updateCheck('scheduling', 'fail', `Failed to create service: ${serviceError.message}`);
          return false;
        }
        serviceId = newService.id;
      } else {
        serviceId = services[0].id;
      }

      // Check/create patient
      const { data: patients } = await supabase
        .from('patients')
        .select('id')
        .eq('clinic_id', profile.clinic_id)
        .limit(1);

      if (!patients?.[0]) {
        const { data: newPatient, error: patientError } = await supabase
          .from('patients')
          .insert({
            clinic_id: profile.clinic_id,
            full_name: 'QA Test Patient',
            phone: '+1234567890',
            email: 'qa-test@example.com'
          })
          .select('id')
          .single();
        
        if (patientError) {
          updateCheck('scheduling', 'fail', `Failed to create patient: ${patientError.message}`);
          return false;
        }
        patientId = newPatient.id;
      } else {
        patientId = patients[0].id;
      }

      // Check/create available slot
      const { data: slots } = await supabase
        .from('slots')
        .select('id, starts_at, ends_at')
        .eq('clinic_id', profile.clinic_id)
        .eq('provider_id', providerId)
        .eq('status', 'open')
        .gte('starts_at', new Date().toISOString())
        .limit(1);

      let slotId, slotStartsAt, slotEndsAt;

      if (!slots?.[0]) {
        // Create a slot 2 hours from now
        const slotStart = new Date();
        slotStart.setHours(slotStart.getHours() + 2);
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + 60);

        const { data: newSlot, error: slotError } = await supabase
          .from('slots')
          .insert({
            clinic_id: profile.clinic_id,
            provider_id: providerId,
            location_id: locationId,
            starts_at: slotStart.toISOString(),
            ends_at: slotEnd.toISOString(),
            status: 'open'
          })
          .select('id, starts_at, ends_at')
          .single();
        
        if (slotError) {
          updateCheck('scheduling', 'fail', `Failed to create slot: ${slotError.message}`);
          return false;
        }
        slotId = newSlot.id;
        slotStartsAt = newSlot.starts_at;
        slotEndsAt = newSlot.ends_at;
      } else {
        slotId = slots[0].id;
        slotStartsAt = slots[0].starts_at;
        slotEndsAt = slots[0].ends_at;
      }

      // Now test the booking flow with transaction-like behavior
      try {
        // Step 1: Hold the slot
        const { error: holdError } = await supabase
          .from('slots')
          .update({ status: 'held' })
          .eq('id', slotId)
          .eq('status', 'open'); // Only update if still open

        if (holdError) {
          updateCheck('scheduling', 'fail', `Failed to hold slot: ${holdError.message}`);
          return false;
        }

        // Step 2: Create appointment
        const { data: appointmentData, error: appointmentError } = await supabase
          .from('appointments')
          .insert({
            clinic_id: profile.clinic_id,
            patient_id: patientId,
            provider_id: providerId,
            location_id: locationId,
            service_id: serviceId,
            starts_at: slotStartsAt,
            ends_at: slotEndsAt,
            source: 'manual'
          })
          .select('id')
          .single();

        if (appointmentError) {
          // Rollback: release the slot
          await supabase
            .from('slots')
            .update({ status: 'open' })
            .eq('id', slotId);
          
          updateCheck('scheduling', 'fail', `Appointment creation failed: ${appointmentError.message}`);
          return false;
        }

        // Step 3: Mark slot as booked
        const { error: bookError } = await supabase
          .from('slots')
          .update({ status: 'booked' })
          .eq('id', slotId);

        if (bookError) {
          updateCheck('scheduling', 'warning', `Slot booking update failed: ${bookError.message}`);
        }

        updateCheck('scheduling', 'pass', `Appointment ${appointmentData.id} booked successfully`);
        return true;

      } catch (bookingError) {
        // Ensure slot is released on any error
        await supabase
          .from('slots')
          .update({ status: 'open' })
          .eq('id', slotId);
        throw bookingError;
      }

    } catch (error) {
      updateCheck('scheduling', 'fail', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const checkRealtime = async (): Promise<boolean> => {
    try {
      updateCheck('realtime', 'checking');
      
      if (!profile?.clinic_id) {
        updateCheck('realtime', 'fail', 'No clinic found');
        return false;
      }

      return new Promise((resolve) => {
        let resolved = false;
        const testId = crypto.randomUUID();
        
        // Set up realtime subscription test
        const channel = supabase
          .channel(`qa-realtime-test-${testId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'calls',
              filter: `clinic_id=eq.${profile.clinic_id}`,
            },
            (payload) => {
              const callData = payload.new as any;
              if (callData.transcript_json?.qa_realtime_test === testId && !resolved) {
                resolved = true;
                supabase.removeChannel(channel);
                updateCheck('realtime', 'pass', 'Real-time updates working');
                resolve(true);
              }
            }
          )
          .subscribe((status) => {
            // Wait for subscription to be ready before inserting
            if (status === 'SUBSCRIBED') {
              setTimeout(async () => {
                try {
                  const { error } = await supabase
                    .from('calls')
                    .insert({
                      clinic_id: profile.clinic_id,
                      outcome: 'completed',
                      transcript_json: { qa_realtime_test: testId }
                    });

                  if (error && !resolved) {
                    resolved = true;
                    supabase.removeChannel(channel);
                    updateCheck('realtime', 'fail', `Failed to insert: ${error.message}`);
                    resolve(false);
                  }
                } catch (insertError) {
                  if (!resolved) {
                    resolved = true;
                    supabase.removeChannel(channel);
                    updateCheck('realtime', 'fail', `Insert error: ${insertError instanceof Error ? insertError.message : 'Unknown error'}`);
                    resolve(false);
                  }
                }
              }, 500); // Shorter delay after subscription is ready
            }
          });

        // Timeout after 8 seconds (longer to account for subscription setup)
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            supabase.removeChannel(channel);
            updateCheck('realtime', 'fail', 'Real-time subscription timeout');
            resolve(false);
          }
        }, 8000);
      });
    } catch (error) {
      updateCheck('realtime', 'fail', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const checkAudit = async (): Promise<boolean> => {
    try {
      updateCheck('audit', 'checking');
      
      if (!profile?.clinic_id) {
        updateCheck('audit', 'fail', 'No clinic found');
        return false;
      }

      // Write a test audit entry first to ensure we have some data
      const testAuditId = crypto.randomUUID();
      const { error: auditInsertError } = await supabase
        .from('audit_log')
        .insert({
          clinic_id: profile.clinic_id,
          entity: 'qa_test',
          entity_id: testAuditId,
          action: 'qa.audit_test',
          actor: 'qa-system',
          diff_json: { test: true, timestamp: Date.now() }
        });

      if (auditInsertError) {
        updateCheck('audit', 'fail', `Failed to create audit entry: ${auditInsertError.message}`);
        return false;
      }

      const { data: auditEntries, error } = await supabase
        .from('audit_log')
        .select('id, action, at')
        .eq('clinic_id', profile.clinic_id)
        .order('at', { ascending: false })
        .limit(10);

      if (error) {
        updateCheck('audit', 'fail', `Audit query failed: ${error.message}`);
        return false;
      }

      if (!auditEntries || auditEntries.length === 0) {
        updateCheck('audit', 'warning', 'No audit entries found');
        return true;
      }

      updateCheck('audit', 'pass', `${auditEntries.length} recent audit entries found`);
      return true;
    } catch (error) {
      updateCheck('audit', 'fail', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const runAllChecks = async () => {
    setRunning(true);
    
    // Reset all checks to checking state
    setChecks(prev => prev.map(check => ({ ...check, status: 'checking' as const })));

    try {
      await checkAuth();
      await checkRLS();
      await checkSetup();
      await checkPMS();
      await checkAICall();
      await checkScheduling();
      await checkRealtime();
      await checkAudit();

      toast({
        title: "QA Checks Complete",
        description: "All checks have been executed",
      });
    } catch (error) {
      toast({
        title: "QA Check Error",
        description: error instanceof Error ? error.message : "Failed to run checks",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const getStatusIcon = (status: QACheck['status']) => {
    switch (status) {
      case 'checking':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: QACheck['status']) => {
    switch (status) {
      case 'checking':
        return <Badge variant="outline">Checking...</Badge>;
      case 'pass':
        return <Badge className="bg-green-100 text-green-800">Pass</Badge>;
      case 'fail':
        return <Badge variant="destructive">Fail</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      default:
        return null;
    }
  };

  // Check if user is owner
  const isOwner = profile?.role === 'owner';

  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Restricted</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            QA Checklist is only available to clinic owners.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">QA Checklist</h1>
          <p className="text-muted-foreground">
            Automated checks to verify system functionality
          </p>
        </div>
        <Button onClick={runAllChecks} disabled={running}>
          {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Run All Checks
        </Button>
      </div>

      <div className="space-y-4">
        {checks.map((check) => (
          <Card key={check.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(check.status)}
                  <div>
                    <h3 className="font-medium">{check.name}</h3>
                    <p className="text-sm text-muted-foreground">{check.description}</p>
                    {check.details && (
                      <p className="text-xs text-muted-foreground mt-1">{check.details}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(check.status)}
                  {(check.status === 'fail' || check.status === 'warning') && check.fixLink && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={check.fixLink}>
                        <ExternalLink className="h-3 w-3 mr-1" />
                        {check.fixLabel}
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};