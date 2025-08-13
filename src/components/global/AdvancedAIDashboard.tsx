import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Brain, 
  Zap, 
  Heart, 
  Target, 
  TrendingUp,
  Settings,
  Lightbulb,
  Beaker,
  Microscope,
  Award,
  Users,
  BarChart3
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface AIMetrics {
  reasoningAccuracy: number
  emotionalIntelligence: number
  learningVelocity: number
  problemSolving: number
  contextAwareness: number
  empathyScore: number
}

interface ResearchProject {
  id: string
  title: string
  category: 'reasoning' | 'emotion' | 'prediction' | 'learning'
  status: 'research' | 'development' | 'testing' | 'production'
  progress: number
  impact: 'low' | 'medium' | 'high' | 'revolutionary'
  timeline: string
}

export function AdvancedAIDashboard() {
  const { profile } = useAuth()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [aiMode, setAiMode] = useState('production')

  const aiMetrics: AIMetrics = {
    reasoningAccuracy: 94.7,
    emotionalIntelligence: 89.3,
    learningVelocity: 96.1,
    problemSolving: 91.8,
    contextAwareness: 97.2,
    empathyScore: 88.9
  }

  const researchProjects: ResearchProject[] = [
    {
      id: '1',
      title: 'Multi-Step Medical Reasoning',
      category: 'reasoning',
      status: 'development',
      progress: 78,
      impact: 'revolutionary',
      timeline: 'Q2 2024'
    },
    {
      id: '2',
      title: 'Empathetic Response Generation',
      category: 'emotion',
      status: 'testing',
      progress: 92,
      impact: 'high',
      timeline: 'Q1 2024'
    },
    {
      id: '3',
      title: 'Predictive Health Analytics',
      category: 'prediction',
      status: 'research',
      progress: 45,
      impact: 'revolutionary',
      timeline: 'Q3 2024'
    },
    {
      id: '4',
      title: 'Autonomous Learning Framework',
      category: 'learning',
      status: 'development',
      progress: 67,
      impact: 'high',
      timeline: 'Q2 2024'
    },
    {
      id: '5',
      title: 'Cultural AI Adaptation',
      category: 'emotion',
      status: 'production',
      progress: 100,
      impact: 'high',
      timeline: 'Released'
    }
  ]

  const innovationMetrics = {
    activeResearch: 12,
    patentApplications: 8,
    publicationsThisYear: 15,
    partnerInstitutions: 6,
    researchBudget: 2.5, // millions
    innovationIndex: 97.3
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'production': return 'text-green-600'
      case 'testing': return 'text-blue-600'
      case 'development': return 'text-yellow-600'
      case 'research': return 'text-purple-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'production': return 'default'
      case 'testing': return 'secondary'
      case 'development': return 'outline'
      case 'research': return 'outline'
      default: return 'outline'
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'revolutionary': return 'text-red-600'
      case 'high': return 'text-orange-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'reasoning': return <Brain className="h-4 w-4" />
      case 'emotion': return <Heart className="h-4 w-4" />
      case 'prediction': return <Target className="h-4 w-4" />
      case 'learning': return <Zap className="h-4 w-4" />
      default: return <Lightbulb className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advanced AI Research & Development</h2>
          <p className="text-muted-foreground">
            Next-generation AI capabilities and cutting-edge research
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Beaker className="mr-2 h-4 w-4" />
            Research Lab
          </Button>
          <Button>
            <Microscope className="mr-2 h-4 w-4" />
            Run Experiment
          </Button>
        </div>
      </div>

      {/* AI Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reasoning Accuracy</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aiMetrics.reasoningAccuracy}%</div>
            <Progress value={aiMetrics.reasoningAccuracy} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emotional Intelligence</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aiMetrics.emotionalIntelligence}%</div>
            <Progress value={aiMetrics.emotionalIntelligence} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Learning Velocity</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aiMetrics.learningVelocity}%</div>
            <Progress value={aiMetrics.learningVelocity} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="research" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="research">Research Projects</TabsTrigger>
          <TabsTrigger value="capabilities">AI Capabilities</TabsTrigger>
          <TabsTrigger value="innovation">Innovation Lab</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="research">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Active Research Projects</h3>
              <Button size="sm">
                <Lightbulb className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {researchProjects.map((project) => (
                <Card key={project.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getCategoryIcon(project.category)}
                        <CardTitle className="text-lg">{project.title}</CardTitle>
                      </div>
                      <Badge variant={getStatusVariant(project.status)}>
                        {project.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Progress</span>
                        <span className="text-sm font-medium">{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} />
                      
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-muted-foreground">Impact:</span>
                          <Badge 
                            variant="outline" 
                            className={getImpactColor(project.impact)}
                          >
                            {project.impact}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">{project.timeline}</span>
                      </div>
                      
                      <Button size="sm" variant="outline" className="w-full">
                        <BarChart3 className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="capabilities">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Advanced Reasoning</CardTitle>
                <CardDescription>Multi-step problem solving in healthcare</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Complex Diagnosis</span>
                    <span className="font-medium">96.2%</span>
                  </div>
                  <Progress value={96.2} />
                  
                  <div className="flex justify-between items-center">
                    <span>Treatment Planning</span>
                    <span className="font-medium">94.8%</span>
                  </div>
                  <Progress value={94.8} />
                  
                  <div className="flex justify-between items-center">
                    <span>Medical Logic</span>
                    <span className="font-medium">97.5%</span>
                  </div>
                  <Progress value={97.5} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Emotional Intelligence</CardTitle>
                <CardDescription>Empathetic and culturally-aware responses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Empathy Detection</span>
                    <span className="font-medium">91.3%</span>
                  </div>
                  <Progress value={91.3} />
                  
                  <div className="flex justify-between items-center">
                    <span>Cultural Sensitivity</span>
                    <span className="font-medium">89.7%</span>
                  </div>
                  <Progress value={89.7} />
                  
                  <div className="flex justify-between items-center">
                    <span>Tone Adaptation</span>
                    <span className="font-medium">93.1%</span>
                  </div>
                  <Progress value={93.1} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="innovation">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Research</CardTitle>
                <Microscope className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{innovationMetrics.activeResearch}</div>
                <p className="text-xs text-muted-foreground">
                  Projects in development
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Patent Applications</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{innovationMetrics.patentApplications}</div>
                <p className="text-xs text-muted-foreground">
                  Intellectual property
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Publications</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{innovationMetrics.publicationsThisYear}</div>
                <p className="text-xs text-muted-foreground">
                  Academic papers 2024
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Research Partners</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{innovationMetrics.partnerInstitutions}</div>
                <p className="text-xs text-muted-foreground">
                  Academic institutions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">R&D Budget</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${innovationMetrics.researchBudget}M</div>
                <p className="text-xs text-muted-foreground">
                  Annual research funding
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Innovation Index</CardTitle>
                <Lightbulb className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{innovationMetrics.innovationIndex}%</div>
                <Progress value={innovationMetrics.innovationIndex} className="mt-2" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Performance Metrics</CardTitle>
                <CardDescription>Real-time AI capability tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Problem Solving</span>
                      <span>{aiMetrics.problemSolving}%</span>
                    </div>
                    <Progress value={aiMetrics.problemSolving} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Context Awareness</span>
                      <span>{aiMetrics.contextAwareness}%</span>
                    </div>
                    <Progress value={aiMetrics.contextAwareness} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Empathy Score</span>
                      <span>{aiMetrics.empathyScore}%</span>
                    </div>
                    <Progress value={aiMetrics.empathyScore} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Learning & Adaptation</CardTitle>
                <CardDescription>Continuous improvement metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium">Autonomous Learning</h3>
                    <p className="text-sm text-muted-foreground">
                      AI improves responses automatically
                    </p>
                    <Progress value={96} className="mt-2" />
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium">Knowledge Expansion</h3>
                    <p className="text-sm text-muted-foreground">
                      +2,847 new medical concepts learned
                    </p>
                    <Progress value={78} className="mt-2" />
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium">Response Quality</h3>
                    <p className="text-sm text-muted-foreground">
                      Self-optimizing conversation quality
                    </p>
                    <Progress value={94} className="mt-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}