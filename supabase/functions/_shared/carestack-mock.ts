// CareStack mock responses that exactly match their API specification
import { 
  CareStackLocation, 
  CareStackOperatory, 
  CareStackProvider, 
  CareStackPatient,
  CareStackAppointment,
  CareStackSearchPatientsResponse 
} from './carestack-types.ts';

// Mock error responses matching CareStack API
export const MOCK_ERRORS = {
  401: {
    error: "Unauthorized",
    message: "Invalid CareStack credentials. Please verify Vendor, Account Key, and Account ID.",
    code: 401
  },
  429: {
    error: "Rate Limited", 
    message: "CareStack rate limit hit. Please wait a moment and try again.",
    code: 429
  },
  500: {
    error: "Internal Server Error",
    message: "CareStack service is unavailable. Try again shortly.", 
    code: 500
  }
};

// Mock providers matching CareStack API schema
export function getProviders(): CareStackProvider[] {
  return [
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
    },
    {
      id: "cs_prov_003",
      firstName: "Dr. Emily", 
      lastName: "Rodriguez",
      title: "DDS, PhD",
      specialty: "Endodontics",
      phone: "+1-555-0303",
      email: "dr.rodriguez@clinic.com", 
      locationIds: ["cs_loc_002"],
      isActive: true
    }
  ];
}

// Mock locations matching CareStack API schema
export function getLocations(): CareStackLocation[] {
  return [
    {
      id: "cs_loc_001",
      name: "Downtown Dental Center", 
      address: {
        street: "123 Main Street",
        city: "Denver",
        state: "CO",
        zipCode: "80202",
        country: "USA"
      },
      phone: "+1-555-0100",
      timezone: "America/Denver",
      isActive: true,
      operatories: [
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
        }
      ]
    },
    {
      id: "cs_loc_002",
      name: "Boulder Family Dentistry",
      address: {
        street: "456 Oak Avenue",
        city: "Boulder", 
        state: "CO",
        zipCode: "80301",
        country: "USA"
      },
      phone: "+1-555-0200",
      timezone: "America/Denver",
      isActive: true,
      operatories: [
        {
          id: "cs_op_003",
          name: "Hygiene Bay 1",
          locationId: "cs_loc_002",
          isActive: true, 
          equipmentList: ["Digital X-Ray", "Ultrasonic Scaler", "Fluoride System"]
        }
      ]
    }
  ];
}

// Mock patient search matching CareStack API schema
export function searchPatients(phone?: string, query?: string): CareStackSearchPatientsResponse {
  const allPatients: CareStackPatient[] = [
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
      address: {
        street: "123 Main Street",
        city: "Denver", 
        state: "CO",
        zipCode: "80202",
        country: "USA"
      },
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
      address: {
        street: "456 Oak Avenue",
        city: "Boulder",
        state: "CO", 
        zipCode: "80301",
        country: "USA"
      },
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
  ];

  let filtered = allPatients;
  
  if (phone) {
    filtered = filtered.filter(p => p.phone?.includes(phone.replace(/\D/g, '')));
  }
  
  if (query) {
    const searchLower = query.toLowerCase();
    filtered = filtered.filter(p => 
      p.firstName.toLowerCase().includes(searchLower) ||
      p.lastName.toLowerCase().includes(searchLower) ||
      p.email?.toLowerCase().includes(searchLower)
    );
  }

  return {
    items: filtered,
    total: filtered.length,
    page: 1,
    pageSize: 50,
    totalPages: 1
  };
}

// Mock available slots matching CareStack API schema
export function getAvailableSlots(providerId: string, locationId: string, date: string) {
  const baseDate = new Date(date);
  const slots = [];
  
  // Generate slots from 9 AM to 5 PM
  for (let hour = 9; hour < 17; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const startTime = new Date(baseDate);
      startTime.setHours(hour, minute, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30);
      
      slots.push({
        id: `slot_${providerId}_${hour}_${minute}`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        providerId,
        locationId,
        available: Math.random() > 0.3 // 70% availability
      });
    }
  }
  
  return slots;
}

// Mock appointment creation matching CareStack API schema
export function createAppointment(appointmentData: any): CareStackAppointment {
  const now = new Date().toISOString();
  
  return {
    id: `cs_appt_${Date.now()}`,
    patientId: appointmentData.patientId,
    providerId: appointmentData.providerId,
    locationId: appointmentData.locationId,
    operatoryId: appointmentData.operatoryId || null,
    start: appointmentData.start,
    end: appointmentData.end,
    status: 'scheduled',
    code: appointmentData.code || 'D0150',
    description: appointmentData.description || 'General Appointment',
    notes: appointmentData.notes || '',
    duration: 30,
    isNewPatient: appointmentData.isNewPatient || false,
    createdAt: now,
    updatedAt: now
  };
}

// Mock appointment retrieval 
export function getAppointments(locationId?: string, providerId?: string, date?: string): CareStackAppointment[] {
  return [
    {
      id: "cs_appt_001",
      patientId: "cs_pat_001",
      providerId: "cs_prov_001",
      locationId: "cs_loc_001",
      operatoryId: "cs_op_001",
      start: "2025-08-12T09:00:00Z",
      end: "2025-08-12T10:00:00Z",
      status: "scheduled",
      code: "D0150",
      description: "Comprehensive Oral Examination",
      notes: "New patient exam with X-rays",
      duration: 60,
      isNewPatient: true,
      createdAt: "2024-12-15T10:00:00Z",
      updatedAt: "2024-12-15T10:00:00Z"
    }
  ];
}

// Add artificial latency to simulate network delays
export async function addLatency(min = 100, max = 300): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Simulate random failures for testing error handling
export function shouldSimulateError(errorRate = 0.02): { shouldError: boolean; error?: any } {
  if (Math.random() < errorRate) {
    const errors = [
      MOCK_ERRORS[429],
      MOCK_ERRORS[500]
    ];
    return { 
      shouldError: true, 
      error: errors[Math.floor(Math.random() * errors.length)]
    };
  }
  return { shouldError: false };
}