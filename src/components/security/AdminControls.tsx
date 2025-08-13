import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Settings, UserCheck, AlertTriangle, Shield, Trash2, Clock, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface UserPermissions {
  id: string;
  email: string;
  role: string;
  admin_role?: string;
  last_login?: string;
  status: 'active' | 'suspended' | 'pending';
}

export const AdminControls: React.FC = () => {
  const { profile } = useAuth();
  const { logAccess } = useSecurityAudit();
  const [users, setUsers] = useState<UserPermissions[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [newRole, setNewRole] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');

  const isAuthorized = profile?.role === 'owner' || profile?.admin_role === 'security_admin';

  React.useEffect(() => {
    if (isAuthorized) {
      fetchUsers();
    }
  }, [isAuthorized]);

  const fetchUsers = async () => {
    if (!profile?.clinic_id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, role, admin_role, updated_at')
        .eq('clinic_id', profile.clinic_id)
        .neq('user_id', profile.user_id); // Don't include current user

      if (error) throw error;
      
      setUsers(data?.map(user => ({
        id: user.user_id,
        email: user.display_name || 'Unknown',
        role: user.role || 'staff',
        admin_role: user.admin_role,
        last_login: user.updated_at,
        status: 'active'
      })) || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    }
  };

  const updateUserRole = async () => {
    if (!selectedUser || !newRole) {
      toast.error('Please select a user and role');
      return;
    }

    setLoading(true);
    try {
      const selectedUserData = users.find(u => u.id === selectedUser);
      
      // Log the permission change before making it
      await logAccess({
        action_type: 'role_update_attempt',
        resource_type: 'user_permissions',
        resource_id: selectedUser,
        metadata: {
          target_user_email: selectedUserData?.email,
          old_role: selectedUserData?.role,
          old_admin_role: selectedUserData?.admin_role,
          new_role: newRole,
          changed_by: profile?.email
        }
      });

      const { error } = await supabase
        .from('profiles')
        .update({ 
          role: newRole.includes('admin') ? 'admin' : newRole,
          admin_role: newRole.includes('admin') ? 'technical_admin' as const : null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', selectedUser)
        .eq('clinic_id', profile?.clinic_id);

      if (error) throw error;

      // Log successful change
      await logAccess({
        action_type: 'role_updated',
        resource_type: 'user_permissions',
        resource_id: selectedUser,
        metadata: {
          target_user_email: selectedUserData?.email,
          new_role: newRole,
          changed_by: profile?.email,
          timestamp: new Date().toISOString()
        }
      });

      await fetchUsers();
      setSelectedUser('');
      setNewRole('');
      toast.success('User role updated successfully');
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    } finally {
      setLoading(false);
    }
  };

  const suspendUser = async () => {
    if (!selectedUser || !suspensionReason) {
      toast.error('Please select a user and provide a suspension reason');
      return;
    }

    setLoading(true);
    try {
      const selectedUserData = users.find(u => u.id === selectedUser);

      // Log suspension action
      await logAccess({
        action_type: 'user_suspended',
        resource_type: 'user_permissions',
        resource_id: selectedUser,
        metadata: {
          target_user_email: selectedUserData?.email,
          suspension_reason: suspensionReason,
          suspended_by: profile?.email,
          timestamp: new Date().toISOString()
        }
      });

      const { error } = await supabase
        .from('profiles')
        .update({ 
          role: 'suspended',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', selectedUser)
        .eq('clinic_id', profile?.clinic_id);

      if (error) throw error;

      await fetchUsers();
      setSelectedUser('');
      setSuspensionReason('');
      toast.success('User suspended successfully');
    } catch (error) {
      console.error('Error suspending user:', error);
      toast.error('Failed to suspend user');
    } finally {
      setLoading(false);
    }
  };

  const cleanupOldData = async () => {
    setLoading(true);
    try {
      // Log cleanup action
      await logAccess({
        action_type: 'data_cleanup_triggered',
        resource_type: 'system',
        metadata: {
          triggered_by: profile?.email,
          timestamp: new Date().toISOString()
        }
      });

      const { error } = await supabase.functions.invoke('security-cleanup');
      
      if (error) throw error;
      toast.success('Data cleanup completed successfully');
    } catch (error) {
      console.error('Error running cleanup:', error);
      toast.error('Failed to run data cleanup');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          You do not have permission to access administrative controls.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Administrative Controls
          </h2>
          <p className="text-muted-foreground">Manage user permissions and system security</p>
        </div>
        <Badge variant="secondary">
          <Shield className="h-3 w-3 mr-1" />
          Security Admin Access
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              User Role Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="user-select">Select User</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user to manage" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.email} - {user.role}
                      {user.status === 'suspended' && ' (Suspended)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="role-select">New Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="receptionist">Receptionist</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="technical_admin">Technical Admin</SelectItem>
                  <SelectItem value="security_admin">Security Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={updateUserRole} 
              disabled={loading || !selectedUser || !newRole}
              className="w-full"
            >
              Update Role
            </Button>
          </CardContent>
        </Card>

        {/* User Suspension */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              User Suspension
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="suspension-reason">Suspension Reason</Label>
              <Input
                id="suspension-reason"
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                placeholder="Enter reason for suspension"
              />
            </div>

            <Button 
              onClick={suspendUser}
              disabled={loading || !selectedUser || !suspensionReason}
              variant="destructive"
              className="w-full"
            >
              <Lock className="h-4 w-4 mr-2" />
              Suspend User
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* System Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            System Maintenance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Data Cleanup</h3>
              <p className="text-sm text-muted-foreground">
                Remove old audit logs and enforce data retention policies
              </p>
            </div>
            <Button onClick={cleanupOldData} disabled={loading} variant="outline">
              <Clock className="h-4 w-4 mr-2" />
              Run Cleanup
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Current Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users.map(user => (
              <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{user.email}</div>
                  <div className="text-sm text-muted-foreground">
                    Role: {user.role}
                    {user.admin_role && ` (${user.admin_role})`}
                  </div>
                  {user.last_login && (
                    <div className="text-xs text-muted-foreground">
                      Last login: {new Date(user.last_login).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                  {user.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};