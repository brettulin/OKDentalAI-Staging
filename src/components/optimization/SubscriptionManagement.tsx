import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  CreditCard, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar,
  ArrowUpRight,
  Star,
  Target,
  Zap,
  Crown
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface SubscriptionTier {
  id: string
  name: string
  price: number
  features: string[]
  limits: {
    calls: number | 'unlimited'
    users: number | 'unlimited'
    storage: string
  }
  popular?: boolean
}

interface UsageMetrics {
  callsUsed: number
  callsLimit: number | 'unlimited'
  usersActive: number
  usersLimit: number | 'unlimited'
  storageUsed: number
  storageLimit: number
}

export function SubscriptionManagement() {
  const { profile } = useAuth()
  const [selectedTier, setSelectedTier] = useState<string>('professional')
  
  const subscriptionTiers: SubscriptionTier[] = [
    {
      id: 'starter',
      name: 'Starter',
      price: 99,
      features: [
        'AI Phone Answering',
        'Basic Appointment Booking',
        'Email Support',
        '1 Location'
      ],
      limits: {
        calls: 1000,
        users: 5,
        storage: '10GB'
      }
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 299,
      features: [
        'Everything in Starter',
        'Advanced AI Features',
        'PMS Integration',
        'Priority Support',
        'Multiple Locations',
        'Analytics Dashboard'
      ],
      limits: {
        calls: 5000,
        users: 25,
        storage: '100GB'
      },
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 999,
      features: [
        'Everything in Professional',
        'Custom AI Training',
        'White-Label Options',
        'Dedicated Support',
        'Unlimited Locations',
        'Custom Integrations',
        'Advanced Analytics'
      ],
      limits: {
        calls: 'unlimited',
        users: 'unlimited',
        storage: 'Unlimited'
      }
    }
  ]

  const currentUsage: UsageMetrics = {
    callsUsed: 3247,
    callsLimit: 5000,
    usersActive: 18,
    usersLimit: 25,
    storageUsed: 45.7,
    storageLimit: 100
  }

  const revenueMetrics = {
    mrr: 8470,
    arr: 101640,
    growth: 23.5,
    churn: 2.8,
    ltv: 47500,
    cac: 1250
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Subscription Management</h2>
          <p className="text-muted-foreground">
            Manage your subscription plan and billing
          </p>
        </div>
        <Button>
          <CreditCard className="mr-2 h-4 w-4" />
          Billing Portal
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
                <Crown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Professional</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(299)}/month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Calls This Month</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3,247</div>
                <Progress 
                  value={(currentUsage.callsUsed / (currentUsage.callsLimit as number)) * 100} 
                  className="mt-2" 
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentUsage.usersActive}</div>
                <p className="text-xs text-muted-foreground">
                  of {currentUsage.usersLimit} limit
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Next Billing</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Jan 15</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(299)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Upgrade Recommendations</CardTitle>
              <CardDescription>Based on your usage patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    <div>
                      <h3 className="font-medium">High Call Volume Detected</h3>
                      <p className="text-sm text-muted-foreground">
                        You're using 65% of your monthly call limit
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Upgrade to Enterprise
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {subscriptionTiers.map((tier) => (
              <Card key={tier.id} className={`relative ${tier.popular ? 'border-primary' : ''}`}>
                {tier.popular && (
                  <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {tier.name}
                    {tier.popular && <Star className="h-4 w-4 text-yellow-500" />}
                  </CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold">{formatCurrency(tier.price)}</span>
                    <span className="text-muted-foreground">/month</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {tier.features.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-1 h-1 bg-primary rounded-full"></div>
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex justify-between text-sm">
                      <span>Calls per month:</span>
                      <span>{tier.limits.calls === 'unlimited' ? 'Unlimited' : tier.limits.calls.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Users:</span>
                      <span>{tier.limits.users === 'unlimited' ? 'Unlimited' : tier.limits.users}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Storage:</span>
                      <span>{tier.limits.storage}</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    variant={tier.id === 'professional' ? 'default' : 'outline'}
                  >
                    {tier.id === 'professional' ? 'Current Plan' : 'Upgrade'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Call Usage</CardTitle>
                <CardDescription>Monthly call volume and trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Calls Used</span>
                    <span className="font-medium">
                      {currentUsage.callsUsed.toLocaleString()} / {currentUsage.callsLimit.toLocaleString()}
                    </span>
                  </div>
                  <Progress 
                    value={(currentUsage.callsUsed / (currentUsage.callsLimit as number)) * 100}
                    className="h-2"
                  />
                  <div className="text-sm text-muted-foreground">
                    65% of monthly limit used
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Storage Usage</CardTitle>
                <CardDescription>Data storage and recordings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Storage Used</span>
                    <span className="font-medium">
                      {currentUsage.storageUsed}GB / {currentUsage.storageLimit}GB
                    </span>
                  </div>
                  <Progress 
                    value={(currentUsage.storageUsed / currentUsage.storageLimit) * 100}
                    className="h-2"
                  />
                  <div className="text-sm text-muted-foreground">
                    46% of storage limit used
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(revenueMetrics.mrr)}</div>
                <p className="text-xs text-muted-foreground flex items-center">
                  <ArrowUpRight className="h-3 w-3 mr-1 text-green-500" />
                  +{revenueMetrics.growth}% from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Annual Recurring Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(revenueMetrics.arr)}</div>
                <p className="text-xs text-muted-foreground">
                  Based on current subscriptions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Customer Lifetime Value</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(revenueMetrics.ltv)}</div>
                <p className="text-xs text-muted-foreground">
                  CAC: {formatCurrency(revenueMetrics.cac)}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}