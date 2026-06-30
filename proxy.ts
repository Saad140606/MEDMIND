// Middleware request interceptor routing unauthenticated users to login and permitting public route fallbacks.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/offline', '/_next', '/favicon.ico', '/manifest.json', '/sw.js', '/api/auth', '/icon-192.svg', '/icon-512.svg'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets to bypass auth middleware redirects.
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p)) || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Check if Supabase is configured via env vars
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    // In local fallback mode — allow everything through
    return NextResponse.next();
  }

  // Read session from cookies
  let session = null;
  try {
    // Manually parse cookies from the request headers to extract the auth token.
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies: Record<string, string> = {};
    cookieHeader.split(';').forEach(c => {
      const [k, ...v] = c.trim().split('=');
      if (k) cookies[decodeURIComponent(k.trim())] = decodeURIComponent(v.join('=').trim());
    });

    // Supabase SSR stores session in a cookie containing 'auth-token' inside its key.
    const tokenKey = Object.keys(cookies).find(k => k.includes('auth-token'));
    if (tokenKey && cookies[tokenKey]) {
      try {
        const parsed = JSON.parse(cookies[tokenKey]);
        if (parsed && parsed.access_token) {
          session = parsed;
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-.*\\.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
