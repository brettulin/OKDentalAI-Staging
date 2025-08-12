// CareStack HTTP client with retry logic and circuit breaker
import { getCareStackEnv, getCareStackHeaders, CareStackConfig } from './carestack-env.ts';

interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

// Circuit breaker storage - in production this would be external storage
const circuitBreakers = new Map<string, CircuitBreakerState>();

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 250,
  maxDelay: 4000
};

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30 seconds
  halfOpenMaxCalls: 3
};

export class CareStackClient {
  private config: CareStackConfig;
  private headers: Record<string, string>;
  
  constructor() {
    this.config = getCareStackEnv();
    this.headers = getCareStackHeaders(this.config);
    console.log(`CareStack client initialized in ${this.config.environment} mode`);
  }

  private getCircuitBreakerKey(endpoint: string): string {
    return `${this.config.baseUrl}${endpoint}`;
  }

  private getCircuitBreakerState(key: string): CircuitBreakerState {
    if (!circuitBreakers.has(key)) {
      circuitBreakers.set(key, {
        failures: 0,
        lastFailure: 0,
        state: 'closed'
      });
    }
    return circuitBreakers.get(key)!;
  }

  private updateCircuitBreaker(key: string, success: boolean): void {
    const state = this.getCircuitBreakerState(key);
    const now = Date.now();

    if (success) {
      state.failures = 0;
      state.state = 'closed';
    } else {
      state.failures++;
      state.lastFailure = now;
      
      if (state.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
        state.state = 'open';
        console.warn(`Circuit breaker opened for ${key} after ${state.failures} failures`);
      }
    }

    circuitBreakers.set(key, state);
  }

  private shouldAllowRequest(key: string): boolean {
    const state = this.getCircuitBreakerState(key);
    const now = Date.now();

    switch (state.state) {
      case 'closed':
        return true;
      
      case 'open':
        if (now - state.lastFailure > CIRCUIT_BREAKER_CONFIG.resetTimeout) {
          state.state = 'half-open';
          circuitBreakers.set(key, state);
          console.log(`Circuit breaker half-open for ${key}`);
          return true;
        }
        return false;
      
      case 'half-open':
        return true;
      
      default:
        return true;
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateDelay(attempt: number, options: RetryOptions): number {
    const delay = options.baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
    return Math.min(delay + jitter, options.maxDelay);
  }

  private shouldRetry(status: number, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries) return false;
    
    // Retry on 5xx server errors and 429 rate limit
    return status >= 500 || status === 429;
  }

  async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {},
    retryOptions: Partial<RetryOptions> = {},
    timeoutMs = 10000
  ): Promise<T> {
    const fullOptions = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
    const url = `${this.config.baseUrl}${endpoint}`;
    const circuitKey = this.getCircuitBreakerKey(endpoint);
    
    // Check circuit breaker
    if (!this.shouldAllowRequest(circuitKey)) {
      throw new Error(`Circuit breaker is open for ${endpoint}. Service may be unavailable.`);
    }

    // If in mock mode, delegate to mock responses
    if (this.config.useMock) {
      return this.handleMockRequest<T>(endpoint, options);
    }

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= fullOptions.maxRetries) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        console.log(`CareStack request attempt ${attempt + 1}: ${options.method || 'GET'} ${url}`);
        
        const response = await fetch(url, {
          ...options,
          headers: {
            ...this.headers,
            ...options.headers
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Log response for debugging
        console.log(`CareStack response: ${response.status} ${response.statusText}`);

        if (response.ok) {
          this.updateCircuitBreaker(circuitKey, true);
          const data = await response.json();
          return data;
        }

        // Handle error responses
        const errorData = await response.json().catch(() => ({ 
          error: 'Unknown error', 
          message: response.statusText,
          code: response.status 
        }));

        if (this.shouldRetry(response.status, attempt, fullOptions.maxRetries)) {
          const delay = this.calculateDelay(attempt, fullOptions);
          console.warn(`Request failed with ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${fullOptions.maxRetries + 1})`);
          
          await this.sleep(delay);
          attempt++;
          continue;
        }

        // Not retryable, update circuit breaker and throw
        this.updateCircuitBreaker(circuitKey, false);
        throw new Error(this.getErrorMessage(response.status, errorData));

      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on abort/timeout unless it's a network error
        if (error.name === 'AbortError') {
          this.updateCircuitBreaker(circuitKey, false);
          throw new Error('CareStack request timed out. Please try again.');
        }

        // Only retry network errors
        if (attempt < fullOptions.maxRetries && this.isNetworkError(error)) {
          const delay = this.calculateDelay(attempt, fullOptions);
          console.warn(`Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${fullOptions.maxRetries + 1}):`, error.message);
          
          await this.sleep(delay);
          attempt++;
          continue;
        }

        this.updateCircuitBreaker(circuitKey, false);
        throw error;
      }
    }

    this.updateCircuitBreaker(circuitKey, false);
    throw lastError || new Error('Max retries exceeded');
  }

  private isNetworkError(error: any): boolean {
    return error.name === 'TypeError' || 
           error.message.includes('network') ||
           error.message.includes('fetch');
  }

  private getErrorMessage(status: number, errorData: any): string {
    switch (status) {
      case 401:
        return 'Invalid CareStack credentials. Please verify Vendor, Account Key, and Account ID.';
      case 429:
        return 'CareStack rate limit hit. Please wait a moment and try again.';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'CareStack service is unavailable. Try again shortly.';
      default:
        return errorData?.message || `CareStack API error (${status})`;
    }
  }

  private async handleMockRequest<T>(endpoint: string, options: RequestInit): Promise<T> {
    // Import mock functions dynamically to avoid circular dependencies
    const { 
      getProviders, 
      getLocations, 
      searchPatients, 
      getAvailableSlots,
      createAppointment,
      getAppointments,
      addLatency,
      shouldSimulateError,
      MOCK_ERRORS
    } = await import('./carestack-mock.ts');

    // Add realistic latency
    await addLatency(50, 200);

    // Simulate occasional errors
    const errorCheck = shouldSimulateError(0.02);
    if (errorCheck.shouldError) {
      throw new Error(errorCheck.error.message);
    }

    console.log(`Mock CareStack request: ${options.method || 'GET'} ${endpoint}`);

    // Route to appropriate mock function based on endpoint
    if (endpoint.includes('/providers') || endpoint.includes('/staff')) {
      return getProviders() as T;
    }
    
    if (endpoint.includes('/locations') || endpoint.includes('/offices')) {
      return getLocations() as T;
    }
    
    if (endpoint.includes('/patients/search')) {
      const url = new URL(`http://mock.com${endpoint}`);
      const phone = url.searchParams.get('phone');
      const query = url.searchParams.get('q');
      return searchPatients(phone || undefined, query || undefined) as T;
    }
    
    if (endpoint.includes('/availability') || endpoint.includes('/slots')) {
      // Parse provider/location from endpoint or use defaults
      return getAvailableSlots('cs_prov_001', 'cs_loc_001', new Date().toISOString().split('T')[0]) as T;
    }
    
    if (endpoint.includes('/appointments') && options.method === 'POST') {
      const body = JSON.parse(options.body as string || '{}');
      return createAppointment(body) as T;
    }
    
    if (endpoint.includes('/appointments')) {
      return getAppointments() as T;
    }

    // Default ping/status response
    return {
      ok: true,
      system: 'carestack',
      environment: this.config.environment,
      timestamp: new Date().toISOString()
    } as T;
  }

  // Convenience methods for common operations
  async get<T>(endpoint: string, retryOptions?: Partial<RetryOptions>): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'GET' }, retryOptions);
  }

  async post<T>(endpoint: string, data: any, retryOptions?: Partial<RetryOptions>): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    }, retryOptions);
  }

  async put<T>(endpoint: string, data: any, retryOptions?: Partial<RetryOptions>): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT', 
      body: JSON.stringify(data)
    }, retryOptions);
  }

  async delete<T>(endpoint: string, retryOptions?: Partial<RetryOptions>): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' }, retryOptions);
  }

  // Get current configuration for debugging
  getConfig(): { environment: string; baseUrl: string; useMock: boolean } {
    return {
      environment: this.config.environment,
      baseUrl: this.config.useMock ? 'mock' : this.config.baseUrl,
      useMock: this.config.useMock
    };
  }

  // Get circuit breaker status for debugging
  getCircuitBreakerStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    circuitBreakers.forEach((state, key) => {
      status[key] = {
        state: state.state,
        failures: state.failures,
        lastFailure: state.lastFailure ? new Date(state.lastFailure).toISOString() : null
      };
    });
    return status;
  }
}