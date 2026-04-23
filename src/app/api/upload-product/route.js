import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/requireAuth';

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

    // ── Upload images ───────────────────────────────────────
    const coverFile = formData.get('coverImage');
    const variantFiles = formData.getAll('variantImages');
    const variantColorTags = JSON.parse(formData.get('variantColorTags') || '[]');

    // Upload cover (display_order = 0)
    if (coverFile && coverFile.size > 0) {
      const ext = coverFile.name.split('.').pop().toLowerCase();
      const storagePath = `products/${product.id}/cover.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(storagePath, coverFile, { contentType: coverFile.type, upsert: true });

      if (uploadErr) {
        console.error('Cover upload error:', uploadErr);
      } else {
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(storagePath);
        await supabase.from('product_images').insert({
          product_id: product.id,
          image_url: urlData.publicUrl,
          display_order: 0,
          color_tag: null,
        });
      }
    }

    // Upload variants (display_order = 1, 2, 3…)
    for (let i = 0; i < variantFiles.length; i++) {
      const file = variantFiles[i];
      if (!file || file.size === 0) continue;
      const ext = file.name.split('.').pop().toLowerCase();
      const storagePath = `products/${product.id}/variant_${i + 1}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(storagePath, file, { contentType: file.type, upsert: true });

      if (uploadErr) {
        console.error(`Variant ${i + 1} upload error:`, uploadErr);
        continue;
      }

      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(storagePath);
      await supabase.from('product_images').insert({
        product_id: product.id,
        image_url: urlData.publicUrl,
        display_order: i + 1,
        color_tag: variantColorTags[i] || null,
      });
    }

    return NextResponse.json({ productId: product.id });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
