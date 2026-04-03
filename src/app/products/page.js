'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function AdminProductsPage() {
  const supabase = createClient();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select(`
        id, name, brand, price, badge, is_active, created_at,
        subcategories ( name, categories ( name ) ),
        product_images ( image_url, display_order )
      `)
      .order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleToggleActive = async (id, currentStatus) => {
    await supabase.from('products').update({ is_active: !currentStatus }).eq('id', id);
    fetchProducts();
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const { data: images } = await supabase.from('product_images').select('image_url').eq('product_id', id);
    if (images) {
      for (const img of images) {
        try {
          const url = new URL(img.image_url);
          const storagePath = url.pathname.split('/storage/v1/object/public/product-images/')[1];
          if (storagePath) {
            await supabase.storage.from('product-images').remove([storagePath]);
          }
        } catch { /* ignore */ }
      }
    }
    await supabase.from('products').delete().eq('id', id);
    fetchProducts();
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase()) ||
    p.subcategories?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.subcategories?.categories?.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="admin-loading"><span className="admin-spinner" /> Loading products...</div>;
  }

  return (
    <>
      <div className="admin-table-wrapper">
        <div className="admin-table-header">
          <h3>All Products ({products.length})</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', width: '100%', maxWidth: '400px' }}>
            <div className="admin-search" style={{ flex: '1 1 auto', minWidth: '0' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                id="product-search"
                style={{ width: '100%' }}
              />
            </div>
            <Link href="/products/new" className="admin-btn admin-btn-primary" id="add-product-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Product
            </Link>
          </div>
        </div>

        {/* Desktop table view */}
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Badge</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const thumb = p.product_images?.sort((a, b) => a.display_order - b.display_order)?.[0];
                return (
                  <tr key={p.id}>
                    <td>
                      {thumb ? (
                        <img src={thumb.image_url} alt={p.name} className="admin-table-thumb" />
                      ) : (
                        <div className="admin-table-thumb" style={{
                          background: 'var(--admin-border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', color: 'var(--admin-text-muted)',
                        }}>No img</div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>{p.brand}</div>
                    </td>
                    <td style={{ color: 'var(--admin-text-muted)', fontSize: '12px' }}>
                      {p.subcategories?.categories?.name} &rsaquo; {p.subcategories?.name}
                    </td>
                    <td>&#8377;{p.price?.toLocaleString()}</td>
                    <td>
                      {p.badge ? (
                        <span className="admin-badge admin-badge-blue">{p.badge}</span>
                      ) : '\u2014'}
                    </td>
                    <td>
                      <button
                        className={`admin-toggle ${p.is_active ? 'active' : ''}`}
                        onClick={() => handleToggleActive(p.id, p.is_active)}
                        title={p.is_active ? 'Click to deactivate' : 'Click to activate'}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <Link
                          href={`/products/${p.id}/edit`}
                          className="admin-btn admin-btn-sm admin-btn-secondary"
                        >
                          Edit
                        </Link>
                        <button
                          className="admin-btn admin-btn-sm admin-btn-danger"
                          onClick={() => handleDelete(p.id, p.name)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-muted)' }}>
                    {search ? 'No products match your search.' : 'No products yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card view */}
        <div className="admin-mobile-cards">
          {filtered.map((p) => {
            const thumb = p.product_images?.sort((a, b) => a.display_order - b.display_order)?.[0];
            return (
              <div key={p.id} className="admin-mobile-card">
                {thumb ? (
                  <img src={thumb.image_url} alt={p.name} className="admin-mobile-card-thumb" />
                ) : (
                  <div className="admin-mobile-card-thumb-placeholder">No img</div>
                )}
                <div className="admin-mobile-card-body">
                  <div className="admin-mobile-card-title">{p.name}</div>
                  <div className="admin-mobile-card-subtitle">
                    {p.brand} · {p.subcategories?.categories?.name} › {p.subcategories?.name}
                  </div>
                  <div className="admin-mobile-card-meta">
                    <span className="admin-mobile-card-price">₹{p.price?.toLocaleString()}</span>
                    {p.badge && (
                      <span className="admin-badge admin-badge-blue">{p.badge}</span>
                    )}
                    <span className={`admin-badge ${p.is_active ? 'admin-badge-green' : 'admin-badge-red'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="admin-mobile-card-actions">
                    <button
                      className={`admin-toggle ${p.is_active ? 'active' : ''}`}
                      onClick={() => handleToggleActive(p.id, p.is_active)}
                      title={p.is_active ? 'Deactivate' : 'Activate'}
                    />
                    <Link
                      href={`/products/${p.id}/edit`}
                      className="admin-btn admin-btn-sm admin-btn-secondary"
                    >
                      Edit
                    </Link>
                    <button
                      className="admin-btn admin-btn-sm admin-btn-danger"
                      onClick={() => handleDelete(p.id, p.name)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-muted)', fontSize: '13px' }}>
              {search ? 'No products match your search.' : 'No products yet.'}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
