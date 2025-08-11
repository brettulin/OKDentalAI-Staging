import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageSkeleton } from "@/components/PageSkeleton";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const patientSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  dob: z.string().optional(),
  notes: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

export default function PatientForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = id && id !== "new";

  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      email: "",
      dob: "",
      notes: "",
    },
  });

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      if (!id || id === "new") return null;

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id && id !== "new",
  });

  useEffect(() => {
    if (patient) {
      form.reset({
        full_name: patient.full_name,
        phone: patient.phone || "",
        email: patient.email || "",
        dob: patient.dob || "",
        notes: patient.notes || "",
      });
    }
  }, [patient, form]);

  const savePatientMutation = useMutation({
    mutationFn: async (data: PatientFormData) => {
      if (!profile?.clinic_id) throw new Error('No clinic found');

      const patientData = {
        clinic_id: profile.clinic_id,
        full_name: data.full_name,
        dob: data.dob ? data.dob : null,
        phone: data.phone || null,
        email: data.email || null,
        notes: data.notes || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('patients')
          .update(patientData)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('patients')
          .insert(patientData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`Patient ${isEditing ? 'updated' : 'created'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
      navigate(isEditing ? `/patients/${id}` : '/patients');
    },
    onError: (error) => {
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} patient: ${error.message}`);
    },
  });

  const onSubmit = (data: PatientFormData) => {
    savePatientMutation.mutate(data);
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" asChild>
            <Link to={isEditing ? `/patients/${id}` : "/patients"}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isEditing ? 'Edit Patient' : 'Add Patient'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Update patient information' : 'Create a new patient record'}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Patient Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="patient@example.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dob"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes about the patient..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(isEditing ? `/patients/${id}` : '/patients')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savePatientMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {savePatientMutation.isPending
                    ? 'Saving...'
                    : isEditing
                    ? 'Update Patient'
                    : 'Create Patient'
                  }
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}