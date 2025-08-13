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

import {
  CareStackCredentials,
  PatientViewModel,
  LocationDetailModel,
  OperatoryDetail,
  CareStackProvider,
  AppointmentDetailModel,
  SearchRequest,
  PatientSearchResponseModel,
  CareStackSearchPatientsRequest,
  CareStackSearchPatientsResponse,
  CareStackCreatePatientRequest,
  CareStackCreateAppointmentRequest,
  CareStackListLocationsResponse,
  CareStackListOperatoriesResponse,
  CareStackCache,
  CareStackCacheItem,
  CareStackErrorResponse,
  AppointmentStatusExternalModel,
  ProcedureCodeBasicApiResponseModel,
  ProductionTypeDetailsModel,
  AppointmentCancelModel,
  AppointmentModifyStatusModel,
  PagedResultsOfPatientViewModel,
  PagedResultsOfAppointmentSyncModel,
  PagedResultsOfTreatmentProcedureSyncModel,
  AppointmentSyncModel,
  TreatmentProcedureSyncModel,
  // Backward compatibility aliases
  CareStackPatient,
  CareStackLocation,
  CareStackOperatory,
  CareStackAppointment
} from './carestack-types.ts'

import {
  getCareStackEnhancedConfig,
  getCareStackEnhancedHeaders,
  CareStackAuthConfig,
  validateCareStackAuthentication
} from './carestack-auth.ts'

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
  private credentials: CareStackCredentials
  private baseUrl: string
  private useMockMode: boolean
  private cache: CareStackCache
  private authConfig: CareStackAuthConfig

  constructor(credentials: CareStackCredentials) {
    this.credentials = credentials
    this.authConfig = getCareStackEnhancedConfig()
    this.baseUrl = this.authConfig.baseUrl
    this.useMockMode = this.authConfig.useMock
    this.cache = {
      locations: new Map(),
      operatories: new Map(),
      providers: new Map()
    }
    
    console.log('CareStack adapter initialized:', {
      mockMode: this.useMockMode,
      baseUrl: this.baseUrl,
      accountId: this.authConfig.accountId,
      authMethod: this.authConfig.authMethod,
      environment: this.authConfig.environment
    })
  }

  private getAuthHeaders(): Record<string, string> {
    const headers = getCareStackEnhancedHeaders(this.authConfig)
    return headers as Record<string, string>
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (this.useMockMode) {
      await addArtificialLatency()
      
      if (simulateRandomFailure()) {
        throw new Error('Simulated network failure (mock mode)')
      }
      
      // Route to appropriate mock method based on endpoint
      return this.handleMockRequest<T>(endpoint, options)
    }

    const authHeaders = this.getAuthHeaders()
    
    // Use timeout from auth config
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.authConfig.timeout)
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...authHeaders,
          ...options.headers,
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
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
          throw new Error('Authentication failed - please check your credentials')
        }
        
        throw new Error(`CareStack API error: ${response.statusText}`)
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.authConfig.timeout}ms`)
      }
      throw error
    }
  }

  private async handleMockRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Mock router for different endpoints
    if (endpoint.includes('/appointment-status')) {
      return this.getAppointmentStatuses() as any
    }
    if (endpoint.includes('/appointments/') && endpoint.includes('/cancel')) {
      return { success: true } as any
    }
    if (endpoint.includes('/appointments/') && endpoint.includes('/checkout')) {
      return { success: true } as any
    }
    if (endpoint.includes('/appointments/') && endpoint.includes('/modify-status')) {
      return { success: true } as any
    }
    if (endpoint.includes('/appointments/') && options.method === 'DELETE') {
      return { success: true } as any
    }
    if (endpoint.includes('/appointments/') && !endpoint.includes('/')) {
      const id = endpoint.split('/').pop()
      return this.getAppointment(parseInt(id!)) as any
    }
    if (endpoint.includes('/procedure-codes')) {
      return this.getProcedureCodes() as any
    }
    if (endpoint.includes('/production-types')) {
      return this.getProductionTypes() as any
    }
    if (endpoint.includes('/sync/patients')) {
      return this.syncPatients(new Date().toISOString()) as any
    }
    if (endpoint.includes('/sync/appointments')) {
      return this.syncAppointments(new Date().toISOString()) as any
    }
    if (endpoint.includes('/sync/treatment-procedures')) {
      return this.syncTreatmentProcedures(new Date().toISOString()) as any
    }
    
    // Default mock response
    throw new Error(`Mock implementation not found for endpoint: ${endpoint}`)
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
  private convertPatient(csPatient: PatientViewModel): Patient {
    return {
      id: csPatient.id.toString(),
      firstName: csPatient.firstName,
      lastName: csPatient.lastName,
      phone: csPatient.mobileNumber || csPatient.homeNumber || csPatient.workNumber || '',
      email: csPatient.email,
      dateOfBirth: csPatient.dateOfBirth,
      address: csPatient.address ? {
        street: csPatient.address.street,
        city: csPatient.address.city,
        state: csPatient.address.state,
        zipCode: csPatient.address.zipCode
      } : undefined
    }
  }

  private convertLocation(csLocation: LocationDetailModel): Location {
    return {
      id: csLocation.id.toString(),
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
      // Updated to use POST with SearchRequest body per API documentation
      const searchRequest: SearchRequest = {
        searchCriteria: {
          phone: phoneNumber
        },
        pageNumber: 1,
        pageSize: 20
      }
      
      const response = await this.makeRequest<PatientSearchResponseModel>('/api/v1.0/patients/search', {
        method: 'POST',
        body: JSON.stringify(searchRequest)
      })
      
      return response.patients.map(patient => this.convertPatient(patient))
    } catch (error) {
      console.error('Error searching patient by phone:', error)
      throw error
    }
  }

  async createPatient(patientData: PatientData): Promise<Patient> {
    if (this.useMockMode) {
      await addArtificialLatency()
      
      const newPatient: PatientViewModel = {
        id: parseInt(generateMockId('cs_pat').replace('cs_pat_', '')),
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        mobileNumber: patientData.phone,
        email: patientData.email || undefined,
        dateOfBirth: patientData.dateOfBirth || undefined,
        insuranceCarrier: undefined,
        memberId: undefined,
        notes: undefined,
        address: patientData.address,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      mockStorage.patients.set(newPatient.id.toString(), newPatient as any)
      return this.convertPatient(newPatient)
    }

    try {
      const payload: CareStackCreatePatientRequest = {
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        mobileNumber: patientData.phone,
        email: patientData.email,
        dateOfBirth: patientData.dateOfBirth,
        address: patientData.address
      }

      const response = await this.makeRequest<PatientViewModel>('/api/v1.0/patients', {
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
        patientId: parseInt(appointmentData.patientId),
        providerId: parseInt(appointmentData.providerId),
        locationId: parseInt(appointmentData.locationId),
        startTime: appointmentData.startTime,
        endTime: appointmentData.endTime,
        notes: appointmentData.notes
      }

      const response = await this.makeRequest<AppointmentDetailModel>('/api/v1.0/appointments', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      return {
        id: response.id.toString(),
        patientId: response.patientId.toString(),
        providerId: response.providerId.toString(),
        locationId: response.locationId.toString(),
        startTime: response.startTime,
        endTime: response.endTime,
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
      // Note: No providers endpoint visible in API docs, may need clarification from CareStack
      // Using a fallback approach for now
      const response = await this.makeRequest<CareStackProvider[]>('/api/v1.0/staff')
      const providers = response.map(provider => this.convertProvider(provider))
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
      // Updated endpoint per API documentation
      const response = await this.makeRequest<LocationDetailModel[]>('/api/v1.0/locations')
      const locations = response.map(location => this.convertLocation(location))
      this.setCachedData(this.cache.locations, cacheKey, locations)
      return locations
    } catch (error) {
      console.error('Error listing locations:', error)
      throw error
    }
  }

  // CareStack-specific methods
  async listOperatories(locationId?: string): Promise<OperatoryDetail[]> {
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
      // Updated endpoint per API documentation
      const response = await this.makeRequest<OperatoryDetail[]>('/api/v1.0/operatories')
      const filtered = locationId 
        ? response.filter(op => op.locationId.toString() === locationId)
        : response
      this.setCachedData(this.cache.operatories, cacheKey, filtered)
      return filtered
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
      // Convert to new SearchRequest format
      const searchRequest: SearchRequest = {
        searchCriteria: {
          firstName: request.q,
          lastName: request.q,
          phone: request.phone,
          email: request.email,
          dateOfBirth: request.dob
        },
        pageNumber: request.page || 1,
        pageSize: request.pageSize || 20
      }

      const response = await this.makeRequest<PatientSearchResponseModel>('/api/v1.0/patients/search', {
        method: 'POST',
        body: JSON.stringify(searchRequest)
      })

      // Convert to backward compatible format
      return {
        items: response.patients,
        total: response.totalCount,
        page: response.pageNumber,
        pageSize: response.pageSize,
        totalPages: response.totalPages
      }
    } catch (error) {
      console.error('Error searching patients:', error)
      throw error
    }
  }

  async getPatient(patientId: string): Promise<PatientViewModel | null> {
    if (this.useMockMode) {
      await addArtificialLatency()
      return mockStorage.patients.get(patientId) || null
    }

    try {
      return await this.makeRequest<PatientViewModel>(`/api/v1.0/patients/${patientId}`)
    } catch (error) {
      if (error.message.includes('404')) {
        return null
      }
      console.error('Error getting patient:', error)
      throw error
    }
  }

  // New CareStack API methods per documentation
  async getAppointmentStatuses(): Promise<AppointmentStatusExternalModel[]> {
    if (this.useMockMode) {
      await addArtificialLatency()
      return [
        { id: 1, name: 'Scheduled', isActive: true },
        { id: 2, name: 'Confirmed', isActive: true },
        { id: 3, name: 'Arrived', isActive: true },
        { id: 4, name: 'In Progress', isActive: true },
        { id: 5, name: 'Completed', isActive: true },
        { id: 6, name: 'Cancelled', isActive: true },
        { id: 7, name: 'No Show', isActive: true }
      ]
    }

    try {
      return await this.makeRequest<AppointmentStatusExternalModel[]>('/api/v1.0/appointment-status')
    } catch (error) {
      console.error('Error getting appointment statuses:', error)
      throw error
    }
  }

  async getAppointment(appointmentId: number): Promise<AppointmentDetailModel | null> {
    if (this.useMockMode) {
      await addArtificialLatency()
      const appointment = Array.from(mockStorage.appointments.values()).find(
        apt => apt.id === appointmentId.toString()
      )
      if (!appointment) return null
      
      return {
        id: parseInt(appointment.id),
        patientId: parseInt(appointment.patientId),
        providerId: parseInt(appointment.providerId),
        locationId: parseInt(appointment.locationId),
        startTime: appointment.start,
        endTime: appointment.end,
        status: appointment.status,
        notes: appointment.notes
      }
    }

    try {
      return await this.makeRequest<AppointmentDetailModel>(`/api/v1.0/appointments/${appointmentId}`)
    } catch (error) {
      if (error.message.includes('404')) {
        return null
      }
      console.error('Error getting appointment:', error)
      throw error
    }
  }

  async deleteAppointment(appointmentId: number): Promise<boolean> {
    if (this.useMockMode) {
      await addArtificialLatency()
      return mockStorage.appointments.delete(appointmentId.toString())
    }

    try {
      await this.makeRequest(`/api/v1.0/appointments/${appointmentId}`, { method: 'DELETE' })
      return true
    } catch (error) {
      console.error('Error deleting appointment:', error)
      return false
    }
  }

  async cancelAppointment(appointmentId: number, reason?: string): Promise<boolean> {
    if (this.useMockMode) {
      await addArtificialLatency()
      const appointment = mockStorage.appointments.get(appointmentId.toString())
      if (appointment) {
        appointment.status = 'cancelled'
        return true
      }
      return false
    }

    try {
      await this.makeRequest(`/api/v1.0/appointments/${appointmentId}/cancel`, {
        method: 'PUT',
        body: JSON.stringify({ reason: reason || 'Cancelled by system' })
      })
      return true
    } catch (error) {
      console.error('Error cancelling appointment:', error)
      return false
    }
  }

  async getProcedureCodes(code?: string, offset = 0, limit = 20): Promise<ProcedureCodeBasicApiResponseModel[]> {
    if (this.useMockMode) {
      await addArtificialLatency()
      return [
        { id: 1, code: 'D0150', description: 'Comprehensive oral evaluation', category: 'Diagnostic', fee: 150 },
        { id: 2, code: 'D1110', description: 'Adult prophylaxis', category: 'Preventive', fee: 100 },
        { id: 3, code: 'D2140', description: 'Amalgam - one surface', category: 'Restorative', fee: 180 }
      ].filter(proc => !code || proc.code.includes(code))
    }

    try {
      const params = new URLSearchParams({
        offset: offset.toString(),
        limit: limit.toString()
      })
      if (code) params.append('code', code)
      
      return await this.makeRequest<ProcedureCodeBasicApiResponseModel[]>(`/api/v1.0/procedure-codes?${params}`)
    } catch (error) {
      console.error('Error getting procedure codes:', error)
      throw error
    }
  }

  // Sync API endpoints
  async syncPatients(modifiedSince: string, continueToken?: string): Promise<PagedResultsOfPatientViewModel> {
    if (this.useMockMode) {
      await addArtificialLatency()
      const allPatients = Array.from(mockStorage.patients.values())
      const modifiedDate = new Date(modifiedSince)
      
      const filteredPatients = allPatients.filter(patient => {
        const patientModified = patient.updatedAt ? new Date(patient.updatedAt) : new Date()
        return patientModified >= modifiedDate
      })

      return {
        items: filteredPatients.slice(0, 50), // Mock pagination
        continueToken: filteredPatients.length > 50 ? 'mock_token_' + Date.now() : undefined,
        totalCount: filteredPatients.length,
        hasMore: filteredPatients.length > 50
      }
    }

    try {
      const params = new URLSearchParams({ modifiedSince })
      if (continueToken) params.append('continueToken', continueToken)
      
      return await this.makeRequest<PagedResultsOfPatientViewModel>(`/api/v1.0/sync/patients?${params}`)
    } catch (error) {
      console.error('Error syncing patients:', error)
      throw error
    }
  }

  async syncAppointments(modifiedSince: string, continueToken?: string): Promise<PagedResultsOfAppointmentSyncModel> {
    if (this.useMockMode) {
      await addArtificialLatency()
      const allAppointments = Array.from(mockStorage.appointments.values())
      const modifiedDate = new Date(modifiedSince)
      
      const syncModels: AppointmentSyncModel[] = allAppointments
        .filter(apt => new Date(apt.updatedAt) >= modifiedDate)
        .map(apt => ({
          id: parseInt(apt.id),
          patientId: parseInt(apt.patientId),
          providerId: parseInt(apt.providerId),
          locationId: parseInt(apt.locationId),
          startTime: apt.start,
          endTime: apt.end,
          status: apt.status,
          modifiedDate: apt.updatedAt
        }))

      return {
        items: syncModels.slice(0, 50),
        continueToken: syncModels.length > 50 ? 'mock_token_' + Date.now() : undefined,
        totalCount: syncModels.length,
        hasMore: syncModels.length > 50
      }
    }

    try {
      const params = new URLSearchParams({ modifiedSince })
      if (continueToken) params.append('continueToken', continueToken)
      
      return await this.makeRequest<PagedResultsOfAppointmentSyncModel>(`/api/v1.0/sync/appointments?${params}`)
    } catch (error) {
      console.error('Error syncing appointments:', error)
      throw error
    }
  }

  async syncTreatmentProcedures(modifiedSince: string, continueToken?: string, includeDeleted = false): Promise<PagedResultsOfTreatmentProcedureSyncModel> {
    if (this.useMockMode) {
      await addArtificialLatency()
      // Mock treatment procedures data
      const mockTreatments: TreatmentProcedureSyncModel[] = [
        {
          id: 1,
          appointmentId: 1,
          patientId: 1,
          procedureCodeId: 1,
          status: 'completed',
          modifiedDate: new Date().toISOString(),
          amount: 150,
          notes: 'Routine cleaning completed'
        }
      ]

      return {
        items: mockTreatments,
        continueToken: undefined,
        totalCount: mockTreatments.length,
        hasMore: false
      }
    }

    try {
      const params = new URLSearchParams({ 
        modifiedSince,
        includeDeleted: includeDeleted.toString()
      })
      if (continueToken) params.append('continueToken', continueToken)
      
      return await this.makeRequest<PagedResultsOfTreatmentProcedureSyncModel>(`/api/v1.0/sync/treatment-procedures?${params}`)
    } catch (error) {
      console.error('Error syncing treatment procedures:', error)
      throw error
    }
  }

  // Treatment and procedure endpoints
  async getAppointmentProcedures(appointmentId: number): Promise<number[]> {
    if (this.useMockMode) {
      await addArtificialLatency()
      return [1, 2, 3] // Mock procedure code IDs
    }

    try {
      return await this.makeRequest<number[]>(`/api/v1.0/treatments/appointment-procedures/${appointmentId}`)
    } catch (error) {
      console.error('Error getting appointment procedures:', error)
      throw error
    }
  }

  async getProductionTypes(): Promise<ProductionTypeDetailsModel[]> {
    if (this.useMockMode) {
      await addArtificialLatency()
      return [
        { id: 1, name: 'Preventive', description: 'Preventive care procedures', isActive: true },
        { id: 2, name: 'Restorative', description: 'Restorative dental procedures', isActive: true },
        { id: 3, name: 'Cosmetic', description: 'Cosmetic dental procedures', isActive: true }
      ]
    }

    try {
      return await this.makeRequest<ProductionTypeDetailsModel[]>('/api/v1.0/production-types')
    } catch (error) {
      console.error('Error getting production types:', error)
      throw error
    }
  }

  // Enhanced appointment management
  async checkoutAppointment(appointmentId: number, overrideCareNoteValidation = true): Promise<boolean> {
    if (this.useMockMode) {
      await addArtificialLatency()
      const appointment = mockStorage.appointments.get(appointmentId.toString())
      if (appointment) {
        appointment.status = 'completed'
        return true
      }
      return false
    }

    try {
      const params = new URLSearchParams({ 
        overrideCareNoteValidation: overrideCareNoteValidation.toString() 
      })
      
      await this.makeRequest(`/api/v1.0/appointments/${appointmentId}/checkout?${params}`, {
        method: 'PUT'
      })
      return true
    } catch (error) {
      console.error('Error checking out appointment:', error)
      return false
    }
  }

  async modifyAppointmentStatus(appointmentId: number, statusData: AppointmentModifyStatusModel): Promise<boolean> {
    if (this.useMockMode) {
      await addArtificialLatency()
      const appointment = mockStorage.appointments.get(appointmentId.toString())
      if (appointment) {
        appointment.status = statusData.status
        if (statusData.notes) appointment.notes = statusData.notes
        return true
      }
      return false
    }

    try {
      await this.makeRequest(`/api/v1.0/appointments/${appointmentId}/modify-status`, {
        method: 'PUT',
        body: JSON.stringify(statusData)
      })
      return true
    } catch (error) {
      console.error('Error modifying appointment status:', error)
      return false
    }
  }

  async cancelAppointmentWithDetails(appointmentId: number, cancelData: AppointmentCancelModel): Promise<boolean> {
    if (this.useMockMode) {
      await addArtificialLatency()
      const appointment = mockStorage.appointments.get(appointmentId.toString())
      if (appointment) {
        appointment.status = 'cancelled'
        appointment.notes = (appointment.notes || '') + ` | Cancelled: ${cancelData.reason}`
        return true
      }
      return false
    }

    try {
      await this.makeRequest(`/api/v1.0/appointments/${appointmentId}/cancel`, {
        method: 'PUT',
        body: JSON.stringify(cancelData)
      })
      return true
    } catch (error) {
      console.error('Error cancelling appointment with details:', error)
      return false
    }
  }
}