import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAuthContext } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Server-side AES-GCM encryption for PMS credentials
class ServerEncryption {
  private key: CryptoKey | null = null;

  private async getKey(): Promise<CryptoKey> {
    if (!this.key) {
      const keyData = Deno.env.get('ENCRYPTION_KEY');
      if (!keyData) {
        // Generate a new key if none exists
        this.key = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        
        // In production, this key should be stored securely
        const exported = await crypto.subtle.exportKey('raw', this.key);
        const keyString = btoa(String.fromCharCode(...new Uint8Array(exported)));
        console.log('Generated new encryption key:', keyString);
      } else {
        const keyBuffer = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
        this.key = await crypto.subtle.importKey(
          'raw',
          keyBuffer,
          { name: 'AES-GCM' },
          true,
          ['encrypt', 'decrypt']
        );
      }
    }
    return this.key;
  }

  async encrypt(data: string): Promise<string> {
    const key = await this.getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(data);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );
    
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(encryptedData: string): Promise<string> {
    const key = await this.getKey();
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  }
}

const encryption = new ServerEncryption();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authContext = await getAuthContext(req);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, officeId, credentials } = await req.json();

    console.log(`Secure PMS Handler - Action: ${action}, Office: ${officeId}`);

    switch (action) {
      case 'encrypt_credentials': {
        if (!credentials) {
          throw new Error('Credentials are required for encryption');
        }

        const encryptedCredentials = await encryption.encrypt(JSON.stringify(credentials));
        
        // Update office with encrypted credentials
        const { error } = await supabase
          .from('offices')
          .update({ 
            encrypted_credentials: encryptedCredentials,
            updated_at: new Date().toISOString()
          })
          .eq('id', officeId)
          .eq('clinic_id', authContext.clinic_id);

        if (error) throw error;

        // Log security event
        await supabase
          .from('security_audit_log')
          .insert({
            clinic_id: authContext.clinic_id,
            user_id: authContext.user.id,
            action_type: 'credentials_encrypted',
            resource_type: 'office',
            resource_id: officeId,
            metadata: { 
              timestamp: new Date().toISOString(),
              risk_level: 'elevated'
            }
          });

        return new Response(
          JSON.stringify({ success: true, message: 'Credentials encrypted successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'decrypt_credentials': {
        // Fetch office with encrypted credentials
        const { data: office, error } = await supabase
          .from('offices')
          .select('encrypted_credentials')
          .eq('id', officeId)
          .eq('clinic_id', authContext.clinic_id)
          .single();

        if (error || !office?.encrypted_credentials) {
          throw new Error('Office credentials not found');
        }

        const decryptedCredentials = await encryption.decrypt(office.encrypted_credentials);
        
        // Log access
        await supabase
          .from('security_audit_log')
          .insert({
            clinic_id: authContext.clinic_id,
            user_id: authContext.user.id,
            action_type: 'credentials_accessed',
            resource_type: 'office',
            resource_id: officeId,
            metadata: { 
              timestamp: new Date().toISOString(),
              risk_level: 'elevated'
            }
          });

        return new Response(
          JSON.stringify({ 
            success: true, 
            credentials: JSON.parse(decryptedCredentials) 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Secure PMS Handler error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});