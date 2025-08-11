import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings as SettingsIcon } from 'lucide-react';

const SettingsPage = () => {
  return (
    <div className="p-6">
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