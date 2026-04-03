import { createClient } from '@/lib/supabase/server';

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [productsRes, categoriesRes, imagesRes, activeRes] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('categories').select('id', { count: 'exact', head: true }),
    supabase.from('product_images').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  const { data: recentProducts } = await supabase
    .from('products')
    .select(`
      id, name, brand, price, badge, is_active, created_at,
      subcategories ( name, categories ( name ) ),
      product_images ( image_url, display_order )
    `)
    .order('created_at', { ascending: false })
    .limit(5);

  const stats = [
    {
      label: 'Total Products',
      value: productsRes.count || 0,
      iconClass: 'products',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      ),
    },
    {
      label: 'Categories',
      value: categoriesRes.count || 0,
      iconClass: 'categories',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      label: 'Images',
      value: imagesRes.count || 0,
      iconClass: 'images',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      ),
    },
    {
      label: 'Active Products',
      value: activeRes.count || 0,
      iconClass: 'active',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <div className="admin-stats-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="admin-stat-card">
            <div className={`admin-stat-card-icon ${stat.iconClass}`}>
              {stat.icon}
            </div>
            <div className="admin-stat-card-label">{stat.label}</div>
            <div className="admin-stat-card-value">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="admin-table-wrapper">
        <div className="admin-table-header">
          <h3>Recent Products</h3>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Badge</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentProducts?.map((p) => {
              const thumbImage = p.product_images
                ?.sort((a, b) => a.display_order - b.display_order)?.[0];
              return (
                <tr key={p.id}>
                  <td>
                    {thumbImage ? (
                      <img
                        src={thumbImage.image_url}
                        alt={p.name}
                        className="admin-table-thumb"
                      />
                    ) : (
                      <div className="admin-table-thumb" style={{
                        background: 'var(--admin-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        color: 'var(--admin-text-muted)',
                      }}>
                        N/A
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td style={{ color: 'var(--admin-text-muted)' }}>
                    {p.subcategories?.categories?.name} &rsaquo; {p.subcategories?.name}
                  </td>
                  <td>&#8377;{p.price?.toLocaleString()}</td>
                  <td>
                    {p.badge ? (
                      <span className="admin-badge admin-badge-blue">{p.badge}</span>
                    ) : (
                      <span style={{ color: 'var(--admin-text-muted)' }}>&mdash;</span>
                    )}
                  </td>
                  <td>
                    <span className={`admin-badge ${p.is_active ? 'admin-badge-green' : 'admin-badge-red'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {(!recentProducts || recentProducts.length === 0) && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-muted)' }}>
                  No products yet. Add your first product to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
