-- Phase 1 Completion Check & Phase 2 Implementation

-- First, complete Phase 1 by fixing the linter issue
-- Fix security definer view issue
DROP VIEW IF EXISTS public.office_pms_status;

-- Create a proper function instead of a security definer view
CREATE OR REPLACE FUNCTION public.get_office_pms_status()
RETURNS TABLE(
  office_id uuid,
  name text,
  clinic_id uuid,
  pms_type text,
  has_credentials boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id as office_id,
    o.name,
    o.clinic_id,
    o.pms_type,
    CASE 
      WHEN EXISTS (SELECT 1 FROM private.pms_credentials pc WHERE pc.office_id = o.id) 
      THEN true 
      ELSE false 
    END as has_credentials,
    o.created_at,
    o.updated_at
  FROM public.offices o
  WHERE o.clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  );
END;
$$;

-- Phase 1 is now complete. Starting Phase 2: Advanced Security Features

-- 1. Enhanced session security with automatic timeout
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_token text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  last_activity timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  ip_address inet,
  user_agent text,
  is_active boolean DEFAULT true,
  clinic_id uuid NOT NULL
);

-- RLS for user sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions" ON public.user_sessions
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own sessions" ON public.user_sessions
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can insert sessions" ON public.user_sessions
FOR INSERT WITH CHECK (user_id = auth.uid());

-- 2. Enhanced password security requirements
CREATE TABLE IF NOT EXISTS public.password_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  password_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  clinic_id uuid NOT NULL
);

ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own password history" ON public.password_history
FOR SELECT USING (user_id = auth.uid());

-- 3. Two-factor authentication support
CREATE TABLE IF NOT EXISTS public.user_mfa (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  secret text NOT NULL,
  backup_codes text[],
  enabled boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  last_used timestamp with time zone,
  clinic_id uuid NOT NULL
);

ALTER TABLE public.user_mfa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own MFA" ON public.user_mfa
FOR ALL USING (user_id = auth.uid());

-- 4. Device fingerprinting for security
CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  device_fingerprint text NOT NULL,
  device_name text,
  created_at timestamp with time zone DEFAULT now(),
  last_used timestamp with time zone DEFAULT now(),
  is_trusted boolean DEFAULT false,
  clinic_id uuid NOT NULL
);

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices" ON public.trusted_devices
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own devices" ON public.trusted_devices
FOR UPDATE USING (user_id = auth.uid());

-- 5. Advanced threat detection
CREATE TABLE IF NOT EXISTS public.security_threats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  threat_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  source_ip inet,
  user_id uuid,
  clinic_id uuid NOT NULL,
  threat_data jsonb DEFAULT '{}',
  status text DEFAULT 'active',
  detected_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone,
  resolved_by uuid
);

ALTER TABLE public.security_threats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and security admins can view threats" ON public.security_threats
FOR SELECT USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ) AND (
    get_current_user_role() = 'owner' OR
    has_admin_permission('view_audit_logs')
  )
);

-- 6. Data loss prevention (DLP)
CREATE TABLE IF NOT EXISTS public.data_classification (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL,
  column_name text NOT NULL,
  classification_level text NOT NULL, -- public, internal, confidential, restricted
  encryption_required boolean DEFAULT false,
  access_log_required boolean DEFAULT true,
  clinic_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.data_classification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tech admins can manage data classification" ON public.data_classification
FOR ALL USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ) AND (
    get_current_user_role() = 'owner' OR
    has_admin_permission('manage_clinic_settings')
  )
);

-- 7. Advanced encryption key management
CREATE TABLE IF NOT EXISTS private.encryption_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key_name text NOT NULL UNIQUE,
  key_data text NOT NULL,
  algorithm text NOT NULL DEFAULT 'AES-256-GCM',
  created_at timestamp with time zone DEFAULT now(),
  rotated_at timestamp with time zone,
  is_active boolean DEFAULT true,
  clinic_id uuid NOT NULL
);

-- Completely lock down encryption keys
REVOKE ALL ON private.encryption_keys FROM anon, authenticated;

-- 8. Security compliance framework
CREATE TABLE IF NOT EXISTS public.compliance_frameworks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  framework_name text NOT NULL, -- HIPAA, SOC2, GDPR, etc.
  version text,
  requirements jsonb NOT NULL DEFAULT '{}',
  compliance_status text DEFAULT 'pending',
  last_assessment timestamp with time zone,
  next_assessment timestamp with time zone,
  clinic_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.compliance_frameworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Compliance admins can manage frameworks" ON public.compliance_frameworks
FOR ALL USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ) AND (
    get_current_user_role() = 'owner' OR
    has_admin_permission('manage_clinic_settings')
  )
);

-- 9. Advanced session management functions
CREATE OR REPLACE FUNCTION public.validate_session_security()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  session_record RECORD;
  is_valid boolean DEFAULT false;
BEGIN
  -- Check for active session with proper security checks
  SELECT * INTO session_record
  FROM public.user_sessions
  WHERE user_id = auth.uid()
    AND is_active = true
    AND expires_at > now()
    AND last_activity > now() - interval '8 hours';
  
  IF FOUND THEN
    -- Update last activity
    UPDATE public.user_sessions
    SET last_activity = now()
    WHERE id = session_record.id;
    
    is_valid := true;
  END IF;
  
  RETURN is_valid;
END;
$$;

-- 10. Threat detection function
CREATE OR REPLACE FUNCTION public.detect_security_threats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  clinic_id_val uuid;
  suspicious_activity RECORD;
BEGIN
  -- Get clinic ID
  SELECT clinic_id INTO clinic_id_val
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  -- Detect brute force attempts
  FOR suspicious_activity IN
    SELECT user_id, COUNT(*) as attempt_count
    FROM public.security_audit_log
    WHERE action_type LIKE '%denied%'
      AND created_at > now() - interval '1 hour'
      AND clinic_id = clinic_id_val
    GROUP BY user_id
    HAVING COUNT(*) > 10
  LOOP
    INSERT INTO public.security_threats (
      threat_type,
      severity,
      user_id,
      clinic_id,
      threat_data
    ) VALUES (
      'brute_force_attack',
      'high',
      suspicious_activity.user_id,
      clinic_id_val,
      jsonb_build_object(
        'attempt_count', suspicious_activity.attempt_count,
        'detection_window', '1_hour'
      )
    );
  END LOOP;
  
  -- Detect unusual data access patterns
  FOR suspicious_activity IN
    SELECT user_id, COUNT(*) as access_count
    FROM public.security_audit_log
    WHERE resource_type IN ('patient_phi', 'call_transcript')
      AND created_at > now() - interval '4 hours'
      AND clinic_id = clinic_id_val
    GROUP BY user_id
    HAVING COUNT(*) > 100
  LOOP
    INSERT INTO public.security_threats (
      threat_type,
      severity,
      user_id,
      clinic_id,
      threat_data
    ) VALUES (
      'excessive_data_access',
      'medium',
      suspicious_activity.user_id,
      clinic_id_val,
      jsonb_build_object(
        'access_count', suspicious_activity.access_count,
        'detection_window', '4_hours'
      )
    );
  END LOOP;
END;
$$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON public.user_sessions(user_id, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_security_threats_clinic_status ON public.security_threats(clinic_id, status, detected_at);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON public.trusted_devices(user_id, is_trusted);

-- Phase 2 Complete: Advanced Security Features Implemented