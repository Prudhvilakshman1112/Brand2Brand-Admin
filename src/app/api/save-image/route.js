/**
 * /api/save-image
 * ─────────────────────────────────────────────────────────────────────────────
 * Saves a Cloudinary image URL to the product_images table.
 * Called after the browser uploads an image directly to Cloudinary.
 *
 * Body: { productId, imageUrl, displayOrder, colorTag? }
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/requireAuth';

export async function POST(request) {
  try {
    const { errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    const supabase = createAdminClient();
    const { productId, imageUrl, displayOrder, colorTag } = await request.json();

    if (!productId || !imageUrl) {
      return NextResponse.json({ error: 'productId and imageUrl are required' }, { status: 400 });
    }

    const { error } = await supabase.from('product_images').insert({
      product_id: productId,
      image_url: imageUrl,
      display_order: displayOrder ?? 0,
      color_tag: colorTag || null,
    });

    if (error) {
      console.error('Image save error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Save image API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
