import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';

// Recursively walks ALL folders in the bucket and sums real file sizes
async function getRealStorageBytes(adminSupabase) {
  let totalBytes = 0;

  async function walkFolder(prefix) {
    const { data: items, error } = await adminSupabase.storage
      .from('product-images')
      .list(prefix, { limit: 1000 });

    if (error || !items) return;

    for (const item of items) {
      if (item.metadata?.size) {
        // It's a real file — add its size
        totalBytes += item.metadata.size;
      } else if (item.name && !item.metadata) {
        // It's a virtual folder (id: null, metadata: null) — recurse
        const subPath = prefix ? `${prefix}/${item.name}` : item.name;
        await walkFolder(subPath);
      }
    }
  }

  try {
    await walkFolder(''); // Start from bucket root
  } catch { /* ignore */ }

  return totalBytes;
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const [productsRes, categoriesRes, imagesRes, activeRes, categoriesData, realStorageBytes] =
    await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('categories').select('id', { count: 'exact', head: true }),
      supabase.from('product_images').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('categories').select('id, name, subcategories(id, name, products(id))'),
      getRealStorageBytes(adminSupabase),
    ]);

  const totalProducts = productsRes.count || 0;
  const activeProducts = activeRes.count || 0;
  const totalCategories = categoriesRes.count || 0;
  const totalImages = imagesRes.count || 0;
  const categoriesWithCounts = categoriesData.data || [];

  // Real storage math
  const storageLimitBytes = 1024 * 1024 * 1024; // 1 GB free tier
  const storageUsedMB = (realStorageBytes / (1024 * 1024)).toFixed(2);
  const storageUsedKB = (realStorageBytes / 1024).toFixed(0);
  const storageRemainingMB = ((storageLimitBytes - realStorageBytes) / (1024 * 1024)).toFixed(1);
  const storagePercent = Math.min((realStorageBytes / storageLimitBytes) * 100, 100).toFixed(2);
  const avgImageKB = totalImages > 0
    ? Math.round(realStorageBytes / totalImages / 1024)
    : 0;

  return (
    <>
      {/* Quick Actions */}
      <div className="admin-quick-actions">
        <Link href="/products/new" className="admin-quick-action-btn admin-quick-action-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Product
        </Link>
        <Link href="/categories" className="admin-quick-action-btn admin-quick-action-secondary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Manage Categories
        </Link>
        <Link href="/products" className="admin-quick-action-btn admin-quick-action-secondary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          All Products
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="admin-stats-grid">
        {[
          {
            label: 'Total Products', value: totalProducts, iconClass: 'products',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
          },
          {
            label: 'Active (Visible)', value: activeProducts, iconClass: 'active',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20"><polyline points="20 6 9 17 4 12"/></svg>,
          },
          {
            label: 'Categories', value: totalCategories, iconClass: 'categories',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
          },
          {
            label: 'Product Images', value: totalImages, iconClass: 'images',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
          },
        ].map(stat => (
          <div key={stat.label} className="admin-stat-card">
            <div className={`admin-stat-card-icon ${stat.iconClass}`}>{stat.icon}</div>
            <div className="admin-stat-card-label">{stat.label}</div>
            <div className="admin-stat-card-value">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Storage — Real data from full bucket walk */}
      <div className="admin-storage-card">
        <div className="admin-storage-header">
          <div>
            <div className="admin-storage-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
              Supabase Storage
              <span style={{ fontSize: 11, color: 'var(--admin-success)', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 20 }}>
                Live from bucket
              </span>
            </div>
            <div className="admin-storage-sub">Free tier: 1,024 MB total · Scanned all folders</div>
          </div>
          <div className="admin-storage-stats">
            <span className="admin-storage-used">
              {realStorageBytes < 1024 * 1024
                ? `${storageUsedKB} KB used`
                : `${storageUsedMB} MB used`}
            </span>
            <span className="admin-storage-pct">{storagePercent}%</span>
          </div>
        </div>
        <div className="admin-storage-bar-track">
          <div className="admin-storage-bar-fill" style={{ width: `${Math.max(parseFloat(storagePercent), 0.3)}%` }} />
        </div>
        <div className="admin-storage-meta">
          {totalImages} images in DB · avg {avgImageKB} KB/image (real) ·{' '}
          <strong style={{ color: 'var(--admin-success)' }}>
            {storageRemainingMB} MB free
          </strong>{' '}
          of 1,024 MB
          {realStorageBytes === 0 && (
            <span style={{ color: 'var(--admin-warning)', marginLeft: 8 }}>
              ⚠ No files found in storage bucket — images may have been uploaded under different paths
            </span>
          )}
        </div>
      </div>

      {/* Category Overview */}
      <div className="admin-section-title">Category Breakdown — Click to view products</div>
      <div className="admin-category-overview-grid">
        {categoriesWithCounts.map(cat => {
          const totalCatProducts = cat.subcategories?.reduce(
            (acc, sub) => acc + (sub.products?.length || 0), 0
          ) || 0;
          return (
            <Link
              key={cat.id}
              href={`/products?categoryId=${cat.id}&categoryName=${encodeURIComponent(cat.name)}`}
              className="admin-category-overview-card"
              style={{ textDecoration: 'none' }}
            >
              <div className="admin-category-overview-icon">
                {cat.name.charAt(0).toUpperCase()}
              </div>
              <div className="admin-category-overview-info">
                <div className="admin-category-overview-name">{cat.name}</div>
                <div className="admin-category-overview-meta">
                  {cat.subcategories?.length || 0} subcategories · {totalCatProducts} products
                </div>
              </div>
              <span className="admin-category-overview-arrow">›</span>
            </Link>
          );
        })}
        {categoriesWithCounts.length === 0 && (
          <div style={{ color: 'var(--admin-text-muted)', fontSize: '13px', padding: '20px 0' }}>
            No categories yet.{' '}
            <Link href="/categories" style={{ color: 'var(--admin-accent-hover)' }}>Add one →</Link>
          </div>
        )}
      </div>
    </>
  );
}
