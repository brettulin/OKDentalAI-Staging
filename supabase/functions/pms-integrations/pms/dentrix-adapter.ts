import { PMSInterface, PMSAdapterConfig, Patient, Appointment, Location, Operatory, PatientSearchQuery, PatientCreateData, PatientUpdateData, AppointmentCreateData, AppointmentUpdateData, DateRange } from '../../_shared/pms-interface.ts';

/**
 * Dentrix PMS Adapter Implementation
 * 
 * This adapter implements the PMSInterface for Dentrix practice management systems.
 * It provides secure, robust integration with comprehensive error handling and retry logic.
 */
export class DentrixAdapter implements PMSInterface {
  private config: PMSAdapterConfig;
  private baseUrl: string;
  private authToken: string | null = null;
  private connectionPool: Map<string, any> = new Map();
  private rateLimiter: Map<string, number> = new Map();
  private circuitBreaker: Map<string, { failures: number; lastFailure: number; isOpen: boolean }> = new Map();

  constructor(config: PMSAdapterConfig) {
    this.config = config;
    this.baseUrl = config.apiUrl || 'https://api.dentrix.com/v1';
    this.initializeCircuitBreaker();
  }

  private initializeCircuitBreaker() {
    const endpoints = ['patients', 'appointments', 'locations', 'operatories'];
    endpoints.forEach(endpoint => {
      this.circuitBreaker.set(endpoint, { failures: 0, lastFailure: 0, isOpen: false });
    });
  }

  private async executeWithCircuitBreaker<T>(
    endpoint: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    const breaker = this.circuitBreaker.get(endpoint);
    if (!breaker) throw new Error(`Circuit breaker not initialized for ${endpoint}`);

    // Check if circuit is open
    if (breaker.isOpen) {
      const timeSinceLastFailure = Date.now() - breaker.lastFailure;
      if (timeSinceLastFailure < 60000) { // 1 minute cooldown
        throw new Error(`Circuit breaker open for ${endpoint}. Retry after cooldown.`);
      } else {
        breaker.isOpen = false; // Reset circuit breaker
      }
    }

    try {
      const result = await operation();
      breaker.failures = 0; // Reset on success
      return result;
    } catch (error) {
      breaker.failures++;
      breaker.lastFailure = Date.now();
      
      if (breaker.failures >= 5) {
        breaker.isOpen = true;
      }
      
      throw error;
    }
  }

  private async authenticate(): Promise<void> {
    if (!this.config.credentials?.apiKey || !this.config.credentials?.secretKey) {
      throw new Error('Dentrix API credentials not configured');
    }

    const authUrl = `${this.baseUrl}/auth/token`;
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.credentials.apiKey,
      },
      body: JSON.stringify({
        clientId: this.config.credentials.apiKey,
        clientSecret: this.config.credentials.secretKey,
        scope: 'patients appointments locations'
      })
    });

    if (!response.ok) {
      throw new Error(`Dentrix authentication failed: ${response.status} ${response.statusText}`);
    }

    const authData = await response.json();
    this.authToken = authData.access_token;
  }

  private async makeApiCall(endpoint: string, options: RequestInit = {}): Promise<Response> {
    if (!this.authToken) {
      await this.authenticate();
    }

    const url = `${this.baseUrl}/${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json',
      'X-Practice-ID': this.config.practiceId || '',
      ...options.headers
    };

    let response = await fetch(url, { ...options, headers });

    // Handle token expiration
    if (response.status === 401) {
      await this.authenticate();
      headers['Authorization'] = `Bearer ${this.authToken}`;
      response = await fetch(url, { ...options, headers });
    }

    if (!response.ok) {
      throw new Error(`Dentrix API error: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  async validateConnection(): Promise<boolean> {
    return this.executeWithCircuitBreaker('validation', async () => {
      try {
        const response = await this.makeApiCall('system/status');
        const data = await response.json();
        return data.status === 'active';
      } catch (error) {
        console.error('Dentrix connection validation failed:', error);
        return false;
      }
    });
  }

  async searchPatients(query: PatientSearchQuery): Promise<Patient[]> {
    return this.executeWithCircuitBreaker('patients', async () => {
      const searchParams = new URLSearchParams();
      
      if (query.firstName) searchParams.append('firstName', query.firstName);
      if (query.lastName) searchParams.append('lastName', query.lastName);
      if (query.phone) searchParams.append('phone', query.phone.replace(/\D/g, ''));
      if (query.email) searchParams.append('email', query.email);
      if (query.dateOfBirth) searchParams.append('dateOfBirth', query.dateOfBirth);

      const response = await this.makeApiCall(`patients/search?${searchParams.toString()}`);
      const data = await response.json();

      return data.patients.map((p: any) => ({
        id: p.patientId,
        externalId: p.patientId,
        firstName: p.firstName,
        lastName: p.lastName,
        fullName: `${p.firstName} ${p.lastName}`,
        phone: p.primaryPhone,
        email: p.email,
        dateOfBirth: p.dateOfBirth,
        address: p.address ? {
          street: p.address.street,
          city: p.address.city,
          state: p.address.state,
          zipCode: p.address.zipCode
        } : undefined,
        insurance: p.insurance ? {
          primary: p.insurance.primary,
          secondary: p.insurance.secondary
        } : undefined,
        notes: p.notes,
        lastVisit: p.lastVisitDate,
        nextAppointment: p.nextAppointmentDate
      }));
    });
  }

  async createPatient(patient: PatientCreateData): Promise<Patient> {
    return this.executeWithCircuitBreaker('patients', async () => {
      const dentrixPatient = {
        firstName: patient.firstName,
        lastName: patient.lastName,
        primaryPhone: patient.phone?.replace(/\D/g, ''),
        email: patient.email,
        dateOfBirth: patient.dateOfBirth,
        address: patient.address ? {
          street: patient.address.street,
          city: patient.address.city,
          state: patient.address.state,
          zipCode: patient.address.zipCode
        } : undefined,
        insurance: patient.insurance,
        notes: patient.notes,
        emergencyContact: patient.emergencyContact
      };

      const response = await this.makeApiCall('patients', {
        method: 'POST',
        body: JSON.stringify(dentrixPatient)
      });

      const data = await response.json();
      
      return {
        id: data.patientId,
        externalId: data.patientId,
        firstName: data.firstName,
        lastName: data.lastName,
        fullName: `${data.firstName} ${data.lastName}`,
        phone: data.primaryPhone,
        email: data.email,
        dateOfBirth: data.dateOfBirth,
        address: data.address,
        insurance: data.insurance,
        notes: data.notes,
        createdAt: new Date().toISOString()
      };
    });
  }

  async updatePatient(patientId: string, updates: PatientUpdateData): Promise<Patient> {
    return this.executeWithCircuitBreaker('patients', async () => {
      const response = await this.makeApiCall(`patients/${patientId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });

      const data = await response.json();
      
      return {
        id: data.patientId,
        externalId: data.patientId,
        firstName: data.firstName,
        lastName: data.lastName,
        fullName: `${data.firstName} ${data.lastName}`,
        phone: data.primaryPhone,
        email: data.email,
        dateOfBirth: data.dateOfBirth,
        address: data.address,
        insurance: data.insurance,
        notes: data.notes,
        updatedAt: new Date().toISOString()
      };
    });
  }

  async listAppointments(locationId: string, dateRange: DateRange): Promise<Appointment[]> {
    return this.executeWithCircuitBreaker('appointments', async () => {
      const params = new URLSearchParams({
        locationId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });

      const response = await this.makeApiCall(`appointments?${params.toString()}`);
      const data = await response.json();

      return data.appointments.map((apt: any) => ({
        id: apt.appointmentId,
        externalId: apt.appointmentId,
        patientId: apt.patientId,
        providerId: apt.providerId,
        locationId: apt.locationId,
        operatoryId: apt.operatoryId,
        serviceId: apt.serviceId,
        startTime: apt.startTime,
        endTime: apt.endTime,
        duration: apt.duration,
        status: apt.status,
        notes: apt.notes,
        reason: apt.reason,
        patient: apt.patient ? {
          id: apt.patient.patientId,
          firstName: apt.patient.firstName,
          lastName: apt.patient.lastName,
          phone: apt.patient.primaryPhone
        } : undefined
      }));
    });
  }

  async createAppointment(appointment: AppointmentCreateData): Promise<Appointment> {
    return this.executeWithCircuitBreaker('appointments', async () => {
      const dentrixAppointment = {
        patientId: appointment.patientId,
        providerId: appointment.providerId,
        locationId: appointment.locationId,
        operatoryId: appointment.operatoryId,
        serviceId: appointment.serviceId,
        startTime: appointment.startTime,
        duration: appointment.duration,
        notes: appointment.notes,
        reason: appointment.reason
      };

      const response = await this.makeApiCall('appointments', {
        method: 'POST',
        body: JSON.stringify(dentrixAppointment)
      });

      const data = await response.json();
      
      return {
        id: data.appointmentId,
        externalId: data.appointmentId,
        patientId: data.patientId,
        providerId: data.providerId,
        locationId: data.locationId,
        operatoryId: data.operatoryId,
        serviceId: data.serviceId,
        startTime: data.startTime,
        endTime: data.endTime,
        duration: data.duration,
        status: data.status || 'scheduled',
        notes: data.notes,
        reason: data.reason,
        createdAt: new Date().toISOString()
      };
    });
  }

  async updateAppointment(appointmentId: string, updates: AppointmentUpdateData): Promise<Appointment> {
    return this.executeWithCircuitBreaker('appointments', async () => {
      const response = await this.makeApiCall(`appointments/${appointmentId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });

      const data = await response.json();
      
      return {
        id: data.appointmentId,
        externalId: data.appointmentId,
        patientId: data.patientId,
        providerId: data.providerId,
        locationId: data.locationId,
        operatoryId: data.operatoryId,
        serviceId: data.serviceId,
        startTime: data.startTime,
        endTime: data.endTime,
        duration: data.duration,
        status: data.status,
        notes: data.notes,
        reason: data.reason,
        updatedAt: new Date().toISOString()
      };
    });
  }

  async listLocations(): Promise<Location[]> {
    return this.executeWithCircuitBreaker('locations', async () => {
      const response = await this.makeApiCall('locations');
      const data = await response.json();

      return data.locations.map((loc: any) => ({
        id: loc.locationId,
        externalId: loc.locationId,
        name: loc.name,
        address: {
          street: loc.address.street,
          city: loc.address.city,
          state: loc.address.state,
          zipCode: loc.address.zipCode
        },
        phone: loc.phone,
        timezone: loc.timezone || 'America/New_York',
        businessHours: loc.businessHours
      }));
    });
  }

  async listOperatories(locationId: string): Promise<Operatory[]> {
    return this.executeWithCircuitBreaker('operatories', async () => {
      const response = await this.makeApiCall(`locations/${locationId}/operatories`);
      const data = await response.json();

      return data.operatories.map((op: any) => ({
        id: op.operatoryId,
        externalId: op.operatoryId,
        name: op.name,
        locationId: op.locationId,
        isActive: op.isActive,
        equipment: op.equipment
      }));
    });
  }

  // Health check for monitoring
  async getHealthStatus(): Promise<{ status: string; lastCheck: string; details: any }> {
    try {
      const isConnected = await this.validateConnection();
      return {
        status: isConnected ? 'healthy' : 'unhealthy',
        lastCheck: new Date().toISOString(),
        details: {
          adapter: 'Dentrix',
          circuitBreakers: Object.fromEntries(this.circuitBreaker),
          authTokenValid: !!this.authToken
        }
      };
    } catch (error) {
      return {
        status: 'error',
        lastCheck: new Date().toISOString(),
        details: {
          adapter: 'Dentrix',
          error: (error as Error).message,
          circuitBreakers: Object.fromEntries(this.circuitBreaker)
        }
      };
    }
  }
}