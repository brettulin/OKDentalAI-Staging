# Test Script for Dental Clinic Management System

## A. Environment Setup

Set these environment variables:

**Frontend (.env or environment):**
```
VITE_TEST_MODE=true
```

**Backend (Supabase Edge Functions):**
```
TEST_MODE=true
```

## B. Manual Verification Steps

### Step 1: Login and Clinic Setup
1. Go to the application URL
2. Click "Sign In" and enter your email
3. Check email for magic link and click it
4. **Expected:** Redirected to clinic setup page
5. Fill out clinic form: Name="Test Clinic", Phone="555-123-4567", Timezone="Eastern Time"
6. Click "Create Clinic"
7. **Expected:** Success toast "Clinic created successfully!"
8. **Expected:** Page shows clinic name and "Setup Progress" with "✓ Clinic Created" and "→ Next: PMS Integration"

### Step 2: Seed Demo Data
1. Click "Test Data" tab
2. **Expected:** See "Test Mode Active" badge
3. Click "Seed Demo Data" button
4. **Expected:** Success toast showing counts inserted (e.g., "Inserted: 2 providers, 2 locations, 4 insurances, 3 services, 12 slots, 3 patients")
5. **Expected:** "Current Data" card shows updated counts

### Step 3: PMS Integration (Test Mode)
1. Click "PMS" tab
2. Fill out form: Office Name="Test Office", PMS Type="Demo/Testing"
3. Click "Create Integration"
4. **Expected:** Success toast "PMS integration created successfully!"
5. Click "Test" button on the created integration
6. **Expected:** Green checkmark with test results showing passed tests

### Step 4: QA Checks
1. Click "QA" tab
2. Click "Run All Checks" button
3. **Expected:** All checks show green ✅ status:
   - Authentication: Pass
   - Row Level Security: Pass  
   - Setup State: Pass
   - PMS Integration: Pass
   - AI Call Simulation: Pass
   - Appointment Booking: Pass
   - Audit Log: Pass

### Step 5: AI Call Simulation
1. Click "AI Assistant" tab
2. Click "Call Simulator" sub-tab
3. Click "Start Simulation" or similar button (if available)
4. **Expected:** New call record created
5. **Expected:** Call shows in "Call Analytics" with turns and outcome

### Step 6: Debug Panel Verification
1. Look for yellow "Debug" button in top-right corner
2. Click it to open debug panel
3. **Expected:** Shows:
   - Test Mode: ON
   - Auth Status: Logged In
   - User ID: (truncated)
   - Clinic ID: (truncated)
   - Role: owner

## C. Database Verification Queries

Run these SQL queries in Supabase SQL Editor to verify data:

### Check Clinic Creation:
```sql
SELECT id, name, main_phone, timezone, created_at 
FROM public.clinics 
ORDER BY created_at DESC 
LIMIT 1;
```

### Check Profile Linking:
```sql
SELECT p.user_id, p.clinic_id, p.role, p.display_name,
       c.name as clinic_name
FROM public.profiles p
LEFT JOIN public.clinics c ON p.clinic_id = c.id
ORDER BY p.created_at DESC
LIMIT 1;
```

### Check Demo Data Seeding:
```sql
-- Providers
SELECT id, name, specialty, clinic_id FROM public.providers ORDER BY created_at DESC LIMIT 5;

-- Locations  
SELECT id, name, address, phone, timezone, clinic_id FROM public.locations ORDER BY created_at DESC LIMIT 5;

-- Services
SELECT id, name, code, duration_min, is_new_patient, clinic_id FROM public.services ORDER BY created_at DESC LIMIT 5;

-- Patients
SELECT id, full_name, phone, email, notes, clinic_id FROM public.patients ORDER BY created_at DESC LIMIT 5;

-- Slots
SELECT id, starts_at, ends_at, status, provider_id, location_id, clinic_id 
FROM public.slots 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check PMS Integration:
```sql
SELECT id, name, pms_type, clinic_id, created_at 
FROM public.offices 
ORDER BY created_at DESC 
LIMIT 1;
```

### Check AI Call Simulation:
```sql
-- Calls
SELECT id, clinic_id, outcome, started_at, ended_at, transcript_json
FROM public.calls
ORDER BY started_at DESC
LIMIT 5;

-- Turns
SELECT c.id as call_id, t.role, t.text, t.at
FROM public.calls c
JOIN public.turns t ON c.id = t.call_id
ORDER BY c.started_at DESC, t.at ASC
LIMIT 10;
```

### Check Appointments:
```sql
SELECT a.id, a.starts_at, a.ends_at, a.source,
       p.full_name as patient_name,
       pr.name as provider_name,
       s.name as service_name
FROM public.appointments a
LEFT JOIN public.patients p ON a.patient_id = p.id
LEFT JOIN public.providers pr ON a.provider_id = pr.id  
LEFT JOIN public.services s ON a.service_id = s.id
ORDER BY a.created_at DESC
LIMIT 5;
```

### Check Audit Log:
```sql
SELECT action, actor, entity, entity_id, at, diff_json
FROM public.audit_log
ORDER BY at DESC
LIMIT 10;
```

## D. Expected Database Effects Summary

After completing all steps, you should see:

- **1 Clinic** with your test data
- **1 Profile** linked to clinic with role="owner"  
- **2 Providers** (Dr. Sarah Johnson, Dr. Michael Chen)
- **2 Locations** (Main Office, Satellite Office)
- **4 Insurances** (2 accepted, 2 not accepted)
- **3 Services** (Cleaning, Exam, Filling)
- **3 Patients** with demo data
- **12+ Slots** for next 7 days
- **1 Office** with PMS type="dummy"
- **1+ Calls** from AI simulation
- **3+ Turns** in the call conversation
- **1+ Appointments** from QA booking test
- **10+ Audit Log** entries tracking all actions

## E. How to Reset/Cleanup

### Option 1: Reset Demo Data Button
1. Go to "Test Data" tab
2. Click "Reset Demo Data" button
3. **Expected:** Success toast with deletion counts

### Option 2: Manual SQL Cleanup
```sql
-- Get your clinic ID first
SELECT id, name FROM public.clinics WHERE name = 'Test Clinic';

-- Replace YOUR_CLINIC_ID with actual ID, then run:
DELETE FROM public.slots WHERE clinic_id = 'YOUR_CLINIC_ID';
DELETE FROM public.appointments WHERE clinic_id = 'YOUR_CLINIC_ID';
DELETE FROM public.turns WHERE call_id IN (SELECT id FROM public.calls WHERE clinic_id = 'YOUR_CLINIC_ID');
DELETE FROM public.calls WHERE clinic_id = 'YOUR_CLINIC_ID';
DELETE FROM public.patients WHERE clinic_id = 'YOUR_CLINIC_ID';
DELETE FROM public.services WHERE clinic_id = 'YOUR_CLINIC_ID';
DELETE FROM public.insurances WHERE clinic_id = 'YOUR_CLINIC_ID';
DELETE FROM public.offices WHERE clinic_id = 'YOUR_CLINIC_ID';
DELETE FROM public.locations WHERE clinic_id = 'YOUR_CLINIC_ID';
DELETE FROM public.providers WHERE clinic_id = 'YOUR_CLINIC_ID';
DELETE FROM public.audit_log WHERE clinic_id = 'YOUR_CLINIC_ID';
DELETE FROM public.profiles WHERE clinic_id = 'YOUR_CLINIC_ID';
DELETE FROM public.clinics WHERE id = 'YOUR_CLINIC_ID';
```

## F. Troubleshooting

### If QA Checks Fail:

**Authentication Fail:** Check that you're logged in and have a profile with clinic_id
**RLS Fail:** Check Supabase RLS policies are enabled and configured correctly
**Setup State Fail:** Run "Seed Demo Data" first
**PMS Fail:** Ensure TEST_MODE=true is set in edge functions environment
**AI Call Fail:** Check edge function logs in Supabase dashboard
**Scheduling Fail:** Ensure you have providers, locations, services, and patients

### If Environment Issues:
- Verify VITE_TEST_MODE=true is set (check debug panel)
- Verify TEST_MODE=true in Supabase edge functions environment
- Check browser console for errors
- Check Supabase edge function logs

### If Data Issues:
- Use SQL queries above to verify each step
- Check audit log for error entries
- Use "Reset Demo Data" and try again