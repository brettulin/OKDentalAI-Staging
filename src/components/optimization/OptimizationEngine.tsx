import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  BarChart3,
  Settings,
  Play,
  Pause
} from 'lucide-react';

interface OptimizationTask {
  id: string;
  title: string;
  description: string;
  category: 'performance' | 'revenue' | 'market' | 'ai';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  impact: number; // 1-10 scale
  effort: number; // 1-10 scale
  progress: number; // 0-100 percentage
}

export function OptimizationEngine() {
  const { profile } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [optimizationRunning, setOptimizationRunning] = useState(false);

  // Mock optimization tasks
  const optimizationTasks: OptimizationTask[] = [
    {
      id: '1',
      title: 'Redis Cache Implementation',
      description: 'Implement Redis caching layer for database queries to reduce response times by 60%',
      category: 'performance',
      priority: 'high',
      status: 'completed',
      impact: 9,
      effort: 7,
      progress: 100
    },
    {
      id: '2',
      title: 'AI Model Fine-tuning',
      description: 'Fine-tune conversation models for medical terminology and practice-specific language',
      category: 'ai',
      priority: 'critical',
      status: 'in-progress',
      impact: 10,
      effort: 9,
      progress: 75
    },
    {
      id: '3',
      title: 'Revenue Optimization Engine',
      description: 'Implement automated upsell suggestions based on usage patterns and customer success metrics',
      category: 'revenue',
      priority: 'high',
      status: 'in-progress',
      impact: 8,
      effort: 6,
      progress: 60
    },
    {
      id: '4',
      title: 'Global CDN Setup',
      description: 'Deploy content delivery network across 12 regions for optimal global performance',
      category: 'performance',
      priority: 'medium',
      status: 'completed',
      impact: 7,
      effort: 5,
      progress: 100
    },
    {
      id: '5',
      title: 'Market Intelligence Dashboard',
      description: 'Real-time competitive analysis and market positioning dashboard',
      category: 'market',
      priority: 'medium',
      status: 'pending',
      impact: 6,
      effort: 4,
      progress: 0
    }
  ];

  const runOptimizationMutation = useMutation({
    mutationFn: async (taskId: string) => {
      // Simulate optimization process
      setOptimizationRunning(true);
      await new Promise(resolve => setTimeout(resolve, 3000));
      return { success: true, improvements: Math.random() * 20 + 5 };
    },
    onSuccess: (data) => {
      setOptimizationRunning(false);
      toast.success(`Optimization completed! Performance improved by ${data.improvements.toFixed(1)}%`);
    },
    onError: () => {
      setOptimizationRunning(false);
      toast.error('Optimization failed. Please try again.');
    }
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'performance': return Zap;
      case 'revenue': return TrendingUp;
      case 'market': return Target;
      case 'ai': return BarChart3;
      default: return Settings;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'in-progress': return Clock;
      case 'failed': return AlertTriangle;
      default: return Settings;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'in-progress': return 'text-blue-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const filteredTasks = selectedCategory === 'all' 
    ? optimizationTasks 
    : optimizationTasks.filter(task => task.category === selectedCategory);

  const completedTasks = optimizationTasks.filter(task => task.status === 'completed').length;
  const totalTasks = optimizationTasks.length;
  const overallProgress = (completedTasks / totalTasks) * 100;

  const averageImpact = optimizationTasks.reduce((sum, task) => sum + task.impact, 0) / totalTasks;
  const totalEffort = optimizationTasks.reduce((sum, task) => sum + task.effort, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Optimization Engine
          </h1>
          <p className="text-muted-foreground">
            Automated performance and revenue optimization
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            onClick={() => runOptimizationMutation.mutate('auto')}
            disabled={optimizationRunning}
            className="flex items-center gap-2"
          >
            {optimizationRunning ? (
              <>
                <Pause className="h-4 w-4" />
                Optimizing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Optimization
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overall Progress</p>
                <p className="text-3xl font-bold">{overallProgress.toFixed(0)}%</p>
                <Progress value={overallProgress} className="mt-2 h-2" />
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed Tasks</p>
                <p className="text-3xl font-bold">{completedTasks}/{totalTasks}</p>
                <p className="text-sm text-muted-foreground mt-1">optimization tasks</p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Impact</p>
                <p className="text-3xl font-bold">{averageImpact.toFixed(1)}/10</p>
                <p className="text-sm text-green-600 mt-1">High impact score</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Effort</p>
                <p className="text-3xl font-bold">{totalEffort}</p>
                <p className="text-sm text-muted-foreground mt-1">optimization points</p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'performance', 'ai', 'revenue', 'market'].map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className="capitalize"
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Optimization Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredTasks.map((task) => {
          const CategoryIcon = getCategoryIcon(task.category);
          const StatusIcon = getStatusIcon(task.status);
          
          return (
            <Card key={task.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CategoryIcon className="h-5 w-5" />
                    <CardTitle className="text-lg">{task.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getPriorityColor(task.priority)}>
                      {task.priority}
                    </Badge>
                    <StatusIcon className={`h-4 w-4 ${getStatusColor(task.status)}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{task.description}</p>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Progress</span>
                      <span className="text-sm text-muted-foreground">{task.progress}%</span>
                    </div>
                    <Progress value={task.progress} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium">Impact</span>
                      <div className="flex items-center gap-1">
                        <Progress value={task.impact * 10} className="h-2 flex-1" />
                        <span className="text-sm text-muted-foreground">{task.impact}/10</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Effort</span>
                      <div className="flex items-center gap-1">
                        <Progress value={task.effort * 10} className="h-2 flex-1" />
                        <span className="text-sm text-muted-foreground">{task.effort}/10</span>
                      </div>
                    </div>
                  </div>

                  {task.status === 'pending' && (
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => runOptimizationMutation.mutate(task.id)}
                      disabled={optimizationRunning}
                    >
                      Start Optimization
                    </Button>
                  )}
                  
                  {task.status === 'in-progress' && (
                    <Button size="sm" variant="outline" className="w-full" disabled>
                      <Clock className="h-4 w-4 mr-2" />
                      In Progress
                    </Button>
                  )}
                  
                  {task.status === 'completed' && (
                    <Button size="sm" variant="outline" className="w-full" disabled>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Completed
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Optimization Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Optimization Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-semibold text-green-900">Performance Gains</h4>
              <p className="text-sm text-green-700 mt-1">
                Redis caching reduced response times by 60%, achieving industry-leading performance
              </p>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900">AI Improvements</h4>
              <p className="text-sm text-blue-700 mt-1">
                Model fine-tuning increased accuracy by 15% for medical conversation scenarios
              </p>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-semibold text-purple-900">Revenue Impact</h4>
              <p className="text-sm text-purple-700 mt-1">
                Optimization efforts projected to increase ARR by 25% through improved conversion
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}