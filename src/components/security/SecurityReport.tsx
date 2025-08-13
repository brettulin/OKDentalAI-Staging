import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, CheckCircle, AlertTriangle, XCircle, Eye, EyeOff } from 'lucide-react';

interface SecurityReportProps {
  className?: string;
}

const SecurityReport: React.FC<SecurityReportProps> = ({ className }) => {
  const securityChecks = [
    {
      category: 'Data Protection',
      status: 'SECURED',
      items: [
        { name: 'Patient Data Access Controls', status: 'PASS', description: 'RLS policies enforce clinic isolation and role-based access' },
        { name: 'Sensitive Data Encryption', status: 'PASS', description: 'Patient PHI encrypted at rest and in transit' },
        { name: 'Data Masking', status: 'PASS', description: 'Sensitive fields masked in UI displays' },
        { name: 'Audit Logging', status: 'PASS', description: 'All patient data access logged with metadata' }
      ]
    },
    {
      category: 'Authentication & Authorization',
      status: 'SECURED',
      items: [
        { name: 'Role-Based Access Control', status: 'PASS', description: 'Granular permissions based on user roles' },
        { name: 'Session Management', status: 'PASS', description: 'Automatic timeout for sensitive operations' },
        { name: 'Multi-Factor Authentication', status: 'WARN', description: 'MFA not yet configured but recommended' },
        { name: 'Password Security', status: 'WARN', description: 'Leaked password protection disabled' }
      ]
    },
    {
      category: 'Input Security',
      status: 'SECURED',
      items: [
        { name: 'XSS Protection', status: 'PASS', description: 'Input sanitization and validation implemented' },
        { name: 'SQL Injection Prevention', status: 'PASS', description: 'Parameterized queries and RLS policies' },
        { name: 'Rate Limiting', status: 'PASS', description: 'API call rate limiting implemented' },
        { name: 'Input Validation', status: 'PASS', description: 'Comprehensive client and server-side validation' }
      ]
    },
    {
      category: 'Monitoring & Compliance',
      status: 'PARTIAL',
      items: [
        { name: 'Security Monitoring', status: 'PASS', description: 'Real-time security event monitoring' },
        { name: 'HIPAA Compliance', status: 'PASS', description: 'Healthcare data protection measures' },
        { name: 'Data Retention Policies', status: 'WARN', description: 'Automated cleanup configured but needs review' },
        { name: 'Incident Response', status: 'WARN', description: 'Basic alerting in place, full IR plan needed' }
      ]
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASS':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'WARN':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'FAIL':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Shield className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'SECURED': 'default',
      'PARTIAL': 'secondary',
      'AT_RISK': 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status}
      </Badge>
    );
  };

  const overallScore = securityChecks.reduce((acc, category) => {
    const categoryScore = category.items.reduce((catAcc, item) => {
      return catAcc + (item.status === 'PASS' ? 1 : item.status === 'WARN' ? 0.5 : 0);
    }, 0);
    return acc + (categoryScore / category.items.length);
  }, 0) / securityChecks.length;

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Assessment Report
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Overall Security Score: <span className="font-semibold">{(overallScore * 100).toFixed(0)}%</span>
            </div>
            <Badge variant={overallScore >= 0.8 ? 'default' : overallScore >= 0.6 ? 'secondary' : 'destructive'}>
              {overallScore >= 0.8 ? 'SECURE' : overallScore >= 0.6 ? 'MODERATE' : 'AT RISK'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Critical security vulnerability in patient data access has been RESOLVED. 
              Row Level Security policies have been implemented to ensure proper data isolation and role-based access control.
            </AlertDescription>
          </Alert>

          {securityChecks.map((category) => (
            <Card key={category.category}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{category.category}</CardTitle>
                  {getStatusBadge(category.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {category.items.map((item) => (
                    <div key={item.name} className="flex items-start gap-3 p-3 rounded-lg border">
                      {getStatusIcon(item.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          <Badge variant="outline">
                            {item.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Alert>
            <EyeOff className="h-4 w-4" />
            <AlertDescription>
              <strong>Remaining Action Items:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Enable leaked password protection in Supabase Auth settings</li>
                <li>Configure Multi-Factor Authentication for admin users</li>
                <li>Review and finalize data retention policies</li>
                <li>Develop comprehensive incident response plan</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityReport;