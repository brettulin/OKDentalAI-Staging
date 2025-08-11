import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { Calendar } from 'lucide-react';

const AppointmentsPage = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="p-6" data-testid="page-appointments">
        <EmptyState
          title="Authentication required"
          description="Please sign in to access appointments."
          icon={<Calendar className="h-12 w-12 text-muted-foreground" />}
        />
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="page-appointments">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Appointments</h1>
          <p className="text-muted-foreground">Schedule and manage appointments</p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Appointment Scheduler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Appointment scheduling features will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppointmentsPage;