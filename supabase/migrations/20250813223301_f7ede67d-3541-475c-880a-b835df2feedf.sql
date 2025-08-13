-- Step 4: Data Isolation & Security Hardening
-- Enhanced RLS policies for strict data isolation and comprehensive audit logging

-- Create comprehensive security audit log table
CREATE TABLE IF NOT EXISTS public.security_audit_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL,
  user_id UUID,
  session_id UUID,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL DEFAULT 'access',
  resource_type TEXT,
  resource_id UUID,
  risk_level TEXT NOT NULL DEFAULT 'normal',
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requires_investigation BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;

-- Create policies for security audit events
CREATE POLICY "Security admins can view audit events" 
ON public.security_audit_events 
FOR SELECT 
USING (
  clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid()) AND
  (get_current_user_role() = 'owner' OR has_admin_permission('view_audit_logs'))
);

CREATE POLICY "System can create audit events" 
ON public.security_audit_events 
FOR INSERT 
WITH CHECK (
  clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
);

-- Create enhanced session security table
CREATE TABLE IF NOT EXISTS public.secure_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  clinic_id UUID NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  device_fingerprint TEXT,
  ip_address INET,
  user_agent TEXT,
  mfa_verified BOOLEAN DEFAULT false,
  risk_score INTEGER DEFAULT 0,
  last_activity TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.secure_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for secure sessions
CREATE POLICY "Users can manage their own sessions" 
ON public.secure_sessions 
FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create data encryption tracking table
CREATE TABLE IF NOT EXISTS public.data_encryption_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  encryption_type TEXT NOT NULL DEFAULT 'aes256',
  encrypted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  encrypted_by UUID NOT NULL,
  key_version INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.data_encryption_log ENABLE ROW LEVEL SECURITY;

-- Create policies for encryption log
CREATE POLICY "Tech admins can view encryption log" 
ON public.data_encryption_log 
FOR SELECT 
USING (
  clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid()) AND
  (get_current_user_role() = 'owner' OR has_admin_permission('manage_security'))
);

-- Enhanced security functions

-- Function to log security events with enhanced context
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type TEXT,
  p_event_category TEXT DEFAULT 'access',
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_risk_level TEXT DEFAULT 'normal',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  clinic_id_val UUID;
  session_info RECORD;
BEGIN
  -- Get user's clinic
  SELECT clinic_id INTO clinic_id_val
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF clinic_id_val IS NULL THEN
    RETURN; -- No clinic associated, skip logging
  END IF;
  
  -- Get session information if available
  SELECT ip_address, user_agent INTO session_info
  FROM public.secure_sessions
  WHERE user_id = auth.uid() AND is_active = true
  ORDER BY last_activity DESC
  LIMIT 1;
  
  -- Insert security audit event
  INSERT INTO public.security_audit_events (
    clinic_id,
    user_id,
    event_type,
    event_category,
    resource_type,
    resource_id,
    risk_level,
    ip_address,
    user_agent,
    metadata,
    requires_investigation
  ) VALUES (
    clinic_id_val,
    auth.uid(),
    p_event_type,
    p_event_category,
    p_resource_type,
    p_resource_id,
    p_risk_level,
    session_info.ip_address,
    session_info.user_agent,
    p_metadata,
    p_risk_level IN ('high', 'critical')
  );
END;
$$;

-- Function to create secure session
CREATE OR REPLACE FUNCTION public.create_secure_session(
  p_device_fingerprint TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  clinic_id_val UUID;
  session_token TEXT;
  session_id UUID;
BEGIN
  -- Get user's clinic
  SELECT clinic_id INTO clinic_id_val
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF clinic_id_val IS NULL THEN
    RAISE EXCEPTION 'User not associated with a clinic';
  END IF;
  
  -- Generate secure session token
  session_token := encode(gen_random_bytes(32), 'base64');
  
  -- Create secure session
  INSERT INTO public.secure_sessions (
    user_id,
    clinic_id,
    session_token,
    device_fingerprint,
    ip_address,
    user_agent,
    expires_at
  ) VALUES (
    auth.uid(),
    clinic_id_val,
    session_token,
    p_device_fingerprint,
    p_ip_address,
    p_user_agent,
    now() + interval '8 hours'
  ) RETURNING id INTO session_id;
  
  -- Log session creation
  PERFORM log_security_event(
    'session_created',
    'authentication',
    'user_session',
    session_id,
    'normal',
    jsonb_build_object(
      'device_fingerprint', p_device_fingerprint,
      'ip_address', p_ip_address
    )
  );
  
  RETURN session_token;
END;
$$;

-- Function to validate and update session
CREATE OR REPLACE FUNCTION public.validate_secure_session(p_session_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  session_record RECORD;
  clinic_id_val UUID;
BEGIN
  -- Get user's clinic
  SELECT clinic_id INTO clinic_id_val
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  -- Find and validate session
  SELECT * INTO session_record
  FROM public.secure_sessions
  WHERE session_token = p_session_token
    AND user_id = auth.uid()
    AND clinic_id = clinic_id_val
    AND is_active = true
    AND expires_at > now();
  
  IF NOT FOUND THEN
    -- Log invalid session attempt
    PERFORM log_security_event(
      'invalid_session_access',
      'authentication',
      'user_session',
      NULL,
      'high',
      jsonb_build_object('session_token_partial', left(p_session_token, 8))
    );
    RETURN false;
  END IF;
  
  -- Update last activity
  UPDATE public.secure_sessions
  SET last_activity = now()
  WHERE id = session_record.id;
  
  RETURN true;
END;
$$;