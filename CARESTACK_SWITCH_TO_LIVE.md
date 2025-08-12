# CareStack Integration: Switch to Live Mode

## Overview

This document provides instructions on how to switch the CareStack integration from mock mode to live API calls using real credentials.

## Current Status: Mock Mode

The CareStack integration is currently running in mock mode, which means:
- All API calls return simulated data
- No actual requests are made to CareStack servers
- Artificial latency and occasional failures are simulated for testing

## Prerequisites

Before switching to live mode, ensure you have:

1. **CareStack Subscription**: An active CareStack account with API access
2. **API Credentials**: Valid CareStack API credentials (VendorKey, AccountKey, and AccountId)
3. **API Access**: Confirmed API access permissions from CareStack support

## CareStack Authentication

CareStack uses header-based authentication with three required credentials:

- **VendorKey**: Secret key for the vendor (your organization)
- **AccountKey**: Secret key for the specific account
- **AccountId**: Unique identifier for the account

These credentials must be passed in the HTTP headers for all API requests.

## Required Secrets

The following secrets need to be configured in your Supabase project:

- `CARESTACK_BASE_URL`: The CareStack API base URL (e.g., `https://api.carestack.com/v1`)
- `CARESTACK_VENDOR_KEY`: Your CareStack Vendor Key
- `CARESTACK_ACCOUNT_KEY`: Your CareStack Account Key
- `CARESTACK_ACCOUNT_ID`: Your CareStack Account ID
- `CARESTACK_USE_MOCK`: Set to `false` to enable live mode

## Switching to Live Mode

### 1. Configure Secrets

Add the required secrets in your Supabase project settings:

1. Go to your Supabase dashboard
2. Navigate to Settings > Edge Functions
3. Add each secret with the values provided by CareStack

### 2. Update Office Configuration

In the PMS Setup page:

1. Navigate to PMS Setup in your dashboard
2. Create or edit your CareStack office configuration
3. Enter your real CareStack credentials (VendorKey, AccountKey, AccountId)
4. Set `useMockMode: false` in the advanced settings

### 3. Verify Configuration

Test the connection to ensure everything is working:

1. Use the "Test Connection" button in PMS Setup
2. Verify that real locations are loaded (not mock data)
3. Test patient search functionality
4. Try booking a test appointment

## Expected Behavior Changes

### Mock Mode (Current)
- Returns simulated patient and appointment data
- Artificial latency (200-500ms)
- Random failure simulation (4% failure rate)
- Mock data banners displayed in UI
- All operations are reversible and safe

### Live Mode (After Switch)
- Real data from your CareStack database
- Actual API response times
- Real error handling and rate limiting
- No mock banners
- **LIVE DATA**: All changes are permanent

## Authentication Method

The integration uses CareStack's standard HTTP header authentication:

```
VendorKey: your_vendor_key
AccountKey: your_account_key  
AccountId: your_account_id
```

This method is more secure than OAuth2 for server-to-server communications and aligns with CareStack's API documentation.

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Verify your VendorKey, AccountKey, and AccountId
2. **Network Timeouts**: Check your CareStack API base URL
3. **Rate Limiting**: CareStack may have API rate limits
4. **Permissions**: Ensure your API credentials have the required permissions

### Support

For CareStack-specific API issues, contact CareStack support.
For integration issues, check the edge function logs in your Supabase dashboard.

## Important Notes

- **Test First**: Always test in a non-production environment
- **Backup**: Ensure you have backups before making changes
- **Monitor**: Monitor API usage and costs after switching to live mode
- **Rollback**: Keep mock mode available for testing and development