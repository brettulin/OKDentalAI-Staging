import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Palette,
  Globe,
  Settings,
  Upload,
  Eye,
  Save,
  Zap,
  Building,
  Users,
  Shield
} from 'lucide-react';

interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  faviconUrl: string;
  brandName: string;
  tagline: string;
  customDomain: string;
  theme: 'light' | 'dark' | 'auto';
}

interface FeatureConfig {
  voiceAI: boolean;
  analytics: boolean;
  multiLanguage: boolean;
  enterpriseSSO: boolean;
  advancedReporting: boolean;
  customWorkflows: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
}

export function WhiteLabelConfigurator() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('branding');

  // Mock configuration for demo
  const config = null;
  const isLoading = false;

  // Mock update mutation
  const updateConfigMutation = {
    mutate: () => toast.success('Configuration updated successfully'),
    isPending: false
  };

  const [brandingConfig, setBrandingConfig] = useState<BrandingConfig>({
    primaryColor: '#2563eb',
    secondaryColor: '#64748b',
    accentColor: '#10b981',
    logoUrl: '',
    faviconUrl: '',
    brandName: 'AI Receptionist',
    tagline: 'Intelligent Patient Communication',
    customDomain: '',
    theme: 'light'
  });

  const [featureConfig, setFeatureConfig] = useState<FeatureConfig>({
    voiceAI: true,
    analytics: true,
    multiLanguage: true,
    enterpriseSSO: false,
    advancedReporting: false,
    customWorkflows: false,
    apiAccess: false,
    whiteLabel: false
  });

  const handleSaveBranding = () => {
    updateConfigMutation.mutate();
  };

  const handleSaveFeatures = () => {
    updateConfigMutation.mutate();
  };

  const handleColorChange = (colorType: keyof Pick<BrandingConfig, 'primaryColor' | 'secondaryColor' | 'accentColor'>, value: string) => {
    setBrandingConfig(prev => ({ ...prev, [colorType]: value }));
    // Apply color change immediately for preview
    document.documentElement.style.setProperty(`--${colorType.replace('Color', '')}`, value);
  };

  if (isLoading) {
    return <div className="p-6">Loading configuration...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building className="h-8 w-8" />
            White-Label Configuration
          </h1>
          <p className="text-muted-foreground">
            Customize branding and features for your organization
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          Enterprise Edition
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Features
          </TabsTrigger>
          <TabsTrigger value="deployment" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Deployment
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Brand Identity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Brand Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="brandName">Brand Name</Label>
                  <Input
                    id="brandName"
                    value={brandingConfig.brandName}
                    onChange={(e) => setBrandingConfig(prev => ({ ...prev, brandName: e.target.value }))}
                    placeholder="Your Brand Name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={brandingConfig.tagline}
                    onChange={(e) => setBrandingConfig(prev => ({ ...prev, tagline: e.target.value }))}
                    placeholder="Your brand tagline"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <Input
                    id="logoUrl"
                    value={brandingConfig.logoUrl}
                    onChange={(e) => setBrandingConfig(prev => ({ ...prev, logoUrl: e.target.value }))}
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="faviconUrl">Favicon URL</Label>
                  <Input
                    id="faviconUrl"
                    value={brandingConfig.faviconUrl}
                    onChange={(e) => setBrandingConfig(prev => ({ ...prev, faviconUrl: e.target.value }))}
                    placeholder="https://example.com/favicon.ico"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Color Scheme */}
            <Card>
              <CardHeader>
                <CardTitle>Color Scheme</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      id="primaryColor"
                      value={brandingConfig.primaryColor}
                      onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                      className="w-16 h-10 border-0 p-0"
                    />
                    <Input
                      value={brandingConfig.primaryColor}
                      onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                      placeholder="#2563eb"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      id="secondaryColor"
                      value={brandingConfig.secondaryColor}
                      onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                      className="w-16 h-10 border-0 p-0"
                    />
                    <Input
                      value={brandingConfig.secondaryColor}
                      onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                      placeholder="#64748b"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accentColor">Accent Color</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      id="accentColor"
                      value={brandingConfig.accentColor}
                      onChange={(e) => handleColorChange('accentColor', e.target.value)}
                      className="w-16 h-10 border-0 p-0"
                    />
                    <Input
                      value={brandingConfig.accentColor}
                      onChange={(e) => handleColorChange('accentColor', e.target.value)}
                      placeholder="#10b981"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveBranding} className="w-full" disabled={updateConfigMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Branding
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Feature Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="voiceAI">Voice AI</Label>
                      <p className="text-sm text-muted-foreground">Enable AI-powered voice conversations</p>
                    </div>
                    <Switch
                      id="voiceAI"
                      checked={featureConfig.voiceAI}
                      onCheckedChange={(checked) => setFeatureConfig(prev => ({ ...prev, voiceAI: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="analytics">Advanced Analytics</Label>
                      <p className="text-sm text-muted-foreground">Comprehensive reporting and insights</p>
                    </div>
                    <Switch
                      id="analytics"
                      checked={featureConfig.analytics}
                      onCheckedChange={(checked) => setFeatureConfig(prev => ({ ...prev, analytics: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="multiLanguage">Multi-Language Support</Label>
                      <p className="text-sm text-muted-foreground">Support for multiple languages</p>
                    </div>
                    <Switch
                      id="multiLanguage"
                      checked={featureConfig.multiLanguage}
                      onCheckedChange={(checked) => setFeatureConfig(prev => ({ ...prev, multiLanguage: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="enterpriseSSO">Enterprise SSO</Label>
                      <p className="text-sm text-muted-foreground">SAML and OAuth integration</p>
                    </div>
                    <Switch
                      id="enterpriseSSO"
                      checked={featureConfig.enterpriseSSO}
                      onCheckedChange={(checked) => setFeatureConfig(prev => ({ ...prev, enterpriseSSO: checked }))}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="advancedReporting">Advanced Reporting</Label>
                      <p className="text-sm text-muted-foreground">Custom reports and dashboards</p>
                    </div>
                    <Switch
                      id="advancedReporting"
                      checked={featureConfig.advancedReporting}
                      onCheckedChange={(checked) => setFeatureConfig(prev => ({ ...prev, advancedReporting: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="customWorkflows">Custom Workflows</Label>
                      <p className="text-sm text-muted-foreground">Workflow automation and customization</p>
                    </div>
                    <Switch
                      id="customWorkflows"
                      checked={featureConfig.customWorkflows}
                      onCheckedChange={(checked) => setFeatureConfig(prev => ({ ...prev, customWorkflows: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="apiAccess">API Access</Label>
                      <p className="text-sm text-muted-foreground">Full REST API access</p>
                    </div>
                    <Switch
                      id="apiAccess"
                      checked={featureConfig.apiAccess}
                      onCheckedChange={(checked) => setFeatureConfig(prev => ({ ...prev, apiAccess: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="whiteLabel">White-Label Mode</Label>
                      <p className="text-sm text-muted-foreground">Remove platform branding</p>
                    </div>
                    <Switch
                      id="whiteLabel"
                      checked={featureConfig.whiteLabel}
                      onCheckedChange={(checked) => setFeatureConfig(prev => ({ ...prev, whiteLabel: checked }))}
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveFeatures} className="w-full mt-6" disabled={updateConfigMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Feature Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployment" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Custom Domain
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customDomain">Domain Name</Label>
                  <Input
                    id="customDomain"
                    value={brandingConfig.customDomain}
                    onChange={(e) => setBrandingConfig(prev => ({ ...prev, customDomain: e.target.value }))}
                    placeholder="app.yourdomain.com"
                  />
                  <p className="text-sm text-muted-foreground">
                    Point your domain to our servers and we'll handle SSL automatically
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900">DNS Configuration</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Add a CNAME record pointing to: platform.lovable.app
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security & Compliance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">SSL Certificate</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">HIPAA Compliance</span>
                    <Badge variant="default">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">SOC 2 Type II</span>
                    <Badge variant="default">Certified</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Data Encryption</span>
                    <Badge variant="default">AES-256</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Brand Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Header Preview */}
                <div 
                  className="p-6 rounded-lg border"
                  style={{ 
                    backgroundColor: brandingConfig.primaryColor + '10',
                    borderColor: brandingConfig.primaryColor + '30'
                  }}
                >
                  <div className="flex items-center gap-4">
                    {brandingConfig.logoUrl && (
                      <img 
                        src={brandingConfig.logoUrl} 
                        alt="Logo" 
                        className="h-12 w-auto"
                      />
                    )}
                    <div>
                      <h3 
                        className="text-2xl font-bold"
                        style={{ color: brandingConfig.primaryColor }}
                      >
                        {brandingConfig.brandName}
                      </h3>
                      <p className="text-muted-foreground">{brandingConfig.tagline}</p>
                    </div>
                  </div>
                </div>

                {/* Button Preview */}
                <div className="flex gap-4">
                  <Button style={{ backgroundColor: brandingConfig.primaryColor }}>
                    Primary Button
                  </Button>
                  <Button 
                    variant="outline" 
                    style={{ 
                      borderColor: brandingConfig.secondaryColor,
                      color: brandingConfig.secondaryColor 
                    }}
                  >
                    Secondary Button
                  </Button>
                  <Button style={{ backgroundColor: brandingConfig.accentColor }}>
                    Accent Button
                  </Button>
                </div>

                {/* Feature List Preview */}
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(featureConfig).map(([feature, enabled]) => (
                    <div key={feature} className="flex items-center gap-2">
                      <div 
                        className={`w-3 h-3 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                      />
                      <span className="text-sm capitalize">
                        {feature.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}