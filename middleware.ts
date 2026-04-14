import createIntlMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { updateSession } from './lib/supabase/middleware';

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Strip locale prefix to determine route type
  const pathWithoutLocale = pathname.replace(/^\/(en|zh|ja)/, '') || '/';
  const isProtected = ['/dashboard', '/settings', '/video'].some(p =>
    pathWithoutLocale.startsWith(p)
  );
  // Root path ("/") is the login page; also keep /login and /signup as auth routes (they redirect to /)
  const isAuthRoute = pathWithoutLocale === '/' ||
    ['/login', '/signup'].some(p => pathWithoutLocale.startsWith(p));

  // Determine locale for redirect URLs
  const localeMatch = pathname.match(/^\/(en|zh|ja)/);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

  // Run intl middleware first (handles locale detection & redirects)
  const intlResponse = intlMiddleware(request);

  // Refresh Supabase session and get current user
  const { user } = await updateSession(request, intlResponse);

  // Dev bypass: set DEV_SUPABASE_USER_ID in .env.local to skip auth checks
  const devBypass = process.env.DEV_SUPABASE_USER_ID?.trim();

  // Redirect unauthenticated users away from protected routes
  if (isProtected && !user && !devBypass) {
    return NextResponse.redirect(new URL(`/${locale}/`, request.url));
  }

  // Redirect authenticated users away from auth routes
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
