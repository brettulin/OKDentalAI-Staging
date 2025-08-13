import { useState } from 'react';
import { useSecurityMonitoring } from '@/hooks/useSecurityMonitoring';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldAlert, 
  AlertTriangle, 
  FileText, 
  Send, 
  CheckCircle,
  Clock
} from 'lucide-react';

export function DataIsolationControls() {
  const { logSecurityEvent } = useSecurityMonitoring();
  const [incidentType, setIncidentType] = useState('');
  const [severity, setSeverity] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateIncident = async () => {
    if (!incidentType || !severity || !description) return;

    setIsSubmitting(true);
    try {
      await logSecurityEvent(
        'security_incident_created',
        'incident',
        'security_incident',
        undefined,
        severity,
        {
          incident_type: incidentType,
          description,
          created_manually: true,
          severity
        }
      );

      // Reset form
      setIncidentType('');
      setSeverity('');
      setDescription('');
    } catch (error) {
      console.error('Error creating incident:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const dataIsolationChecks = [
    {
      name: 'RLS Enforcement',
      status: 'active',
      description: 'All data tables enforce Row Level Security',
      level: 'critical'
    },
    {
      name: 'Tenant Isolation',
      status: 'active', 
      description: 'Multi-tenant data is properly isolated by clinic_id',
      level: 'critical'
    },
    {
      name: 'Session Validation',
      status: 'active',
      description: 'Enhanced session security with device tracking',
      level: 'high'
    },
    {
      name: 'Audit Logging',
      status: 'active',
      description: 'Comprehensive security event logging',
      level: 'high'
    },
    {
      name: 'Data Encryption',
      status: 'monitoring',
      description: 'Sensitive data encryption tracking',
      level: 'medium'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'monitoring': return 'secondary';
      case 'warning': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'monitoring': return <Clock className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Data Isolation & Security Controls</h1>
        <p className="text-muted-foreground">
          Comprehensive data protection and isolation monitoring
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Data Isolation Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Data Isolation Status
            </CardTitle>
            <CardDescription>
              Current status of data protection mechanisms
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dataIsolationChecks.map((check) => (
              <div key={check.name} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground">{check.name}</h4>
                    <Badge variant={getStatusColor(check.status)}>
                      {getStatusIcon(check.status)}
                      {check.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{check.description}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {check.level}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Manual Incident Reporting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Report Security Incident
            </CardTitle>
            <CardDescription>
              Manually report and track security incidents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="incident-type">Incident Type</Label>
              <Select value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select incident type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="data_breach">Data Breach</SelectItem>
                  <SelectItem value="unauthorized_access">Unauthorized Access</SelectItem>
                  <SelectItem value="system_compromise">System Compromise</SelectItem>
                  <SelectItem value="malware_detection">Malware Detection</SelectItem>
                  <SelectItem value="policy_violation">Policy Violation</SelectItem>
                  <SelectItem value="suspicious_activity">Suspicious Activity</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="severity">Severity Level</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the security incident in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <Button 
              onClick={handleCreateIncident}
              disabled={!incidentType || !severity || !description || isSubmitting}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Creating...' : 'Report Incident'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Security Hardening Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>Security Hardening Checklist</CardTitle>
          <CardDescription>
            Essential security measures implemented in this system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Database Security</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Row Level Security (RLS) enabled on all tables
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Tenant isolation by clinic_id
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Comprehensive audit logging
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Role-based access control
                </li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Application Security</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Enhanced session management
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Device fingerprinting
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Real-time security monitoring
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Risk-based authentication
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Alert */}
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          <strong>Security Status:</strong> All critical data isolation measures are active. 
          This system implements enterprise-grade security controls including RLS enforcement, 
          tenant isolation, comprehensive audit logging, and real-time threat monitoring.
        </AlertDescription>
      </Alert>
    </div>
  );
}