// CareStack API Types based on API documentation

export interface CareStackCredentials {
  vendorKey: string
  accountKey: string
  accountId: string
  baseUrl?: string
  useMockMode?: boolean
}

// CareStack API Models (matching actual API structure)
export interface PatientViewModel {
  id: number
  firstName: string
  lastName: string
  dateOfBirth?: string
  mobileNumber?: string
  homeNumber?: string
  workNumber?: string
  email?: string
  address?: CareStackAddress
  gender?: string
  ssn?: string
  emergencyContact?: CareStackEmergencyContact
  createdAt?: string
  updatedAt?: string
  insuranceCarrier?: string
  memberId?: string
  notes?: string
}

// Keep backward compatibility alias
export interface CareStackPatient extends PatientViewModel {}

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

export interface LocationDetailModel {
  id: number
  name: string
  address: CareStackAddress
  phone?: string
  timezone?: string
  isActive: boolean
}

// Keep backward compatibility alias
export interface CareStackLocation extends LocationDetailModel {
  operatories?: CareStackOperatory[]
}

export interface OperatoryDetail {
  id: number
  name: string
  locationId: number
  isActive: boolean
  equipmentList?: string[]
}

// Keep backward compatibility alias  
export interface CareStackOperatory extends OperatoryDetail {}

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

export interface AppointmentDetailModel {
  id: number
  patientId: number
  providerId: number
  locationId: number
  operatoryId?: number
  startTime: string
  endTime: string
  status: 'scheduled' | 'confirmed' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  procedureCode?: string
  description?: string
  notes?: string
  duration?: number
  isNewPatient?: boolean
  createdAt?: string
  updatedAt?: string
}

// Keep backward compatibility alias
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

// Patient Search (POST body structure)
export interface SearchRequest {
  searchCriteria: {
    firstName?: string
    lastName?: string
    phone?: string
    email?: string
    dateOfBirth?: string
  }
  pageNumber?: number
  pageSize?: number
}

export interface PatientSearchResponseModel {
  patients: PatientViewModel[]
  totalCount: number
  pageNumber: number
  pageSize: number
  totalPages: number
}

// Keep backward compatibility
export interface CareStackSearchPatientsRequest {
  q?: string
  phone?: string
  email?: string
  dob?: string
  page?: number
  pageSize?: number
}

export interface CareStackSearchPatientsResponse {
  items: PatientViewModel[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CareStackCreatePatientRequest {
  firstName: string
  lastName: string
  dateOfBirth?: string
  mobileNumber?: string
  homeNumber?: string
  workNumber?: string
  email?: string
  insuranceCarrier?: string
  memberId?: string
  notes?: string
  address?: CareStackAddress
  gender?: string
  emergencyContact?: CareStackEmergencyContact
}

export interface CareStackCreateAppointmentRequest {
  patientId: number
  providerId: number
  locationId: number
  operatoryId?: number
  startTime: string
  endTime: string
  procedureCode?: string
  description?: string
  notes?: string
  isNewPatient?: boolean
}

export interface CareStackListLocationsResponse {
  locations: LocationDetailModel[]
}

export interface CareStackListOperatoriesResponse {
  operatories: OperatoryDetail[]
}

// New API response models
export interface AppointmentStatusExternalModel {
  id: number
  name: string
  isActive: boolean
}

export interface ProcedureCodeBasicApiResponseModel {
  id: number
  code: string
  description: string
  category?: string
  fee?: number
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
  locations: Map<string, CareStackCacheItem<LocationDetailModel[]>>
  operatories: Map<string, CareStackCacheItem<OperatoryDetail[]>>
  providers: Map<string, CareStackCacheItem<CareStackProvider[]>>
}