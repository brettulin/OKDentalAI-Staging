// Client-side encryption utilities for sensitive data using Web Crypto API
// Real AES-GCM encryption for production use

// Generate a key for AES-GCM encryption
const generateKey = async (): Promise<CryptoKey> => {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
};

// Convert key to/from base64 for storage
const exportKey = async (key: CryptoKey): Promise<string> => {
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

const importKey = async (keyString: string): Promise<CryptoKey> => {
  const keyBuffer = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
};

// Get or create a key for the current session
const getOrCreateKey = async (): Promise<string> => {
  let keyString = sessionStorage.getItem('encryption_key');
  if (!keyString) {
    const key = await generateKey();
    keyString = await exportKey(key);
    sessionStorage.setItem('encryption_key', keyString);
  }
  return keyString;
};

export const encryptData = async (data: string, keyString?: string): Promise<string> => {
  try {
    const keyToUse = keyString || await getOrCreateKey();
    const key = await importKey(keyToUse);
    
    // Generate a random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encodedData = new TextEncoder().encode(data);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Return as base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
};

export const decryptData = async (encryptedData: string, keyString?: string): Promise<string> => {
  try {
    const keyToUse = keyString || await getOrCreateKey();
    const key = await importKey(keyToUse);
    
    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
};

// Field-level encryption for sensitive patient data
export const encryptPatientField = async (data: string, fieldType: 'ssn' | 'dob' | 'phone' | 'email'): Promise<string> => {
  try {
    // Generate field-specific salt
    const salt = `patient_${fieldType}_${Date.now()}`;
    const combinedData = `${salt}:${data}`;
    
    return await encryptData(combinedData);
  } catch (error) {
    console.error(`Failed to encrypt ${fieldType}:`, error);
    throw new Error(`Failed to encrypt ${fieldType}`);
  }
};

export const decryptPatientField = async (encryptedData: string, fieldType: 'ssn' | 'dob' | 'phone' | 'email'): Promise<string> => {
  try {
    const decrypted = await decryptData(encryptedData);
    const [salt, data] = decrypted.split(':', 2);
    
    // Verify salt format
    if (!salt.startsWith(`patient_${fieldType}_`)) {
      throw new Error('Invalid encrypted data format');
    }
    
    return data || '';
  } catch (error) {
    console.error(`Failed to decrypt ${fieldType}:`, error);
    return '';
  }
};

// Secure data comparison without decryption
export const compareEncryptedField = async (plainText: string, encryptedData: string, fieldType: 'ssn' | 'dob' | 'phone' | 'email'): Promise<boolean> => {
  try {
    const decrypted = await decryptPatientField(encryptedData, fieldType);
    return decrypted === plainText;
  } catch (error) {
    console.error('Failed to compare encrypted field:', error);
    return false;
  }
};

// Mask sensitive data for display
export const maskSensitiveData = (data: string, visibleChars: number = 4): string => {
  if (!data || data.length <= visibleChars) return data;
  const visible = data.slice(-visibleChars);
  const masked = '*'.repeat(Math.max(0, data.length - visibleChars));
  return masked + visible;
};

// Validate input to prevent injection attacks
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>\"']/g, '') // Remove potential XSS characters
    .trim()
    .slice(0, 1000); // Limit length
};