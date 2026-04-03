'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function AdminNewProductPage() {
  const supabase = createClient();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    brand: 'Brand 2 Brand',
    description: '',
    price: '',
    originalPrice: '',
    categoryId: '',
    subcategoryId: '',
    gender: '',
    badge: '',
    atmosphereTheme: 'default',
  });

  const [sizes, setSizes] = useState([]);
  const [sizeInput, setSizeInput] = useState('');
  const [colors, setColors] = useState([]);
  const [colorInput, setColorInput] = useState('');
  const [images, setImages] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase.from('categories').select('*, subcategories(*)').order('name');
      setCategories(data || []);
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (form.categoryId) {
      const cat = categories.find(c => c.id === form.categoryId);
      setSubcategories(cat?.subcategories || []);
      setForm(prev => ({ ...prev, subcategoryId: '' }));
    }
  }, [form.categoryId, categories]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAddSize = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = sizeInput.trim();
      if (val && !sizes.includes(val)) {
        setSizes(prev => [...prev, val]);
        setSizeInput('');
      }
    }
  };

  const handleAddColor = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = colorInput.trim();
      if (val && !colors.includes(val)) {
        setColors(prev => [...prev, val]);
        setColorInput('');
      }
    }
  };

  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files);
    const newImages = files.map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setImages(prev => [...prev, ...newImages]);
  };

  const handleRemoveImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.price || !form.subcategoryId) {
      alert('Please fill in required fields: name, price, subcategory.');
      return;
    }

    setLoading(true);

    try {
      const { data: product, error: prodErr } = await supabase
        .from('products')
        .insert({
          name: form.name,
          brand: form.brand || 'Brand 2 Brand',
          subcategory_id: form.subcategoryId,
          gender: form.gender || null,
          price: parseInt(form.price),
          original_price: form.originalPrice ? parseInt(form.originalPrice) : null,
          description: form.description || null,
          sizes: sizes,
          colors: colors,
          badge: form.badge || null,
          atmosphere_theme: form.atmosphereTheme || 'default',
          is_active: true,
        })
        .select()
        .single();

      if (prodErr) throw prodErr;

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const ext = img.file.name.split('.').pop().toLowerCase();
        const storagePath = `products/${product.id}/${i}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from('product-images')
          .upload(storagePath, img.file, {
            contentType: img.file.type,
            upsert: true,
          });

        if (uploadErr) {
          console.error('Upload error:', uploadErr);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(storagePath);

        await supabase.from('product_images').insert({
          product_id: product.id,
          image_url: urlData.publicUrl,
          display_order: i,
        });
      }

      router.push('/products');
    } catch (err) {
      alert('Error creating product: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="admin-page-header">
        <h2>New Product</h2>
        <button className="admin-btn admin-btn-secondary" onClick={() => router.back()}>
          &larr; Back
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="admin-product-grid">
          <div>
            <div className="admin-table-wrapper" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px' }}>Product Details</h3>

              <div className="admin-form-group">
                <label className="admin-form-label">Product Name *</label>
                <input className="admin-form-input" value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="e.g. Premium Oxford Shirt" required id="product-name" />
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-form-label">Brand</label>
                  <input className="admin-form-input" value={form.brand} onChange={(e) => handleChange('brand', e.target.value)} />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Gender</label>
                  <select className="admin-form-select" value={form.gender} onChange={(e) => handleChange('gender', e.target.value)}>
                    <option value="">None</option>
                    <option value="men">Men</option>
                    <option value="women">Women</option>
                  </select>
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Description</label>
                <textarea className="admin-form-textarea" value={form.description} onChange={(e) => handleChange('description', e.target.value)} placeholder="Describe the product..." />
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-form-label">Price (Rs) *</label>
                  <input type="number" className="admin-form-input" value={form.price} onChange={(e) => handleChange('price', e.target.value)} placeholder="1999" required />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Original Price (Rs)</label>
                  <input type="number" className="admin-form-input" value={form.originalPrice} onChange={(e) => handleChange('originalPrice', e.target.value)} placeholder="2999" />
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-form-label">Sizes (press Enter to add)</label>
                  <div className="admin-tags">
                    {sizes.map((s, i) => (
                      <span key={i} className="admin-tag">
                        {s}
                        <button type="button" onClick={() => setSizes(prev => prev.filter((_, idx) => idx !== i))}>x</button>
                      </span>
                    ))}
                    <input value={sizeInput} onChange={(e) => setSizeInput(e.target.value)} onKeyDown={handleAddSize} placeholder="S, M, L..." />
                  </div>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Colors (press Enter to add)</label>
                  <div className="admin-tags">
                    {colors.map((c, i) => (
                      <span key={i} className="admin-tag">
                        {c}
                        <button type="button" onClick={() => setColors(prev => prev.filter((_, idx) => idx !== i))}>x</button>
                      </span>
                    ))}
                    <input value={colorInput} onChange={(e) => setColorInput(e.target.value)} onKeyDown={handleAddColor} placeholder="Black, Blue..." />
                  </div>
                </div>
              </div>
            </div>

            <div className="admin-table-wrapper" style={{ padding: '24px', marginTop: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px' }}>Product Images</h3>

              <div
                className="admin-image-upload"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p>Click to upload images</p>
                <p style={{ fontSize: '11px', color: 'var(--admin-text-muted)', marginTop: '4px' }}>
                  JPG, PNG up to 5MB each
                </p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFilesSelected}
                multiple
                accept="image/*"
                style={{ display: 'none' }}
              />

              {images.length > 0 && (
                <div className="admin-image-preview-grid">
                  {images.map((img, i) => (
                    <div key={i} className="admin-image-preview">
                      <img src={img.preview} alt={`Preview ${i + 1}`} />
                      <button className="admin-image-preview-remove" onClick={() => handleRemoveImage(i)} type="button">x</button>
                      <div className="admin-image-preview-order">{i + 1}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="admin-table-wrapper" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px' }}>Organization</h3>

              <div className="admin-form-group">
                <label className="admin-form-label">Category *</label>
                <select className="admin-form-select" value={form.categoryId} onChange={(e) => handleChange('categoryId', e.target.value)} required>
                  <option value="">Select category...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Subcategory *</label>
                <select className="admin-form-select" value={form.subcategoryId} onChange={(e) => handleChange('subcategoryId', e.target.value)} required disabled={!form.categoryId}>
                  <option value="">Select subcategory...</option>
                  {subcategories.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Badge</label>
                <select className="admin-form-select" value={form.badge} onChange={(e) => handleChange('badge', e.target.value)}>
                  <option value="">None</option>
                  <option value="BESTSELLER">Bestseller</option>
                  <option value="NEW">New</option>
                  <option value="TRENDING">Trending</option>
                  <option value="EXCLUSIVE">Exclusive</option>
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Atmosphere Theme</label>
                <select className="admin-form-select" value={form.atmosphereTheme} onChange={(e) => handleChange('atmosphereTheme', e.target.value)}>
                  <option value="default">Default</option>
                  <option value="clothing">Clothing</option>
                  <option value="footwear">Footwear</option>
                  <option value="accessories">Accessories</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '14px', marginTop: '20px', fontSize: '14px' }}
              disabled={loading}
              id="save-product-btn"
            >
              {loading ? (
                <><span className="admin-spinner" style={{ width: 16, height: 16 }} /> Creating...</>
              ) : (
                'Create Product'
              )}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
