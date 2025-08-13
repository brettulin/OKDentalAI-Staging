import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, Lock, Eye, CheckCircle } from 'lucide-react';

interface SecurityBannerProps {
  complianceScore: number;
  hasActiveAlerts: boolean;
  isMonitoring: boolean;
  onViewSecurity: () => void;
}

export const SecurityBanner: React.FC<SecurityBannerProps> = ({
  complianceScore,
  hasActiveAlerts,
  isMonitoring,
  onViewSecurity
}) => {
  const getComplianceVariant = () => {
    if (complianceScore >= 95) return 'default';
    if (complianceScore >= 85) return 'secondary';
    return 'destructive';
  };

  const getComplianceIcon = () => {
    if (complianceScore >= 95) return CheckCircle;
    if (complianceScore >= 85) return Shield;
    return AlertTriangle;
  };

  const ComplianceIcon = getComplianceIcon();

  return (
    <Alert className="border-l-4 border-l-primary bg-muted/50">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <ComplianceIcon className="h-5 w-5" />
          <div className="flex items-center gap-4">
            <div>
              <AlertDescription className="text-sm font-medium">
                Security Status: Healthcare-Grade Protection Active
              </AlertDescription>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={getComplianceVariant()}>
                  Compliance Score: {complianceScore}%
                </Badge>
                {isMonitoring && (
                  <Badge variant="secondary">
                    <Eye className="h-3 w-3 mr-1" />
                    Real-time Monitoring
                  </Badge>
                )}
                {hasActiveAlerts && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Active Alerts
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" />
            HIPAA Compliant
          </div>
          <Button variant="outline" size="sm" onClick={onViewSecurity}>
            <Shield className="h-4 w-4 mr-1" />
            Security Dashboard
          </Button>
        </div>
      </div>
    </Alert>
  );
};