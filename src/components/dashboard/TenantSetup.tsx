import { useState } from 'react';
import { useTenantSetup } from '@/hooks/useTenantSetup';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Clock, AlertCircle, Building } from 'lucide-react';

export function TenantSetup() {
  const { invites, loading, acceptInvite, createClinic } = useTenantSetup();
  const [inviteCode, setInviteCode] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleAcceptInvite = async () => {
    if (!inviteCode.trim()) return;
    
    setIsAccepting(true);
    try {
      await acceptInvite(inviteCode);
      setInviteCode('');
    } catch (error) {
      // Error handled in hook
    } finally {
      setIsAccepting(false);
    }
  };

  const handleCreateClinic = async () => {
    if (!clinicName.trim()) return;
    
    setIsCreating(true);
    try {
      await createClinic(clinicName);
      setClinicName('');
    } catch (error) {
      // Error handled in hook
    } finally {
      setIsCreating(false);
    }
  };

  const pendingInvites = invites.filter(invite => !invite.accepted_at && new Date(invite.expires_at) > new Date());
  const expiredInvites = invites.filter(invite => !invite.accepted_at && new Date(invite.expires_at) <= new Date());
  const acceptedInvites = invites.filter(invite => invite.accepted_at);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <Building className="h-12 w-12 mx-auto text-primary" />
        <h1 className="text-3xl font-bold text-foreground">Clinic Setup</h1>
        <p className="text-muted-foreground">Join an existing clinic or create a new one</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Accept Invite Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Join Existing Clinic
            </CardTitle>
            <CardDescription>
              Enter an invitation code to join an existing clinic
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-code">Invitation Code</Label>
              <Input
                id="invite-code"
                placeholder="Enter invitation code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleAcceptInvite}
              disabled={!inviteCode.trim() || isAccepting}
              className="w-full"
            >
              {isAccepting ? 'Joining...' : 'Join Clinic'}
            </Button>
          </CardContent>
        </Card>

        {/* Create New Clinic Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Create New Clinic
            </CardTitle>
            <CardDescription>
              Start a new clinic and become the owner
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clinic-name">Clinic Name</Label>
              <Input
                id="clinic-name"
                placeholder="Enter clinic name"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleCreateClinic}
              disabled={!clinicName.trim() || isCreating}
              className="w-full"
              variant="secondary"
            >
              {isCreating ? 'Creating...' : 'Create Clinic'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Invitations List */}
      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Invitations</CardTitle>
            <CardDescription>
              View and manage your clinic invitations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pending Invites */}
            {pendingInvites.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  Pending Invitations
                </h4>
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50 border-yellow-200">
                    <div>
                      <p className="font-medium text-foreground">{invite.clinic_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Expires: {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-yellow-400 text-yellow-700">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Accepted Invites */}
            {acceptedInvites.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Accepted Invitations
                </h4>
                {acceptedInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-3 border rounded-lg bg-green-50 border-green-200">
                    <div>
                      <p className="font-medium text-foreground">{invite.clinic_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Accepted: {new Date(invite.accepted_at!).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Accepted
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Expired Invites */}
            {expiredInvites.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  Expired Invitations
                </h4>
                {expiredInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-3 border rounded-lg bg-red-50 border-red-200">
                    <div>
                      <p className="font-medium text-foreground">{invite.clinic_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Expired: {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Expired
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}