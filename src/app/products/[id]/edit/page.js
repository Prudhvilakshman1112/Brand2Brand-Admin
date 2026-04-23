'use client';

import { useState, useEffect, useRef, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { compressImage, formatBytes } from '@/lib/compressImage';

function getSizePreset(subcategoryName) {
  const n = (subcategoryName || '').toLowerCase();
  if (/shirt|top|t-shirt|tee|kurta|blouse|polo|sweatshirt|hoodie|jacket|coat|blazer/.test(n))
    return { label: 'Clothing Sizes', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] };
  if (/pant|trouser|jean|chino|short|skirt|legging/.test(n))
    return { label: 'Bottom Sizes (waist)', sizes: ['26', '28', '30', '32', '34', '36', '38', '40', '42'] };
  if (/shoe|sneaker|boot|sandal|slipper|footwear|loafer|heel/.test(n))
    return { label: 'Shoe Sizes (UK)', sizes: ['5', '6', '7', '8', '9', '10', '11', '12'] };
  if (/bag|wallet|belt|watch|jewel|accessory|accessories|cap|hat|sock/.test(n))
    return { label: 'Sizes', sizes: ['Free Size', 'One Size'] };
  return { label: 'Sizes', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] };
}

const COMMON_COLORS = [
  { name: 'Black', hex: '#111111' }, { name: 'White', hex: '#f5f5f5' },
  { name: 'Navy', hex: '#1e3a5f' }, { name: 'Red', hex: '#dc2626' },
  { name: 'Maroon', hex: '#7f1d1d' }, { name: 'Olive', hex: '#5f6b1e' },
  { name: 'Green', hex: '#16a34a' }, { name: 'Blue', hex: '#2563eb' },
  { name: 'Sky Blue', hex: '#0ea5e9' }, { name: 'Grey', hex: '#6b7280' },
  { name: 'Brown', hex: '#92400e' }, { name: 'Beige', hex: '#d4a574' },
  { name: 'Pink', hex: '#ec4899' }, { name: 'Purple', hex: '#7c3aed' },
  { name: 'Yellow', hex: '#eab308' }, { name: 'Orange', hex: '#ea580c' },
];

export default function AdminEditProductPage({ params }) {
  const resolvedParams = use(params);
  const productId = resolvedParams.id;
  const supabase = createClient();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [selectedSubName, setSelectedSubName] = useState('');

  const [form, setForm] = useState({
    name: '', brand: 'Brand 2 Brand', description: '', price: '', originalPrice: '',
    categoryId: '', subcategoryId: '', gender: '', badge: '', atmosphereTheme: 'default',
  });

  const [sizes, setSizes] = useState([]);
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [colors, setColors] = useState([]);
  const [customColorInput, setCustomColorInput] = useState('');
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [removedImageIds, setRemovedImageIds] = useState([]);

  useEffect(() => {
    const load = async () => {
      const { data: cats } = await supabase.from('categories').select('*, subcategories(*)').order('name');
      setCategories(cats || []);
      const { data: product } = await supabase.from('products')
        .select('*, subcategories(id,name,category_id,categories(id,name)), product_images(id,image_url,display_order,color_tag)')
        .eq('id', productId).single();
      if (!product) { router.push('/products'); return; }
      const catId = product.subcategories?.categories?.id || '';
      const cat = cats?.find(c => c.id === catId);
      setSubcategories(cat?.subcategories || []);
      setSelectedSubName(product.subcategories?.name || '');
      setForm({
        name: product.name || '', brand: product.brand || 'Brand 2 Brand',
        description: product.description || '', price: product.price?.toString() || '',
        originalPrice: product.original_price?.toString() || '', categoryId: catId,
        subcategoryId: product.subcategory_id || '', gender: product.gender || '',
        badge: product.badge || '', atmosphereTheme: product.atmosphere_theme || 'default',
      });
      setSizes(product.sizes || []);
      setColors(product.colors || []);
      setExistingImages((product.product_images || []).sort((a, b) => a.display_order - b.display_order));
      setLoading(false);
    };
    load();
  }, [productId]);

  useEffect(() => {
    if (form.categoryId) {
      const cat = categories.find(c => c.id === form.categoryId);
      setSubcategories(cat?.subcategories || []);
    }
  }, [form.categoryId, categories]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubChange = (e) => {
    const id = e.target.value;
    const sub = subcategories.find(s => s.id === id);
    handleChange('subcategoryId', id);
    setSelectedSubName(sub?.name || '');
  };

  const sizePreset = getSizePreset(selectedSubName);
  const toggleSize = (s) => setSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleColor = (c) => setColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const addCustomSize = () => {
    const v = customSizeInput.trim();
    if (v && !sizes.includes(v)) { setSizes(prev => [...prev, v]); setCustomSizeInput(''); }
  };
  const addCustomColor = () => {
    const v = customColorInput.trim();
    if (v && !colors.includes(v)) { setColors(prev => [...prev, v]); setCustomColorInput(''); }
  };

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    if (!files.length) return;
    setCompressing(true);
    try {
      const results = await Promise.all(files.map(f => compressImage(f)));
      setNewImages(prev => [
        ...prev,
        ...results.map(r => ({
          file:           r.file,
          preview:        URL.createObjectURL(r.file),
          colorTag:       '',
          originalSize:   r.originalSize,
          compressedSize: r.compressedSize,
        })),
      ]);
    } finally {
      setCompressing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.subcategoryId) { alert('Please fill required fields.'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('productId', productId);
      fd.append('name', form.name);
      fd.append('brand', form.brand);
      fd.append('subcategoryId', form.subcategoryId);
      fd.append('gender', form.gender);
      fd.append('price', form.price);
      fd.append('originalPrice', form.originalPrice);
      fd.append('description', form.description);
      fd.append('sizes', JSON.stringify(sizes));
      fd.append('colors', JSON.stringify(colors));
      fd.append('badge', form.badge);
      fd.append('atmosphereTheme', form.atmosphereTheme);
      fd.append('removedImageIds', JSON.stringify(removedImageIds));
      fd.append('existingImageCount', String(existingImages.length));
      newImages.forEach(img => fd.append('newImages', img.file));
      fd.append('newColorTags', JSON.stringify(newImages.map(img => img.colorTag)));

      const res = await fetch('/api/edit-product', { method: 'PUT', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      router.push('/products');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="admin-loading"><span className="admin-spinner" /> Loading product...</div>;

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h2>Edit Product</h2>
          <p className="admin-page-subtitle">{form.name}</p>
        </div>
        <button className="admin-btn admin-btn-ghost" onClick={() => router.back()}>← Back</button>
      </div>

      <form onSubmit={handleSubmit} className="admin-new-product-form">

        <div className="admin-form-section">
          <div className="admin-form-section-title"><span className="admin-form-section-num">1</span> Product Info</div>
          <div className="admin-form-section-body">
            <div className="admin-form-group">
              <label className="admin-form-label">Product Name *</label>
              <input className="admin-form-input admin-form-input-lg" value={form.name}
                onChange={e => handleChange('name', e.target.value)} required />
            </div>
            <div className="admin-form-row-3">
              <div className="admin-form-group">
                <label className="admin-form-label">Brand</label>
                <input className="admin-form-input" value={form.brand} onChange={e => handleChange('brand', e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Gender</label>
                <select className="admin-form-select" value={form.gender} onChange={e => handleChange('gender', e.target.value)}>
                  <option value="">Unisex / None</option>
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Badge</label>
                <select className="admin-form-select" value={form.badge} onChange={e => handleChange('badge', e.target.value)}>
                  <option value="">None</option>
                  <option value="BESTSELLER">Bestseller</option>
                  <option value="NEW">New</option>
                  <option value="TRENDING">Trending</option>
                  <option value="EXCLUSIVE">Exclusive</option>
                </select>
              </div>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Selling Price (₹) *</label>
                <input type="number" className="admin-form-input" value={form.price} onChange={e => handleChange('price', e.target.value)} required />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Original Price (₹)</label>
                <input type="number" className="admin-form-input" value={form.originalPrice} onChange={e => handleChange('originalPrice', e.target.value)} />
              </div>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Description</label>
              <textarea className="admin-form-textarea" value={form.description} onChange={e => handleChange('description', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="admin-form-section">
          <div className="admin-form-section-title"><span className="admin-form-section-num">2</span> Category</div>
          <div className="admin-form-section-body">
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Category *</label>
                <select className="admin-form-select" value={form.categoryId} onChange={e => handleChange('categoryId', e.target.value)} required>
                  <option value="">Select...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Subcategory *</label>
                <select className="admin-form-select" value={form.subcategoryId} onChange={handleSubChange} required disabled={!form.categoryId}>
                  <option value="">Select...</option>
                  {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Atmosphere Theme</label>
              <div className="admin-chip-row">
                {['default', 'clothing', 'footwear', 'accessories'].map(t => (
                  <button key={t} type="button" className={`admin-chip ${form.atmosphereTheme === t ? 'selected' : ''}`}
                    onClick={() => handleChange('atmosphereTheme', t)}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="admin-form-section">
          <div className="admin-form-section-title"><span className="admin-form-section-num">3</span> Sizes
            {selectedSubName && <span className="admin-form-section-hint">— {sizePreset.label}</span>}
          </div>
          <div className="admin-form-section-body">
            <div className="admin-chip-grid">
              {sizePreset.sizes.map(s => (
                <button key={s} type="button" className={`admin-size-chip ${sizes.includes(s) ? 'selected' : ''}`}
                  onClick={() => toggleSize(s)}>
                  {s}{sizes.includes(s) && <span className="admin-chip-check">✓</span>}
                </button>
              ))}
            </div>
            <div className="admin-custom-add-row">
              <input className="admin-form-input" value={customSizeInput}
                onChange={e => setCustomSizeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSize(); } }}
                placeholder="Custom size..." />
              <button type="button" className="admin-btn admin-btn-outline" onClick={addCustomSize}>+ Add</button>
            </div>
            {sizes.length > 0 && (
              <div className="admin-selected-chips">
                <span className="admin-selected-label">Selected:</span>
                {sizes.map(s => <span key={s} className="admin-tag">{s}<button type="button" onClick={() => setSizes(prev => prev.filter(x => x !== s))}>×</button></span>)}
              </div>
            )}
          </div>
        </div>

        <div className="admin-form-section">
          <div className="admin-form-section-title"><span className="admin-form-section-num">4</span> Colours</div>
          <div className="admin-form-section-body">
            <div className="admin-color-swatches">
              {COMMON_COLORS.map(c => (
                <button key={c.name} type="button"
                  className={`admin-color-swatch ${colors.includes(c.name) ? 'selected' : ''}`}
                  style={{ '--swatch-color': c.hex }} onClick={() => toggleColor(c.name)} title={c.name}>
                  {colors.includes(c.name) && <span className="admin-swatch-check">✓</span>}
                  <span className="admin-swatch-label">{c.name}</span>
                </button>
              ))}
            </div>
            <div className="admin-custom-add-row">
              <input className="admin-form-input" value={customColorInput}
                onChange={e => setCustomColorInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomColor(); } }}
                placeholder="Custom colour..." />
              <button type="button" className="admin-btn admin-btn-outline" onClick={addCustomColor}>+ Add</button>
            </div>
            {colors.length > 0 && (
              <div className="admin-selected-chips">
                <span className="admin-selected-label">Selected:</span>
                {colors.map(c => <span key={c} className="admin-tag">{c}<button type="button" onClick={() => setColors(prev => prev.filter(x => x !== c))}>×</button></span>)}
              </div>
            )}
          </div>
        </div>

        <div className="admin-form-section">
          <div className="admin-form-section-title"><span className="admin-form-section-num">5</span> Images</div>
          <div className="admin-form-section-body">
            {existingImages.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p className="admin-form-label" style={{ marginBottom: 10 }}>Current Images</p>
                <div className="admin-variant-images-area">
                  {existingImages.map((img, i) => (
                    <div key={img.id} className="admin-image-preview-single">
                      <img src={img.image_url} alt={`Image ${i + 1}`} />
                      <button className="admin-image-remove-btn" type="button"
                        onClick={() => { setRemovedImageIds(prev => [...prev, img.id]); setExistingImages(prev => prev.filter(x => x.id !== img.id)); }}>×</button>
                      <div className="admin-image-badge">{i === 0 ? 'Cover' : i + 1}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="admin-variant-images-area">
              <div className="admin-image-drop-zone admin-image-drop-zone-sm" onClick={() => fileInputRef.current?.click()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                <p>{compressing ? 'Optimising…' : 'Add more images'}</p>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFilesSelected} multiple accept="image/*" style={{ display: 'none' }} />
              {newImages.map((img, i) => (
                <div key={i} className="admin-image-preview-single">
                  <img src={img.preview} alt={`New ${i + 1}`} />
                  <button className="admin-image-remove-btn" type="button"
                    onClick={() => setNewImages(prev => prev.filter((_, idx) => idx !== i))}>×</button>
                  <div className="admin-image-badge" style={{ background: 'var(--admin-success)' }}>+{i + 1}</div>
                  {img.originalSize && (
                    <div className="admin-compress-badge">
                      {formatBytes(img.originalSize)} → {formatBytes(img.compressedSize)} ✓
                    </div>
                  )}
                  {colors.length > 0 && (
                    <select className="admin-image-color-tag" value={img.colorTag}
                      onChange={e => setNewImages(prev => prev.map((v, idx) => idx === i ? { ...v, colorTag: e.target.value } : v))}>
                      <option value="">Tag colour</option>
                      {colors.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <button type="submit" className="admin-btn admin-btn-primary admin-btn-submit" disabled={saving || compressing}>
          {saving ? <><span className="admin-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Saving...</>
          : compressing ? <><span className="admin-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Optimising Images...</>
          : '✦ Save Changes'}
        </button>
      </form>
    </>
  );
}
