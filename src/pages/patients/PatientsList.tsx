import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, Users, Phone, Mail, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";

export default function PatientsList() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const { searchTerm, setSearchTerm, debouncedValue, isDebouncing } = useDebouncedSearch(initialSearch);

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients', profile?.clinic_id, debouncedValue],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];

      let query = supabase
        .from('patients')
        .select(`
          *,
          appointments(
            id,
            starts_at,
            ends_at,
            services(name)
          )
        `)
        .eq('clinic_id', profile.clinic_id)
        .order('full_name');

      if (debouncedValue) {
        query = query.or(`full_name.ilike.%${debouncedValue}%,phone.ilike.%${debouncedValue}%,email.ilike.%${debouncedValue}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  // Update URL with search params
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (value) {
      searchParams.set('search', value);
    } else {
      searchParams.delete('search');
    }
    setSearchParams(searchParams);
  };

  const clearSearch = () => {
    setSearchTerm('');
    searchParams.delete('search');
    setSearchParams(searchParams);
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Patients</h1>
          <p className="text-muted-foreground">
            Manage your patient database and view their appointment history
          </p>
        </div>
        <Button asChild>
          <Link to="/patients/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Patient
          </Link>
        </Button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className={`absolute left-3 top-3 h-4 w-4 text-muted-foreground ${isDebouncing ? 'animate-pulse' : ''}`} />
          <Input
            placeholder="Search patients by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="absolute right-1 top-1 h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {!patients?.length ? (
        <EmptyState
          icon={<Users className="h-12 w-12 text-muted-foreground" />}
          title="No patients found"
          description={debouncedValue ? "Try adjusting your search terms or create a new patient" : "Add your first patient to get started"}
          action={
            !debouncedValue ? {
              label: "Add Patient",
              onClick: () => window.location.href = "/patients/new"
            } : {
              label: "Create New Patient",
              onClick: () => window.location.href = "/patients/new"
            }
          }
        />
      ) : (
        <div className="grid gap-4">
          {patients.map((patient) => {
            const upcomingAppointments = patient.appointments
              ?.filter((apt: any) => new Date(apt.starts_at) > new Date())
              ?.length || 0;
            
            return (
              <Card key={patient.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      <Link
                        to={`/patients/${patient.id}`}
                        className="hover:text-primary transition-colors"
                      >
                        {patient.full_name}
                      </Link>
                    </CardTitle>
                    {upcomingAppointments > 0 && (
                      <Badge variant="secondary">
                        {upcomingAppointments} upcoming
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {patient.phone && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Phone className="w-4 h-4 mr-2" />
                        {patient.phone}
                      </div>
                    )}
                    {patient.email && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Mail className="w-4 h-4 mr-2" />
                        {patient.email}
                      </div>
                    )}
                    {patient.dob && (
                      <div className="text-sm text-muted-foreground">
                        DOB: {new Date(patient.dob).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}