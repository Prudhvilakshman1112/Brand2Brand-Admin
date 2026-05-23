/**
 * /api/edit-product
 * ─────────────────────────────────────────────────────────────────────────────
 * Updates an existing product's metadata and handles image deletions.
 *
 * UPDATED: No longer handles image file uploads — new images are uploaded
 * directly from the browser to Cloudinary and saved via /api/save-image.
 * This route still handles deleting removed images from Cloudinary/Supabase.
 *
 * Body: JSON with product fields + removedImageIds
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/requireAuth';
import {
  deleteFromCloudinary,
  extractPublicId,
  isCloudinaryUrl,
  isSupabaseStorageUrl,
  extractSupabaseStoragePath,
} from '@/lib/cloudinary';

export async function PUT(request) {
  try {
    // ── Auth guard ─────────────────────────────────────────────────────────
    const { errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    const supabase = createAdminClient();
    const body = await request.json();

    const productId     = body.productId;
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
    const removedImageIds = body.removedImageIds || [];

    if (!productId || !name || !price || !subcategoryId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── Update product row ──────────────────────────────────
    const { error: updateErr } = await supabase
      .from('products')
      .update({
        name, brand, subcategory_id: subcategoryId, gender, price,
        original_price: originalPrice, description, sizes, colors,
        badge, atmosphere_theme: atmosphereTheme,
      })
      .eq('id', productId);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    console.log(`✅ Product updated: ${productId} — "${name}"`);

    const imageResults = { deleted: 0 };

    // ── Remove deleted images ───────────────────────────────
    for (const imgId of removedImageIds) {
      const { data: img } = await supabase
        .from('product_images')
        .select('image_url')
        .eq('id', imgId)
        .single();

      if (img?.image_url) {
        try {
          if (isCloudinaryUrl(img.image_url)) {
            // Delete from Cloudinary
            const publicId = extractPublicId(img.image_url);
            if (publicId) await deleteFromCloudinary(publicId);
          } else if (isSupabaseStorageUrl(img.image_url)) {
            // Legacy: delete from Supabase Storage
            const storagePath = extractSupabaseStoragePath(img.image_url);
            if (storagePath) await supabase.storage.from('product-images').remove([storagePath]);
          }
        } catch (err) {
          console.error('Image delete error:', err.message);
        }
      }
      await supabase.from('product_images').delete().eq('id', imgId);
      imageResults.deleted++;
      console.log(`   🗑️  Deleted image ${imgId}`);
    }

    console.log(`📊 Edit summary: ${imageResults.deleted} deleted`);

    return NextResponse.json({ success: true, images: imageResults });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
