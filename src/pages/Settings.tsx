import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { Settings as SettingsIcon } from 'lucide-react';

const SettingsPage = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="p-6" data-testid="page-settings">
        <EmptyState
          title="Authentication required"
          description="Please sign in to access settings."
          icon={<SettingsIcon className="h-12 w-12 text-muted-foreground" />}
        />
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="page-settings">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure your clinic settings</p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Clinic Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Settings and configuration options will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;