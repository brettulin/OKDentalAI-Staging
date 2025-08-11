import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { Users } from 'lucide-react';

const PatientsPage = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="p-6" data-testid="page-patients">
        <EmptyState
          title="Authentication required"
          description="Please sign in to access patient records."
          icon={<Users className="h-12 w-12 text-muted-foreground" />}
        />
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="page-patients">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Patients</h1>
          <p className="text-muted-foreground">Manage patient records and information</p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Patient Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Patient management features will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PatientsPage;