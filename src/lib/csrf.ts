/**
 * Get CSRF token from cookies
 * NextAuth.js stores CSRF tokens in cookies with the format 'csrf-token=value'
 */
export function getCsrfTokenFromCookies(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf-token' || name === '_csrf') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Make an authenticated fetch request with CSRF token
 * This helper automatically adds the CSRF token to the request
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get CSRF token from cookies
  const csrfToken = getCsrfTokenFromCookies();

  const headers = {
    'Content-Type': 'application/json',
    ...(csrfToken && { 'x-csrf-token': csrfToken }),
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers
  });
}

/**
 * Get CSRF token by calling the NextAuth API endpoint
 * This is useful if you need to get a fresh token
 */
export async function getCsrfToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/csrf', {
      cache: 'no-store',
      credentials: 'include'
    });

    if (!response.ok) {
      console.error('Failed to get CSRF token');
      return null;
    }

    const data = await response.json();
    return data.csrfToken || null;
  } catch (error) {
    console.error('Error getting CSRF token:', error);
    return null;
  }
}