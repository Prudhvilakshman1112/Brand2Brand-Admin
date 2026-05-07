import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/requireAuth';
import { uploadToCloudinary } from '@/lib/cloudinary';

export async function POST(request) {
  try {
    // ── Auth guard ─────────────────────────────────────────────────────────
    const { errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    const supabase = createAdminClient();
    const formData = await request.formData();

    // ── Extract product fields ──────────────────────────────
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

    const folder = `brand2brand/products/${product.id}`;

    // ── Upload images to Cloudinary ─────────────────────────
    const coverFile = formData.get('coverImage');
    const variantFiles = formData.getAll('variantImages');
    const variantColorTags = JSON.parse(formData.get('variantColorTags') || '[]');

    // Upload cover (display_order = 0)
    if (coverFile && coverFile.size > 0) {
      try {
        const result = await uploadToCloudinary(coverFile, folder, 'cover');
        await supabase.from('product_images').insert({
          product_id: product.id,
          image_url: result.url,
          display_order: 0,
          color_tag: null,
        });
        console.log(`   🖼️  Cover uploaded to Cloudinary (${result.bytes} bytes)`);
      } catch (err) {
        console.error('Cover upload error:', err.message);
      }
    }

    // Upload variants (display_order = 1, 2, 3…)
    for (let i = 0; i < variantFiles.length; i++) {
      const file = variantFiles[i];
      if (!file || file.size === 0) continue;

      try {
        const result = await uploadToCloudinary(file, folder, `variant_${i + 1}`);
        await supabase.from('product_images').insert({
          product_id: product.id,
          image_url: result.url,
          display_order: i + 1,
          color_tag: variantColorTags[i] || null,
        });
        console.log(`   🖼️  Variant ${i + 1} uploaded to Cloudinary (${result.bytes} bytes)`);
      } catch (err) {
        console.error(`Variant ${i + 1} upload error:`, err.message);
      }
    }

    return NextResponse.json({ productId: product.id });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
