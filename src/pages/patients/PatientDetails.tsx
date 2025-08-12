import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Edit, Trash2, Calendar, Phone, Mail, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSecurity } from "@/components/security/SecurityProvider";
import { SecurityBanner } from "@/components/security/SecurityBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/PageSkeleton";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function PatientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { hasPermission, logSecurityEvent } = useSecurity();
  const queryClient = useQueryClient();

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      if (!id) throw new Error('Patient ID required');

      // Log patient data access
      logSecurityEvent('view_patient', 'patient', id);

      const { data, error } = await supabase
        .from('patients')
        .select(`
          *,
          appointments(
            id,
            starts_at,
            ends_at,
            source,
            services(name),
            providers(name),
            locations(name)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const deletePatientMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Patient ID required');

      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Patient deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      navigate('/patients');
    },
    onError: (error) => {
      toast.error(`Failed to delete patient: ${error.message}`);
    },
  });

  if (isLoading) return <PageSkeleton />;
  if (!patient) return <div>Patient not found</div>;

  const upcomingAppointments = patient.appointments
    ?.filter((apt: any) => new Date(apt.starts_at) > new Date())
    ?.sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()) || [];

  const pastAppointments = patient.appointments
    ?.filter((apt: any) => new Date(apt.starts_at) <= new Date())
    ?.sort((a: any, b: any) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()) || [];

  return (
    <div className="space-y-6">
      <SecurityBanner />
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" asChild>
            <Link to="/patients">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Patients
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{patient.full_name}</h1>
            <p className="text-muted-foreground">Patient Details</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" asChild>
            <Link to={`/patients/${patient.id}/edit`}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Patient</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {patient.full_name}? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deletePatientMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Patient
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {patient.phone && (
                <div className="flex items-center">
                  <Phone className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span>{patient.phone}</span>
                </div>
              )}
              {patient.email && (
                <div className="flex items-center">
                  <Mail className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span>{patient.email}</span>
                </div>
              )}
              {patient.dob && (
                <div>
                  <span className="text-sm text-muted-foreground">Date of Birth:</span>
                  <p>{new Date(patient.dob).toLocaleDateString()}</p>
                </div>
              )}
              {patient.notes && (
                <div>
                  <span className="text-sm text-muted-foreground">Notes:</span>
                  <p className="text-sm mt-1">{patient.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Upcoming Appointments ({upcomingAppointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingAppointments.length === 0 ? (
                <p className="text-muted-foreground">No upcoming appointments</p>
              ) : (
                <div className="space-y-3">
                  {upcomingAppointments.map((appointment: any) => (
                    <div key={appointment.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {new Date(appointment.starts_at).toLocaleDateString()} at{' '}
                          {new Date(appointment.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {appointment.services?.name} with {appointment.providers?.name}
                        </div>
                        {appointment.locations?.name && (
                          <div className="text-sm text-muted-foreground">
                            at {appointment.locations.name}
                          </div>
                        )}
                      </div>
                      <Badge variant="secondary">
                        {appointment.source === 'voice_ai' ? 'AI Booked' : 'Manual'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Past Appointments ({pastAppointments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {pastAppointments.length === 0 ? (
                <p className="text-muted-foreground">No past appointments</p>
              ) : (
                <div className="space-y-3">
                  {pastAppointments.slice(0, 10).map((appointment: any) => (
                    <div key={appointment.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {new Date(appointment.starts_at).toLocaleDateString()} at{' '}
                          {new Date(appointment.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {appointment.services?.name} with {appointment.providers?.name}
                        </div>
                      </div>
                      <Badge variant="outline">
                        {appointment.source === 'voice_ai' ? 'AI Booked' : 'Manual'}
                      </Badge>
                    </div>
                  ))}
                  {pastAppointments.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center">
                      And {pastAppointments.length - 10} more appointments...
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}