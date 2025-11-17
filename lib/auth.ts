import crypto from 'crypto';

/**
 * Generate a simple auth token
 */
export function generateAuthToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify if the provided access code matches the environment variable
 */
export function verifyAccessCode(accessCode: string): boolean {
  const validAccessCode = process.env.ACCESS_CODE;

  if (!validAccessCode) {
    console.error('ACCESS_CODE environment variable is not set');
    return false;
  }

  return accessCode === validAccessCode;
}

/**
 * Simple token validation (checks if token exists and is valid format)
 * In a real app, you'd store tokens in a database or session store
 */
export function validateAuthToken(token: string | null): boolean {
  if (!token) return false;
  // Simple validation: check if it's a 64-character hex string
  return /^[a-f0-9]{64}$/.test(token);
}

/**
 * Client-side: Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('authToken');
  return validateAuthToken(token);
}

/**
 * Client-side: Get auth token from localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken');
}

/**
 * Client-side: Clear auth token (logout)
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('authToken');
}
