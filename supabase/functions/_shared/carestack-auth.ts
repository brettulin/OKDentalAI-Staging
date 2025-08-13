// Enhanced CareStack Authentication Configuration
export interface CareStackAuthConfig {
  vendorKey: string;
  accountKey: string;
  accountId: string;
  baseUrl: string;
  useMock: boolean;
  environment: 'sandbox' | 'live' | 'mock';
  // Enhanced authentication options
  authMethod: 'header' | 'oauth2' | 'api_key';
  timeout: number;
  maxRetries: number;
  rateLimitPerSecond: number;
}

export interface CareStackAuthHeaders {
  'Content-Type': string;
  'VendorKey'?: string;
  'AccountKey'?: string;
  'AccountId'?: string;
  'Authorization'?: string;
  'X-API-Key'?: string;
  'User-Agent': string;
  'Accept': string;
}

export function getCareStackEnhancedConfig(): CareStackAuthConfig {
  const useMock = Deno.env.get("CARESTACK_USE_MOCK") !== "false";
  const useSandbox = Deno.env.get("CARESTACK_USE_SANDBOX") === "true";
  
  if (useMock) {
    return {
      vendorKey: "mock_vendor_key",
      accountKey: "mock_account_key", 
      accountId: "mock_account_id",
      baseUrl: "https://mock.carestack.com",
      useMock: true,
      environment: 'mock',
      authMethod: 'header',
      timeout: 30000,
      maxRetries: 3,
      rateLimitPerSecond: 10
    };
  }

  const environment = useSandbox ? 'sandbox' : 'live';
  const suffix = useSandbox ? '_SANDBOX' : '_LIVE';
  
  const vendorKey = Deno.env.get(`CARESTACK_VENDOR_KEY${suffix}`);
  const accountKey = Deno.env.get(`CARESTACK_ACCOUNT_KEY${suffix}`);
  const accountId = Deno.env.get(`CARESTACK_ACCOUNT_ID${suffix}`);
  const authMethod = (Deno.env.get(`CARESTACK_AUTH_METHOD${suffix}`) || 'header') as 'header' | 'oauth2' | 'api_key';
  
  // Support both formats based on CareStack docs uncertainty
  const baseUrl = Deno.env.get(`CARESTACK_BASE_URL${suffix}`) || 
    (useSandbox ? "https://sandbox-api.carestack.com" : "https://brightsmiles.carestack.com");

  if (!vendorKey || !accountKey || !accountId) {
    console.warn(`Missing CareStack ${environment} credentials, falling back to mock mode`);
    return {
      vendorKey: "mock_vendor_key",
      accountKey: "mock_account_key",
      accountId: "mock_account_id", 
      baseUrl: "https://mock.carestack.com",
      useMock: true,
      environment: 'mock',
      authMethod: 'header',
      timeout: 30000,
      maxRetries: 3,
      rateLimitPerSecond: 10
    };
  }

  return {
    vendorKey,
    accountKey,
    accountId,
    baseUrl,
    useMock: false,
    environment,
    authMethod,
    timeout: parseInt(Deno.env.get(`CARESTACK_TIMEOUT${suffix}`) || '30000'),
    maxRetries: parseInt(Deno.env.get(`CARESTACK_MAX_RETRIES${suffix}`) || '3'),
    rateLimitPerSecond: parseInt(Deno.env.get(`CARESTACK_RATE_LIMIT${suffix}`) || '10')
  };
}

export function getCareStackEnhancedHeaders(config: CareStackAuthConfig, accessToken?: string): CareStackAuthHeaders {
  const baseHeaders: CareStackAuthHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': `CareStack-Integration/2.0 (Lovable)`,
    'Accept': 'application/json'
  };

  switch (config.authMethod) {
    case 'header':
      // Standard header-based authentication (current implementation)
      return {
        ...baseHeaders,
        'VendorKey': config.vendorKey,
        'AccountKey': config.accountKey,
        'AccountId': config.accountId
      };

    case 'oauth2':
      // OAuth2 Bearer token authentication
      if (!accessToken) {
        throw new Error('OAuth2 access token required but not provided');
      }
      return {
        ...baseHeaders,
        'Authorization': `Bearer ${accessToken}`,
        'X-Account-Id': config.accountId
      };

    case 'api_key':
      // API Key based authentication
      return {
        ...baseHeaders,
        'X-API-Key': config.vendorKey,
        'X-Account-Key': config.accountKey,
        'X-Account-Id': config.accountId
      };

    default:
      throw new Error(`Unsupported authentication method: ${config.authMethod}`);
  }
}

// Authentication validation utility
export async function validateCareStackAuthentication(config: CareStackAuthConfig): Promise<{
  isValid: boolean;
  method: string;
  details: any;
  suggestions?: string[];
}> {
  if (config.useMock) {
    return {
      isValid: true,
      method: 'mock',
      details: { message: 'Mock authentication always valid' }
    };
  }

  const suggestions: string[] = [];
  
  // Validate credentials format
  if (!config.vendorKey || config.vendorKey.length < 8) {
    suggestions.push('VendorKey should be at least 8 characters long');
  }
  
  if (!config.accountKey || config.accountKey.length < 8) {
    suggestions.push('AccountKey should be at least 8 characters long');
  }
  
  if (!config.accountId || !/^[a-zA-Z0-9_-]+$/.test(config.accountId)) {
    suggestions.push('AccountId should contain only alphanumeric characters, underscores, and hyphens');
  }

  // Test basic connectivity
  try {
    const headers = getCareStackEnhancedHeaders(config);
    const response = await fetch(`${config.baseUrl}/api/v1.0/appointment-status`, {
      method: 'GET',
      headers: headers as any,
      signal: AbortSignal.timeout(config.timeout)
    });

    if (response.status === 401) {
      return {
        isValid: false,
        method: config.authMethod,
        details: { 
          status: 401, 
          message: 'Authentication failed - credentials may be invalid' 
        },
        suggestions: [
          ...suggestions,
          'Verify VendorKey, AccountKey, and AccountId are correct',
          'Check if credentials are for the correct environment (sandbox vs live)',
          'Ensure account has API access enabled'
        ]
      };
    }

    if (response.status === 403) {
      return {
        isValid: false,
        method: config.authMethod,
        details: { 
          status: 403, 
          message: 'Access forbidden - account may not have API permissions' 
        },
        suggestions: [
          ...suggestions,
          'Contact CareStack support to enable API access',
          'Verify account subscription includes API features'
        ]
      };
    }

    if (response.ok) {
      return {
        isValid: true,
        method: config.authMethod,
        details: { 
          status: 200, 
          message: 'Authentication successful',
          baseUrl: config.baseUrl
        }
      };
    }

    return {
      isValid: false,
      method: config.authMethod,
      details: { 
        status: response.status, 
        message: `Unexpected response: ${response.statusText}` 
      },
      suggestions: [
        ...suggestions,
        'Check CareStack API status',
        'Verify base URL is correct for your instance'
      ]
    };

  } catch (error) {
    return {
      isValid: false,
      method: config.authMethod,
      details: { 
        error: (error as Error).message,
        type: 'network_error'
      },
      suggestions: [
        ...suggestions,
        'Check network connectivity',
        'Verify base URL is accessible',
        'Check if CareStack API is experiencing issues'
      ]
    };
  }
}

// Backward compatibility
export const getCareStackEnv = getCareStackEnhancedConfig;
export const getCareStackHeaders = (config: any) => getCareStackEnhancedHeaders(config);