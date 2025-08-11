import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface AuthContext {
  user: any;
  clinic_id: string;
  profile: any;
}

export async function getAuthContext(req: Request): Promise<AuthContext> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Authorization header required');
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    throw new Error('Invalid authentication token');
  }

  // Get user's profile with clinic_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile?.clinic_id) {
    throw new Error('User not associated with a clinic');
  }

  return {
    user,
    clinic_id: profile.clinic_id,
    profile
  };
}

export function createAuthenticatedSupabaseClient(authContext?: AuthContext) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}