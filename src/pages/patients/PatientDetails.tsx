import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SecurityBanner } from '@/components/security/SecurityBanner';
import { useSecurePatientData } from '@/hooks/useSecurePatientData';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar,
  Shield,
  Edit,
  Activity,
  FileText,
  Clock
} from 'lucide-react';

const PatientDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [showSecurityDashboard, setShowSecurityDashboard] = useState(false);
  const { 
    patient, 
    loading, 
    error, 
    accessLevel,
    auditAccess 
  } = useSecurePatientData(id || '');

  const { data: patientHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['patientHistory', id],
    queryFn: async () => {
      if (!id) return [];

      const { data, error } = await supabase
        .from('patient_history')
        .select('*')
        .eq('patient_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading patient details...</div>;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Error Loading Patient</h1>
          <p className="text-muted-foreground mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Patient Not Found</h1>
          <p className="text-muted-foreground mt-2">The requested patient could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <SecurityBanner 
        complianceScore={96}
        hasActiveAlerts={false}
        isMonitoring={true}
        onViewSecurity={() => setShowSecurityDashboard(true)}
      />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <User className="h-6 w-6" />
          <h1 className="text-3xl font-bold">{patient.first_name} {patient.last_name}</h1>
          <Badge variant="secondary">
            Access Level: {accessLevel}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.href = `/patients/${id}/edit`}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Patient
        </Button>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone: {patient.phone}
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email: {patient.email}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Address: {patient.address}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date of Birth: {patient.dob}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Patient History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {historyLoading ? (
                <p>Loading history...</p>
              ) : patientHistory && patientHistory.length > 0 ? (
                <ul className="list-disc pl-5">
                  {patientHistory.map((event) => (
                    <li key={event.id} className="mb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{event.action_type}:</span> {event.description}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <Clock className="h-3 w-3 inline-block mr-1" />
                          {new Date(event.created_at).toLocaleString()}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No history available for this patient.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Access Log: <Button variant="link" size="sm" onClick={() => auditAccess()}>View Access Log</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PatientDetails;
