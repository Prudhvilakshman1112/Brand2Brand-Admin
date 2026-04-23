import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/requireAuth';

export async function DELETE(request) {
  try {
    // ── Auth guard ─────────────────────────────────────────────────────────
    const { errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    const { productId } = await request.json();
    const supabase = createAdminClient();

    // Get all images for this product
    const { data: images } = await supabase
      .from('product_images')
      .select('image_url')
      .eq('product_id', productId);

    // Delete from storage
    if (images?.length) {
      const paths = images.flatMap(img => {
        try {
          const url = new URL(img.image_url);
          const path = url.pathname.split('/storage/v1/object/public/product-images/')[1];
          return path ? [path] : [];
        } catch { return []; }
      });
      if (paths.length) {
        await supabase.storage.from('product-images').remove(paths);
      }
    }

    // Delete product (cascade deletes product_images rows)
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
