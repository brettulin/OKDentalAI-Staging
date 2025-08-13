import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePlatformSuperadmin } from '@/hooks/usePlatformSuperadmin';
import { PageSkeleton } from '@/components/PageSkeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle } from 'lucide-react';

interface PlatformRouteProps {
  children: React.ReactNode;
}

export function PlatformRoute({ children }: PlatformRouteProps) {
  const { isSuperadmin, isLoading } = usePlatformSuperadmin();

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!isSuperadmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full px-6">
          <Alert variant="destructive" className="border-destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <span className="font-semibold">Access Denied</span>
              </div>
              <p className="text-sm">
                You don't have permission to access this platform administration area. 
                This section requires superadmin privileges.
              </p>
              <div className="pt-2">
                <button 
                  onClick={() => window.history.back()}
                  className="text-sm underline hover:no-underline"
                >
                  Go back
                </button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}