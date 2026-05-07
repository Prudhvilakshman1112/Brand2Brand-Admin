import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/requireAuth';
import {
  uploadToCloudinary,
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
    const formData = await request.formData();

    const productId     = formData.get('productId');
    const name          = formData.get('name');
    const brand         = formData.get('brand') || 'Brand 2 Brand';
    const subcategoryId = formData.get('subcategoryId');
    const gender        = formData.get('gender') || null;
    const price         = parseInt(formData.get('price'));
    const originalPrice = formData.get('originalPrice') ? parseInt(formData.get('originalPrice')) : null;
    const description   = formData.get('description') || null;
    const sizes         = JSON.parse(formData.get('sizes') || '[]');
    const colors        = JSON.parse(formData.get('colors') || '[]');
    const badge         = formData.get('badge') || null;
    const atmosphereTheme = formData.get('atmosphereTheme') || 'default';
    const removedImageIds = JSON.parse(formData.get('removedImageIds') || '[]');
    const existingImageCount = parseInt(formData.get('existingImageCount') || '0');

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
    }

    // ── Upload new images to Cloudinary ─────────────────────
    const newFiles = formData.getAll('newImages');
    const newColorTags = JSON.parse(formData.get('newColorTags') || '[]');
    const startOrder = existingImageCount;
    const folder = `brand2brand/products/${productId}`;

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      if (!file || file.size === 0) continue;

      try {
        const result = await uploadToCloudinary(file, folder, `${Date.now()}_${i}`);
        await supabase.from('product_images').insert({
          product_id: productId,
          image_url: result.url,
          display_order: startOrder + i,
          color_tag: newColorTags[i] || null,
        });
      } catch (err) {
        console.error(`New image ${i + 1} upload error:`, err.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
