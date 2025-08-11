import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Trash2, MapPin } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  address: string;
  phone: string;
  timezone: string;
  created_at: string;
}

export const LocationsSetup = () => {
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [locationForm, setLocationForm] = useState({
    name: '',
    address: '',
    phone: '',
    timezone: 'America/New_York'
  });

  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time' },
    { value: 'America/Chicago', label: 'Central Time' },
    { value: 'America/Denver', label: 'Mountain Time' },
    { value: 'America/Los_Angeles', label: 'Pacific Time' },
    { value: 'America/Phoenix', label: 'Arizona Time' },
    { value: 'America/Anchorage', label: 'Alaska Time' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time' }
  ];

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.clinic_id) return;

      const { data: locationsData } = await supabase
        .from('locations')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .order('name');

      setLocations(locationsData || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load locations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.clinic_id) throw new Error('No clinic found');

      const { data, error } = await supabase
        .from('locations')
        .insert([{
          ...locationForm,
          clinic_id: profile.clinic_id
        }])
        .select()
        .single();

      if (error) throw error;

      setLocations([...locations, data]);
      setLocationForm({
        name: '',
        address: '',
        phone: '',
        timezone: 'America/New_York'
      });

      toast({
        title: "Success",
        description: "Location added successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add location",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteLocation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setLocations(locations.filter(l => l.id !== id));
      toast({
        title: "Success",
        description: "Location deleted successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete location",
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Locations Setup</h2>
        <p className="text-muted-foreground">
          Manage your clinic locations and their contact information
        </p>
      </div>

      {/* Add Location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Location
          </CardTitle>
          <CardDescription>
            Add a new clinic location for appointments and services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createLocation} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="location-name">Location Name</Label>
              <Input
                id="location-name"
                placeholder="Main Office"
                value={locationForm.name}
                onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                placeholder="123 Main St, City, State, ZIP"
                value={locationForm.address}
                onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location-phone">Phone Number</Label>
              <Input
                id="location-phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={locationForm.phone}
                onChange={(e) => setLocationForm({ ...locationForm, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location-timezone">Timezone</Label>
              <Select 
                value={locationForm.timezone} 
                onValueChange={(value) => setLocationForm({ ...locationForm, timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Location
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Locations */}
      {locations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Your Locations ({locations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {locations.map((location) => (
              <div key={location.id} className="flex items-start justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{location.name}</h4>
                  {location.address && (
                    <p className="text-sm text-muted-foreground mt-1">{location.address}</p>
                  )}
                  {location.phone && (
                    <p className="text-sm text-muted-foreground">{location.phone}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Timezone: {timezones.find(tz => tz.value === location.timezone)?.label || location.timezone}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Added: {new Date(location.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteLocation(location.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {locations.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No locations yet</h3>
            <p className="text-muted-foreground">
              Add your first location to start managing appointments and services across different offices.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
