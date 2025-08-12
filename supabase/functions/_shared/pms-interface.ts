// Standard PMS interface that all adapters must implement
export interface PMSInterface {
  // Patient management
  searchPatientByPhone(phoneNumber: string): Promise<Patient[]>
  createPatient(patientData: PatientData): Promise<Patient>
  
  // Appointment management
  getAvailableSlots(providerId: string, dateRange: DateRange): Promise<Slot[]>
  bookAppointment(appointmentData: AppointmentData): Promise<Appointment>
  
  // Resource management
  listProviders(): Promise<Provider[]>
  listLocations(): Promise<Location[]>
}

// Data types
export interface Patient {
  id: string
  firstName: string
  lastName: string
  phone: string
  email?: string
  dateOfBirth?: string
  address?: Address
}

export interface PatientData {
  firstName: string
  lastName: string
  phone: string
  email?: string
  dateOfBirth?: string
  address?: Address
}

export interface Address {
  street: string
  city: string
  state: string
  zipCode: string
}

export interface DateRange {
  from: string
  to: string
}

export interface Slot {
  id: string
  startTime: string
  endTime: string
  providerId: string
  locationId: string
  available: boolean
}

export interface AppointmentData {
  patientId: string
  providerId: string
  locationId: string
  serviceId?: string
  startTime: string
  endTime: string
  notes?: string
}

export interface Appointment {
  id: string
  patientId: string
  providerId: string
  locationId: string
  startTime: string
  endTime: string
  status: string
  notes?: string
}

export interface Provider {
  id: string
  name: string
  specialty?: string
  locationIds: string[]
}

export interface Location {
  id: string
  name: string
  address: Address
  phone?: string
}