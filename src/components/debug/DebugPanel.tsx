import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { Bug, User, Database, Settings } from 'lucide-react';

export const DebugPanel = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';

  React.useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        setProfile(profileData);
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };

    if (user) {
      loadProfile();
    }
  }, [user]);

  if (!isTestMode) {
    return null;
  }

  return (
    <>
      {/* Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(!isVisible)}
        className="fixed top-4 right-4 z-50 bg-yellow-100 border-yellow-400 text-yellow-800 hover:bg-yellow-200"
      >
        <Bug className="h-4 w-4 mr-1" />
        Debug
      </Button>

      {/* Debug Panel */}
      {isVisible && (
        <Card className="fixed top-16 right-4 z-40 w-80 max-h-[80vh] overflow-y-auto bg-yellow-50 border-yellow-400">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Debug Panel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Environment */}
            <div>
              <h4 className="font-medium flex items-center gap-1 mb-2">
                <Settings className="h-4 w-4" />
                Environment
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Test Mode:</span>
                  <Badge variant={isTestMode ? "default" : "secondary"}>
                    {isTestMode ? 'ON' : 'OFF'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Environment:</span>
                  <Badge variant="outline">
                    {import.meta.env.MODE}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>URL:</span>
                  <span className="text-xs truncate max-w-32">
                    {window.location.hostname}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Authentication */}
            <div>
              <h4 className="font-medium flex items-center gap-1 mb-2">
                <User className="h-4 w-4" />
                Authentication
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Auth Status:</span>
                  <Badge variant={user ? "default" : "destructive"}>
                    {user ? 'Logged In' : 'Not Logged In'}
                  </Badge>
                </div>
                {user && (
                  <>
                    <div className="flex justify-between">
                      <span>User ID:</span>
                      <span className="text-xs font-mono truncate max-w-32">
                        {user.id.substring(0, 8)}...
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Email:</span>
                      <span className="text-xs truncate max-w-32">
                        {user.email}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Separator />

            {/* Profile */}
            <div>
              <h4 className="font-medium flex items-center gap-1 mb-2">
                <Database className="h-4 w-4" />
                Profile
              </h4>
              <div className="space-y-1 text-sm">
                {profile ? (
                  <>
                    <div className="flex justify-between">
                      <span>Clinic ID:</span>
                      <span className="text-xs font-mono truncate max-w-32">
                        {profile.clinic_id ? `${profile.clinic_id.substring(0, 8)}...` : 'None'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Role:</span>
                      <Badge variant="outline" className="text-xs">
                        {profile.role || 'None'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Display Name:</span>
                      <span className="text-xs truncate max-w-32">
                        {profile.display_name || 'Not Set'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    No profile loaded
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Quick Actions */}
            <div>
              <h4 className="font-medium mb-2">Quick Actions</h4>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start text-xs"
                  onClick={() => console.log('User:', user, 'Profile:', profile)}
                >
                  Log State to Console
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start text-xs"
                  onClick={() => localStorage.clear()}
                >
                  Clear LocalStorage
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start text-xs"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </Button>
              </div>
            </div>

            {/* Supabase Info */}
            <div>
              <h4 className="font-medium mb-2">Supabase</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Project:</span>
                  <span className="text-xs font-mono">
                    zvpezltqpphvolzgfhme
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>URL:</span>
                  <span className="text-xs truncate max-w-32">
                    supabase.co
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};