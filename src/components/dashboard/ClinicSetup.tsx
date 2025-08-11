import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Trash2 } from 'lucide-react';

interface Clinic {
  id: string;
  name: string;
  main_phone: string;
  timezone: string;
}

interface Service {
  id: string;
  code: string;
  name: string;
  duration_min: number;
  is_new_patient: boolean;
}

interface Insurance {
  id: string;
  name: string;
  accepted: boolean;
}

export const ClinicSetup = () => {
  const { toast } = useToast();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form states
  const [clinicForm, setClinicForm] = useState({
    name: '',
    main_phone: '',
    timezone: 'America/New_York'
  });
  const [serviceForm, setServiceForm] = useState({
    code: '',
    name: '',
    duration_min: 60,
    is_new_patient: false
  });
  const [insuranceForm, setInsuranceForm] = useState({
    name: '',
    accepted: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's clinic
      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.clinic_id) {
        // Load clinic data
        const { data: clinicData } = await supabase
          .from('clinics')
          .select('*')
          .eq('id', profile.clinic_id)
          .maybeSingle();

        setClinic(clinicData);

        // Load services
        const { data: servicesData } = await supabase
          .from('services')
          .select('*')
          .eq('clinic_id', profile.clinic_id)
          .order('name');

        setServices(servicesData || []);

        // Load insurances
        const { data: insurancesData } = await supabase
          .from('insurances')
          .select('*')
          .eq('clinic_id', profile.clinic_id)
          .order('name');

        setInsurances(insurancesData || []);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load clinic data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('You must be logged in to create a clinic');
      }

      console.log('Auth user:', user.id);
      
      // Verify auth context before insert
      const { data: { user: authUser } } = await supabase.auth.getUser();
      console.log('creating clinic for uid:', authUser?.id);

      // Create clinic - the trigger will automatically link the user to the clinic
      console.log('Creating clinic with data:', clinicForm);
      const { data: newClinic, error: clinicError } = await supabase
        .from('clinics')
        .insert([clinicForm])
        .select()
        .single();

      if (clinicError) {
        console.error('Clinic creation error:', clinicError);
        throw new Error(`Failed to create clinic: ${clinicError.message}`);
      }

      console.log('Clinic created:', newClinic);
      setClinic(newClinic);
      
      toast({
        title: "Success",
        description: "Clinic created successfully!",
      });
    } catch (error) {
      console.error('Full error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create clinic';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const addService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinic) return;

    try {
      const { data, error } = await supabase
        .from('services')
        .insert([{ ...serviceForm, clinic_id: clinic.id }])
        .select()
        .single();

      if (error) throw error;

      setServices([...services, data]);
      setServiceForm({ code: '', name: '', duration_min: 60, is_new_patient: false });
      toast({
        title: "Success",
        description: "Service added successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add service",
        variant: "destructive",
      });
    }
  };

  const deleteService = async (id: string) => {
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setServices(services.filter(s => s.id !== id));
      toast({
        title: "Success",
        description: "Service deleted successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete service",
        variant: "destructive",
      });
    }
  };

  const addInsurance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinic) return;

    try {
      const { data, error } = await supabase
        .from('insurances')
        .insert([{ ...insuranceForm, clinic_id: clinic.id }])
        .select()
        .single();

      if (error) throw error;

      setInsurances([...insurances, data]);
      setInsuranceForm({ name: '', accepted: true });
      toast({
        title: "Success",
        description: "Insurance added successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add insurance",
        variant: "destructive",
      });
    }
  };

  const deleteInsurance = async (id: string) => {
    try {
      const { error } = await supabase
        .from('insurances')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setInsurances(insurances.filter(i => i.id !== id));
      toast({
        title: "Success",
        description: "Insurance deleted successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete insurance",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Create Your Clinic</CardTitle>
            <CardDescription>
              Set up your dental clinic to start using the Voice AI system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createClinic} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Clinic Name</Label>
                <Input
                  id="name"
                  value={clinicForm.name}
                  onChange={(e) => setClinicForm({ ...clinicForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Main Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={clinicForm.main_phone}
                  onChange={(e) => setClinicForm({ ...clinicForm, main_phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select 
                  value={clinicForm.timezone} 
                  onValueChange={(value) => setClinicForm({ ...clinicForm, timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Clinic
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{clinic.name}</h1>
        <p className="text-muted-foreground">{clinic.main_phone}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Services */}
        <Card>
          <CardHeader>
            <CardTitle>Services</CardTitle>
            <CardDescription>Manage your clinic's services</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={addService} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Code (e.g., CLEAN)"
                  value={serviceForm.code}
                  onChange={(e) => setServiceForm({ ...serviceForm, code: e.target.value })}
                />
                <Input
                  placeholder="Duration (min)"
                  type="number"
                  value={serviceForm.duration_min}
                  onChange={(e) => setServiceForm({ ...serviceForm, duration_min: parseInt(e.target.value) })}
                />
              </div>
              <Input
                placeholder="Service name"
                value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                required
              />
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="new-patient"
                  checked={serviceForm.is_new_patient}
                  onChange={(e) => setServiceForm({ ...serviceForm, is_new_patient: e.target.checked })}
                />
                <Label htmlFor="new-patient">New patient only</Label>
              </div>
              <Button type="submit" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </form>
            
            <div className="space-y-2">
              {services.map((service) => (
                <div key={service.id} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div>
                    <span className="font-medium">{service.name}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({service.duration_min}min)
                      {service.is_new_patient && ' - New patients only'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteService(service.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Insurances */}
        <Card>
          <CardHeader>
            <CardTitle>Insurance Plans</CardTitle>
            <CardDescription>Manage accepted insurance plans</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={addInsurance} className="space-y-3">
              <Input
                placeholder="Insurance name"
                value={insuranceForm.name}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, name: e.target.value })}
                required
              />
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="accepted"
                  checked={insuranceForm.accepted}
                  onChange={(e) => setInsuranceForm({ ...insuranceForm, accepted: e.target.checked })}
                />
                <Label htmlFor="accepted">Currently accepted</Label>
              </div>
              <Button type="submit" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Insurance
              </Button>
            </form>
            
            <div className="space-y-2">
              {insurances.map((insurance) => (
                <div key={insurance.id} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div>
                    <span className="font-medium">{insurance.name}</span>
                    <span className={`text-sm ml-2 ${
                      insurance.accepted ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {insurance.accepted ? 'Accepted' : 'Not accepted'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteInsurance(insurance.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};