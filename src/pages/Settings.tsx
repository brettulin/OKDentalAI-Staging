import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SecurityDashboard } from '@/components/security/SecurityDashboard';
import { SecurityBanner } from '@/components/security/SecurityBanner';
import { AdminControls } from '@/components/security/AdminControls';
import { useAuth } from '@/hooks/useAuth';
import { useSecurity } from '@/components/security/SecurityProvider';
import { Settings as SettingsIcon, Shield, Users, Database, Bot, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Settings = () => {
  const { profile } = useAuth();
  const { hasPermission } = useSecurity();

  return (
    <div className="p-6" data-testid="page-settings">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        <SecurityBanner />

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            {hasPermission('manage_users') && (
              <TabsTrigger value="users">Users</TabsTrigger>
            )}
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  General Settings
                </CardTitle>
                <CardDescription>
                  Configure your application preferences and settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Overview
                </CardTitle>
                <CardDescription>
                  Monitor security alerts and system health
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SecurityDashboard />
              </CardContent>
            </Card>
          </TabsContent>

          {hasPermission('manage_users') && (
            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    User Management
                  </CardTitle>
                  <CardDescription>
                    Manage user roles and permissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AdminControls userProfile={profile} />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="data" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data Management
                </CardTitle>
                <CardDescription>
                  Data retention, encryption, and backup settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Data Retention</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Audit logs are retained for 2 years, rate limits for 7 days.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Security alerts are auto-resolved after 30 days and deleted after 1 year.
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Encryption</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      PMS credentials use AES-256-GCM encryption on the server.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Patient data supports field-level encryption for sensitive information.
                    </p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Security Monitoring</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Automated cleanup runs daily to maintain system performance.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Real-time monitoring for suspicious activities and rate limiting.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;