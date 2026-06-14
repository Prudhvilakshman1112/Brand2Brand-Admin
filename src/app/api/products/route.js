import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/requireAuth';

// GET /api/products — fetch ALL products (including inactive) for admin panel
// Uses the service-role client so RLS policies don't filter out inactive products.
export async function GET() {
  try {
    // ── Auth guard ─────────────────────────────────────────────────────────
    const { errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('products')
      .select(`
        id, name, brand, price, badge, is_active, created_at, product_code,
        subcategories ( name, category_id, categories ( id, name ) ),
        product_images ( id, image_url, display_order, color_tag )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ products: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
