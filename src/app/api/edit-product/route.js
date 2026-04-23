import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/requireAuth';

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
          const url = new URL(img.image_url);
          const storagePath = url.pathname.split('/storage/v1/object/public/product-images/')[1];
          if (storagePath) await supabase.storage.from('product-images').remove([storagePath]);
        } catch { /* ignore */ }
      }
      await supabase.from('product_images').delete().eq('id', imgId);
    }

    // ── Upload new images ───────────────────────────────────
    const newFiles = formData.getAll('newImages');
    const newColorTags = JSON.parse(formData.get('newColorTags') || '[]');
    const startOrder = existingImageCount;

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      if (!file || file.size === 0) continue;
      const ext = file.name.split('.').pop().toLowerCase();
      const storagePath = `products/${productId}/${Date.now()}_${i}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(storagePath, file, { contentType: file.type, upsert: true });

      if (uploadErr) { console.error(uploadErr); continue; }

      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(storagePath);
      await supabase.from('product_images').insert({
        product_id: productId,
        image_url: urlData.publicUrl,
        display_order: startOrder + i,
        color_tag: newColorTags[i] || null,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
