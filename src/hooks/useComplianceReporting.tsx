import { useCallback, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ComplianceReportRequest {
  reportType: 'hipaa' | 'audit' | 'security' | 'access';
  startDate?: string;
  endDate?: string;
  clinicId?: string;
}

interface ComplianceReport {
  reportType: string;
  period: {
    start: string;
    end: string;
  };
  metrics: Record<string, any>;
  generatedAt: string;
  generatedBy: string;
}

export const useComplianceReporting = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [lastReport, setLastReport] = useState<ComplianceReport | null>(null);

  // Check if user has permission to generate compliance reports
  const hasCompliancePermission = useCallback((): boolean => {
    return profile?.role === 'owner' || profile?.admin_role === 'technical_admin';
  }, [profile]);

  // Generate HIPAA compliance report
  const generateHIPAAReport = useCallback(async (
    startDate?: string,
    endDate?: string
  ): Promise<ComplianceReport | null> => {
    if (!hasCompliancePermission()) {
      throw new Error('Insufficient permissions for HIPAA compliance reporting');
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('security-compliance-reporter', {
        body: {
          reportType: 'hipaa',
          startDate,
          endDate,
          clinicId: profile?.clinic_id
        }
      });

      if (error) {
        console.error('HIPAA report generation failed:', error);
        throw new Error(`HIPAA report generation failed: ${error.message}`);
      }

      const report: ComplianceReport = {
        ...data,
        generatedAt: new Date().toISOString(),
        generatedBy: profile?.user_id || 'unknown'
      };

      setLastReport(report);
      return report;
    } catch (error) {
      console.error('HIPAA report error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [profile, hasCompliancePermission]);

  // Generate security audit report
  const generateSecurityAuditReport = useCallback(async (
    startDate?: string,
    endDate?: string
  ): Promise<ComplianceReport | null> => {
    if (!hasCompliancePermission()) {
      throw new Error('Insufficient permissions for security audit reporting');
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('security-compliance-reporter', {
        body: {
          reportType: 'audit',
          startDate,
          endDate,
          clinicId: profile?.clinic_id
        }
      });

      if (error) {
        console.error('Security audit report generation failed:', error);
        throw new Error(`Security audit report generation failed: ${error.message}`);
      }

      const report: ComplianceReport = {
        ...data,
        generatedAt: new Date().toISOString(),
        generatedBy: profile?.user_id || 'unknown'
      };

      setLastReport(report);
      return report;
    } catch (error) {
      console.error('Security audit report error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [profile, hasCompliancePermission]);

  // Generate security alerts report
  const generateSecurityAlertsReport = useCallback(async (
    startDate?: string,
    endDate?: string
  ): Promise<ComplianceReport | null> => {
    if (!hasCompliancePermission()) {
      throw new Error('Insufficient permissions for security alerts reporting');
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('security-compliance-reporter', {
        body: {
          reportType: 'security',
          startDate,
          endDate,
          clinicId: profile?.clinic_id
        }
      });

      if (error) {
        console.error('Security alerts report generation failed:', error);
        throw new Error(`Security alerts report generation failed: ${error.message}`);
      }

      const report: ComplianceReport = {
        ...data,
        generatedAt: new Date().toISOString(),
        generatedBy: profile?.user_id || 'unknown'
      };

      setLastReport(report);
      return report;
    } catch (error) {
      console.error('Security alerts report error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [profile, hasCompliancePermission]);

  // Generate access control report
  const generateAccessControlReport = useCallback(async (
    startDate?: string,
    endDate?: string
  ): Promise<ComplianceReport | null> => {
    if (!hasCompliancePermission()) {
      throw new Error('Insufficient permissions for access control reporting');
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('security-compliance-reporter', {
        body: {
          reportType: 'access',
          startDate,
          endDate,
          clinicId: profile?.clinic_id
        }
      });

      if (error) {
        console.error('Access control report generation failed:', error);
        throw new Error(`Access control report generation failed: ${error.message}`);
      }

      const report: ComplianceReport = {
        ...data,
        generatedAt: new Date().toISOString(),
        generatedBy: profile?.user_id || 'unknown'
      };

      setLastReport(report);
      return report;
    } catch (error) {
      console.error('Access control report error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [profile, hasCompliancePermission]);

  // Generate comprehensive compliance report
  const generateComprehensiveReport = useCallback(async (
    startDate?: string,
    endDate?: string
  ): Promise<Record<string, ComplianceReport> | null> => {
    if (!hasCompliancePermission()) {
      throw new Error('Insufficient permissions for comprehensive compliance reporting');
    }

    try {
      const [hipaaReport, auditReport, securityReport, accessReport] = await Promise.all([
        generateHIPAAReport(startDate, endDate),
        generateSecurityAuditReport(startDate, endDate),
        generateSecurityAlertsReport(startDate, endDate),
        generateAccessControlReport(startDate, endDate)
      ]);

      return {
        hipaa: hipaaReport!,
        audit: auditReport!,
        security: securityReport!,
        access: accessReport!
      };
    } catch (error) {
      console.error('Comprehensive report generation error:', error);
      throw error;
    }
  }, [generateHIPAAReport, generateSecurityAuditReport, generateSecurityAlertsReport, generateAccessControlReport, hasCompliancePermission]);

  return {
    loading,
    lastReport,
    hasCompliancePermission,
    generateHIPAAReport,
    generateSecurityAuditReport,
    generateSecurityAlertsReport,
    generateAccessControlReport,
    generateComprehensiveReport
  };
};