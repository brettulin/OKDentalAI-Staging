import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  TrendingUp,
  DollarSign,
  Users,
  ArrowUpRight,
  Target,
  Zap,
  BarChart3,
  ShoppingCart,
  CreditCard,
  PieChart
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface RevenueMetrics {
  totalRevenue: number
  monthlyGrowth: number
  conversionRate: number
  averageOrderValue: number
  customerLifetimeValue: number
  churnRate: number
}

interface UpsellOpportunity {
  id: string
  customer: string
  currentPlan: string
  suggestedPlan: string
  potentialRevenue: number
  likelihood: number
  reason: string
}

export function RevenueOptimization() {
  const { profile } = useAuth()
  const [selectedPeriod, setSelectedPeriod] = useState('month')

  const revenueMetrics: RevenueMetrics = {
    totalRevenue: 127500,
    monthlyGrowth: 18.5,
    conversionRate: 23.7,
    averageOrderValue: 347,
    customerLifetimeValue: 12450,
    churnRate: 2.8
  }

  const upsellOpportunities: UpsellOpportunity[] = [
    {
      id: '1',
      customer: 'Bright Smiles Dental',
      currentPlan: 'Professional',
      suggestedPlan: 'Enterprise',
      potentialRevenue: 8400,
      likelihood: 85,
      reason: 'High call volume, multiple locations'
    },
    {
      id: '2',
      customer: 'Downtown Orthodontics',
      currentPlan: 'Starter',
      suggestedPlan: 'Professional',
      potentialRevenue: 2400,
      likelihood: 72,
      reason: 'Approaching call limits'
    },
    {
      id: '3',
      customer: 'Family Dental Care',
      currentPlan: 'Professional',
      suggestedPlan: 'Enterprise',
      potentialRevenue: 8400,
      likelihood: 68,
      reason: 'Needs advanced analytics'
    }
  ]

  const conversionFunnel = {
    visitors: 12450,
    trials: 2956,
    conversions: 701,
    upgrades: 156
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Revenue Optimization</h2>
          <p className="text-muted-foreground">
            Maximize revenue through data-driven insights and automated optimization
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </Button>
          <Button>
            <Zap className="mr-2 h-4 w-4" />
            Auto-Optimize
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="upsells">Upsell Opportunities</TabsTrigger>
          <TabsTrigger value="funnel">Conversion Funnel</TabsTrigger>
          <TabsTrigger value="pricing">Pricing Strategy</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(revenueMetrics.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground flex items-center">
                  <ArrowUpRight className="h-3 w-3 mr-1 text-green-500" />
                  +{formatPercentage(revenueMetrics.monthlyGrowth)} from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercentage(revenueMetrics.conversionRate)}</div>
                <Progress value={revenueMetrics.conversionRate} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Customer LTV</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(revenueMetrics.customerLifetimeValue)}</div>
                <p className="text-xs text-muted-foreground">
                  Churn: {formatPercentage(revenueMetrics.churnRate)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
                <CardDescription>Revenue by subscription tier</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span>Enterprise</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(65200)}</div>
                      <div className="text-sm text-muted-foreground">51.1%</div>
                    </div>
                  </div>
                  <Progress value={51.1} />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Professional</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(44100)}</div>
                      <div className="text-sm text-muted-foreground">34.6%</div>
                    </div>
                  </div>
                  <Progress value={34.6} />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span>Starter</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(18200)}</div>
                      <div className="text-sm text-muted-foreground">14.3%</div>
                    </div>
                  </div>
                  <Progress value={14.3} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Growth Opportunities</CardTitle>
                <CardDescription>Areas for revenue expansion</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h3 className="font-medium">Customer Upsells</h3>
                      <p className="text-sm text-muted-foreground">14 opportunities identified</p>
                    </div>
                    <Badge variant="secondary">{formatCurrency(24500)}</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h3 className="font-medium">Feature Add-ons</h3>
                      <p className="text-sm text-muted-foreground">Custom integrations</p>
                    </div>
                    <Badge variant="secondary">{formatCurrency(18200)}</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h3 className="font-medium">Enterprise Deals</h3>
                      <p className="text-sm text-muted-foreground">3 in pipeline</p>
                    </div>
                    <Badge variant="secondary">{formatCurrency(45000)}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="upsells" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upsell Opportunities</CardTitle>
              <CardDescription>AI-identified opportunities for plan upgrades</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upsellOpportunities.map((opportunity) => (
                  <div key={opportunity.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h3 className="font-medium">{opportunity.customer}</h3>
                          <p className="text-sm text-muted-foreground">
                            {opportunity.currentPlan} → {opportunity.suggestedPlan}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {opportunity.reason}
                      </p>
                    </div>
                    
                    <div className="text-right space-y-2">
                      <div className="font-medium">{formatCurrency(opportunity.potentialRevenue)}/year</div>
                      <div className="flex items-center space-x-2">
                        <Progress value={opportunity.likelihood} className="w-20" />
                        <span className="text-sm text-muted-foreground">
                          {opportunity.likelihood}%
                        </span>
                      </div>
                    </div>
                    
                    <Button size="sm" className="ml-4">
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Contact
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversion Funnel</CardTitle>
              <CardDescription>Track visitor journey from awareness to revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Website Visitors</h3>
                      <p className="text-sm text-muted-foreground">Total traffic</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{conversionFunnel.visitors.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">100%</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Target className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Trial Signups</h3>
                      <p className="text-sm text-muted-foreground">Free trial conversions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{conversionFunnel.trials.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">
                      {((conversionFunnel.trials / conversionFunnel.visitors) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Paid Conversions</h3>
                      <p className="text-sm text-muted-foreground">Trial to paid</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{conversionFunnel.conversions.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">
                      {((conversionFunnel.conversions / conversionFunnel.trials) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <ArrowUpRight className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Upgrades</h3>
                      <p className="text-sm text-muted-foreground">Plan upgrades</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{conversionFunnel.upgrades.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">
                      {((conversionFunnel.upgrades / conversionFunnel.conversions) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pricing Strategy Optimization</CardTitle>
              <CardDescription>AI-powered pricing recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium">Current Average</h3>
                    <div className="text-2xl font-bold">{formatCurrency(347)}</div>
                    <p className="text-sm text-muted-foreground">Average order value</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium">Optimized Price</h3>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(389)}</div>
                    <p className="text-sm text-muted-foreground">+12% revenue potential</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium">Price Elasticity</h3>
                    <div className="text-2xl font-bold">-0.73</div>
                    <p className="text-sm text-muted-foreground">Demand sensitivity</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Pricing Recommendations</h3>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Starter Plan Price Increase</h4>
                        <p className="text-sm text-muted-foreground">
                          Increase from $99 to $119 (+20%)
                        </p>
                      </div>
                      <Badge variant="secondary">+$12K/month</Badge>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Enterprise Value Pricing</h4>
                        <p className="text-sm text-muted-foreground">
                          Custom pricing based on call volume
                        </p>
                      </div>
                      <Badge variant="secondary">+$45K/month</Badge>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Usage-Based Add-ons</h4>
                        <p className="text-sm text-muted-foreground">
                          Overage charges for call limits
                        </p>
                      </div>
                      <Badge variant="secondary">+$8K/month</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}