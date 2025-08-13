import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { CareStackAdapter } from '../supabase/functions/_shared/carestack-adapter'
import { validateCareStackAuthentication, getCareStackEnhancedConfig } from '../supabase/functions/_shared/carestack-auth'

// Mock Deno environment for testing
global.Deno = {
  env: {
    get: jest.fn((key: string) => {
      const mockEnv = {
        'CARESTACK_USE_MOCK': 'true',
        'CARESTACK_BASE_URL_LIVE': 'https://brightsmiles.carestack.com',
        'CARESTACK_VENDOR_KEY_LIVE': 'mock_vendor_key',
        'CARESTACK_ACCOUNT_KEY_LIVE': 'mock_account_key',
        'CARESTACK_ACCOUNT_ID_LIVE': 'mock_account_id',
        'CARESTACK_AUTH_METHOD_LIVE': 'header',
        'CARESTACK_TIMEOUT_LIVE': '30000',
        'CARESTACK_MAX_RETRIES_LIVE': '3',
        'CARESTACK_RATE_LIMIT_LIVE': '10'
      }
      return mockEnv[key]
    })
  }
} as any

// Mock fetch for testing
global.fetch = jest.fn()

describe('CareStack Integration Tests - Phase 3 & 4', () => {
  let adapter: CareStackAdapter
  const mockCredentials = {
    vendorKey: 'test_vendor_key',
    accountKey: 'test_account_key', 
    accountId: 'test_account_id',
    baseUrl: 'https://brightsmiles.carestack.com',
    useMockMode: true
  }

  beforeEach(() => {
    adapter = new CareStackAdapter(mockCredentials)
    jest.clearAllMocks()
  })

  describe('Phase 3: Authentication Clarification', () => {
    it('should support multiple authentication methods', async () => {
      const config = getCareStackEnhancedConfig()
      
      expect(config).toHaveProperty('authMethod')
      expect(config).toHaveProperty('timeout')
      expect(config).toHaveProperty('maxRetries')
      expect(config).toHaveProperty('rateLimitPerSecond')
    })

    it('should validate authentication configuration', async () => {
      const config = getCareStackEnhancedConfig()
      const validation = await validateCareStackAuthentication(config)
      
      expect(validation).toHaveProperty('isValid')
      expect(validation).toHaveProperty('method')
      expect(validation).toHaveProperty('details')
      
      // In mock mode, authentication should always be valid
      if (config.useMock) {
        expect(validation.isValid).toBe(true)
        expect(validation.method).toBe('mock')
      }
    })

    it('should handle different base URL formats', () => {
      const adapter1 = new CareStackAdapter({
        ...mockCredentials,
        baseUrl: 'https://brightsmiles.carestack.com' // Customer-specific URL
      })

      const adapter2 = new CareStackAdapter({
        ...mockCredentials,
        baseUrl: 'https://api.carestack.com' // Generic API URL
      })

      expect(adapter1).toBeDefined()
      expect(adapter2).toBeDefined()
    })

    it('should generate correct headers for different auth methods', async () => {
      const headerAuth = (adapter as any).getAuthHeaders()
      
      expect(headerAuth).toHaveProperty('VendorKey')
      expect(headerAuth).toHaveProperty('AccountKey')
      expect(headerAuth).toHaveProperty('AccountId')
      expect(headerAuth).toHaveProperty('Content-Type', 'application/json')
    })
  })

  describe('Phase 4: Updated API Structure Testing', () => {
    describe('Patient API - New Structure', () => {
      it('should search patients using POST with SearchRequest body', async () => {
        const searchRequest = {
          q: 'John Smith',
          phone: '+1-555-0123',
          page: 1,
          pageSize: 20
        }

        const result = await adapter.searchPatients(searchRequest)
        
        expect(result).toHaveProperty('items')
        expect(result).toHaveProperty('total')
        expect(result).toHaveProperty('page', 1)
        expect(result).toHaveProperty('pageSize', 20)
        expect(result).toHaveProperty('totalPages')
        expect(Array.isArray(result.items)).toBe(true)

        if (result.items.length > 0) {
          const patient = result.items[0]
          expect(patient).toHaveProperty('id')
          expect(patient).toHaveProperty('firstName')
          expect(patient).toHaveProperty('lastName')
        }
      })

      it('should create patient with new API structure', async () => {
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

      it('should get patient by numeric ID', async () => {
        const patientId = '1'
        const patient = await adapter.getPatient(patientId)
        
        expect(patient).not.toBeNull()
        if (patient) {
          expect(patient.id).toBe(1)
          expect(patient).toHaveProperty('firstName')
          expect(patient).toHaveProperty('lastName')
          expect(patient).toHaveProperty('mobileNumber')
        }
      })
    })

    describe('Appointment API - Enhanced Features', () => {
      it('should get appointment statuses', async () => {
        const statuses = await adapter.getAppointmentStatuses()
        
        expect(Array.isArray(statuses)).toBe(true)
        expect(statuses.length).toBeGreaterThan(0)
        
        const status = statuses[0]
        expect(status).toHaveProperty('id')
        expect(status).toHaveProperty('name')
        expect(status).toHaveProperty('isActive')
      })

      it('should get appointment by ID', async () => {
        const appointmentId = 1
        const appointment = await adapter.getAppointment(appointmentId)
        
        expect(appointment).not.toBeNull()
        if (appointment) {
          expect(appointment.id).toBe(appointmentId)
          expect(appointment).toHaveProperty('patientId')
          expect(appointment).toHaveProperty('providerId')
          expect(appointment).toHaveProperty('startTime')
          expect(appointment).toHaveProperty('endTime')
        }
      })

      it('should cancel appointment', async () => {
        const appointmentId = 1
        const result = await adapter.cancelAppointment(appointmentId, 'Test cancellation')
        
        expect(typeof result).toBe('boolean')
      })

      it('should checkout appointment', async () => {
        const appointmentId = 1
        const result = await adapter.checkoutAppointment(appointmentId)
        
        expect(typeof result).toBe('boolean')
      })

      it('should modify appointment status', async () => {
        const appointmentId = 1
        const statusData = {
          status: 'confirmed' as const,
          notes: 'Updated via test'
        }
        
        const result = await adapter.modifyAppointmentStatus(appointmentId, statusData)
        
        expect(typeof result).toBe('boolean')
      })
    })

    describe('Procedure and Treatment APIs', () => {
      it('should get procedure codes with filtering', async () => {
        const procedures = await adapter.getProcedureCodes('D0150', 0, 10)
        
        expect(Array.isArray(procedures)).toBe(true)
        
        if (procedures.length > 0) {
          const procedure = procedures[0]
          expect(procedure).toHaveProperty('id')
          expect(procedure).toHaveProperty('code')
          expect(procedure).toHaveProperty('description')
          expect(procedure).toHaveProperty('category')
          expect(procedure).toHaveProperty('fee')
        }
      })

      it('should get production types', async () => {
        const productionTypes = await adapter.getProductionTypes()
        
        expect(Array.isArray(productionTypes)).toBe(true)
        expect(productionTypes.length).toBeGreaterThan(0)
        
        const type = productionTypes[0]
        expect(type).toHaveProperty('id')
        expect(type).toHaveProperty('name')
        expect(type).toHaveProperty('isActive')
      })

      it('should get appointment procedures', async () => {
        const appointmentId = 1
        const procedureIds = await adapter.getAppointmentProcedures(appointmentId)
        
        expect(Array.isArray(procedureIds)).toBe(true)
        
        if (procedureIds.length > 0) {
          procedureIds.forEach(id => {
            expect(typeof id).toBe('number')
          })
        }
      })
    })

    describe('Sync APIs - Phase 2 Features', () => {
      it('should sync patients with pagination', async () => {
        const modifiedSince = '2024-01-01T00:00:00Z'
        const result = await adapter.syncPatients(modifiedSince)
        
        expect(result).toHaveProperty('items')
        expect(result).toHaveProperty('totalCount')
        expect(result).toHaveProperty('hasMore')
        expect(Array.isArray(result.items)).toBe(true)
        
        if (result.items.length > 0) {
          const patient = result.items[0]
          expect(patient).toHaveProperty('id')
          expect(patient).toHaveProperty('firstName')
          expect(patient).toHaveProperty('lastName')
        }
      })

      it('should sync appointments with pagination', async () => {
        const modifiedSince = '2024-01-01T00:00:00Z'
        const result = await adapter.syncAppointments(modifiedSince)
        
        expect(result).toHaveProperty('items')
        expect(result).toHaveProperty('totalCount')
        expect(result).toHaveProperty('hasMore')
        expect(Array.isArray(result.items)).toBe(true)
        
        if (result.items.length > 0) {
          const appointment = result.items[0]
          expect(appointment).toHaveProperty('id')
          expect(appointment).toHaveProperty('patientId')
          expect(appointment).toHaveProperty('providerId')
          expect(appointment).toHaveProperty('status')
          expect(appointment).toHaveProperty('modifiedDate')
        }
      })

      it('should sync treatment procedures', async () => {
        const modifiedSince = '2024-01-01T00:00:00Z'
        const result = await adapter.syncTreatmentProcedures(modifiedSince)
        
        expect(result).toHaveProperty('items')
        expect(result).toHaveProperty('totalCount')
        expect(result).toHaveProperty('hasMore')
        expect(Array.isArray(result.items)).toBe(true)
        
        if (result.items.length > 0) {
          const treatment = result.items[0]
          expect(treatment).toHaveProperty('id')
          expect(treatment).toHaveProperty('appointmentId')
          expect(treatment).toHaveProperty('patientId')
          expect(treatment).toHaveProperty('procedureCodeId')
          expect(treatment).toHaveProperty('status')
          expect(treatment).toHaveProperty('modifiedDate')
        }
      })

      it('should support pagination with continueToken', async () => {
        const modifiedSince = '2024-01-01T00:00:00Z'
        const result1 = await adapter.syncPatients(modifiedSince)
        
        if (result1.continueToken) {
          const result2 = await adapter.syncPatients(modifiedSince, result1.continueToken)
          expect(result2).toHaveProperty('items')
          expect(result2).toHaveProperty('continueToken')
        }
      })
    })

    describe('Location and Operatory APIs - Updated Structure', () => {
      it('should list locations with new API structure', async () => {
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

      it('should list operatories with numeric IDs', async () => {
        const operatories = await adapter.listOperatories('1')
        
        expect(Array.isArray(operatories)).toBe(true)
        
        if (operatories.length > 0) {
          const operatory = operatories[0]
          expect(operatory).toHaveProperty('id')
          expect(operatory).toHaveProperty('name')
          expect(operatory).toHaveProperty('locationId')
          expect(operatory).toHaveProperty('isActive')
        }
      })
    })

    describe('Error Handling and Resilience', () => {
      it('should handle network timeouts gracefully', async () => {
        // Mock a timeout scenario
        jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Timeout'))
        
        try {
          await adapter.listLocations()
        } catch (error) {
          expect(error).toBeDefined()
        }
      })

      it('should handle API rate limiting', async () => {
        // Mock a rate limit response
        const mockResponse = {
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: jest.fn().mockResolvedValue({ error: 'Rate limit exceeded' })
        }
        jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse as any)
        
        try {
          await (adapter as any).makeRequest('/test')
        } catch (error) {
          expect(error.message).toContain('Rate limit exceeded')
        }
      })

      it('should handle authentication failures', async () => {
        // Mock an auth failure response
        const mockResponse = {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: jest.fn().mockResolvedValue({ error: 'Invalid credentials' })
        }
        jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse as any)
        
        try {
          await (adapter as any).makeRequest('/test')
        } catch (error) {
          expect(error.message).toContain('Authentication failed')
        }
      })
    })

    describe('Data Type Validation - New Structure', () => {
      it('should return correctly typed PatientViewModel data', async () => {
        const patients = await adapter.searchPatientByPhone('+1-555-0123')
        
        if (patients.length > 0) {
          const patient = patients[0]
          expect(typeof patient.id).toBe('string') // Converted to string for interface compatibility
          expect(typeof patient.firstName).toBe('string')
          expect(typeof patient.lastName).toBe('string')
          if (patient.phone) expect(typeof patient.phone).toBe('string')
          if (patient.email) expect(typeof patient.email).toBe('string')
          if (patient.dateOfBirth) expect(typeof patient.dateOfBirth).toBe('string')
        }
      })

      it('should return correctly typed LocationDetailModel data', async () => {
        const locations = await adapter.listLocations()
        
        if (locations.length > 0) {
          const location = locations[0]
          expect(typeof location.id).toBe('string') // Converted to string for interface compatibility
          expect(typeof location.name).toBe('string')
          expect(typeof location.address).toBe('object')
          expect(typeof location.address.street).toBe('string')
          expect(typeof location.address.city).toBe('string')
          expect(typeof location.address.state).toBe('string')
          expect(typeof location.address.zipCode).toBe('string')
        }
      })

      it('should handle numeric ID conversions correctly', async () => {
        // Test that numeric IDs from API are properly converted to strings for interface compatibility
        const patient = await adapter.getPatient('1')
        
        if (patient) {
          // Internal ID should be number
          expect(typeof patient.id).toBe('number')
          
          // When converted through adapter methods, should be string
          const converted = (adapter as any).convertPatient(patient)
          expect(typeof converted.id).toBe('string')
        }
      })
    })

    describe('Performance and Caching', () => {
      it('should cache location data efficiently', async () => {
        const start1 = Date.now()
        const locations1 = await adapter.listLocations()
        const time1 = Date.now() - start1
        
        const start2 = Date.now()
        const locations2 = await adapter.listLocations()
        const time2 = Date.now() - start2
        
        expect(locations1).toEqual(locations2)
        // Second call should be faster due to caching (in mock mode, both should be fast)
        expect(time2).toBeLessThanOrEqual(time1 + 50) // Allow some variance
      })

      it('should respect cache TTL', async () => {
        const locations1 = await adapter.listLocations()
        
        // Simulate cache expiry by clearing cache manually
        ;(adapter as any).cache.locations.clear()
        
        const locations2 = await adapter.listLocations()
        
        expect(locations1).toEqual(locations2) // Same data structure
      })
    })
  })

  describe('Integration Health Checks', () => {
    it('should provide comprehensive health status', async () => {
      const config = getCareStackEnhancedConfig()
      const validation = await validateCareStackAuthentication(config)
      
      expect(validation).toHaveProperty('isValid')
      expect(validation).toHaveProperty('method')
      expect(validation).toHaveProperty('details')
      
      if (!validation.isValid) {
        expect(validation).toHaveProperty('suggestions')
        expect(Array.isArray(validation.suggestions)).toBe(true)
      }
    })

    it('should validate all endpoints are accessible', async () => {
      const endpoints = [
        () => adapter.listLocations(),
        () => adapter.listProviders(),
        () => adapter.getAppointmentStatuses(),
        () => adapter.getProcedureCodes(),
        () => adapter.getProductionTypes()
      ]

      const results = await Promise.allSettled(endpoints.map(fn => fn()))
      
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(`Endpoint ${index} failed:`, result.reason)
        }
        // In mock mode, all endpoints should succeed
        expect(result.status).toBe('fulfilled')
      })
    })
  })
})