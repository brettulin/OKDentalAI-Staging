import { 
  PMSInterface, 
  Patient, 
  PatientData, 
  DateRange, 
  Slot, 
  AppointmentData, 
  Appointment, 
  Provider, 
  Location 
} from './pms-interface.ts'

export class CareStackAdapter implements PMSInterface {
  private credentials: any
  private baseUrl: string
  private accessToken?: string
  private tokenExpiry?: number

  constructor(credentials: any) {
    this.credentials = credentials
    this.baseUrl = credentials.baseUrl || 'https://api.carestack.com/v1'
  }

  private async getCareStackToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    try {
      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to get CareStack token: ${response.statusText}`)
      }

      const data = await response.json()
      this.accessToken = data.access_token
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000 // Subtract 1 minute for safety

      return this.accessToken
    } catch (error) {
      console.error('Error getting CareStack token:', error)
      throw new Error('Failed to authenticate with CareStack')
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getCareStackToken()
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`CareStack API error: ${response.statusText}`)
    }

    return response.json()
  }

  async searchPatientByPhone(phoneNumber: string): Promise<Patient[]> {
    try {
      const data = await this.makeRequest(`/patients?phone=${encodeURIComponent(phoneNumber)}`)
      
      return data.patients?.map((p: any) => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        phone: p.phone,
        email: p.email,
        dateOfBirth: p.date_of_birth,
        address: p.address ? {
          street: p.address.street,
          city: p.address.city,
          state: p.address.state,
          zipCode: p.address.zip_code,
        } : undefined,
      })) || []
    } catch (error) {
      console.error('Error searching patient by phone:', error)
      throw error
    }
  }

  async createPatient(patientData: PatientData): Promise<Patient> {
    try {
      const payload = {
        first_name: patientData.firstName,
        last_name: patientData.lastName,
        phone: patientData.phone,
        email: patientData.email,
        date_of_birth: patientData.dateOfBirth,
        address: patientData.address ? {
          street: patientData.address.street,
          city: patientData.address.city,
          state: patientData.address.state,
          zip_code: patientData.address.zipCode,
        } : undefined,
      }

      const data = await this.makeRequest('/patients', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      return {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        phone: data.phone,
        email: data.email,
        dateOfBirth: data.date_of_birth,
        address: data.address ? {
          street: data.address.street,
          city: data.address.city,
          state: data.address.state,
          zipCode: data.address.zip_code,
        } : undefined,
      }
    } catch (error) {
      console.error('Error creating patient:', error)
      throw error
    }
  }

  async getAvailableSlots(providerId: string, dateRange: DateRange): Promise<Slot[]> {
    try {
      const data = await this.makeRequest(
        `/appointments/slots?providerId=${providerId}&from=${dateRange.from}&to=${dateRange.to}`
      )

      return data.slots?.map((s: any) => ({
        id: s.id,
        startTime: s.start_time,
        endTime: s.end_time,
        providerId: s.provider_id,
        locationId: s.location_id,
        available: s.available,
      })) || []
    } catch (error) {
      console.error('Error getting available slots:', error)
      throw error
    }
  }

  async bookAppointment(appointmentData: AppointmentData): Promise<Appointment> {
    try {
      const payload = {
        patient_id: appointmentData.patientId,
        provider_id: appointmentData.providerId,
        location_id: appointmentData.locationId,
        service_id: appointmentData.serviceId,
        start_time: appointmentData.startTime,
        end_time: appointmentData.endTime,
        notes: appointmentData.notes,
      }

      const data = await this.makeRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      return {
        id: data.id,
        patientId: data.patient_id,
        providerId: data.provider_id,
        locationId: data.location_id,
        startTime: data.start_time,
        endTime: data.end_time,
        status: data.status,
        notes: data.notes,
      }
    } catch (error) {
      console.error('Error booking appointment:', error)
      throw error
    }
  }

  async listProviders(): Promise<Provider[]> {
    try {
      const data = await this.makeRequest('/providers')

      return data.providers?.map((p: any) => ({
        id: p.id,
        name: p.name,
        specialty: p.specialty,
        locationIds: p.location_ids || [],
      })) || []
    } catch (error) {
      console.error('Error listing providers:', error)
      throw error
    }
  }

  async listLocations(): Promise<Location[]> {
    try {
      const data = await this.makeRequest('/locations')

      return data.locations?.map((l: any) => ({
        id: l.id,
        name: l.name,
        address: {
          street: l.address.street,
          city: l.address.city,
          state: l.address.state,
          zipCode: l.address.zip_code,
        },
        phone: l.phone,
      })) || []
    } catch (error) {
      console.error('Error listing locations:', error)
      throw error
    }
  }
}