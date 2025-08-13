import { PMSInterface, PMSAdapterConfig, Patient, Appointment, Location, Operatory, PatientSearchQuery, PatientCreateData, PatientUpdateData, AppointmentCreateData, AppointmentUpdateData, DateRange } from '../../../_shared/pms-interface.ts';

/**
 * Eaglesoft PMS Adapter Implementation
 * 
 * This adapter implements the PMSInterface for Eaglesoft practice management systems.
 * It provides secure, robust integration with comprehensive error handling and retry logic.
 */
export class EaglesoftAdapter implements PMSInterface {
  private config: PMSAdapterConfig;
  private baseUrl: string;
  private sessionId: string | null = null;
  private connectionPool: Map<string, any> = new Map();
  private rateLimiter: Map<string, number> = new Map();
  private circuitBreaker: Map<string, { failures: number; lastFailure: number; isOpen: boolean }> = new Map();

  constructor(config: PMSAdapterConfig) {
    this.config = config;
    this.baseUrl = config.apiUrl || 'https://api.eaglesoft.com/v2';
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
    if (!this.config.credentials?.username || !this.config.credentials?.password) {
      throw new Error('Eaglesoft credentials not configured');
    }

    const authUrl = `${this.baseUrl}/session/create`;
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Practice-Code': this.config.practiceId || '',
      },
      body: JSON.stringify({
        username: this.config.credentials.username,
        password: this.config.credentials.password,
        applicationName: 'AI-Receptionist'
      })
    });

    if (!response.ok) {
      throw new Error(`Eaglesoft authentication failed: ${response.status} ${response.statusText}`);
    }

    const authData = await response.json();
    this.sessionId = authData.sessionId;
  }

  private async makeApiCall(endpoint: string, options: RequestInit = {}): Promise<Response> {
    if (!this.sessionId) {
      await this.authenticate();
    }

    const url = `${this.baseUrl}/${endpoint}`;
    const headers = {
      'X-Session-ID': this.sessionId!,
      'Content-Type': 'application/json',
      'X-Practice-Code': this.config.practiceId || '',
      ...options.headers
    };

    let response = await fetch(url, { ...options, headers });

    // Handle session expiration
    if (response.status === 401) {
      await this.authenticate();
      headers['X-Session-ID'] = this.sessionId!;
      response = await fetch(url, { ...options, headers });
    }

    if (!response.ok) {
      throw new Error(`Eaglesoft API error: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  async validateConnection(): Promise<boolean> {
    return this.executeWithCircuitBreaker('validation', async () => {
      try {
        const response = await this.makeApiCall('system/ping');
        const data = await response.json();
        return data.status === 'ok';
      } catch (error) {
        console.error('Eaglesoft connection validation failed:', error);
        return false;
      }
    });
  }

  async searchPatients(query: PatientSearchQuery): Promise<Patient[]> {
    return this.executeWithCircuitBreaker('patients', async () => {
      const searchCriteria: any = {};
      
      if (query.firstName) searchCriteria.FirstName = query.firstName;
      if (query.lastName) searchCriteria.LastName = query.lastName;
      if (query.phone) searchCriteria.HomePhone = query.phone.replace(/\D/g, '');
      if (query.email) searchCriteria.Email = query.email;
      if (query.dateOfBirth) searchCriteria.BirthDate = query.dateOfBirth;

      const response = await this.makeApiCall('patients/search', {
        method: 'POST',
        body: JSON.stringify({ criteria: searchCriteria })
      });
      const data = await response.json();

      return data.results.map((p: any) => ({
        id: p.PatientID,
        externalId: p.PatientID,
        firstName: p.FirstName,
        lastName: p.LastName,
        fullName: `${p.FirstName} ${p.LastName}`,
        phone: p.HomePhone || p.WorkPhone || p.CellPhone,
        email: p.Email,
        dateOfBirth: p.BirthDate,
        address: p.Address ? {
          street: `${p.Address.Address1} ${p.Address.Address2}`.trim(),
          city: p.Address.City,
          state: p.Address.State,
          zipCode: p.Address.ZipCode
        } : undefined,
        insurance: {
          primary: p.InsurancePrimary,
          secondary: p.InsuranceSecondary
        },
        notes: p.Notes,
        lastVisit: p.LastVisitDate,
        nextAppointment: p.NextAppointmentDate
      }));
    });
  }

  async createPatient(patient: PatientCreateData): Promise<Patient> {
    return this.executeWithCircuitBreaker('patients', async () => {
      const eaglesoftPatient = {
        FirstName: patient.firstName,
        LastName: patient.lastName,
        HomePhone: patient.phone?.replace(/\D/g, ''),
        Email: patient.email,
        BirthDate: patient.dateOfBirth,
        Address: patient.address ? {
          Address1: patient.address.street,
          City: patient.address.city,
          State: patient.address.state,
          ZipCode: patient.address.zipCode
        } : undefined,
        InsurancePrimary: patient.insurance?.primary,
        InsuranceSecondary: patient.insurance?.secondary,
        Notes: patient.notes,
        EmergencyContact: patient.emergencyContact
      };

      const response = await this.makeApiCall('patients', {
        method: 'POST',
        body: JSON.stringify(eaglesoftPatient)
      });

      const data = await response.json();
      
      return {
        id: data.PatientID,
        externalId: data.PatientID,
        firstName: data.FirstName,
        lastName: data.LastName,
        fullName: `${data.FirstName} ${data.LastName}`,
        phone: data.HomePhone,
        email: data.Email,
        dateOfBirth: data.BirthDate,
        address: data.Address ? {
          street: `${data.Address.Address1} ${data.Address.Address2}`.trim(),
          city: data.Address.City,
          state: data.Address.State,
          zipCode: data.Address.ZipCode
        } : undefined,
        insurance: {
          primary: data.InsurancePrimary,
          secondary: data.InsuranceSecondary
        },
        notes: data.Notes,
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
        id: data.PatientID,
        externalId: data.PatientID,
        firstName: data.FirstName,
        lastName: data.LastName,
        fullName: `${data.FirstName} ${data.LastName}`,
        phone: data.HomePhone,
        email: data.Email,
        dateOfBirth: data.BirthDate,
        address: data.Address ? {
          street: `${data.Address.Address1} ${data.Address.Address2}`.trim(),
          city: data.Address.City,
          state: data.Address.State,
          zipCode: data.Address.ZipCode
        } : undefined,
        insurance: {
          primary: data.InsurancePrimary,
          secondary: data.InsuranceSecondary
        },
        notes: data.Notes,
        updatedAt: new Date().toISOString()
      };
    });
  }

  async listAppointments(locationId: string, dateRange: DateRange): Promise<Appointment[]> {
    return this.executeWithCircuitBreaker('appointments', async () => {
      const criteria = {
        LocationID: locationId,
        StartDate: dateRange.startDate,
        EndDate: dateRange.endDate
      };

      const response = await this.makeApiCall('appointments/search', {
        method: 'POST',
        body: JSON.stringify({ criteria })
      });
      const data = await response.json();

      return data.results.map((apt: any) => ({
        id: apt.AppointmentID,
        externalId: apt.AppointmentID,
        patientId: apt.PatientID,
        providerId: apt.ProviderID,
        locationId: apt.LocationID,
        operatoryId: apt.OperatoryID,
        serviceId: apt.ProcedureCode,
        startTime: apt.StartTime,
        endTime: apt.EndTime,
        duration: apt.Duration,
        status: apt.Status,
        notes: apt.Notes,
        reason: apt.Reason,
        patient: apt.Patient ? {
          id: apt.Patient.PatientID,
          firstName: apt.Patient.FirstName,
          lastName: apt.Patient.LastName,
          phone: apt.Patient.HomePhone
        } : undefined
      }));
    });
  }

  async createAppointment(appointment: AppointmentCreateData): Promise<Appointment> {
    return this.executeWithCircuitBreaker('appointments', async () => {
      const eaglesoftAppointment = {
        PatientID: appointment.patientId,
        ProviderID: appointment.providerId,
        LocationID: appointment.locationId,
        OperatoryID: appointment.operatoryId,
        ProcedureCode: appointment.serviceId,
        StartTime: appointment.startTime,
        Duration: appointment.duration,
        Notes: appointment.notes,
        Reason: appointment.reason
      };

      const response = await this.makeApiCall('appointments', {
        method: 'POST',
        body: JSON.stringify(eaglesoftAppointment)
      });

      const data = await response.json();
      
      return {
        id: data.AppointmentID,
        externalId: data.AppointmentID,
        patientId: data.PatientID,
        providerId: data.ProviderID,
        locationId: data.LocationID,
        operatoryId: data.OperatoryID,
        serviceId: data.ProcedureCode,
        startTime: data.StartTime,
        endTime: data.EndTime,
        duration: data.Duration,
        status: data.Status || 'scheduled',
        notes: data.Notes,
        reason: data.Reason,
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
        id: data.AppointmentID,
        externalId: data.AppointmentID,
        patientId: data.PatientID,
        providerId: data.ProviderID,
        locationId: data.LocationID,
        operatoryId: data.OperatoryID,
        serviceId: data.ProcedureCode,
        startTime: data.StartTime,
        endTime: data.EndTime,
        duration: data.Duration,
        status: data.Status,
        notes: data.Notes,
        reason: data.Reason,
        updatedAt: new Date().toISOString()
      };
    });
  }

  async listLocations(): Promise<Location[]> {
    return this.executeWithCircuitBreaker('locations', async () => {
      const response = await this.makeApiCall('locations');
      const data = await response.json();

      return data.results.map((loc: any) => ({
        id: loc.LocationID,
        externalId: loc.LocationID,
        name: loc.Name,
        address: {
          street: `${loc.Address.Address1} ${loc.Address.Address2}`.trim(),
          city: loc.Address.City,
          state: loc.Address.State,
          zipCode: loc.Address.ZipCode
        },
        phone: loc.Phone,
        timezone: loc.TimeZone || 'America/New_York',
        businessHours: loc.BusinessHours
      }));
    });
  }

  async listOperatories(locationId: string): Promise<Operatory[]> {
    return this.executeWithCircuitBreaker('operatories', async () => {
      const response = await this.makeApiCall(`locations/${locationId}/operatories`);
      const data = await response.json();

      return data.results.map((op: any) => ({
        id: op.OperatoryID,
        externalId: op.OperatoryID,
        name: op.Name,
        locationId: op.LocationID,
        isActive: op.IsActive,
        equipment: op.Equipment
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
          adapter: 'Eaglesoft',
          circuitBreakers: Object.fromEntries(this.circuitBreaker),
          sessionValid: !!this.sessionId
        }
      };
    } catch (error) {
      return {
        status: 'error',
        lastCheck: new Date().toISOString(),
        details: {
          adapter: 'Eaglesoft',
          error: (error as Error).message,
          circuitBreakers: Object.fromEntries(this.circuitBreaker)
        }
      };
    }
  }
}