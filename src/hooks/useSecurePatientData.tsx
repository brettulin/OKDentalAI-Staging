import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';
import { supabase } from '@/integrations/supabase/client';
import { encryptPatientField, decryptPatientField, maskSensitiveData } from '@/utils/encryption';

interface Patient {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
  dob?: string;
  notes?: string;
  clinic_id: string;
}

interface SecurePatientData extends Omit<Patient, 'phone' | 'email' | 'dob'> {
  phone_masked?: string;
  email_masked?: string;
  dob_masked?: string;
  phone_encrypted?: string;
  email_encrypted?: string;
  dob_encrypted?: string;
}

export const useSecurePatientData = () => {
  const { profile } = useAuth();
  const { logAccess } = useSecurityAudit();
  const [patients, setPatients] = useState<SecurePatientData[]>([]);
  const [loading, setLoading] = useState(false);

  const logPatientAccess = async (patientId: string, action: string) => {
    await logAccess({
      action_type: action,
      resource_type: 'patient',
      resource_id: patientId,
      metadata: {
        timestamp: new Date().toISOString(),
        high_risk: true
      }
    });
  };

  const fetchPatients = async (searchTerm?: string) => {
    if (!profile?.clinic_id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('patients')
        .select('*')
        .eq('clinic_id', profile.clinic_id);

      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Log access to patient list
      await logAccess({
        action_type: 'view_patient_list',
        resource_type: 'patient',
        metadata: {
          search_term: searchTerm,
          result_count: data?.length || 0
        }
      });

      // Process and mask sensitive data
      const securePatients: SecurePatientData[] = data?.map(patient => ({
        id: patient.id,
        full_name: patient.full_name,
        clinic_id: patient.clinic_id,
        notes: patient.notes,
        phone_masked: patient.phone ? maskSensitiveData(patient.phone, 4) : undefined,
        email_masked: patient.email ? maskSensitiveData(patient.email, 3) : undefined,
        dob_masked: patient.dob ? maskSensitiveData(patient.dob, 0) : undefined,
        phone_encrypted: patient.phone,
        email_encrypted: patient.email,
        dob_encrypted: patient.dob
      })) || [];

      setPatients(securePatients);
    } catch (error) {
      console.error('Error fetching patients:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getPatientDetails = async (patientId: string): Promise<Patient | null> => {
    if (!profile?.clinic_id) return null;

    try {
      // Log access to specific patient
      await logPatientAccess(patientId, 'view_patient_details');

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .eq('clinic_id', profile.clinic_id)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching patient details:', error);
      throw error;
    }
  };

  const createPatient = async (patientData: Omit<Patient, 'id' | 'clinic_id'>) => {
    if (!profile?.clinic_id) throw new Error('No clinic associated');

    try {
      // Encrypt sensitive fields before storing
      const encryptedData = {
        ...patientData,
        clinic_id: profile.clinic_id,
        phone: patientData.phone ? await encryptPatientField(patientData.phone, 'phone') : null,
        email: patientData.email ? await encryptPatientField(patientData.email, 'email') : null,
        dob: patientData.dob ? await encryptPatientField(patientData.dob, 'dob') : null
      };

      const { data, error } = await supabase
        .from('patients')
        .insert([encryptedData])
        .select()
        .single();

      if (error) throw error;

      // Log patient creation
      await logPatientAccess(data.id, 'create_patient');

      return data;
    } catch (error) {
      console.error('Error creating patient:', error);
      throw error;
    }
  };

  const updatePatient = async (patientId: string, updates: Partial<Patient>) => {
    if (!profile?.clinic_id) throw new Error('No clinic associated');

    try {
      // Encrypt sensitive fields if they're being updated
      const encryptedUpdates = { ...updates };
      if (updates.phone) {
        encryptedUpdates.phone = await encryptPatientField(updates.phone, 'phone');
      }
      if (updates.email) {
        encryptedUpdates.email = await encryptPatientField(updates.email, 'email');
      }
      if (updates.dob) {
        encryptedUpdates.dob = await encryptPatientField(updates.dob, 'dob');
      }

      const { data, error } = await supabase
        .from('patients')
        .update(encryptedUpdates)
        .eq('id', patientId)
        .eq('clinic_id', profile.clinic_id)
        .select()
        .single();

      if (error) throw error;

      // Log patient update
      await logPatientAccess(patientId, 'update_patient');

      return data;
    } catch (error) {
      console.error('Error updating patient:', error);
      throw error;
    }
  };

  return {
    patients,
    loading,
    fetchPatients,
    getPatientDetails,
    createPatient,
    updatePatient,
    logPatientAccess
  };
};