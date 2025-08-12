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
} from '../../_shared/pms-interface.ts'

export class DentrixAdapter implements PMSInterface {
  private credentials: any

  constructor(credentials: any) {
    this.credentials = credentials
  }

  async searchPatientByPhone(phoneNumber: string): Promise<Patient[]> {
    throw new Error("Dentrix integration not implemented")
  }

  async createPatient(patientData: PatientData): Promise<Patient> {
    throw new Error("Dentrix integration not implemented")
  }

  async getAvailableSlots(providerId: string, dateRange: DateRange): Promise<Slot[]> {
    throw new Error("Dentrix integration not implemented")
  }

  async bookAppointment(appointmentData: AppointmentData): Promise<Appointment> {
    throw new Error("Dentrix integration not implemented")
  }

  async listProviders(): Promise<Provider[]> {
    throw new Error("Dentrix integration not implemented")
  }

  async listLocations(): Promise<Location[]> {
    throw new Error("Dentrix integration not implemented")
  }
}