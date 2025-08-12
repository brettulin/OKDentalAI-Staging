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
} from '../pms-integrations/pms/pms-interface.ts'

import {
  CareStackPatient,
  CareStackLocation,
  CareStackOperatory,
  CareStackProvider,
  CareStackAppointment,
  CareStackSearchPatientsRequest,
  CareStackSearchPatientsResponse,
  CareStackCreatePatientRequest,
  CareStackCreateAppointmentRequest,
  CareStackListLocationsResponse,
  CareStackListOperatoriesResponse,
  CareStackCache,
  CareStackCacheItem,
  CareStackAuthResponse,
  CareStackErrorResponse
} from './carestack-types.ts'

import {
  mockPatients,
  mockLocations,
  mockOperatories,
  mockProviders,
  mockAppointments,
  mockStorage,
  generateMockId,
  addArtificialLatency,
  simulateRandomFailure
} from './carestack-mock-data.ts'

export class CareStackAdapter implements PMSInterface {
  private credentials: any
  private baseUrl: string
  private accessToken?: string
  private tokenExpiry?: number
  private useMockMode: boolean
  private cache: CareStackCache

  constructor(credentials: any) {
    this.credentials = credentials
    this.baseUrl = credentials.baseUrl || Deno.env.get('CARESTACK_BASE_URL') || 'https://api.carestack.com/v1'
    this.useMockMode = credentials.useMockMode ?? (Deno.env.get('CARESTACK_USE_MOCK') === 'true')
    this.cache = {
      locations: new Map(),
      operatories: new Map(),
      providers: new Map()
    }
    
    console.log('CareStack adapter initialized:', {
      mockMode: this.useMockMode,
      baseUrl: this.baseUrl
    })
  }

  private async getAccessToken(): Promise<string> {
    if (this.useMockMode) {
      await addArtificialLatency(100, 200)
      return 'mock_access_token_' + Date.now()
    }

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
          client_id: this.credentials.clientId || Deno.env.get('CARESTACK_CLIENT_ID'),
          client_secret: this.credentials.clientSecret || Deno.env.get('CARESTACK_CLIENT_SECRET'),
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to get CareStack token: ${response.statusText}`)
      }

      const data: CareStackAuthResponse = await response.json()
      this.accessToken = data.access_token
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000 // Subtract 1 minute for safety

      return this.accessToken
    } catch (error) {
      console.error('Error getting CareStack token:', error)
      throw new Error('Failed to authenticate with CareStack')
    }
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (this.useMockMode) {
      await addArtificialLatency()
      
      if (simulateRandomFailure()) {
        throw new Error('Simulated network failure (mock mode)')
      }
      
      // This would be replaced with actual mock logic per endpoint
      throw new Error('Mock implementation needed for endpoint: ' + endpoint)
    }

    const token = await this.getAccessToken()
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('CareStack API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded')
      }
      if (response.status === 401) {
        this.accessToken = undefined // Force token refresh
        throw new Error('Authentication failed')
      }
      
      throw new Error(`CareStack API error: ${response.statusText}`)
    }

    return response.json()
  }

  private getCachedData<T>(cacheMap: Map<string, CareStackCacheItem<T>>, key: string): T | null {
    const cached = cacheMap.get(key)
    if (cached && Date.now() < cached.expiry) {
      return cached.data
    }
    return null
  }

  private setCachedData<T>(cacheMap: Map<string, CareStackCacheItem<T>>, key: string, data: T, ttlMs = 300000): void {
    cacheMap.set(key, {
      data,
      expiry: Date.now() + ttlMs
    })
  }

  // Convert CareStack types to our internal types
  private convertPatient(csPatient: CareStackPatient): Patient {
    return {
      id: csPatient.id,
      firstName: csPatient.firstName,
      lastName: csPatient.lastName,
      phone: csPatient.phone || '',
      email: csPatient.email,
      dateOfBirth: csPatient.dob,
      address: csPatient.address ? {
        street: csPatient.address.street,
        city: csPatient.address.city,
        state: csPatient.address.state,
        zipCode: csPatient.address.zipCode
      } : undefined
    }
  }

  private convertLocation(csLocation: CareStackLocation): Location {
    return {
      id: csLocation.id,
      name: csLocation.name,
      address: {
        street: csLocation.address.street,
        city: csLocation.address.city,
        state: csLocation.address.state,
        zipCode: csLocation.address.zipCode
      },
      phone: csLocation.phone
    }
  }

  private convertProvider(csProvider: CareStackProvider): Provider {
    return {
      id: csProvider.id,
      name: `${csProvider.firstName} ${csProvider.lastName}`,
      specialty: csProvider.specialty,
      locationIds: csProvider.locationIds
    }
  }

  // PMS Interface Implementation
  async searchPatientByPhone(phoneNumber: string): Promise<Patient[]> {
    if (this.useMockMode) {
      await addArtificialLatency()
      
      const matchingPatients = Array.from(mockStorage.patients.values()).filter(
        patient => patient.phone && patient.phone.includes(phoneNumber.replace(/\D/g, ''))
      )
      
      return matchingPatients.map(patient => this.convertPatient(patient))
    }

    try {
      const params = new URLSearchParams({ phone: phoneNumber })
      const response = await this.makeRequest<CareStackSearchPatientsResponse>(`/patients/search?${params}`)
      
      return response.items.map(patient => this.convertPatient(patient))
    } catch (error) {
      console.error('Error searching patient by phone:', error)
      throw error
    }
  }

  async createPatient(patientData: PatientData): Promise<Patient> {
    if (this.useMockMode) {
      await addArtificialLatency()
      
      const newPatient: CareStackPatient = {
        id: generateMockId('cs_pat'),
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        phone: patientData.phone,
        email: patientData.email || null,
        dob: patientData.dateOfBirth || null,
        insuranceCarrier: null,
        memberId: null,
        notes: null,
        address: patientData.address,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      mockStorage.patients.set(newPatient.id, newPatient)
      return this.convertPatient(newPatient)
    }

    try {
      const payload: CareStackCreatePatientRequest = {
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        phone: patientData.phone,
        email: patientData.email,
        dob: patientData.dateOfBirth,
        address: patientData.address
      }

      const response = await this.makeRequest<CareStackPatient>('/patients', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      return this.convertPatient(response)
    } catch (error) {
      console.error('Error creating patient:', error)
      throw error
    }
  }

  async getAvailableSlots(providerId: string, dateRange: DateRange): Promise<Slot[]> {
    if (this.useMockMode) {
      await addArtificialLatency()
      
      // Generate mock slots for the date range
      const slots: Slot[] = []
      const startDate = new Date(dateRange.from)
      const endDate = new Date(dateRange.to)
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        // Skip weekends
        if (d.getDay() === 0 || d.getDay() === 6) continue
        
        // Generate slots for 9 AM to 5 PM
        for (let hour = 9; hour < 17; hour++) {
          const slotStart = new Date(d)
          slotStart.setHours(hour, 0, 0, 0)
          const slotEnd = new Date(slotStart)
          slotEnd.setHours(hour + 1, 0, 0, 0)
          
          slots.push({
            id: generateMockId('cs_slot'),
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            providerId,
            locationId: 'cs_loc_001',
            available: Math.random() > 0.3 // 70% availability
          })
        }
      }
      
      return slots
    }

    try {
      const params = new URLSearchParams({
        providerId,
        from: dateRange.from,
        to: dateRange.to
      })
      
      const response = await this.makeRequest<any>(`/appointments/availability?${params}`)
      
      // Convert CareStack availability response to our Slot format
      return response.slots?.map((slot: any) => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        providerId: slot.providerId,
        locationId: slot.locationId,
        available: slot.available
      })) || []
    } catch (error) {
      console.error('Error getting available slots:', error)
      throw error
    }
  }

  async bookAppointment(appointmentData: AppointmentData): Promise<Appointment> {
    if (this.useMockMode) {
      await addArtificialLatency()
      
      const newAppointment: CareStackAppointment = {
        id: generateMockId('cs_appt'),
        patientId: appointmentData.patientId,
        providerId: appointmentData.providerId,
        locationId: appointmentData.locationId,
        operatoryId: null,
        start: appointmentData.startTime,
        end: appointmentData.endTime,
        status: 'scheduled',
        code: null,
        description: 'Appointment',
        notes: appointmentData.notes || null,
        duration: Math.floor((new Date(appointmentData.endTime).getTime() - new Date(appointmentData.startTime).getTime()) / 60000),
        isNewPatient: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      mockStorage.appointments.set(newAppointment.id, newAppointment)
      
      return {
        id: newAppointment.id,
        patientId: newAppointment.patientId,
        providerId: newAppointment.providerId,
        locationId: newAppointment.locationId,
        startTime: newAppointment.start,
        endTime: newAppointment.end,
        status: 'scheduled',
        notes: newAppointment.notes
      }
    }

    try {
      const payload: CareStackCreateAppointmentRequest = {
        patientId: appointmentData.patientId,
        providerId: appointmentData.providerId,
        locationId: appointmentData.locationId,
        start: appointmentData.startTime,
        end: appointmentData.endTime,
        notes: appointmentData.notes,
        idempotencyKey: `appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }

      const response = await this.makeRequest<CareStackAppointment>('/appointments', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      return {
        id: response.id,
        patientId: response.patientId,
        providerId: response.providerId,
        locationId: response.locationId,
        startTime: response.start,
        endTime: response.end,
        status: response.status,
        notes: response.notes
      }
    } catch (error) {
      console.error('Error booking appointment:', error)
      throw error
    }
  }

  async listProviders(): Promise<Provider[]> {
    const cacheKey = 'all'
    const cached = this.getCachedData(this.cache.providers, cacheKey)
    if (cached) return cached

    if (this.useMockMode) {
      await addArtificialLatency()
      const providers = mockProviders.map(provider => this.convertProvider(provider))
      this.setCachedData(this.cache.providers, cacheKey, providers)
      return providers
    }

    try {
      const response = await this.makeRequest<{ providers: CareStackProvider[] }>('/providers')
      const providers = response.providers.map(provider => this.convertProvider(provider))
      this.setCachedData(this.cache.providers, cacheKey, providers)
      return providers
    } catch (error) {
      console.error('Error listing providers:', error)
      throw error
    }
  }

  async listLocations(): Promise<Location[]> {
    const cacheKey = 'all'
    const cached = this.getCachedData(this.cache.locations, cacheKey)
    if (cached) return cached

    if (this.useMockMode) {
      await addArtificialLatency()
      const locations = mockLocations.map(location => this.convertLocation(location))
      this.setCachedData(this.cache.locations, cacheKey, locations)
      return locations
    }

    try {
      const response = await this.makeRequest<CareStackListLocationsResponse>('/locations')
      const locations = response.locations.map(location => this.convertLocation(location))
      this.setCachedData(this.cache.locations, cacheKey, locations)
      return locations
    } catch (error) {
      console.error('Error listing locations:', error)
      throw error
    }
  }

  // CareStack-specific methods
  async listOperatories(locationId?: string): Promise<CareStackOperatory[]> {
    const cacheKey = locationId || 'all'
    const cached = this.getCachedData(this.cache.operatories, cacheKey)
    if (cached) return cached

    if (this.useMockMode) {
      await addArtificialLatency()
      const operatories = locationId 
        ? mockOperatories.filter(op => op.locationId === locationId)
        : mockOperatories
      this.setCachedData(this.cache.operatories, cacheKey, operatories)
      return operatories
    }

    try {
      const endpoint = locationId ? `/operatories?locationId=${locationId}` : '/operatories'
      const response = await this.makeRequest<CareStackListOperatoriesResponse>(endpoint)
      this.setCachedData(this.cache.operatories, cacheKey, response.operatories)
      return response.operatories
    } catch (error) {
      console.error('Error listing operatories:', error)
      throw error
    }
  }

  async searchPatients(request: CareStackSearchPatientsRequest): Promise<CareStackSearchPatientsResponse> {
    if (this.useMockMode) {
      await addArtificialLatency()
      
      let filteredPatients = Array.from(mockStorage.patients.values())
      
      if (request.q) {
        const query = request.q.toLowerCase()
        filteredPatients = filteredPatients.filter(patient =>
          patient.firstName.toLowerCase().includes(query) ||
          patient.lastName.toLowerCase().includes(query) ||
          (patient.phone && patient.phone.includes(query)) ||
          (patient.email && patient.email.toLowerCase().includes(query))
        )
      }
      
      if (request.phone) {
        filteredPatients = filteredPatients.filter(patient =>
          patient.phone && patient.phone.includes(request.phone!.replace(/\D/g, ''))
        )
      }
      
      if (request.email) {
        filteredPatients = filteredPatients.filter(patient =>
          patient.email && patient.email.toLowerCase().includes(request.email!.toLowerCase())
        )
      }
      
      if (request.dob) {
        filteredPatients = filteredPatients.filter(patient =>
          patient.dob === request.dob
        )
      }
      
      const page = request.page || 1
      const pageSize = request.pageSize || 20
      const startIndex = (page - 1) * pageSize
      const endIndex = startIndex + pageSize
      
      return {
        items: filteredPatients.slice(startIndex, endIndex),
        total: filteredPatients.length,
        page,
        pageSize,
        totalPages: Math.ceil(filteredPatients.length / pageSize)
      }
    }

    try {
      const params = new URLSearchParams()
      if (request.q) params.append('q', request.q)
      if (request.phone) params.append('phone', request.phone)
      if (request.email) params.append('email', request.email)
      if (request.dob) params.append('dob', request.dob)
      if (request.page) params.append('page', request.page.toString())
      if (request.pageSize) params.append('pageSize', request.pageSize.toString())
      
      return await this.makeRequest<CareStackSearchPatientsResponse>(`/patients/search?${params}`)
    } catch (error) {
      console.error('Error searching patients:', error)
      throw error
    }
  }

  async getPatient(patientId: string): Promise<CareStackPatient | null> {
    if (this.useMockMode) {
      await addArtificialLatency()
      return mockStorage.patients.get(patientId) || null
    }

    try {
      return await this.makeRequest<CareStackPatient>(`/patients/${patientId}`)
    } catch (error) {
      if (error.message.includes('404')) {
        return null
      }
      console.error('Error getting patient:', error)
      throw error
    }
  }
}