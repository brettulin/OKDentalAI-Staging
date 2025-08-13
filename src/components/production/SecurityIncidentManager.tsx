import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Plus, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface SecurityIncident {
  id: string;
  incident_type: string;
  severity: string;
  status: string;
  description: string;
  assigned_to: string | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  metadata: any;
}

export const SecurityIncidentManager: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newIncident, setNewIncident] = useState({
    incident_type: '',
    severity: 'medium',
    description: '',
  });

  useEffect(() => {
    if (profile?.clinic_id) {
      loadIncidents();
    }
  }, [profile?.clinic_id]);

  const loadIncidents = async () => {
    if (!profile?.clinic_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('security_incidents')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIncidents(data || []);
    } catch (error) {
      console.error('Error loading incidents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load security incidents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createIncident = async () => {
    if (!profile?.clinic_id || !newIncident.incident_type || !newIncident.description) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('security_incidents')
        .insert({
          clinic_id: profile.clinic_id,
          incident_type: newIncident.incident_type,
          severity: newIncident.severity,
          description: newIncident.description,
          assigned_to: profile.user_id,
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Security incident created successfully',
      });

      setNewIncident({
        incident_type: '',
        severity: 'medium',
        description: '',
      });
      setShowCreateDialog(false);
      loadIncidents();
    } catch (error) {
      console.error('Error creating incident:', error);
      toast({
        title: 'Error',
        description: 'Failed to create security incident',
        variant: 'destructive',
      });
    }
  };

  const resolveIncident = async (incidentId: string, resolutionNotes: string) => {
    try {
      const { error } = await supabase
        .from('security_incidents')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes,
        })
        .eq('id', incidentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Incident resolved successfully',
      });

      loadIncidents();
    } catch (error) {
      console.error('Error resolving incident:', error);
      toast({
        title: 'Error',
        description: 'Failed to resolve incident',
        variant: 'destructive',
      });
    }
  };

  const getSeverityColor = (severity: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusColor = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case 'open':
        return 'destructive';
      case 'investigating':
        return 'secondary';
      case 'resolved':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Security Incident Manager</h1>
          <p className="text-muted-foreground">
            Track and manage security incidents
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Incident
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Security Incident</DialogTitle>
              <DialogDescription>
                Report a new security incident for investigation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Incident Type</label>
                <Select
                  value={newIncident.incident_type}
                  onValueChange={(value) => 
                    setNewIncident(prev => ({ ...prev, incident_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select incident type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unauthorized_access">Unauthorized Access</SelectItem>
                    <SelectItem value="data_breach">Data Breach</SelectItem>
                    <SelectItem value="malware_detection">Malware Detection</SelectItem>
                    <SelectItem value="phishing_attempt">Phishing Attempt</SelectItem>
                    <SelectItem value="suspicious_activity">Suspicious Activity</SelectItem>
                    <SelectItem value="system_compromise">System Compromise</SelectItem>
                    <SelectItem value="policy_violation">Policy Violation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Severity</label>
                <Select
                  value={newIncident.severity}
                  onValueChange={(value) => 
                    setNewIncident(prev => ({ ...prev, severity: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={newIncident.description}
                  onChange={(e) => 
                    setNewIncident(prev => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Describe the security incident..."
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button onClick={createIncident}>
                  Create Incident
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-500">
              {incidents.filter(i => i.status === 'open').length}
            </div>
            <p className="text-sm text-muted-foreground">Open Incidents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-500">
              {incidents.filter(i => i.status === 'investigating').length}
            </div>
            <p className="text-sm text-muted-foreground">Under Investigation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">
              {incidents.filter(i => i.status === 'resolved').length}
            </div>
            <p className="text-sm text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length}
            </div>
            <p className="text-sm text-muted-foreground">Critical Open</p>
          </CardContent>
        </Card>
      </div>

      {/* Incidents List */}
      <div className="space-y-4">
        {incidents.map((incident) => (
          <IncidentCard
            key={incident.id}
            incident={incident}
            onResolve={resolveIncident}
            getSeverityColor={getSeverityColor}
            getStatusColor={getStatusColor}
          />
        ))}
      </div>
    </div>
  );
};

interface IncidentCardProps {
  incident: SecurityIncident;
  onResolve: (id: string, notes: string) => void;
  getSeverityColor: (severity: string) => "default" | "destructive" | "secondary" | "outline";
  getStatusColor: (status: string) => "default" | "destructive" | "secondary" | "outline";
}

const IncidentCard: React.FC<IncidentCardProps> = ({ 
  incident, 
  onResolve, 
  getSeverityColor, 
  getStatusColor 
}) => {
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const handleResolve = () => {
    onResolve(incident.id, resolutionNotes);
    setShowResolveDialog(false);
    setResolutionNotes('');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <CardTitle className="text-lg">
                {incident.incident_type.replace(/_/g, ' ')}
              </CardTitle>
              <CardDescription>
                {new Date(incident.created_at).toLocaleString()}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getSeverityColor(incident.severity)}>
              {incident.severity}
            </Badge>
            <Badge variant={getStatusColor(incident.status)}>
              {incident.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-4">{incident.description}</p>
        
        {incident.resolution_notes && (
          <Alert className="mb-4">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Resolution:</strong> {incident.resolution_notes}
            </AlertDescription>
          </Alert>
        )}

        {incident.status !== 'resolved' && (
          <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <CheckCircle className="h-4 w-4 mr-2" />
                Resolve Incident
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Resolve Security Incident</DialogTitle>
                <DialogDescription>
                  Mark this incident as resolved and add resolution notes
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Describe how this incident was resolved..."
                  rows={4}
                />
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowResolveDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleResolve}>
                    Resolve
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
};