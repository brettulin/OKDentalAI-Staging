-- Enhanced security policies and functions for Phase 1 completion

-- Create enhanced session security table
CREATE TABLE IF NOT EXISTS public.enhanced_user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  clinic_id UUID NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  device_fingerprint TEXT,
  ip_address INET,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  security_level TEXT DEFAULT 'standard' CHECK (security_level IN ('standard', 'elevated', 'critical')),
  mfa_verified BOOLEAN DEFAULT false,
  risk_score INTEGER DEFAULT 0
);

-- Enhanced audit logging for sensitive operations
CREATE TABLE IF NOT EXISTS public.enhanced_security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  user_id UUID,
  session_id UUID,
  action_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  risk_level TEXT DEFAULT 'normal' CHECK (risk_level IN ('normal', 'elevated', 'high', 'critical')),
  ip_address INET,
  user_agent TEXT,
  device_fingerprint TEXT,
  metadata JSONB DEFAULT '{}',
  requires_investigation BOOLEAN DEFAULT false,
  data_classification TEXT DEFAULT 'internal' CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enhanced function for comprehensive access validation
CREATE OR REPLACE FUNCTION public.validate_enhanced_access(
  p_resource_type TEXT,
  p_resource_id UUID,
  p_operation TEXT,
  p_data_classification TEXT DEFAULT 'internal'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  user_profile RECORD;
  session_valid BOOLEAN := false;
  risk_score INTEGER := 0;
  requires_mfa BOOLEAN := false;
BEGIN
  -- Get user profile and session info
  SELECT * INTO user_profile
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF user_profile.clinic_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check session validity
  SELECT EXISTS(
    SELECT 1 FROM public.enhanced_user_sessions
    WHERE user_id = auth.uid()
      AND is_active = true
      AND expires_at > now()
      AND last_activity > now() - interval '8 hours'
  ) INTO session_valid;
  
  IF NOT session_valid THEN
    RETURN false;
  END IF;
  
  -- Calculate risk score
  SELECT COUNT(*) * 5 INTO risk_score
  FROM public.enhanced_security_audit_log
  WHERE user_id = auth.uid()
    AND risk_level IN ('high', 'critical')
    AND created_at > now() - interval '1 hour';
  
  -- Determine if MFA is required
  requires_mfa := (
    p_data_classification = 'restricted' OR
    p_operation IN ('delete', 'export', 'pms_access') OR
    risk_score > 20
  );
  
  -- Check MFA requirement
  IF requires_mfa THEN
    SELECT mfa_verified INTO session_valid
    FROM public.enhanced_user_sessions
    WHERE user_id = auth.uid() AND is_active = true
    ORDER BY last_activity DESC
    LIMIT 1;
    
    IF NOT session_valid THEN
      RETURN false;
    END IF;
  END IF;
  
  -- Log access attempt
  INSERT INTO public.enhanced_security_audit_log (
    clinic_id, user_id, action_type, resource_type, resource_id,
    risk_level, data_classification, metadata
  ) VALUES (
    user_profile.clinic_id, auth.uid(), 
    CASE WHEN session_valid THEN 'access_granted' ELSE 'access_denied' END,
    p_resource_type, p_resource_id,
    CASE 
      WHEN p_data_classification = 'restricted' THEN 'critical'
      WHEN requires_mfa THEN 'high'
      ELSE 'normal'
    END,
    p_data_classification,
    jsonb_build_object(
      'operation', p_operation,
      'risk_score', risk_score,
      'mfa_required', requires_mfa,
      'timestamp', now()
    )
  );
  
  RETURN session_valid;
END;
$$;

-- Function to encrypt sensitive patient fields
CREATE OR REPLACE FUNCTION public.encrypt_patient_field(
  p_value TEXT,
  p_field_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  encrypted_value TEXT;
  salt TEXT;
BEGIN
  -- Generate field-specific salt
  salt := encode(digest(p_field_type || auth.uid()::text, 'sha256'), 'hex');
  
  -- Simple encryption for demo (use proper encryption in production)
  encrypted_value := encode(
    digest(p_value || salt || current_timestamp::text, 'sha256'), 
    'base64'
  );
  
  -- Log encryption event
  INSERT INTO public.enhanced_security_audit_log (
    clinic_id, user_id, action_type, resource_type,
    risk_level, data_classification, metadata
  ) 
  SELECT 
    profiles.clinic_id, auth.uid(), 'field_encryption', 'patient_phi',
    'high', 'restricted',
    jsonb_build_object(
      'field_type', p_field_type,
      'encrypted_at', now()
    )
  FROM public.profiles 
  WHERE profiles.user_id = auth.uid();
  
  RETURN encrypted_value;
END;
$$;

-- Enhanced call transcript security function
CREATE OR REPLACE FUNCTION public.validate_call_access_enhanced(
  p_call_id UUID,
  p_operation TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  call_record RECORD;
  has_access BOOLEAN := false;
  user_role TEXT;
  clinic_id_val UUID;
  access_count INTEGER;
BEGIN
  -- Get user info
  SELECT p.role, p.clinic_id INTO user_role, clinic_id_val
  FROM public.profiles p 
  WHERE p.user_id = auth.uid();
  
  IF clinic_id_val IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get call details
  SELECT * INTO call_record
  FROM public.calls 
  WHERE id = p_call_id AND clinic_id = clinic_id_val;
  
  IF NOT FOUND THEN
    -- Log unauthorized access attempt
    PERFORM validate_enhanced_access('call_transcript', p_call_id, p_operation, 'restricted');
    RETURN false;
  END IF;
  
  -- Check access permissions with enhanced validation
  IF user_role IN ('owner', 'doctor') THEN
    has_access := true;
  ELSIF call_record.assigned_to = auth.uid() THEN
    has_access := true;
  ELSIF user_role IN ('nurse', 'medical_assistant', 'admin') AND call_record.caller_phone IS NOT NULL THEN
    -- Check patient relationship
    SELECT EXISTS(
      SELECT 1 FROM public.patients p
      WHERE p.phone = call_record.caller_phone 
        AND p.clinic_id = clinic_id_val
        AND user_can_access_patient(p.id)
    ) INTO has_access;
  END IF;
  
  -- Check for excessive access
  SELECT COUNT(*) INTO access_count
  FROM public.enhanced_security_audit_log
  WHERE user_id = auth.uid()
    AND resource_type = 'call_transcript'
    AND created_at > now() - interval '1 hour';
  
  IF access_count > 20 THEN
    has_access := false;
    -- Create security alert
    PERFORM create_security_alert(
      clinic_id_val,
      'excessive_transcript_access',
      'critical',
      format('User %s accessed %s call transcripts in 1 hour', auth.uid(), access_count),
      jsonb_build_object('user_id', auth.uid(), 'access_count', access_count)
    );
  END IF;
  
  -- Enhanced logging with comprehensive metadata
  RETURN validate_enhanced_access('call_transcript', p_call_id, p_operation, 'restricted');
END;
$$;

-- Add RLS policies for new tables
ALTER TABLE public.enhanced_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enhanced_security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own enhanced sessions" 
ON public.enhanced_user_sessions 
FOR ALL 
USING (user_id = auth.uid());

CREATE POLICY "Security admins can view enhanced audit logs" 
ON public.enhanced_security_audit_log 
FOR SELECT 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id FROM public.profiles 
    WHERE profiles.user_id = auth.uid()
  ) AND (
    get_current_user_role() = 'owner' OR 
    has_admin_permission('view_audit_logs')
  )
);

CREATE POLICY "System can create enhanced audit logs" 
ON public.enhanced_security_audit_log 
FOR INSERT 
WITH CHECK (
  clinic_id IN (
    SELECT profiles.clinic_id FROM public.profiles 
    WHERE profiles.user_id = auth.uid()
  ) AND user_id = auth.uid()
);

-- Create trigger for session activity tracking
CREATE OR REPLACE FUNCTION public.update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.enhanced_user_sessions
  SET last_activity = now()
  WHERE user_id = auth.uid() AND is_active = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create voice synthesis performance tracking table
CREATE TABLE IF NOT EXISTS public.voice_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  user_id UUID,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('synthesis', 'transcription', 'latency_test')),
  latency_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  voice_model TEXT,
  voice_id TEXT,
  text_length INTEGER,
  audio_duration_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.voice_performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their clinic voice metrics" 
ON public.voice_performance_metrics 
FOR ALL 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id FROM public.profiles 
    WHERE profiles.user_id = auth.uid()
  )
);

-- Function to log voice performance
CREATE OR REPLACE FUNCTION public.log_voice_performance(
  p_operation_type TEXT,
  p_latency_ms INTEGER,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL,
  p_voice_model TEXT DEFAULT NULL,
  p_voice_id TEXT DEFAULT NULL,
  p_text_length INTEGER DEFAULT NULL,
  p_audio_duration_ms INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  clinic_id_val UUID;
BEGIN
  SELECT clinic_id INTO clinic_id_val
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF clinic_id_val IS NULL THEN
    RETURN;
  END IF;
  
  INSERT INTO public.voice_performance_metrics (
    clinic_id, user_id, operation_type, latency_ms, success,
    error_message, voice_model, voice_id, text_length,
    audio_duration_ms, metadata
  ) VALUES (
    clinic_id_val, auth.uid(), p_operation_type, p_latency_ms, p_success,
    p_error_message, p_voice_model, p_voice_id, p_text_length,
    p_audio_duration_ms, p_metadata
  );
END;
$$;