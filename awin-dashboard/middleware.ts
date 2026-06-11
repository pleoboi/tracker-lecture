import { NextRequest, NextResponse } from 'next/server';

async function makeToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + ':awin-hub-2026');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow the login page and auth API
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const password = process.env.DASHBOARD_PASSWORD;
  // If no password configured, allow everything (dev mode)
  if (!password) return NextResponse.next();

  const cookie = request.cookies.get('awin_auth')?.value;
  const expected = await makeToken(password);

  if (cookie !== expected) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
