import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

/**
 * createMiddlewareClient
 * ─────────────────────────────────────────────────────────────────────────────
 * Special Supabase client for use inside Next.js middleware.
 * It reads + writes cookies via the incoming Request and outgoing Response,
 * which is the ONLY way to refresh Supabase sessions at the edge.
 */
export function createMiddlewareClient(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies on both the outgoing request (so server components
          // see them) and the outgoing response (so the browser stores them).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return { supabase, response };
}
