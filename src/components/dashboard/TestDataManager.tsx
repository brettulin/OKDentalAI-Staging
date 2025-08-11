import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Database, Trash2, Plus, AlertCircle } from 'lucide-react';

interface SeedCounts {
  clinics: number;
  providers: number;
  locations: number;
  insurances: number;
  services: number;
  slots: number;
  patients: number;
}

export const TestDataManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [seedCounts, setSeedCounts] = useState<SeedCounts | null>(null);

  const checkExistingData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.clinic_id) return;

      // Count existing demo data
      const [
        { count: providersCount },
        { count: locationsCount },
        { count: insurancesCount },
        { count: servicesCount },
        { count: slotsCount },
        { count: patientsCount }
      ] = await Promise.all([
        supabase.from('providers').select('*', { count: 'exact', head: true }).eq('clinic_id', profile.clinic_id),
        supabase.from('locations').select('*', { count: 'exact', head: true }).eq('clinic_id', profile.clinic_id),
        supabase.from('insurances').select('*', { count: 'exact', head: true }).eq('clinic_id', profile.clinic_id),
        supabase.from('services').select('*', { count: 'exact', head: true }).eq('clinic_id', profile.clinic_id),
        supabase.from('slots').select('*', { count: 'exact', head: true }).eq('clinic_id', profile.clinic_id),
        supabase.from('patients').select('*', { count: 'exact', head: true }).eq('clinic_id', profile.clinic_id)
      ]);

      setSeedCounts({
        clinics: 1, // Always 1 if we have a profile
        providers: providersCount || 0,
        locations: locationsCount || 0,
        insurances: insurancesCount || 0,
        services: servicesCount || 0,
        slots: slotsCount || 0,
        patients: patientsCount || 0,
      });
    } catch (error) {
      console.error('Error checking existing data:', error);
    }
  };

  useEffect(() => {
    checkExistingData();
  }, []);

  const seedDemoData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.clinic_id) throw new Error('No clinic found');

      const clinicId = profile.clinic_id;
      let insertedCounts: SeedCounts = {
        clinics: 0,
        providers: 0,
        locations: 0,
        insurances: 0,
        services: 0,
        slots: 0,
        patients: 0,
      };

      // Insert providers
      const { data: providersData } = await supabase
        .from('providers')
        .upsert([
          { name: 'Dr. Sarah Johnson', specialty: 'General Dentistry', clinic_id: clinicId },
          { name: 'Dr. Michael Chen', specialty: 'Oral Surgery', clinic_id: clinicId }
        ], { onConflict: 'clinic_id,name' })
        .select();
      insertedCounts.providers = providersData?.length || 0;

      // Insert locations
      const { data: locationsData } = await supabase
        .from('locations')
        .upsert([
          {
            name: 'Main Office',
            address: '456 Dental Ave, Tooth City, NY 12345',
            phone: '(555) 123-4567',
            timezone: 'America/New_York',
            clinic_id: clinicId
          },
          {
            name: 'Satellite Office',
            address: '789 Smile Blvd, Tooth City, NY 12346',
            phone: '(555) 123-4568',
            timezone: 'America/New_York',
            clinic_id: clinicId
          }
        ], { onConflict: 'clinic_id,name' })
        .select();
      insertedCounts.locations = locationsData?.length || 0;

      // Insert insurances
      const { data: insurancesData } = await supabase
        .from('insurances')
        .upsert([
          { name: 'BlueCross BlueShield', accepted: true, clinic_id: clinicId },
          { name: 'Aetna', accepted: true, clinic_id: clinicId },
          { name: 'Cigna', accepted: false, clinic_id: clinicId },
          { name: 'UnitedHealthcare', accepted: false, clinic_id: clinicId }
        ], { onConflict: 'clinic_id,name' })
        .select();
      insertedCounts.insurances = insurancesData?.length || 0;

      // Insert services
      const { data: servicesData } = await supabase
        .from('services')
        .upsert([
          { name: 'Routine Cleaning', code: 'CLEAN', duration_min: 60, is_new_patient: false, clinic_id: clinicId },
          { name: 'New Patient Exam', code: 'EXAM', duration_min: 90, is_new_patient: true, clinic_id: clinicId },
          { name: 'Filling', code: 'FILL', duration_min: 45, is_new_patient: false, clinic_id: clinicId }
        ], { onConflict: 'clinic_id,name' })
        .select();
      insertedCounts.services = servicesData?.length || 0;

      // Insert patients
      const { data: patientsData } = await supabase
        .from('patients')
        .upsert([
          {
            full_name: 'John Doe',
            phone: '+1234567890',
            email: 'john.doe@example.com',
            dob: '1980-01-15',
            notes: 'Test patient - Demo data',
            clinic_id: clinicId
          },
          {
            full_name: 'Jane Smith',
            phone: '+1234567891', 
            email: 'jane.smith@example.com',
            dob: '1990-05-22',
            notes: 'Test patient - Demo data',
            clinic_id: clinicId
          },
          {
            full_name: 'Bob Wilson',
            phone: '+1234567892',
            email: 'bob.wilson@example.com',
            dob: '1975-12-10',
            notes: 'Test patient - Demo data',
            clinic_id: clinicId
          }
        ], { onConflict: 'clinic_id,phone' })
        .select();
      insertedCounts.patients = patientsData?.length || 0;

      // Insert slots for next 7 days
      if (providersData && locationsData) {
        const slots = [];
        const today = new Date();
        
        for (let day = 1; day <= 7; day++) {
          const date = new Date(today);
          date.setDate(today.getDate() + day);
          
          // Skip weekends
          if (date.getDay() === 0 || date.getDay() === 6) continue;
          
          for (let hour = 9; hour < 17; hour += 2) { // Every 2 hours
            for (const provider of providersData) {
              for (const location of locationsData) {
                const startTime = new Date(date);
                startTime.setHours(hour, 0, 0, 0);
                
                const endTime = new Date(startTime);
                endTime.setHours(hour + 1, 0, 0, 0);
                
                slots.push({
                  starts_at: startTime.toISOString(),
                  ends_at: endTime.toISOString(),
                  provider_id: provider.id,
                  location_id: location.id,
                  clinic_id: clinicId,
                  status: 'open'
                });
              }
            }
          }
        }

        if (slots.length > 0) {
          const { data: slotsData } = await supabase
            .from('slots')
            .insert(slots)
            .select();
          insertedCounts.slots = slotsData?.length || 0;
        }
      }

      // Log to audit log
      await supabase.from('audit_log').insert({
        action: 'seed_demo_data',
        actor: user.email || 'system',
        entity: 'test_data',
        clinic_id: clinicId,
        diff_json: insertedCounts as any
      });

      await checkExistingData(); // Refresh counts

      toast({
        title: "Demo Data Seeded",
        description: `Inserted: ${insertedCounts.providers} providers, ${insertedCounts.locations} locations, ${insertedCounts.insurances} insurances, ${insertedCounts.services} services, ${insertedCounts.slots} slots, ${insertedCounts.patients} patients`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to seed demo data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetDemoData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.clinic_id) throw new Error('No clinic found');

      const clinicId = profile.clinic_id;
      let deletedCounts: SeedCounts = {
        clinics: 0,
        providers: 0,
        locations: 0,
        insurances: 0,
        services: 0,
        slots: 0,
        patients: 0,
      };

      // Delete in correct order due to foreign key constraints
      const { count: slotsDeleted } = await supabase
        .from('slots')
        .delete()
        .eq('clinic_id', clinicId);
      deletedCounts.slots = slotsDeleted || 0;

      const { count: patientsDeleted } = await supabase
        .from('patients')
        .delete()
        .eq('clinic_id', clinicId)
        .ilike('notes', '%Demo data%');
      deletedCounts.patients = patientsDeleted || 0;

      const { count: servicesDeleted } = await supabase
        .from('services')
        .delete()
        .eq('clinic_id', clinicId);
      deletedCounts.services = servicesDeleted || 0;

      const { count: insurancesDeleted } = await supabase
        .from('insurances')
        .delete()
        .eq('clinic_id', clinicId);
      deletedCounts.insurances = insurancesDeleted || 0;

      const { count: locationsDeleted } = await supabase
        .from('locations')
        .delete()
        .eq('clinic_id', clinicId);
      deletedCounts.locations = locationsDeleted || 0;

      const { count: providersDeleted } = await supabase
        .from('providers')
        .delete()
        .eq('clinic_id', clinicId);
      deletedCounts.providers = providersDeleted || 0;

      // Log to audit log
      await supabase.from('audit_log').insert({
        action: 'reset_demo_data',
        actor: user.email || 'system',
        entity: 'test_data',
        clinic_id: clinicId,
        diff_json: deletedCounts as any
      });

      await checkExistingData(); // Refresh counts

      toast({
        title: "Demo Data Reset",
        description: `Deleted: ${deletedCounts.providers} providers, ${deletedCounts.locations} locations, ${deletedCounts.insurances} insurances, ${deletedCounts.services} services, ${deletedCounts.slots} slots, ${deletedCounts.patients} patients`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reset demo data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';

  if (!isTestMode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            Test Mode Disabled
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Test mode is not enabled. Set VITE_TEST_MODE=true to access test data management features.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Test Data Management</h2>
        <p className="text-muted-foreground">
          Seed demo data for testing or reset to clean state
        </p>
        <Badge variant="outline" className="mt-2">Test Mode Active</Badge>
      </div>

      {/* Current Data Counts */}
      {seedCounts && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Current Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>Providers: <Badge variant="secondary">{seedCounts.providers}</Badge></div>
              <div>Locations: <Badge variant="secondary">{seedCounts.locations}</Badge></div>
              <div>Services: <Badge variant="secondary">{seedCounts.services}</Badge></div>
              <div>Insurances: <Badge variant="secondary">{seedCounts.insurances}</Badge></div>
              <div>Patients: <Badge variant="secondary">{seedCounts.patients}</Badge></div>
              <div>Slots: <Badge variant="secondary">{seedCounts.slots}</Badge></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Seed Demo Data
            </CardTitle>
            <CardDescription>
              Insert sample data for testing: 2 providers, 2 locations, 4 insurances, 3 services, slots for next 7 days, 3 patients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={seedDemoData} disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Seed Demo Data
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Reset Demo Data
            </CardTitle>
            <CardDescription>
              Delete all demo data for this clinic to start fresh
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={resetDemoData} disabled={loading} variant="destructive" className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset Demo Data
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};