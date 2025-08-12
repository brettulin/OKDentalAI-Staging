import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useSecurity } from '@/components/security/SecurityProvider';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Users, Settings, Database } from 'lucide-react';
import { toast } from 'sonner';

interface AdminControlsProps {
  userProfile?: any;
  onRefresh?: () => void;
}

export const AdminControls: React.FC<AdminControlsProps> = ({ userProfile, onRefresh }) => {
  const { profile } = useAuth();
  const { hasPermission, logSecurityEvent } = useSecurity();

  const updateAdminRole = async (userId: string, newAdminRole: string) => {
    try {
      const validAdminRole = newAdminRole as 'technical_admin' | 'medical_admin' | 'clinic_admin';
      const { error } = await supabase.rpc('update_admin_role', {
        target_user_id: userId,
        new_admin_role: validAdminRole || null
      });

      if (error) throw error;

      await logSecurityEvent('admin_role_updated', 'user', userId);
      toast.success('Admin role updated successfully');
      onRefresh?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update admin role');
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase.rpc('update_user_role', {
        target_user_id: userId,
        new_role: newRole
      });

      if (error) throw error;

      await logSecurityEvent('user_role_updated', 'user', userId);
      toast.success('User role updated successfully');
      onRefresh?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user role');
    }
  };

  // Only show to users with appropriate permissions
  if (!hasPermission('manage_users') && profile?.role !== 'owner') {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <Shield className="h-5 w-5" />
          Admin Controls
        </CardTitle>
        <CardDescription className="text-amber-700 dark:text-amber-300">
          Enhanced role management with granular permissions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {userProfile && (
          <div className="space-y-4 p-4 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-amber-900 dark:text-amber-100">
                  {userProfile.display_name || 'Unnamed User'}
                </h4>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {userProfile.role}
                  </Badge>
                  {userProfile.admin_role && (
                    <Badge variant="secondary" className="text-xs">
                      {userProfile.admin_role}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Role Management - Only for owners */}
            {profile?.role === 'owner' && userProfile.role !== 'owner' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Base Role
                </label>
                <Select 
                  value={userProfile.role} 
                  onValueChange={(value) => updateUserRole(userProfile.user_id, value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="nurse">Nurse</SelectItem>
                    <SelectItem value="medical_assistant">Medical Assistant</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Admin Role Management */}
            {hasPermission('manage_users') && userProfile.role !== 'owner' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Admin Specialization
                </label>
                <Select 
                  value={userProfile.admin_role || 'none'} 
                  onValueChange={(value) => updateAdminRole(userProfile.user_id, value === 'none' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Admin Role</SelectItem>
                    <SelectItem value="technical_admin">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Technical Admin
                      </div>
                    </SelectItem>
                    <SelectItem value="medical_admin">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Medical Admin
                      </div>
                    </SelectItem>
                    <SelectItem value="clinic_admin">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Clinic Admin
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
          <p><strong>Technical Admin:</strong> User management, PMS integration</p>
          <p><strong>Medical Admin:</strong> Patient data, medical records</p>
          <p><strong>Clinic Admin:</strong> Clinic settings, general administration</p>
        </div>
      </CardContent>
    </Card>
  );
};