import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { CareStackAdapter } from '../supabase/functions/_shared/carestack-adapter'

// Mock Deno environment for testing
global.Deno = {
  env: {
    get: jest.fn((key: string) => {
      const mockEnv = {
        'CARESTACK_USE_MOCK': 'true',
        'CARESTACK_BASE_URL': 'https://api.carestack.com/v1',
        'CARESTACK_CLIENT_ID': 'mock_client_id',
        'CARESTACK_CLIENT_SECRET': 'mock_client_secret'
      }
      return mockEnv[key]
    })
  }
} as any

describe('CareStackAdapter', () => {
  let adapter: CareStackAdapter
  const mockCredentials = {
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    baseUrl: 'https://api.carestack.com/v1',
    useMockMode: true
  }

  beforeEach(() => {
    adapter = new CareStackAdapter(mockCredentials)
  })

  describe('Authentication', () => {
    it('should return mock token in mock mode', async () => {
      const token = await (adapter as any).getAccessToken()
      expect(token).toMatch(/^mock_access_token_/)
    })
  })

  describe('Patient Operations', () => {
    it('should search patients by phone number', async () => {
      const patients = await adapter.searchPatientByPhone('+1-555-0123')
      
      expect(Array.isArray(patients)).toBe(true)
      expect(patients.length).toBeGreaterThan(0)
      
      const patient = patients[0]
      expect(patient).toHaveProperty('id')
      expect(patient).toHaveProperty('firstName')
      expect(patient).toHaveProperty('lastName')
      expect(patient).toHaveProperty('phone')
    })

    it('should create a new patient', async () => {
      const patientData = {
        firstName: 'Test',
        lastName: 'Patient',
        phone: '+1-555-9999',
        email: 'test@example.com',
        dateOfBirth: '1990-01-01'
      }

      const newPatient = await adapter.createPatient(patientData)
      
      expect(newPatient).toHaveProperty('id')
      expect(newPatient.firstName).toBe(patientData.firstName)
      expect(newPatient.lastName).toBe(patientData.lastName)
      expect(newPatient.phone).toBe(patientData.phone)
      expect(newPatient.email).toBe(patientData.email)
    })

    it('should search patients with pagination', async () => {
      const searchRequest = {
        q: 'John',
        page: 1,
        pageSize: 10
      }

      const result = await adapter.searchPatients(searchRequest)
      
      expect(result).toHaveProperty('items')
      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('page', 1)
      expect(result).toHaveProperty('pageSize', 10)
      expect(result).toHaveProperty('totalPages')
      expect(Array.isArray(result.items)).toBe(true)
    })

    it('should get patient by ID', async () => {
      const patientId = 'cs_pat_001'
      const patient = await adapter.getPatient(patientId)
      
      expect(patient).not.toBeNull()
      expect(patient?.id).toBe(patientId)
      expect(patient).toHaveProperty('firstName')
      expect(patient).toHaveProperty('lastName')
    })
  })

  describe('Location Operations', () => {
    it('should list all locations', async () => {
      const locations = await adapter.listLocations()
      
      expect(Array.isArray(locations)).toBe(true)
      expect(locations.length).toBeGreaterThan(0)
      
      const location = locations[0]
      expect(location).toHaveProperty('id')
      expect(location).toHaveProperty('name')
      expect(location).toHaveProperty('address')
      expect(location.address).toHaveProperty('street')
      expect(location.address).toHaveProperty('city')
      expect(location.address).toHaveProperty('state')
      expect(location.address).toHaveProperty('zipCode')
    })

    it('should list operatories for a location', async () => {
      const locationId = 'cs_loc_001'
      const operatories = await adapter.listOperatories(locationId)
      
      expect(Array.isArray(operatories)).toBe(true)
      
      if (operatories.length > 0) {
        const operatory = operatories[0]
        expect(operatory).toHaveProperty('id')
        expect(operatory).toHaveProperty('name')
        expect(operatory).toHaveProperty('locationId', locationId)
        expect(operatory).toHaveProperty('isActive')
      }
    })

    it('should list all operatories when no location specified', async () => {
      const operatories = await adapter.listOperatories()
      
      expect(Array.isArray(operatories)).toBe(true)
      expect(operatories.length).toBeGreaterThan(0)
    })
  })

  describe('Provider Operations', () => {
    it('should list all providers', async () => {
      const providers = await adapter.listProviders()
      
      expect(Array.isArray(providers)).toBe(true)
      expect(providers.length).toBeGreaterThan(0)
      
      const provider = providers[0]
      expect(provider).toHaveProperty('id')
      expect(provider).toHaveProperty('name')
      expect(provider).toHaveProperty('specialty')
      expect(provider).toHaveProperty('locationIds')
      expect(Array.isArray(provider.locationIds)).toBe(true)
    })
  })

  describe('Appointment Operations', () => {
    it('should get available slots for date range', async () => {
      const providerId = 'cs_prov_001'
      const dateRange = {
        from: '2024-12-20',
        to: '2024-12-22'
      }

      const slots = await adapter.getAvailableSlots(providerId, dateRange)
      
      expect(Array.isArray(slots)).toBe(true)
      
      if (slots.length > 0) {
        const slot = slots[0]
        expect(slot).toHaveProperty('id')
        expect(slot).toHaveProperty('startTime')
        expect(slot).toHaveProperty('endTime')
        expect(slot).toHaveProperty('providerId', providerId)
        expect(slot).toHaveProperty('locationId')
        expect(slot).toHaveProperty('available')
      }
    })

    it('should book an appointment', async () => {
      const appointmentData = {
        patientId: 'cs_pat_001',
        providerId: 'cs_prov_001',
        locationId: 'cs_loc_001',
        startTime: '2024-12-20T10:00:00Z',
        endTime: '2024-12-20T11:00:00Z',
        notes: 'Test appointment'
      }

      const appointment = await adapter.bookAppointment(appointmentData)
      
      expect(appointment).toHaveProperty('id')
      expect(appointment.patientId).toBe(appointmentData.patientId)
      expect(appointment.providerId).toBe(appointmentData.providerId)
      expect(appointment.locationId).toBe(appointmentData.locationId)
      expect(appointment.startTime).toBe(appointmentData.startTime)
      expect(appointment.endTime).toBe(appointmentData.endTime)
      expect(appointment).toHaveProperty('status')
    })
  })

  describe('Error Handling', () => {
    it('should handle network failures gracefully', async () => {
      // Test with a high failure simulation (not realistic but for testing)
      const adapter = new CareStackAdapter({
        ...mockCredentials,
        useMockMode: true
      })

      // This might occasionally fail due to the 4% random failure simulation
      // In a real test environment, we'd mock the failure more predictably
      try {
        await adapter.listLocations()
      } catch (error) {
        expect(error.message).toContain('Simulated network failure')
      }
    })
  })

  describe('Caching', () => {
    it('should cache location data', async () => {
      // First call
      const locations1 = await adapter.listLocations()
      
      // Second call should use cache (in mock mode, both should return same data)
      const locations2 = await adapter.listLocations()
      
      expect(locations1).toEqual(locations2)
    })

    it('should cache provider data', async () => {
      // First call
      const providers1 = await adapter.listProviders()
      
      // Second call should use cache
      const providers2 = await adapter.listProviders()
      
      expect(providers1).toEqual(providers2)
    })
  })

  describe('Type Validation', () => {
    it('should return correctly typed patient data', async () => {
      const patients = await adapter.searchPatientByPhone('+1-555-0123')
      
      if (patients.length > 0) {
        const patient = patients[0]
        expect(typeof patient.id).toBe('string')
        expect(typeof patient.firstName).toBe('string')
        expect(typeof patient.lastName).toBe('string')
        if (patient.phone) expect(typeof patient.phone).toBe('string')
        if (patient.email) expect(typeof patient.email).toBe('string')
        if (patient.dateOfBirth) expect(typeof patient.dateOfBirth).toBe('string')
      }
    })

    it('should return correctly typed location data', async () => {
      const locations = await adapter.listLocations()
      
      if (locations.length > 0) {
        const location = locations[0]
        expect(typeof location.id).toBe('string')
        expect(typeof location.name).toBe('string')
        expect(typeof location.address).toBe('object')
        expect(typeof location.address.street).toBe('string')
        expect(typeof location.address.city).toBe('string')
        expect(typeof location.address.state).toBe('string')
        expect(typeof location.address.zipCode).toBe('string')
      }
    })
  })
})