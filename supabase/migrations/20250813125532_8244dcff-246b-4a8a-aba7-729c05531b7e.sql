-- Create function to validate production readiness
CREATE OR REPLACE FUNCTION public.validate_production_readiness(p_clinic_id uuid)
RETURNS TABLE(
  check_name text,
  status text,
  details text
) AS $$
DECLARE
  has_patients boolean;
  has_providers boolean;
  has_locations boolean;
  has_services boolean;
  has_pms_config boolean;
  has_ai_settings boolean;
  recent_calls_count integer;
  security_alerts_count integer;
  audit_log_count integer;
BEGIN
  -- Check if clinic has basic setup data
  SELECT EXISTS(SELECT 1 FROM public.patients WHERE clinic_id = p_clinic_id) INTO has_patients;
  SELECT EXISTS(SELECT 1 FROM public.providers WHERE clinic_id = p_clinic_id) INTO has_providers;
  SELECT EXISTS(SELECT 1 FROM public.locations WHERE clinic_id = p_clinic_id) INTO has_locations;
  SELECT EXISTS(SELECT 1 FROM public.services WHERE clinic_id = p_clinic_id) INTO has_services;
  SELECT EXISTS(SELECT 1 FROM public.offices WHERE clinic_id = p_clinic_id AND pms_type IS NOT NULL) INTO has_pms_config;
  SELECT EXISTS(SELECT 1 FROM public.ai_settings WHERE clinic_id = p_clinic_id) INTO has_ai_settings;
  
  -- Check operational readiness
  SELECT COUNT(*) FROM public.calls 
  WHERE clinic_id = p_clinic_id AND created_at > now() - interval '7 days' 
  INTO recent_calls_count;
  
  -- Check security status
  SELECT COUNT(*) FROM public.security_alerts 
  WHERE clinic_id = p_clinic_id AND resolved = false AND severity IN ('high', 'critical') 
  INTO security_alerts_count;
  
  SELECT COUNT(*) FROM public.security_audit_log 
  WHERE clinic_id = p_clinic_id AND created_at > now() - interval '24 hours' 
  INTO audit_log_count;

  -- Return readiness checks
  RETURN QUERY VALUES
    ('pms_integration', 
     CASE WHEN has_pms_config THEN 'PASS' ELSE 'FAIL' END,
     CASE WHEN has_pms_config THEN 'PMS integration configured' ELSE 'PMS integration not configured' END),
    
    ('clinic_data', 
     CASE WHEN has_providers AND has_locations AND has_services THEN 'PASS' ELSE 'FAIL' END,
     CASE 
       WHEN has_providers AND has_locations AND has_services THEN 'Clinic data complete'
       ELSE 'Missing: ' || 
         CASE WHEN NOT has_providers THEN 'providers ' ELSE '' END ||
         CASE WHEN NOT has_locations THEN 'locations ' ELSE '' END ||
         CASE WHEN NOT has_services THEN 'services' ELSE '' END
     END),
    
    ('ai_configuration', 
     CASE WHEN has_ai_settings THEN 'PASS' ELSE 'FAIL' END,
     CASE WHEN has_ai_settings THEN 'AI settings configured' ELSE 'AI settings not configured' END),
    
    ('security_status', 
     CASE WHEN security_alerts_count = 0 THEN 'PASS' ELSE 'FAIL' END,
     CASE 
       WHEN security_alerts_count = 0 THEN 'No active security alerts'
       ELSE security_alerts_count::text || ' unresolved security alerts'
     END),
    
    ('operational_testing', 
     CASE WHEN recent_calls_count > 0 THEN 'PASS' ELSE 'WARN' END,
     CASE 
       WHEN recent_calls_count > 0 THEN recent_calls_count::text || ' calls in last 7 days'
       ELSE 'No recent call activity for testing'
     END),
    
    ('audit_logging', 
     CASE WHEN audit_log_count > 0 THEN 'PASS' ELSE 'WARN' END,
     CASE 
       WHEN audit_log_count > 0 THEN 'Audit logging active'
       ELSE 'No recent audit activity'
     END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;