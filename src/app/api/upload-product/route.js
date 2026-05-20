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

    console.log(`✅ Product created: ${product.id} — "${name}"`);

    const folder = `brand2brand/products/${product.id}`;
    const imageResults = { uploaded: 0, failed: 0, errors: [] };

    // ── Upload images to Cloudinary ─────────────────────────
    const coverFile = formData.get('coverImage');
    const variantFiles = formData.getAll('variantImages');
    const variantColorTags = JSON.parse(formData.get('variantColorTags') || '[]');

    // Upload cover (display_order = 0)
    if (coverFile && coverFile.size > 0) {
      try {
        console.log(`📤 Uploading cover image (${coverFile.size} bytes, type: ${coverFile.type})...`);
        const result = await uploadToCloudinary(coverFile, folder, 'cover');
        const { error: imgErr } = await supabase.from('product_images').insert({
          product_id: product.id,
          image_url: result.url,
          display_order: 0,
          color_tag: null,
        });
        if (imgErr) {
          console.error('Cover DB insert error:', imgErr);
          imageResults.failed++;
          imageResults.errors.push(`Cover DB error: ${imgErr.message}`);
        } else {
          imageResults.uploaded++;
          console.log(`   🖼️  Cover uploaded to Cloudinary (${result.bytes} bytes) → ${result.url}`);
        }
      } catch (err) {
        console.error('❌ Cover upload error:', err.message);
        imageResults.failed++;
        imageResults.errors.push(`Cover upload: ${err.message}`);
      }
    }

    // Upload variants (display_order = 1, 2, 3…)
    for (let i = 0; i < variantFiles.length; i++) {
      const file = variantFiles[i];
      if (!file || file.size === 0) continue;

      try {
        console.log(`📤 Uploading variant ${i + 1} (${file.size} bytes, type: ${file.type})...`);
        const result = await uploadToCloudinary(file, folder, `variant_${i + 1}`);
        const { error: imgErr } = await supabase.from('product_images').insert({
          product_id: product.id,
          image_url: result.url,
          display_order: i + 1,
          color_tag: variantColorTags[i] || null,
        });
        if (imgErr) {
          console.error(`Variant ${i + 1} DB insert error:`, imgErr);
          imageResults.failed++;
          imageResults.errors.push(`Variant ${i + 1} DB error: ${imgErr.message}`);
        } else {
          imageResults.uploaded++;
          console.log(`   🖼️  Variant ${i + 1} uploaded (${result.bytes} bytes) → ${result.url}`);
        }
      } catch (err) {
        console.error(`❌ Variant ${i + 1} upload error:`, err.message);
        imageResults.failed++;
        imageResults.errors.push(`Variant ${i + 1}: ${err.message}`);
      }
    }

    console.log(`📊 Image upload summary: ${imageResults.uploaded} uploaded, ${imageResults.failed} failed`);

    // Return detailed results so the client knows what happened
    return NextResponse.json({
      productId: product.id,
      images: imageResults,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

