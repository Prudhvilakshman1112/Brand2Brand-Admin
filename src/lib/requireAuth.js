/**
 * requireAuth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared helper that validates the caller's Supabase session inside an API
 * route handler. Uses getUser() — which calls Supabase's servers — so the JWT
 * cannot be forged locally.
 *
 * Usage in any route.js:
 *
 *   const { user, errorResponse } = await requireAuth();
 *   if (errorResponse) return errorResponse;
 *   // user is now guaranteed to be authenticated
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function requireAuth() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Unauthorised — you must be logged in to perform this action.' },
        { status: 401 }
      ),
    };
  }

  return { user, errorResponse: null };
}
