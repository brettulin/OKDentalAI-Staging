import { PMSInterface, Patient, PatientData, Slot, Appointment, AppointmentData, Provider, Location, DateRange } from '../../_shared/pms-interface.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export class DummyAdapter implements PMSInterface {
  private supabase: any
  private clinicId: string

  constructor(credentials: any) {
    // Initialize Supabase client for direct database access
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    // Extract clinic ID from credentials or use a default valid UUID format
    if (credentials?.clinicId && this.isValidUUID(credentials.clinicId)) {
      this.clinicId = credentials.clinicId;
    } else {
      // Use the demo clinic ID that exists in the database
      this.clinicId = 'd6e5800e-95d8-4cf0-aa4f-2905926e578e';
    }
  }

  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  async searchPatientByPhone(phoneNumber: string): Promise<Patient[]> {
    const { data, error } = await this.supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', this.clinicId)
      .eq('phone', phoneNumber)

    if (error) throw new Error(`Failed to search patients: ${error.message}`)

    return data.map((p: any) => ({
      id: p.id,
      firstName: p.full_name.split(' ')[0],
      lastName: p.full_name.split(' ').slice(1).join(' '),
      phone: p.phone,
      email: p.email,
      dateOfBirth: p.dob,
      address: p.address ? JSON.parse(p.address) : undefined
    }))
  }

  async createPatient(patientData: PatientData): Promise<Patient> {
    const { data, error } = await this.supabase
      .from('patients')
      .insert({
        clinic_id: this.clinicId,
        full_name: `${patientData.firstName} ${patientData.lastName}`,
        phone: patientData.phone,
        email: patientData.email,
        dob: patientData.dateOfBirth,
        notes: `Created via AI call`
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create patient: ${error.message}`)

    return {
      id: data.id,
      firstName: patientData.firstName,
      lastName: patientData.lastName,
      phone: patientData.phone,
      email: patientData.email,
      dateOfBirth: patientData.dateOfBirth,
      address: patientData.address
    }
  }

  async getAvailableSlots(providerId: string, dateRange: DateRange): Promise<Slot[]> {
    const { data, error } = await this.supabase
      .from('slots')
      .select('*')
      .eq('clinic_id', this.clinicId)
      .eq('provider_id', providerId)
      .eq('status', 'open')
      .gte('starts_at', dateRange.from)
      .lte('starts_at', dateRange.to)
      .order('starts_at')

    if (error) throw new Error(`Failed to get available slots: ${error.message}`)

    return data.map((slot: any) => ({
      id: slot.id,
      startTime: slot.starts_at,
      endTime: slot.ends_at,
      providerId: slot.provider_id,
      locationId: slot.location_id,
      available: slot.status === 'open'
    }))
  }

  async bookAppointment(appointmentData: AppointmentData): Promise<Appointment> {
    // Start a transaction to book the appointment and update the slot
    const { data: appointment, error: appointmentError } = await this.supabase
      .from('appointments')
      .insert({
        clinic_id: this.clinicId,
        patient_id: appointmentData.patientId,
        provider_id: appointmentData.providerId,
        location_id: appointmentData.locationId,
        service_id: appointmentData.serviceId || '550e8400-e29b-41d4-a716-446655440005', // Default to cleaning
        starts_at: appointmentData.startTime,
        ends_at: appointmentData.endTime,
        source: 'voice_ai'
      })
      .select()
      .single()

    if (appointmentError) throw new Error(`Failed to create appointment: ${appointmentError.message}`)

    // Update the slot to booked status
    await this.supabase
      .from('slots')
      .update({ status: 'booked' })
      .eq('provider_id', appointmentData.providerId)
      .eq('starts_at', appointmentData.startTime)

    return {
      id: appointment.id,
      patientId: appointment.patient_id,
      providerId: appointment.provider_id,
      locationId: appointment.location_id,
      startTime: appointment.starts_at,
      endTime: appointment.ends_at,
      status: 'confirmed',
      notes: appointmentData.notes
    }
  }

  async listProviders(): Promise<Provider[]> {
    const { data, error } = await this.supabase
      .from('providers')
      .select('*')
      .eq('clinic_id', this.clinicId)

    if (error) throw new Error(`Failed to list providers: ${error.message}`)

    return data.map((provider: any) => ({
      id: provider.id,
      name: provider.name,
      specialty: provider.specialty,
      locationIds: ['550e8400-e29b-41d4-a716-446655440002'] // Default to main office
    }))
  }

  async listLocations(): Promise<Location[]> {
    const { data, error } = await this.supabase
      .from('locations')
      .select('*')
      .eq('clinic_id', this.clinicId)

    if (error) throw new Error(`Failed to list locations: ${error.message}`)

    return data.map((location: any) => ({
      id: location.id,
      name: location.name,
      address: {
        street: location.address?.split(',')[0] || '',
        city: location.address?.split(',')[1]?.trim() || '',
        state: location.address?.split(',')[2]?.trim()?.split(' ')[0] || '',
        zipCode: location.address?.split(',')[2]?.trim()?.split(' ')[1] || ''
      },
      phone: location.phone
    }))
  }
}