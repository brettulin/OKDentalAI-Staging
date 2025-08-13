import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const superadminEmail = Deno.env.get('SUPERADMIN_EMAIL');
    
    if (!superadminEmail) {
      console.error('SUPERADMIN_EMAIL environment variable not set');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'SUPERADMIN_EMAIL not configured' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Looking up user with email:', superadminEmail);

    // Find the auth user by email using admin client
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('Error listing users:', usersError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to list users' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const targetUser = users.users.find(user => user.email === superadminEmail);
    
    if (!targetUser) {
      console.error('User not found with email:', superadminEmail);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `User with email ${superadminEmail} not found` 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Found user:', targetUser.id);

    // Upsert into platform_users
    const { data: platformUser, error: upsertError } = await supabase
      .from('platform_users')
      .upsert({
        user_id: targetUser.id,
        email: superadminEmail,
        role: 'superadmin'
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Error upserting platform user:', upsertError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to create platform user' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Successfully created/updated platform superadmin:', platformUser);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          user_id: platformUser.user_id,
          email: platformUser.email,
          role: platformUser.role,
          created_at: platformUser.created_at
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});