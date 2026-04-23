import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // List top level of bucket (no prefix)
    const { data: rootList, error: rootErr } = await supabase.storage
      .from('product-images')
      .list('', { limit: 100 });

    // List 'products' folder
    const { data: productsFolderList, error: prodFolderErr } = await supabase.storage
      .from('product-images')
      .list('products', { limit: 100 });

    // If there are subfolders, list the first one
    let firstFolderFiles = null;
    if (productsFolderList?.length > 0) {
      const first = productsFolderList[0];
      const { data } = await supabase.storage
        .from('product-images')
        .list(`products/${first.name}`, { limit: 50 });
      firstFolderFiles = { folderName: first.name, folderEntry: first, files: data };
    }

    return NextResponse.json({
      rootList,
      rootErr,
      productsFolderList,
      prodFolderErr,
      firstFolderFiles,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
