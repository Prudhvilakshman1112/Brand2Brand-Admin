/**
 * /api/upload-product
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates a new product row in the database.
 * 
 * UPDATED: No longer handles image file uploads — images are now uploaded
 * directly from the browser to Cloudinary, bypassing Vercel entirely.
 * Image URLs are saved via the separate /api/save-image endpoint.
 *
 * Body: JSON with product fields
 * Response: { productId }
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/requireAuth';

export async function POST(request) {
  try {
    // ── Auth guard ─────────────────────────────────────────────────────────
    const { errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    const supabase = createAdminClient();
    const body = await request.json();

    // ── Extract product fields ──────────────────────────────
    const name          = body.name;
    const brand         = body.brand || 'Brand 2 Brand';
    const subcategoryId = body.subcategoryId;
    const gender        = body.gender || null;
    const price         = parseInt(body.price);
    const originalPrice = body.originalPrice ? parseInt(body.originalPrice) : null;
    const description   = body.description || null;
    const sizes         = body.sizes || [];
    const colors        = body.colors || [];
    const badge         = body.badge || null;
    const atmosphereTheme = body.atmosphereTheme || 'default';

    if (!name || !price || !subcategoryId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── Insert product row ──────────────────────────────────
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .insert({
        name,
        brand,
        subcategory_id: subcategoryId,
        gender,
        price,
        original_price: originalPrice,
        description,
        sizes,
        colors,
        badge,
        atmosphere_theme: atmosphereTheme,
        is_active: true,
      })
      .select()
      .single();

    if (prodErr) {
      console.error('Product insert error:', prodErr);
      return NextResponse.json({ error: prodErr.message }, { status: 500 });
    }

    console.log(`✅ Product created: ${product.id} — "${name}"`);

    return NextResponse.json({ productId: product.id });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
