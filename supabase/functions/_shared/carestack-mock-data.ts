import {
  PatientViewModel,
  LocationDetailModel,
  OperatoryDetail,
  CareStackProvider,
  AppointmentDetailModel,
  AppointmentSyncModel,
  TreatmentProcedureSyncModel,
  AppointmentStatusExternalModel,
  ProcedureCodeBasicApiResponseModel,
  ProductionTypeDetailsModel,
  CareStackAddress,
  // Backward compatibility
  CareStackPatient,
  CareStackLocation,
  CareStackOperatory,
  CareStackAppointment
} from './carestack-types.ts'

// Mock data that matches CareStack API schema exactly

const mockAddresses: CareStackAddress[] = [
  {
    street: "123 Main Street",
    city: "Denver",
    state: "CO",
    zipCode: "80202",
    country: "USA"
  },
  {
    street: "456 Oak Avenue",
    city: "Boulder",
    state: "CO", 
    zipCode: "80301",
    country: "USA"
  }
]

// Updated mock data aligned with actual API structure
export const mockPatientsNew: PatientViewModel[] = [
  {
    id: 1,
    firstName: "John",
    lastName: "Smith",
    dateOfBirth: "1985-03-15",
    mobileNumber: "+1-555-0123",
    email: "john.smith@email.com",
    address: mockAddresses[0],
    gender: "male",
    emergencyContact: {
      name: "Jane Smith",
      phone: "+1-555-0124",
      relationship: "spouse"
    },
    createdAt: "2024-01-15T10:30:00Z",
    updatedAt: "2024-01-15T10:30:00Z",
    insuranceCarrier: "Delta Dental",
    memberId: "DD123456789",
    notes: "Patient prefers morning appointments. History of dental anxiety."
  },
  {
    id: 2,
    firstName: "Maria",
    lastName: "Garcia",
    dateOfBirth: "1992-07-22",
    mobileNumber: "+1-555-0456",
    email: "maria.garcia@email.com",
    address: mockAddresses[1],
    gender: "female",
    emergencyContact: {
      name: "Carlos Garcia",
      phone: "+1-555-0457",
      relationship: "brother"
    },
    createdAt: "2024-02-10T14:15:00Z",
    updatedAt: "2024-02-10T14:15:00Z",
    insuranceCarrier: "Cigna Dental",
    memberId: "CG987654321",
    notes: "Regular cleaning patient. No known allergies."
  },
  {
    id: 3,
    firstName: "Robert",
    lastName: "Johnson",
    dateOfBirth: "1978-11-08",
    mobileNumber: "+1-555-0789",
    email: "robert.johnson@email.com",
    address: {
      street: "789 Pine Road",
      city: "Lakewood",
      state: "CO",
      zipCode: "80226",
      country: "USA"
    },
    gender: "male",
    createdAt: "2024-03-05T09:45:00Z",
    updatedAt: "2024-03-05T09:45:00Z",
    notes: "Self-pay patient. Prefers evening appointments."
  }
]

// Backward compatibility
export const mockPatients: CareStackPatient[] = mockPatientsNew.map(p => ({
  id: p.id.toString(),
  firstName: p.firstName,
  lastName: p.lastName,
  dob: p.dateOfBirth,
  phone: p.mobileNumber,
  email: p.email,
  address: p.address,
  gender: p.gender,
  emergencyContact: p.emergencyContact,
  createdAt: p.createdAt || '',
  updatedAt: p.updatedAt || '',
  insuranceCarrier: p.insuranceCarrier || null,
  memberId: p.memberId || null,
  notes: p.notes || null,
  ssn: undefined
}))

export const mockOperatoriesNew: OperatoryDetail[] = [
  {
    id: 1,
    name: "Operatory 1",
    locationId: 1,
    isActive: true,
    equipmentList: ["Digital X-Ray", "Intraoral Camera", "Ultrasonic Scaler"]
  },
  {
    id: 2,
    name: "Operatory 2",
    locationId: 1,
    isActive: true,
    equipmentList: ["Digital X-Ray", "CEREC", "Laser"]
  },
  {
    id: 3,
    name: "Hygiene Bay 1",
    locationId: 2,
    isActive: true,
    equipmentList: ["Digital X-Ray", "Ultrasonic Scaler", "Fluoride System"]
  }
]

// Backward compatibility
export const mockOperatories: CareStackOperatory[] = mockOperatoriesNew.map(op => ({
  id: op.id.toString(),
  name: op.name,
  locationId: op.locationId.toString(),
  isActive: op.isActive,
  equipmentList: op.equipmentList
}))

export const mockLocationsNew: LocationDetailModel[] = [
  {
    id: 1,
    name: "Downtown Dental Center",
    address: mockAddresses[0],
    phone: "+1-555-0100",
    timezone: "America/Denver",
    isActive: true
  },
  {
    id: 2,
    name: "Boulder Family Dentistry",
    address: mockAddresses[1],
    phone: "+1-555-0200",
    timezone: "America/Denver",
    isActive: true
  }
]

// Backward compatibility
export const mockLocations: CareStackLocation[] = mockLocationsNew.map(loc => ({
  id: loc.id.toString(),
  name: loc.name,
  address: loc.address,
  phone: loc.phone,
  timezone: loc.timezone || "America/Denver",
  isActive: loc.isActive,
  operatories: mockOperatories.filter(op => op.locationId === loc.id.toString())
}))

export const mockProviders: CareStackProvider[] = [
  {
    id: "cs_prov_001",
    firstName: "Dr. Sarah",
    lastName: "Wilson",
    title: "DDS",
    specialty: "General Dentistry",
    phone: "+1-555-0301",
    email: "dr.wilson@clinic.com",
    locationIds: ["cs_loc_001", "cs_loc_002"],
    isActive: true
  },
  {
    id: "cs_prov_002",
    firstName: "Dr. Michael",
    lastName: "Chen",
    title: "DDS, MS",
    specialty: "Orthodontics", 
    phone: "+1-555-0302",
    email: "dr.chen@clinic.com",
    locationIds: ["cs_loc_001"],
    isActive: true
  }
]

export const mockAppointments: CareStackAppointment[] = [
  {
    id: "cs_appt_001",
    patientId: "cs_pat_001",
    providerId: "cs_prov_001",
    locationId: "cs_loc_001",
    operatoryId: "cs_op_001",
    start: "2024-12-20T09:00:00Z",
    end: "2024-12-20T10:00:00Z",
    status: "scheduled",
    code: "D0150",
    description: "Comprehensive Oral Examination",
    notes: "New patient exam with X-rays",
    duration: 60,
    isNewPatient: true,
    createdAt: "2024-12-15T10:00:00Z",
    updatedAt: "2024-12-15T10:00:00Z"
  },
  {
    id: "cs_appt_002",
    patientId: "cs_pat_002", 
    providerId: "cs_prov_001",
    locationId: "cs_loc_002",
    operatoryId: "cs_op_003",
    start: "2024-12-21T14:00:00Z",
    end: "2024-12-21T15:00:00Z",
    status: "confirmed",
    code: "D1110",
    description: "Adult Prophylaxis",
    notes: "Routine cleaning and checkup",
    duration: 60,
    isNewPatient: false,
    createdAt: "2024-12-10T15:30:00Z",
    updatedAt: "2024-12-12T09:00:00Z"
  }
]

// New mock data for Phase 2 features
export const mockAppointmentStatuses: AppointmentStatusExternalModel[] = [
  { id: 1, name: "Scheduled", isActive: true },
  { id: 2, name: "Confirmed", isActive: true },
  { id: 3, name: "Arrived", isActive: true },
  { id: 4, name: "In Progress", isActive: true },
  { id: 5, name: "Completed", isActive: true },
  { id: 6, name: "Cancelled", isActive: true },
  { id: 7, name: "No Show", isActive: true }
]

export const mockProcedureCodes: ProcedureCodeBasicApiResponseModel[] = [
  { id: 1, code: "D0150", description: "Comprehensive oral evaluation", category: "Diagnostic", fee: 150 },
  { id: 2, code: "D1110", description: "Adult prophylaxis", category: "Preventive", fee: 100 },
  { id: 3, code: "D2140", description: "Amalgam - one surface", category: "Restorative", fee: 180 },
  { id: 4, code: "D2391", description: "Resin-based composite - one surface", category: "Restorative", fee: 200 },
  { id: 5, code: "D4341", description: "Periodontal scaling and root planing", category: "Periodontics", fee: 250 }
]

export const mockProductionTypes: ProductionTypeDetailsModel[] = [
  { id: 1, name: "Preventive", description: "Preventive care procedures", isActive: true },
  { id: 2, name: "Restorative", description: "Restorative dental procedures", isActive: true },
  { id: 3, name: "Cosmetic", description: "Cosmetic dental procedures", isActive: true },
  { id: 4, name: "Periodontics", description: "Periodontal treatments", isActive: true },
  { id: 5, name: "Orthodontics", description: "Orthodontic treatments", isActive: true }
]

export const mockAppointmentSyncModels: AppointmentSyncModel[] = [
  {
    id: 1,
    patientId: 1,
    providerId: 1,
    locationId: 1,
    startTime: "2024-12-20T09:00:00Z",
    endTime: "2024-12-20T10:00:00Z",
    status: "scheduled",
    modifiedDate: "2024-12-15T10:00:00Z"
  },
  {
    id: 2,
    patientId: 2,
    providerId: 1,
    locationId: 2,
    startTime: "2024-12-21T14:00:00Z",
    endTime: "2024-12-21T15:00:00Z",
    status: "confirmed",
    modifiedDate: "2024-12-12T09:00:00Z"
  }
]

export const mockTreatmentProcedures: TreatmentProcedureSyncModel[] = [
  {
    id: 1,
    appointmentId: 1,
    patientId: 1,
    procedureCodeId: 1,
    status: "completed",
    modifiedDate: "2024-12-20T10:00:00Z",
    amount: 150,
    notes: "Comprehensive exam completed successfully"
  },
  {
    id: 2,
    appointmentId: 2,
    patientId: 2,
    procedureCodeId: 2,
    status: "scheduled",
    modifiedDate: "2024-12-21T15:00:00Z",
    amount: 100,
    notes: "Routine prophylaxis"
  }
]

// In-memory storage for created items (simulates database)
export const mockStorage = {
  patients: new Map<string, PatientViewModel>(),
  appointments: new Map<string, AppointmentDetailModel>(),
  idempotencyKeys: new Set<string>()
}

// Initialize storage with mock data
mockPatientsNew.forEach(patient => {
  mockStorage.patients.set(patient.id.toString(), patient)
})

mockAppointments.forEach(appointment => {
  const aptDetail: AppointmentDetailModel = {
    id: parseInt(appointment.id),
    patientId: parseInt(appointment.patientId),
    providerId: parseInt(appointment.providerId),
    locationId: parseInt(appointment.locationId),
    operatoryId: appointment.operatoryId ? parseInt(appointment.operatoryId) : undefined,
    startTime: appointment.start,
    endTime: appointment.end,
    status: appointment.status,
    procedureCode: appointment.code,
    description: appointment.description,
    notes: appointment.notes,
    duration: appointment.duration,
    isNewPatient: appointment.isNewPatient,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt
  }
  mockStorage.appointments.set(appointment.id, aptDetail)
})

// Utility functions for mock data manipulation
export function generateMockId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function addArtificialLatency(min = 200, max = 500): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise(resolve => setTimeout(resolve, delay))
}

export function simulateRandomFailure(failureRate = 0.04): boolean {
  return Math.random() < failureRate
}