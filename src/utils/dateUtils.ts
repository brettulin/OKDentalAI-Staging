import { startOfDay, endOfDay } from 'date-fns';

/**
 * Get UTC date range for a given date in clinic timezone
 * This ensures consistent date queries across timezones
 */
export function dayUtcRange(clinicTz: string, dateISO: string) {
  const date = new Date(dateISO);
  const startOfDayLocal = startOfDay(date);
  const endOfDayLocal = endOfDay(date);
  
  return {
    start: startOfDayLocal.toISOString(),
    end: endOfDayLocal.toISOString()
  };
}

/**
 * Format phone number for consistent search
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // If it starts with 1, remove it (US country code)
  const cleaned = digits.startsWith('1') && digits.length === 11 
    ? digits.slice(1) 
    : digits;
  
  // Format as (XXX) XXX-XXXX
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone; // Return original if can't format
}