// CareStack API Types based on Swagger specification

export interface CareStackAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

export interface CareStackPatient {
  id: string
  firstName: string
  lastName: string
  dob: string | null
  phone: string | null
  email: string | null
  insuranceCarrier: string | null
  memberId: string | null
  notes: string | null
  address?: CareStackAddress
  gender?: string
  ssn?: string
  emergencyContact?: CareStackEmergencyContact
  createdAt: string
  updatedAt: string
}

export interface CareStackAddress {
  street: string
  city: string
  state: string
  zipCode: string
  country?: string
}

export interface CareStackEmergencyContact {
  name: string
  phone: string
  relationship: string
}

export interface CareStackLocation {
  id: string
  name: string
  address: CareStackAddress
  phone: string | null
  timezone: string
  isActive: boolean
  operatories: CareStackOperatory[]
}

export interface CareStackOperatory {
  id: string
  name: string
  locationId: string
  isActive: boolean
  equipmentList?: string[]
}

export interface CareStackProvider {
  id: string
  firstName: string
  lastName: string
  title: string | null
  specialty: string | null
  phone: string | null
  email: string | null
  locationIds: string[]
  isActive: boolean
}

export interface CareStackAppointment {
  id: string
  patientId: string
  providerId: string
  locationId: string
  operatoryId: string | null
  start: string
  end: string
  status: 'scheduled' | 'confirmed' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  code: string | null
  description: string | null
  notes: string | null
  duration: number
  isNewPatient: boolean
  createdAt: string
  updatedAt: string
}

export interface CareStackSearchPatientsRequest {
  q?: string
  phone?: string
  email?: string
  dob?: string
  page?: number
  pageSize?: number
}

export interface CareStackSearchPatientsResponse {
  items: CareStackPatient[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CareStackCreatePatientRequest {
  firstName: string
  lastName: string
  dob?: string
  phone?: string
  email?: string
  insuranceCarrier?: string
  memberId?: string
  notes?: string
  address?: CareStackAddress
  gender?: string
  emergencyContact?: CareStackEmergencyContact
}

export interface CareStackCreateAppointmentRequest {
  patientId: string
  providerId: string
  locationId: string
  operatoryId?: string
  start: string
  end: string
  code?: string
  description?: string
  notes?: string
  isNewPatient?: boolean
  idempotencyKey?: string
}

export interface CareStackListLocationsResponse {
  locations: CareStackLocation[]
}

export interface CareStackListOperatoriesRequest {
  locationId: string
}

export interface CareStackListOperatoriesResponse {
  operatories: CareStackOperatory[]
}

export interface CareStackErrorResponse {
  error: string
  message: string
  code: number
  details?: any
}

// Request/Response wrappers
export interface CareStackApiResponse<T> {
  success: boolean
  data?: T
  error?: CareStackErrorResponse
}

// Cache interfaces
export interface CareStackCacheItem<T> {
  data: T
  expiry: number
}

export interface CareStackCache {
  locations: Map<string, CareStackCacheItem<CareStackLocation[]>>
  operatories: Map<string, CareStackCacheItem<CareStackOperatory[]>>
  providers: Map<string, CareStackCacheItem<CareStackProvider[]>>
}