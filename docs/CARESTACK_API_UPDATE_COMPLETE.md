# CareStack API Integration Update - Complete

## Overview
Successfully updated the CareStack integration to match the actual API documentation provided. This represents a major overhaul of the API structure, endpoints, and data models.

## Key Changes Made

### 1. API Structure Updates
- **Base URL**: Changed from `/v1` to `/api/v1.0/` pattern
- **Authentication**: Maintained header-based authentication (VendorKey, AccountKey, AccountId)
- **Endpoints**: Updated all endpoints to match actual API paths

### 2. Data Model Alignment
- **Patient Model**: Updated from `CareStackPatient` to `PatientViewModel`
  - Changed ID type from `string` to `number`
  - Updated phone fields: `phone` → `mobileNumber`, `homeNumber`, `workNumber`
  - Updated date field: `dob` → `dateOfBirth`

- **Location Model**: Updated to `LocationDetailModel`
  - Changed ID type from `string` to `number`
  - Simplified structure to match API response

- **Operatory Model**: Updated to `OperatoryDetail`
  - Changed ID types from `string` to `number`
  - Updated reference fields accordingly

- **Appointment Model**: Updated to `AppointmentDetailModel`
  - Changed all ID types from `string` to `number`
  - Updated time fields: `start`/`end` → `startTime`/`endTime`
  - Updated procedure field: `code` → `procedureCode`

### 3. Search Implementation Overhaul
- **Patient Search**: Changed from GET with query params to POST with `SearchRequest` body
- **Request Structure**: Now uses nested `searchCriteria` object
- **Response Format**: Updated to `PatientSearchResponseModel` structure
- **Pagination**: Updated field names (`pageNumber` vs `page`, `totalCount` vs `total`)

### 4. New API Endpoints Added
- **Appointment Status**: `GET /api/v1.0/appointment-status`
- **Get Appointment**: `GET /api/v1.0/appointments/{id}`
- **Delete Appointment**: `DELETE /api/v1.0/appointments/{id}`
- **Cancel Appointment**: `PUT /api/v1.0/appointments/{id}/cancel`
- **Procedure Codes**: `GET /api/v1.0/procedure-codes`

### 5. Updated Core Endpoints
- **Create Patient**: `POST /api/v1.0/patients`
- **Search Patients**: `POST /api/v1.0/patients/search` (body-based)
- **Get Patient**: `GET /api/v1.0/patients/{id}`
- **Create Appointment**: `POST /api/v1.0/appointments`
- **List Locations**: `GET /api/v1.0/locations`
- **List Operatories**: `GET /api/v1.0/operatories`

### 6. Backward Compatibility
- Maintained type aliases for existing code compatibility
- Conversion functions handle ID type changes (string ↔ number)
- Mock mode continues to work with updated data structures

## Integration Impact

### Edge Functions Updated
All CareStack edge functions will automatically use the updated adapter:
- `pms-carestack-search-patients`
- `pms-carestack-create-patient`
- `pms-carestack-create-appointment`
- `pms-carestack-list-locations`
- `pms-carestack-list-operatories`

### Frontend Integration
No changes required to frontend code - the PMS interface remains the same. All changes are encapsulated within the adapter layer.

### Authentication
- Continues using header-based authentication
- Headers: `VendorKey`, `AccountKey`, `AccountId`
- Mock mode unchanged for testing

## Next Steps

### When CareStack Credentials Are Available
1. Set the Supabase secrets:
   ```
   CARESTACK_VENDOR_KEY_LIVE=your_vendor_key
   CARESTACK_ACCOUNT_KEY_LIVE=your_account_key  
   CARESTACK_ACCOUNT_ID_LIVE=your_account_id
   CARESTACK_BASE_URL_LIVE=https://brightsmiles.carestack.com
   CARESTACK_USE_MOCK=false
   ```

2. Update office configuration to use live mode:
   ```typescript
   {
     pms_type: 'carestack',
     useMockMode: false,
     credentials: { /* encrypted credentials */ }
   }
   ```

### Verification Steps
1. Test patient search with live API
2. Verify appointment creation workflow
3. Validate location and operatory retrieval
4. Test new endpoints (appointment status, procedure codes)

### Missing Clarifications Needed
1. **Provider/Staff Endpoint**: API docs don't clearly show provider listing endpoint
   - Currently using `/api/v1.0/staff` as fallback
   - May need clarification from CareStack

2. **Availability Endpoint**: No clear endpoint for appointment availability
   - Current implementation needs API path confirmation

3. **Authentication Headers**: Confirm exact header format requirements

## Summary
The CareStack integration has been comprehensively updated to match the actual API specification. The adapter now supports the full range of documented endpoints with proper data models and request/response handling. Mock mode continues to work for development and testing.