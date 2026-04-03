'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminCategoriesPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [addingSubFor, setAddingSubFor] = useState(null);
  const [expanded, setExpanded] = useState({});

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*, subcategories(*)')
      .order('name');
    setCategories(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []);

  const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const { error } = await supabase.from('categories').insert({
      name: newCatName.trim(),
      slug: slugify(newCatName.trim()),
    });
    if (error) { alert(error.message); return; }
    setNewCatName('');
    fetchCategories();
  };

  const handleDeleteCategory = async (id, name) => {
    if (!confirm(`Delete category "${name}" and all its subcategories?`)) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    fetchCategories();
  };

  const handleAddSubcategory = async (e, categoryId) => {
    e.preventDefault();
    if (!newSubName.trim()) return;
    const { error } = await supabase.from('subcategories').insert({
      category_id: categoryId,
      name: newSubName.trim(),
      slug: slugify(newSubName.trim()),
    });
    if (error) { alert(error.message); return; }
    setNewSubName('');
    setAddingSubFor(null);
    fetchCategories();
  };

  const handleDeleteSubcategory = async (id, name) => {
    if (!confirm(`Delete subcategory "${name}"?`)) return;
    const { error } = await supabase.from('subcategories').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    fetchCategories();
  };

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return <div className="admin-loading"><span className="admin-spinner" /> Loading categories...</div>;
  }

  return (
    <>
      <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="admin-form-input"
          placeholder="New category name..."
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          style={{ flex: '1 1 200px', minWidth: '0' }}
          id="new-category-input"
        />
        <button type="submit" className="admin-btn admin-btn-primary" id="add-category-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Category
        </button>
      </form>

      {categories.map((cat) => (
        <div key={cat.id} className="admin-category-card">
          <div className="admin-category-card-header" onClick={() => toggleExpand(cat.id)}>
            <h4>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18"
                style={{ transform: expanded[cat.id] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
              {cat.name}
              <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400, fontSize: '12px' }}>
                ({cat.subcategories?.length || 0} subcategories)
              </span>
            </h4>
            <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
              <button
                className="admin-btn admin-btn-sm admin-btn-secondary"
                onClick={() => { setAddingSubFor(addingSubFor === cat.id ? null : cat.id); setNewSubName(''); }}
              >
                + Sub
              </button>
              <button
                className="admin-btn admin-btn-sm admin-btn-danger"
                onClick={() => handleDeleteCategory(cat.id, cat.name)}
              >
                Delete
              </button>
            </div>
          </div>

          {expanded[cat.id] && (
            <div className="admin-category-card-content">
              {addingSubFor === cat.id && (
                <form onSubmit={(e) => handleAddSubcategory(e, cat.id)} style={{ display: 'flex', gap: '8px', marginBottom: '12px', paddingTop: '12px' }}>
                  <input
                    type="text"
                    className="admin-form-input"
                    placeholder="Subcategory name..."
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="admin-btn admin-btn-sm admin-btn-primary">Add</button>
                  <button type="button" className="admin-btn admin-btn-sm admin-btn-secondary" onClick={() => setAddingSubFor(null)}>Cancel</button>
                </form>
              )}

              {cat.subcategories?.length === 0 ? (
                <p style={{ color: 'var(--admin-text-muted)', padding: '12px 0', fontSize: '13px' }}>
                  No subcategories yet.
                </p>
              ) : (
                cat.subcategories?.map((sub) => (
                  <div key={sub.id} className="admin-subcategory-item">
                    <div>
                      <span>{sub.name}</span>
                      <span style={{ color: 'var(--admin-text-muted)', marginLeft: '8px', fontSize: '11px' }}>
                        /{sub.slug}
                      </span>
                    </div>
                    <button
                      className="admin-btn admin-btn-sm admin-btn-danger"
                      onClick={() => handleDeleteSubcategory(sub.id, sub.name)}
                    >
                      x
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}

      {categories.length === 0 && (
        <div className="admin-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <p>No categories yet. Create your first category above.</p>
        </div>
      )}
    </>
  );
}
