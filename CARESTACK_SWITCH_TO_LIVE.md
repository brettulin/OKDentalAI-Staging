# CareStack Integration - Switch to Live Documentation

## Overview
The CareStack integration is currently running in **mock mode** with simulated data. This document explains how to switch to live API calls once you have real CareStack credentials.

## Current Status
✅ **Completed:**
- Full CareStack adapter with OAuth2 authentication
- All 5 edge functions (locations, operatories, search patients, create patient, create appointment)
- Mock data system with realistic schemas
- Database integration with external_id mapping
- UI components for testing and configuration
- Error handling and retry logic

## Switching to Live Mode

### 1. Prerequisites
- Active CareStack subscription
- API access enabled by CareStack support
- Client ID and Client Secret from CareStack

### 2. Required Secrets
Add these secrets in Supabase Edge Functions settings:

```bash
CARESTACK_BASE_URL=https://api.carestack.com/v1
CARESTACK_CLIENT_ID=your_client_id_here
CARESTACK_CLIENT_SECRET=your_client_secret_here
CARESTACK_USE_MOCK=false  # This disables mock mode
```

### 3. Update Office Configuration
In the PMS Setup page:
1. Edit your CareStack office configuration
2. Add your real Client ID and Client Secret
3. Set `useMockMode: false` in the credentials

### 4. Verification Steps
1. Test connection in PMS Settings → CareStack tab
2. Verify locations load from live API
3. Test patient search with real data
4. Confirm appointment booking works

## Mock vs Live Behavior

### Mock Mode (Current)
- Uses local simulated data
- 200-500ms artificial latency
- 4% simulated failure rate
- No network calls to CareStack
- Yellow "Mock Mode" banners displayed

### Live Mode (After Switch)
- Real OAuth2 authentication with CareStack
- Actual API calls to CareStack servers
- Real patient and appointment data
- Production error handling
- No mock mode banners

## Troubleshooting

### Common Issues
1. **Authentication Errors**: Verify Client ID/Secret are correct
2. **Rate Limiting**: CareStack has API rate limits
3. **Permissions**: Ensure API access is enabled for your account

### Support
- CareStack API Documentation: [CareStack Developer Portal]
- Contact CareStack support for API access issues

## Testing Checklist
- [ ] Connection test passes
- [ ] Patient search returns real data  
- [ ] Appointment booking creates real appointments
- [ ] Error handling works properly
- [ ] No mock mode banners visible

The integration is production-ready once these steps are completed!