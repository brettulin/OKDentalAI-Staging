import {
  CareStackPatient,
  CareStackLocation,
  CareStackOperatory,
  CareStackProvider,
  CareStackAppointment,
  CareStackAddress
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

export const mockPatients: CareStackPatient[] = [
  {
    id: "cs_pat_001",
    firstName: "John",
    lastName: "Smith",
    dob: "1985-03-15",
    phone: "+1-555-0123",
    email: "john.smith@email.com",
    insuranceCarrier: "Delta Dental",
    memberId: "DD123456789",
    notes: "Patient prefers morning appointments. History of dental anxiety.",
    address: mockAddresses[0],
    gender: "male",
    emergencyContact: {
      name: "Jane Smith",
      phone: "+1-555-0124",
      relationship: "spouse"
    },
    createdAt: "2024-01-15T10:30:00Z",
    updatedAt: "2024-01-15T10:30:00Z"
  },
  {
    id: "cs_pat_002", 
    firstName: "Maria",
    lastName: "Garcia",
    dob: "1992-07-22",
    phone: "+1-555-0456",
    email: "maria.garcia@email.com",
    insuranceCarrier: "Cigna Dental",
    memberId: "CG987654321",
    notes: "Regular cleaning patient. No known allergies.",
    address: mockAddresses[1],
    gender: "female",
    emergencyContact: {
      name: "Carlos Garcia",
      phone: "+1-555-0457",
      relationship: "brother"
    },
    createdAt: "2024-02-10T14:15:00Z",
    updatedAt: "2024-02-10T14:15:00Z"
  },
  {
    id: "cs_pat_003",
    firstName: "Robert",
    lastName: "Johnson",
    dob: "1978-11-08",
    phone: "+1-555-0789",
    email: "robert.johnson@email.com",
    insuranceCarrier: null,
    memberId: null,
    notes: "Self-pay patient. Prefers evening appointments.",
    address: {
      street: "789 Pine Road",
      city: "Lakewood",
      state: "CO",
      zipCode: "80226",
      country: "USA"
    },
    gender: "male",
    createdAt: "2024-03-05T09:45:00Z",
    updatedAt: "2024-03-05T09:45:00Z"
  }
]

export const mockOperatories: CareStackOperatory[] = [
  {
    id: "cs_op_001",
    name: "Operatory 1",
    locationId: "cs_loc_001",
    isActive: true,
    equipmentList: ["Digital X-Ray", "Intraoral Camera", "Ultrasonic Scaler"]
  },
  {
    id: "cs_op_002", 
    name: "Operatory 2",
    locationId: "cs_loc_001",
    isActive: true,
    equipmentList: ["Digital X-Ray", "CEREC", "Laser"]
  },
  {
    id: "cs_op_003",
    name: "Hygiene Bay 1", 
    locationId: "cs_loc_002",
    isActive: true,
    equipmentList: ["Digital X-Ray", "Ultrasonic Scaler", "Fluoride System"]
  }
]

export const mockLocations: CareStackLocation[] = [
  {
    id: "cs_loc_001",
    name: "Downtown Dental Center",
    address: mockAddresses[0],
    phone: "+1-555-0100",
    timezone: "America/Denver",
    isActive: true,
    operatories: mockOperatories.filter(op => op.locationId === "cs_loc_001")
  },
  {
    id: "cs_loc_002",
    name: "Boulder Family Dentistry",
    address: mockAddresses[1], 
    phone: "+1-555-0200",
    timezone: "America/Denver",
    isActive: true,
    operatories: mockOperatories.filter(op => op.locationId === "cs_loc_002")
  }
]

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

// In-memory storage for created items (simulates database)
export const mockStorage = {
  patients: new Map<string, CareStackPatient>(),
  appointments: new Map<string, CareStackAppointment>(),
  idempotencyKeys: new Set<string>()
}

// Initialize storage with mock data
mockPatients.forEach(patient => {
  mockStorage.patients.set(patient.id, patient)
})

mockAppointments.forEach(appointment => {
  mockStorage.appointments.set(appointment.id, appointment)
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