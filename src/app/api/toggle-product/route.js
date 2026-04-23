import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/requireAuth';

export async function POST(request) {
  try {
    // ── Auth guard ─────────────────────────────────────────────────────────
    const { errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    const { productId, isActive } = await request.json();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('products')
      .update({ is_active: !isActive })
      .eq('id', productId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, is_active: !isActive });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
