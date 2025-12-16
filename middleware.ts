import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to login page and API routes without authentication
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/agent-hub/execute') || // Internal proxy for Agent Hub
    pathname.startsWith('/api/story/generate') || // Story generation API (for testing)
    pathname.startsWith('/api/assets/analyze') || // Asset analysis via AI (internal)
    pathname.startsWith('/api/edit-image-stream') || // Image editing stream API (internal)
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next();
  }

  // Check for auth token in cookie (used for both pages and API routes)
  const authCookie = request.cookies.get('authToken')?.value;

  // For API routes, check cookie or authorization header
  if (pathname.startsWith('/api')) {
    const authHeader = request.headers.get('authorization');
    const authToken = authHeader?.replace('Bearer ', '');

    // Allow if either cookie or header has valid token
    if ((authCookie && isValidToken(authCookie)) || (authToken && isValidToken(authToken))) {
      return NextResponse.next();
    }

    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // For regular pages, redirect to login if no auth cookie
  if (!authCookie || !isValidToken(authCookie)) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

function isValidToken(token: string): boolean {
  // Simple validation: check if it's a 64-character hex string
  return /^[a-f0-9]{64}$/.test(token);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
