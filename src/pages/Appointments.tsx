import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

const AppointmentsPage = () => {
  return (
    <div className="p-6">
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