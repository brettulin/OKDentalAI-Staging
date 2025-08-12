-- Phase 1: Critical Data Protection

-- 1. Enhance Call Data Access Controls
-- Drop existing permissive policies and create more restrictive ones
DROP POLICY IF EXISTS "Clinic isolation policy" ON public.calls;
DROP POLICY IF EXISTS "Clinic isolation policy" ON public.turns;

-- Create more restrictive policies for calls table
CREATE POLICY "Medical staff can view calls" 
ON public.calls 
FOR SELECT 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND get_current_user_role() = ANY (ARRAY['owner'::text, 'doctor'::text, 'nurse'::text, 'medical_assistant'::text])
);

CREATE POLICY "Medical staff can create calls" 
ON public.calls 
FOR INSERT 
WITH CHECK (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND get_current_user_role() = ANY (ARRAY['owner'::text, 'doctor'::text, 'nurse'::text, 'medical_assistant'::text])
);

CREATE POLICY "Medical staff can update calls" 
ON public.calls 
FOR UPDATE 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND get_current_user_role() = ANY (ARRAY['owner'::text, 'doctor'::text, 'nurse'::text, 'medical_assistant'::text])
);

-- Only owners can delete calls (for compliance)
CREATE POLICY "Only owners can delete calls" 
ON public.calls 
FOR DELETE 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND get_current_user_role() = 'owner'::text
);

-- Create more restrictive policies for turns table (call transcripts)
CREATE POLICY "Medical staff can view turns" 
ON public.turns 
FOR SELECT 
USING (
  call_id IN (
    SELECT calls.id
    FROM calls
    WHERE calls.clinic_id IN (
      SELECT profiles.clinic_id
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
  ) 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = ANY (ARRAY['owner'::text, 'doctor'::text, 'nurse'::text, 'medical_assistant'::text])
  )
);

CREATE POLICY "Medical staff can create turns" 
ON public.turns 
FOR INSERT 
WITH CHECK (
  call_id IN (
    SELECT calls.id
    FROM calls
    WHERE calls.clinic_id IN (
      SELECT profiles.clinic_id
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
  ) 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = ANY (ARRAY['owner'::text, 'doctor'::text, 'nurse'::text, 'medical_assistant'::text])
  )
);

CREATE POLICY "Medical staff can update turns" 
ON public.turns 
FOR UPDATE 
USING (
  call_id IN (
    SELECT calls.id
    FROM calls
    WHERE calls.clinic_id IN (
      SELECT profiles.clinic_id
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
  ) 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = ANY (ARRAY['owner'::text, 'doctor'::text, 'nurse'::text, 'medical_assistant'::text])
  )
);

-- Only owners can delete turns
CREATE POLICY "Only owners can delete turns" 
ON public.turns 
FOR DELETE 
USING (
  call_id IN (
    SELECT calls.id
    FROM calls
    WHERE calls.clinic_id IN (
      SELECT profiles.clinic_id
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
  ) 
  AND get_current_user_role() = 'owner'::text
);

-- 2. Add encryption support for PMS credentials
-- Add encrypted_credentials column for future use
ALTER TABLE public.offices 
ADD COLUMN IF NOT EXISTS encrypted_credentials text;

-- 3. Enhanced audit logging for sensitive data access
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  action_type text NOT NULL, -- 'view_patient', 'view_call', 'view_transcript', 'export_data'
  resource_type text NOT NULL, -- 'patient', 'call', 'turn', 'appointment'
  resource_id uuid,
  ip_address inet,
  user_agent text,
  risk_level text DEFAULT 'normal', -- 'normal', 'elevated', 'high'
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on security audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only owners and admins can view security audit logs
CREATE POLICY "Owners and admins can view security audit logs" 
ON public.security_audit_log 
FOR SELECT 
USING (
  clinic_id IN (
    SELECT profiles.clinic_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  ) 
  AND get_current_user_role() = ANY (ARRAY['owner'::text, 'admin'::text])
);

-- System can insert audit logs
CREATE POLICY "System can create audit logs" 
ON public.security_audit_log 
FOR INSERT 
WITH CHECK (true);

-- Create function to log sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_access(
  p_clinic_id uuid,
  p_action_type text,
  p_resource_type text,
  p_resource_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.security_audit_log (
    clinic_id,
    user_id,
    action_type,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    p_clinic_id,
    auth.uid(),
    p_action_type,
    p_resource_type,
    p_resource_id,
    p_metadata
  );
END;
$$;

-- 4. Add data validation constraints
-- Add constraint to ensure call outcomes are valid
ALTER TABLE public.calls 
ADD CONSTRAINT valid_call_outcome 
CHECK (outcome IS NULL OR outcome = ANY(get_allowed_call_outcomes()));

-- Add constraint to ensure turn roles are valid
ALTER TABLE public.turns 
ADD CONSTRAINT valid_turn_role 
CHECK (role IN ('user', 'assistant', 'system'));

-- 5. Add indexes for security monitoring
CREATE INDEX IF NOT EXISTS idx_security_audit_log_clinic_action 
ON public.security_audit_log (clinic_id, action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_risk 
ON public.security_audit_log (user_id, risk_level, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calls_clinic_outcome 
ON public.calls (clinic_id, outcome, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_patients_clinic_created 
ON public.patients (clinic_id, created_at DESC);