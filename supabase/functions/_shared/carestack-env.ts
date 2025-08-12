// CareStack environment configuration helper
export interface CareStackConfig {
  vendorKey: string;
  accountKey: string;
  accountId: string;
  baseUrl: string;
  useMock: boolean;
  environment: 'sandbox' | 'live' | 'mock';
}

export function getCareStackEnv(): CareStackConfig {
  const useMock = Deno.env.get("CARESTACK_USE_MOCK") !== "false";
  const useSandbox = Deno.env.get("CARESTACK_USE_SANDBOX") === "true";
  
  if (useMock) {
    return {
      vendorKey: "mock_vendor_key",
      accountKey: "mock_account_key", 
      accountId: "mock_account_id",
      baseUrl: "https://mock.carestack.com",
      useMock: true,
      environment: 'mock'
    };
  }

  const environment = useSandbox ? 'sandbox' : 'live';
  const suffix = useSandbox ? '_SANDBOX' : '_LIVE';
  
  const vendorKey = Deno.env.get(`CARESTACK_VENDOR_KEY${suffix}`);
  const accountKey = Deno.env.get(`CARESTACK_ACCOUNT_KEY${suffix}`);
  const accountId = Deno.env.get(`CARESTACK_ACCOUNT_ID${suffix}`);
  const baseUrl = Deno.env.get(`CARESTACK_BASE_URL${suffix}`) || 
    (useSandbox ? "https://sandbox-api.carestack.com" : "https://api.carestack.com");

  if (!vendorKey || !accountKey || !accountId) {
    console.warn(`Missing CareStack ${environment} credentials, falling back to mock mode`);
    return {
      vendorKey: "mock_vendor_key",
      accountKey: "mock_account_key",
      accountId: "mock_account_id", 
      baseUrl: "https://mock.carestack.com",
      useMock: true,
      environment: 'mock'
    };
  }

  return {
    vendorKey,
    accountKey,
    accountId,
    baseUrl,
    useMock: false,
    environment
  };
}

export function getCareStackHeaders(config: CareStackConfig): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'VendorKey': config.vendorKey,
    'AccountKey': config.accountKey,
    'AccountId': config.accountId
  };
}