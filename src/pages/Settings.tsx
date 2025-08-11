import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { Settings as SettingsIcon, Bot, ChevronRight } from 'lucide-react';

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
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              Clinic Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Manage your clinic's general settings and preferences.
            </p>
            <Button variant="outline" disabled>
              General Settings (Coming Soon)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Receptionist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Configure your AI receptionist's voice, behavior, and booking policies.
            </p>
            <Button 
              onClick={() => window.location.href = '/settings/ai'}
              className="flex items-center gap-2"
            >
              Configure AI Settings
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;