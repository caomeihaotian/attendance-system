import crypto from 'crypto';

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Calculate expiry time for verification codes (default 5 minutes)
 */
export function calculateExpiry(minutes: number = 5): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Generate a secure random token for temporary password reset access
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a secure token with specified byte length
 */
export function generateSecureToken(byteLength: number = 16): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Hash a verification code for storage (optional, for extra security)
 */
export function hashVerificationCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Verify if a code matches the hash
 */
export function verifyCodeHash(code: string, hash: string): boolean {
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  return codeHash === hash;
}

/**
 * Check if a verification code has expired
 */
export function isCodeExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Format phone number to standard format (China)
 * Removes spaces, dashes, and ensures it starts with +
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('86') && cleaned.length === 13) {
    return '+' + cleaned;
  } else if (cleaned.startsWith('1') && cleaned.length === 11) {
    return '+86' + cleaned;
  }
  return cleaned;
}

/**
 * Validate Chinese phone number format
 */
export function isValidChinesePhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-+]/g, '');
  return /^1[3-9]\d{9}$/.test(cleaned);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
