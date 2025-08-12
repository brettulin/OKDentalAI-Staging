import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Shield, 
  Database, 
  Key, 
  Monitor,
  Users,
  Settings,
  Rocket
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  required: boolean;
  completed: boolean;
  icon: React.ReactNode;
}

export const ProductionChecklist: React.FC = () => {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const checklistItems: ChecklistItem[] = [
    // Security Category
    {
      id: 'security-rls',
      category: 'Security',
      title: 'Row Level Security Policies',
      description: 'All sensitive tables have proper RLS policies implemented',
      required: true,
      completed: true, // Auto-completed via migration
      icon: <Shield className="h-4 w-4" />
    },
    {
      id: 'security-auth',
      category: 'Security',
      title: 'Authentication Settings',
      description: 'Enable leaked password protection in Supabase Auth settings',
      required: true,
      completed: false,
      icon: <Key className="h-4 w-4" />
    },
    {
      id: 'security-admin',
      category: 'Security',
      title: 'Admin User Setup',
      description: 'Ensure at least one owner/admin user is configured',
      required: true,
      completed: false,
      icon: <Users className="h-4 w-4" />
    },
    {
      id: 'security-audit',
      category: 'Security',
      title: 'Security Audit Review',
      description: 'Review and resolve all security audit findings',
      required: true,
      completed: true, // Auto-completed via migration
      icon: <Monitor className="h-4 w-4" />
    },

    // PMS Integration Category
    {
      id: 'pms-credentials',
      category: 'PMS Integration',
      title: 'CareStack Live Credentials',
      description: 'Configure production CareStack API credentials',
      required: true,
      completed: false,
      icon: <Key className="h-4 w-4" />
    },
    {
      id: 'pms-testing',
      category: 'PMS Integration',
      title: 'Integration Testing',
      description: 'Test PMS integration in sandbox and production',
      required: true,
      completed: false,
      icon: <Database className="h-4 w-4" />
    },

    // Data & Backup Category
    {
      id: 'data-backup',
      category: 'Data & Backup',
      title: 'Backup Strategy',
      description: 'Verify Supabase automatic backups and retention policy',
      required: true,
      completed: false,
      icon: <Database className="h-4 w-4" />
    },
    {
      id: 'data-migration',
      category: 'Data & Backup',
      title: 'Data Migration Plan',
      description: 'Plan for migrating existing patient and appointment data',
      required: false,
      completed: false,
      icon: <Database className="h-4 w-4" />
    },

    // Monitoring & Alerting Category
    {
      id: 'monitoring-setup',
      category: 'Monitoring',
      title: 'Production Monitoring',
      description: 'Set up system monitoring and health checks',
      required: true,
      completed: false,
      icon: <Monitor className="h-4 w-4" />
    },
    {
      id: 'monitoring-alerts',
      category: 'Monitoring',
      title: 'Security Alerts',
      description: 'Configure security alert notifications for critical events',
      required: true,
      completed: false,
      icon: <AlertTriangle className="h-4 w-4" />
    },

    // Training & Documentation Category
    {
      id: 'training-staff',
      category: 'Training',
      title: 'Staff Training',
      description: 'Train medical staff on the new AI receptionist system',
      required: true,
      completed: false,
      icon: <Users className="h-4 w-4" />
    },
    {
      id: 'training-docs',
      category: 'Training',
      title: 'Documentation',
      description: 'Create user guides and troubleshooting documentation',
      required: false,
      completed: false,
      icon: <Settings className="h-4 w-4" />
    },

    // Go-Live Category
    {
      id: 'golive-domain',
      category: 'Go-Live',
      title: 'Custom Domain',
      description: 'Configure custom domain for production deployment',
      required: false,
      completed: false,
      icon: <Settings className="h-4 w-4" />
    },
    {
      id: 'golive-support',
      category: 'Go-Live',
      title: 'Support Plan',
      description: 'Establish 24/7 support plan for first week after launch',
      required: true,
      completed: false,
      icon: <Monitor className="h-4 w-4" />
    }
  ];

  const toggleItem = (itemId: string) => {
    const newCheckedItems = new Set(checkedItems);
    if (newCheckedItems.has(itemId)) {
      newCheckedItems.delete(itemId);
    } else {
      newCheckedItems.add(itemId);
    }
    setCheckedItems(newCheckedItems);
  };

  const getCompletionStatus = (item: ChecklistItem) => {
    return item.completed || checkedItems.has(item.id);
  };

  const categories = [...new Set(checklistItems.map(item => item.category))];
  
  const getProgress = () => {
    const completed = checklistItems.filter(item => getCompletionStatus(item)).length;
    const total = checklistItems.length;
    return { completed, total, percentage: Math.round((completed / total) * 100) };
  };

  const getRequiredProgress = () => {
    const requiredItems = checklistItems.filter(item => item.required);
    const completed = requiredItems.filter(item => getCompletionStatus(item)).length;
    const total = requiredItems.length;
    return { completed, total, percentage: Math.round((completed / total) * 100) };
  };

  const progress = getProgress();
  const requiredProgress = getRequiredProgress();
  const isReadyForProduction = requiredProgress.completed === requiredProgress.total;

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Production Go-Live Checklist
          </CardTitle>
          <CardDescription>
            Complete all required items before launching in production
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium text-sm text-muted-foreground">Overall Progress</h3>
              <div className="text-2xl font-bold">{progress.completed}/{progress.total}</div>
              <div className="text-sm text-muted-foreground">{progress.percentage}% Complete</div>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium text-sm text-muted-foreground">Required Items</h3>
              <div className="text-2xl font-bold">{requiredProgress.completed}/{requiredProgress.total}</div>
              <div className="text-sm text-muted-foreground">{requiredProgress.percentage}% Complete</div>
            </div>
          </div>

          <Alert className={`border ${isReadyForProduction ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
            <div className="flex items-center gap-2">
              {isReadyForProduction ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              )}
              <AlertDescription className={isReadyForProduction ? 'text-green-800' : 'text-yellow-800'}>
                {isReadyForProduction ? (
                  <strong>Ready for Production! 🚀</strong>
                ) : (
                  <span>
                    <strong>Not Ready for Production</strong> - 
                    {requiredProgress.total - requiredProgress.completed} required item(s) remaining
                  </span>
                )}
              </AlertDescription>
            </div>
          </Alert>
        </CardContent>
      </Card>

      {/* Checklist by Category */}
      {categories.map((category) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-lg">{category}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {checklistItems
                .filter(item => item.category === category)
                .map((item) => {
                  const isCompleted = getCompletionStatus(item);
                  return (
                    <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Checkbox
                        id={item.id}
                        checked={isCompleted}
                        onCheckedChange={() => !item.completed && toggleItem(item.id)}
                        disabled={item.completed}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {item.icon}
                          <label htmlFor={item.id} className="font-medium cursor-pointer">
                            {item.title}
                          </label>
                          {item.required && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                          {item.completed && (
                            <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                              Auto-completed
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <div className="flex items-center">
                        {isCompleted ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-400" />
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Final Action */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <Button 
              size="lg" 
              disabled={!isReadyForProduction}
              className="bg-gradient-to-r from-blue-600 to-purple-600"
            >
              <Rocket className="h-4 w-4 mr-2" />
              {isReadyForProduction ? 'Deploy to Production' : 'Complete Required Items First'}
            </Button>
            {!isReadyForProduction && (
              <p className="text-sm text-muted-foreground mt-2">
                Complete all required checklist items to enable production deployment
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};