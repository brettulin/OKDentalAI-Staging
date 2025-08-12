// Client-side encryption utilities for sensitive data
// Note: For production, consider using server-side encryption with proper key management

export const encryptData = async (data: string, key?: string): Promise<string> => {
  // For demo purposes - in production, use proper encryption
  // This should be replaced with actual encryption using Web Crypto API
  // or server-side encryption in edge functions
  return btoa(data);
};

export const decryptData = async (encryptedData: string, key?: string): Promise<string> => {
  // For demo purposes - in production, use proper decryption
  try {
    return atob(encryptedData);
  } catch (error) {
    console.error('Failed to decrypt data:', error);
    return '';
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