import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSecurity } from '@/components/security/SecurityProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Shield, 
  Settings, 
  AlertTriangle, 
  UserCheck, 
  Database,
  Activity,
  Lock,
  Trash2,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';

export const AdminControls: React.FC = () => {
  const { profile } = useAuth();
  const { hasPermission } = useSecurity();
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) {
        console.error("Error fetching users:", error);
        throw error;
      }
      return data;
    },
  });

  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('*');

      if (error) {
        console.error("Error fetching roles:", error);
        throw error;
      }
      return data;
    },
  });

  const handleRoleChange = async (userId: string, roleId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role_id: roleId })
        .eq('user_id', userId);

      if (error) {
        console.error("Error updating user role:", error);
        toast.error("Failed to update user role.");
        return;
      }

      toast.success("User role updated successfully!");
      refetchUsers(); // Refresh the user list
    } catch (err) {
      console.error("Unexpected error updating user role:", err);
      toast.error("Unexpected error occurred.");
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      // Call the Supabase function to reset the user's password
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { user_id: userId },
      });

      if (error) {
        console.error('Error invoking reset password function:', error);
        toast.error('Failed to reset password. Please check the console for details.');
        return;
      }

      toast.success('Password reset email sent successfully!');
    } catch (err) {
      console.error('Unexpected error resetting password:', err);
      toast.error('Unexpected error occurred. Please check the console for details.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const confirmDelete = window.confirm("Are you sure you want to delete this user? This action cannot be undone.");
      if (!confirmDelete) {
        return;
      }

      // Call the Supabase function to delete the user
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: userId },
      });

      if (error) {
        console.error('Error invoking delete user function:', error);
        toast.error('Failed to delete user. Please check the console for details.');
        return;
      }

      toast.success('User deleted successfully!');
      refetchUsers(); // Refresh the user list
    } catch (err) {
      console.error('Unexpected error deleting user:', err);
      toast.error('Unexpected error occurred. Please check the console for details.');
    }
  };

  if (!hasPermission('manage_users')) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to access admin controls.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {usersLoading ? (
            <div>Loading users...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users?.map((user) => (
                <Card key={user.user_id} className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">{user.full_name || user.email}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      <p>Email: {user.email}</p>
                      <p>User ID: {user.user_id}</p>
                    </div>
                    <Select onValueChange={(roleId) => handleRoleChange(user.user_id, roleId)}>
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent>
                        {rolesLoading ? (
                          <SelectItem value="">Loading roles...</SelectItem>
                        ) : (
                          roles?.map((role) => (
                            <SelectItem key={role.id} value={role.id.toString()}>
                              {role.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-between items-center mt-2">
                      <Button 
                        variant="outline" 
                        size="xs" 
                        onClick={() => handleResetPassword(user.user_id)}
                      >
                        <Lock className="h-3 w-3 mr-1" />
                        Reset Password
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="xs" 
                        onClick={() => handleDeleteUser(user.user_id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete User
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
