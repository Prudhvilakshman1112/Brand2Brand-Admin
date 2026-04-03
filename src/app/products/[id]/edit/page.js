'use client';

import { useState, useEffect, useRef, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

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

  const [form, setForm] = useState({
    name: '', brand: 'Brand 2 Brand', description: '', price: '', originalPrice: '',
    categoryId: '', subcategoryId: '', gender: '', badge: '', atmosphereTheme: 'default',
  });

  const [sizes, setSizes] = useState([]);
  const [sizeInput, setSizeInput] = useState('');
  const [colors, setColors] = useState([]);
  const [colorInput, setColorInput] = useState('');
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [removedImageIds, setRemovedImageIds] = useState([]);

  useEffect(() => {
    const load = async () => {
      const { data: cats } = await supabase.from('categories').select('*, subcategories(*)').order('name');
      setCategories(cats || []);
      const { data: product } = await supabase.from('products').select('*, subcategories ( id, name, category_id, categories ( id, name ) ), product_images ( id, image_url, display_order )').eq('id', productId).single();
      if (!product) { router.push('/products'); return; }
      const catId = product.subcategories?.categories?.id || '';
      const cat = cats?.find(c => c.id === catId);
      setSubcategories(cat?.subcategories || []);
      setForm({ name: product.name || '', brand: product.brand || 'Brand 2 Brand', description: product.description || '', price: product.price?.toString() || '', originalPrice: product.original_price?.toString() || '', categoryId: catId, subcategoryId: product.subcategory_id || '', gender: product.gender || '', badge: product.badge || '', atmosphereTheme: product.atmosphere_theme || 'default' });
      setSizes(product.sizes || []); setColors(product.colors || []);
      setExistingImages((product.product_images || []).sort((a, b) => a.display_order - b.display_order));
      setLoading(false);
    };
    load();
  }, [productId]);

  useEffect(() => { if (form.categoryId) { const cat = categories.find(c => c.id === form.categoryId); setSubcategories(cat?.subcategories || []); } }, [form.categoryId, categories]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const handleAddSize = (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); const val = sizeInput.trim(); if (val && !sizes.includes(val)) { setSizes(prev => [...prev, val]); setSizeInput(''); } } };
  const handleAddColor = (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); const val = colorInput.trim(); if (val && !colors.includes(val)) { setColors(prev => [...prev, val]); setColorInput(''); } } };
  const handleFilesSelected = (e) => { const files = Array.from(e.target.files); setNewImages(prev => [...prev, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))]); };
  const handleRemoveExisting = (imgId) => { setRemovedImageIds(prev => [...prev, imgId]); setExistingImages(prev => prev.filter(img => img.id !== imgId)); };
  const handleRemoveNew = (index) => { setNewImages(prev => prev.filter((_, i) => i !== index)); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.subcategoryId) { alert('Please fill required fields.'); return; }
    setSaving(true);
    try {
      await supabase.from('products').update({ name: form.name, brand: form.brand || 'Brand 2 Brand', subcategory_id: form.subcategoryId, gender: form.gender || null, price: parseInt(form.price), original_price: form.originalPrice ? parseInt(form.originalPrice) : null, description: form.description || null, sizes, colors, badge: form.badge || null, atmosphere_theme: form.atmosphereTheme || 'default' }).eq('id', productId);
      for (const imgId of removedImageIds) {
        const img = existingImages.find(i => i.id === imgId) || (await supabase.from('product_images').select('image_url').eq('id', imgId).single()).data;
        if (img?.image_url) { try { const url = new URL(img.image_url); const storagePath = url.pathname.split('/storage/v1/object/public/product-images/')[1]; if (storagePath) await supabase.storage.from('product-images').remove([storagePath]); } catch {} }
        await supabase.from('product_images').delete().eq('id', imgId);
      }
      const startOrder = existingImages.length;
      for (let i = 0; i < newImages.length; i++) {
        const img = newImages[i]; const ext = img.file.name.split('.').pop().toLowerCase();
        const storagePath = `products/${productId}/${Date.now()}_${i}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('product-images').upload(storagePath, img.file, { contentType: img.file.type, upsert: true });
        if (uploadErr) { console.error(uploadErr); continue; }
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(storagePath);
        await supabase.from('product_images').insert({ product_id: productId, image_url: urlData.publicUrl, display_order: startOrder + i });
      }
      router.push('/products');
    } catch (err) { alert('Error: ' + err.message); } finally { setSaving(false); }
  };

  if (loading) { return <div className="admin-loading"><span className="admin-spinner" /> Loading product...</div>; }

  return (
    <>
      <div className="admin-page-header">
        <h2>Edit Product</h2>
        <button className="admin-btn admin-btn-secondary" onClick={() => router.back()}>Back</button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="admin-product-grid">
          <div>
            <div className="admin-table-wrapper" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px' }}>Product Details</h3>
              <div className="admin-form-group"><label className="admin-form-label">Product Name *</label><input className="admin-form-input" value={form.name} onChange={(e) => handleChange('name', e.target.value)} required /></div>
              <div className="admin-form-row"><div className="admin-form-group"><label className="admin-form-label">Brand</label><input className="admin-form-input" value={form.brand} onChange={(e) => handleChange('brand', e.target.value)} /></div><div className="admin-form-group"><label className="admin-form-label">Gender</label><select className="admin-form-select" value={form.gender} onChange={(e) => handleChange('gender', e.target.value)}><option value="">None</option><option value="men">Men</option><option value="women">Women</option></select></div></div>
              <div className="admin-form-group"><label className="admin-form-label">Description</label><textarea className="admin-form-textarea" value={form.description} onChange={(e) => handleChange('description', e.target.value)} /></div>
              <div className="admin-form-row"><div className="admin-form-group"><label className="admin-form-label">Price *</label><input type="number" className="admin-form-input" value={form.price} onChange={(e) => handleChange('price', e.target.value)} required /></div><div className="admin-form-group"><label className="admin-form-label">Original Price</label><input type="number" className="admin-form-input" value={form.originalPrice} onChange={(e) => handleChange('originalPrice', e.target.value)} /></div></div>
              <div className="admin-form-row"><div className="admin-form-group"><label className="admin-form-label">Sizes</label><div className="admin-tags">{sizes.map((s, i) => (<span key={i} className="admin-tag">{s}<button type="button" onClick={() => setSizes(prev => prev.filter((_, idx) => idx !== i))}>x</button></span>))}<input value={sizeInput} onChange={(e) => setSizeInput(e.target.value)} onKeyDown={handleAddSize} placeholder="Add size..." /></div></div><div className="admin-form-group"><label className="admin-form-label">Colors</label><div className="admin-tags">{colors.map((c, i) => (<span key={i} className="admin-tag">{c}<button type="button" onClick={() => setColors(prev => prev.filter((_, idx) => idx !== i))}>x</button></span>))}<input value={colorInput} onChange={(e) => setColorInput(e.target.value)} onKeyDown={handleAddColor} placeholder="Add color..." /></div></div></div>
            </div>
            <div className="admin-table-wrapper" style={{ padding: '24px', marginTop: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px' }}>Images</h3>
              {existingImages.length > 0 && (<><p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '12px' }}>Current images:</p><div className="admin-image-preview-grid">{existingImages.map((img, i) => (<div key={img.id} className="admin-image-preview"><img src={img.image_url} alt={`Image ${i+1}`} /><button className="admin-image-preview-remove" type="button" onClick={() => handleRemoveExisting(img.id)}>x</button><div className="admin-image-preview-order">{i+1}</div></div>))}</div></>)}
              <div className="admin-image-upload" style={{ marginTop: '16px' }} onClick={() => fileInputRef.current?.click()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg><p>Click to add more images</p></div>
              <input type="file" ref={fileInputRef} onChange={handleFilesSelected} multiple accept="image/*" style={{ display: 'none' }} />
              {newImages.length > 0 && (<div className="admin-image-preview-grid" style={{ marginTop: '12px' }}>{newImages.map((img, i) => (<div key={i} className="admin-image-preview"><img src={img.preview} alt={`New ${i+1}`} /><button className="admin-image-preview-remove" type="button" onClick={() => handleRemoveNew(i)}>x</button><div className="admin-image-preview-order" style={{ background: 'var(--admin-success)' }}>+{i+1}</div></div>))}</div>)}
            </div>
          </div>
          <div>
            <div className="admin-table-wrapper" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px' }}>Organization</h3>
              <div className="admin-form-group"><label className="admin-form-label">Category *</label><select className="admin-form-select" value={form.categoryId} onChange={(e) => handleChange('categoryId', e.target.value)} required><option value="">Select...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="admin-form-group"><label className="admin-form-label">Subcategory *</label><select className="admin-form-select" value={form.subcategoryId} onChange={(e) => handleChange('subcategoryId', e.target.value)} required disabled={!form.categoryId}><option value="">Select...</option>{subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="admin-form-group"><label className="admin-form-label">Badge</label><select className="admin-form-select" value={form.badge} onChange={(e) => handleChange('badge', e.target.value)}><option value="">None</option><option value="BESTSELLER">Bestseller</option><option value="NEW">New</option><option value="TRENDING">Trending</option><option value="EXCLUSIVE">Exclusive</option></select></div>
              <div className="admin-form-group"><label className="admin-form-label">Atmosphere Theme</label><select className="admin-form-select" value={form.atmosphereTheme} onChange={(e) => handleChange('atmosphereTheme', e.target.value)}><option value="default">Default</option><option value="clothing">Clothing</option><option value="footwear">Footwear</option><option value="accessories">Accessories</option></select></div>
            </div>
            <button type="submit" className="admin-btn admin-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px', marginTop: '20px', fontSize: '14px' }} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      </form>
    </>
  );
}
