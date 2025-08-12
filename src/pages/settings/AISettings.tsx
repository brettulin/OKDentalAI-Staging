import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Settings, Save, Loader2, Play, Volume2 } from 'lucide-react';
import { PageSkeleton } from '@/components/PageSkeleton';
import { VoiceLatencyTest } from '@/components/ai/VoiceLatencyTest';

const AISettingsPage = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch AI settings directly using clinic from profile
  const { data: settings, isLoading } = useQuery({
    queryKey: ['ai-settings', profile?.clinic_id],
    queryFn: async () => {
      if (!profile?.clinic_id) throw new Error('No clinic ID');
      
      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  // Save AI settings
  const saveSettingsMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!profile?.clinic_id) throw new Error('No clinic ID');
      
      const settingsData = {
        clinic_id: profile.clinic_id,
        ...values
      };

      if (settings?.id) {
        // Update existing settings
        const { data, error } = await supabase
          .from('ai_settings')
          .update(settingsData)
          .eq('id', settings.id)
          .eq('clinic_id', profile.clinic_id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Create new settings
        const { data, error } = await supabase
          .from('ai_settings')
          .insert(settingsData)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      toast({
        title: 'Settings saved',
        description: 'AI settings have been updated successfully.',
      });
    },
    onError: (error) => {
      console.error('Error saving AI settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save AI settings. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Test voice synthesis
  const testVoiceMutation = useMutation({
    mutationFn: async (text: string) => {
      const { data, error } = await supabase.functions.invoke('voice-synthesize', {
        body: { 
          text,
          voiceId: formData.voice_id,
          model: formData.voice_model 
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.audioBase64) {
        // Convert base64 to audio and play
        const audioBlob = new Blob([
          Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0))
        ], { type: data.mime || 'audio/mpeg' });
        
        const audio = new Audio(URL.createObjectURL(audioBlob));
        audio.onended = () => URL.revokeObjectURL(audio.src);
        audio.play().catch(console.error);
        
        toast({
          title: 'Voice test successful',
          description: `Playing synthesized audio using ${data.voiceId} voice.`,
        });
      } else {
        toast({
          title: 'Voice test completed',
          description: 'Voice synthesis works but no audio returned.',
        });
      }
    },
    onError: (error) => {
      console.error('Voice test error:', error);
      toast({
        title: 'Voice test failed',
        description: error.message || 'Failed to test voice synthesis.',
        variant: 'destructive',
      });
    },
  });

  const [formData, setFormData] = useState({
    voice_provider: settings?.voice_provider || 'elevenlabs',
    voice_model: settings?.voice_model || 'eleven_multilingual_v2',
    voice_id: (settings as any)?.voice_id || '9BWtsMINqrJLrRacOk9x', // Aria default
    language: settings?.language || 'en',
    transfer_number: settings?.transfer_number || '',
    greeting: '', // Add greeting field
    booking_policy: settings?.booking_policy || {},
    auto_booking_enabled: (settings?.booking_policy as any)?.auto_booking_enabled || false,
    require_insurance: (settings?.booking_policy as any)?.require_insurance || false,
    max_advance_days: (settings?.booking_policy as any)?.max_advance_days || 30,
    voice_enabled: (settings?.booking_policy as any)?.voice_enabled !== false, // Default to enabled
  });

  const [testGreeting, setTestGreeting] = useState('');

  React.useEffect(() => {
    if (settings) {
      const bookingPolicy = settings.booking_policy as any || {};
      setFormData({
        voice_provider: settings.voice_provider || 'elevenlabs',
        voice_model: settings.voice_model || 'eleven_multilingual_v2',
        voice_id: (settings as any).voice_id || '9BWtsMINqrJLrRacOk9x',
        language: settings.language || 'en',
        transfer_number: settings.transfer_number || '',
        greeting: (settings.booking_policy as any)?.greeting || '',
        booking_policy: settings.booking_policy || {},
        auto_booking_enabled: bookingPolicy.auto_booking_enabled || false,
        require_insurance: bookingPolicy.require_insurance || false,
        max_advance_days: bookingPolicy.max_advance_days || 30,
        voice_enabled: bookingPolicy.voice_enabled !== false, // Default to enabled
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      voice_provider: formData.voice_provider,
      voice_model: formData.voice_model,
      voice_id: formData.voice_id,
      language: formData.language,
      transfer_number: formData.transfer_number,
      booking_policy: {
        auto_booking_enabled: formData.auto_booking_enabled,
        require_insurance: formData.require_insurance,
        max_advance_days: formData.max_advance_days,
        greeting: formData.greeting,
        voice_enabled: formData.voice_enabled,
      }
    };

    await saveSettingsMutation.mutateAsync(submitData);
  };

  const handleTestVoice = () => {
    const testText = formData.greeting || "Hello! Thank you for calling our dental office. How can I assist you today?";
    testVoiceMutation.mutate(testText);
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!profile?.clinic_id) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Setup Required</h1>
          <p className="text-muted-foreground">
            Please complete clinic setup before configuring AI settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="space-y-2 mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          AI Configuration
        </h1>
        <p className="text-muted-foreground">
          Configure your AI receptionist's voice, behavior, and booking policies.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Voice Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Voice & Language Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="voice_provider">Voice Provider</Label>
                <Select 
                  value={formData.voice_provider} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, voice_provider: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select voice provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                    <SelectItem value="azure">Azure Cognitive Services</SelectItem>
                    <SelectItem value="openai-tts">OpenAI TTS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="voice_model">Voice Model</Label>
                <Select 
                  value={formData.voice_model} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, voice_model: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select voice model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eleven_multilingual_v2">ElevenLabs Multilingual v2</SelectItem>
                    <SelectItem value="eleven_turbo_v2">ElevenLabs Turbo v2</SelectItem>
                    <SelectItem value="eleven_turbo_v2_5">ElevenLabs Turbo v2.5</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="voice_id">Voice</Label>
                <Select 
                  value={formData.voice_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, voice_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9BWtsMINqrJLrRacOk9x">Aria (Female)</SelectItem>
                    <SelectItem value="CwhRBWXzGAHq8TQ4Fs17">Roger (Male)</SelectItem>
                    <SelectItem value="EXAVITQu4vr4xnSDxMaL">Sarah (Female)</SelectItem>
                    <SelectItem value="FGY2WhTYpPnrIDTdsKH5">Laura (Female)</SelectItem>
                    <SelectItem value="IKne3meq5aSn9XLyUdCD">Charlie (Male)</SelectItem>
                    <SelectItem value="JBFqnCBsd6RMkjVDRZzb">George (Male)</SelectItem>
                    <SelectItem value="N2lVS1w4EtoT3dr4eOWO">Callum (Male)</SelectItem>
                    <SelectItem value="SAz9YHcvj6GT2YYXdXww">River (Female)</SelectItem>
                    <SelectItem value="sIak7pFapfSLCfctxdOu">Clarice (Female)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="language">Language</Label>
                <Select 
                  value={formData.language} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="it">Italian</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="transfer_number">Transfer Number</Label>
                <Input
                  id="transfer_number"
                  value={formData.transfer_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, transfer_number: e.target.value }))}
                  placeholder="+1234567890"
                  type="tel"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="greeting">Custom Greeting</Label>
              <Textarea
                id="greeting"
                value={formData.greeting}
                onChange={(e) => setFormData(prev => ({ ...prev, greeting: e.target.value }))}
                placeholder="Hello! Thank you for calling our dental office. How can I assist you today?"
                rows={3}
              />
              <p className="text-sm text-muted-foreground mt-1">
                This greeting will be used when the AI answers calls. If empty, a default greeting will be used.
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const greeting = formData.greeting || "Hello! Thank you for calling our dental office. How can I assist you today?";
                    const languageText = formData.language === 'es' ? 'Spanish' : 
                                        formData.language === 'fr' ? 'French' : 
                                        formData.language === 'de' ? 'German' : 
                                        formData.language === 'it' ? 'Italian' : 'English';
                    setTestGreeting(`${greeting} (Language: ${languageText})`);
                  }}
                >
                  <Volume2 className="h-4 w-4 mr-1" />
                  Preview Text
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestVoice}
                  disabled={testVoiceMutation.isPending}
                  className="flex items-center gap-1"
                >
                  {testVoiceMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Test Voice
                </Button>
              </div>
              {testGreeting && (
                <div className="mt-2 p-3 bg-muted rounded-lg text-sm">
                  <strong>Preview:</strong> {testGreeting}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Booking Policies */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Policies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto_booking">Enable Automatic Booking</Label>
                <p className="text-sm text-muted-foreground">
                  Allow AI to automatically book appointments without human approval
                </p>
              </div>
              <Switch
                id="auto_booking"
                checked={formData.auto_booking_enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_booking_enabled: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="require_insurance">Require Insurance Information</Label>
                <p className="text-sm text-muted-foreground">
                  Always ask for insurance details before booking
                </p>
              </div>
              <Switch
                id="require_insurance"
                checked={formData.require_insurance}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, require_insurance: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="voice_enabled">Enable Voice Interface</Label>
                <p className="text-sm text-muted-foreground">
                  Allow AI to use voice synthesis and recognition for phone calls
                </p>
              </div>
              <Switch
                id="voice_enabled"
                checked={formData.voice_enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, voice_enabled: checked }))}
              />
            </div>

            <div>
              <Label htmlFor="max_advance_days">Maximum Advance Booking (Days)</Label>
              <Input
                id="max_advance_days"
                type="number"
                min="1"
                max="365"
                value={formData.max_advance_days}
                onChange={(e) => setFormData(prev => ({ ...prev, max_advance_days: parseInt(e.target.value) || 30 }))}
              />
              <p className="text-sm text-muted-foreground mt-1">
                How far in advance can patients book appointments
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Voice Testing */}
        {formData.voice_enabled && (
          <VoiceLatencyTest />
        )}

        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={saveSettingsMutation.isPending}
            className="flex items-center gap-2"
          >
            {saveSettingsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AISettingsPage;
