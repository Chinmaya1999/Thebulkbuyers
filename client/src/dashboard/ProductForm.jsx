import { useState } from 'react';
import { api } from '../api.js';
import { useAsync, useCategories } from '../hooks.js';
import { img, GENDERS, AGES, SEASONS } from '../lib.js';
import { Modal } from './ui.jsx';

// Full product editor for the admin: every catalogue attribute, photos, supplier, status and featured flag.
export default function ProductForm({ id, onClose, onSaved }) {
  const existing = useAsync(() => (id ? api('/admin/products/' + id) : Promise.resolve({})), [id]);
  const users = useAsync(() => api('/admin/users'));
  if (!existing.data || !users.data) return <Modal title={id ? 'Edit product' : 'Add product'} onClose={onClose}><p className="muted">Loading…</p></Modal>;
  return <Form id={id} p={existing.data} suppliers={users.data.filter(u => u.role === 'seller' || u.role === 'admin')} onClose={onClose} onSaved={onSaved} />;
}

function Form({ id, p, suppliers, onClose, onSaved }) {
  const { tree, data: nodes } = useCategories();
  const [err, setErr] = useState(''), [image, setImage] = useState(p.image || ''), [gallery, setGallery] = useState(p.gallery || []), [cat, setCat] = useState(p.category || ''), [busy, setBusy] = useState(false);
  const types = (nodes || []).filter(n => n.parent_id === cat);
  const push = async file => { const fd = new FormData(); fd.append('image', file); return (await api('/admin/upload', { method: 'POST', body: fd })).url; };
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    const body = { ...Object.fromEntries(new FormData(e.target)), image, gallery, featured: e.target.featured.checked };
    try { await api(id ? '/admin/products/' + id : '/admin/products', { method: id ? 'PUT' : 'POST', body }); onSaved(); } catch (er) { setErr(er.message); setBusy(false); }
  };
  const opts = arr => arr.map(x => <option key={x} value={x}>{x}</option>);
  return <Modal title={id ? 'Edit product' : 'Add product'} onClose={onClose}><form className="form" onSubmit={submit}>
    <label>Product name<input name="name" required maxLength={120} defaultValue={p.name || ''} /></label>
    <div className="row2"><label>Supplier / manufacturer<select name="seller_id" defaultValue={p.seller_id || ''}><option value="">Our own stock (admin)</option>{suppliers.filter(s => s.role === 'seller').map(s => <option key={s.id} value={s.id}>{s.company || s.name}</option>)}</select></label>
      <label>Listing status<select name="status" defaultValue={p.status || 'approved'}><option value="approved">Live</option><option value="pending">Draft / pending</option><option value="rejected">Hidden</option></select></label></div>
    <div className="row2"><label>Category<select name="category" required value={cat} onChange={e => setCat(e.target.value)}><option value="">Select…</option>{tree.map(g => <optgroup key={g.id} label={g.name}>{g.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}</select></label>
      <label>Product type<select name="subcategory" key={cat} defaultValue={p.category === cat ? p.subcategory || '' : ''}><option value="">— any —</option>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>
    <div className="row2"><label>Brand<input name="brand" maxLength={60} defaultValue={p.brand || ''} placeholder="Private label if blank" /></label><label>Gender<select name="gender" defaultValue={p.gender || ''}><option value="">—</option>{opts(GENDERS)}</select></label></div>
    <div className="row2"><label>Age group<select name="age_group" defaultValue={p.age_group || ''}><option value="">—</option>{opts(AGES)}</select></label><label>Season<select name="season" defaultValue={p.season || ''}><option value="">—</option>{opts(SEASONS)}</select></label></div>
    <div className="row2"><label>Fabric / material<input name="fabric" defaultValue={p.fabric || ''} placeholder="100% Combed Cotton" /></label><label>Pattern<input name="pattern" defaultValue={p.pattern || ''} placeholder="Solid, Printed, Check…" /></label></div>
    <div className="row2"><label>GSM<input name="gsm" type="number" min="0" defaultValue={p.gsm || ''} /></label><label>Fit<input name="fit" defaultValue={p.fit || ''} placeholder="Regular" /></label></div>
    <div className="row2"><label>Sizes<input name="sizes" defaultValue={p.sizes || 'S–3XL'} placeholder="S–3XL · UK 6–11 · 2Y–10Y · Free size" /></label><label>Colours (hex, comma separated)<input name="colors" defaultValue={(p.colors || []).join(', ')} placeholder="#111111, #1f3a5f" /></label></div>
    <div className="row2"><label>Min. order qty (wholesale)<input name="moq" type="number" min="1" required defaultValue={p.moq || 300} /></label><label>Lead time (days)<input name="lead_days" type="number" min="1" defaultValue={p.lead_days || 30} /></label></div>
    <div className="row2"><label>Wholesale price min (₹/pc)<input name="price_min" type="number" min="1" step="any" required defaultValue={p.price_min || ''} /></label><label>Wholesale price max (₹/pc)<input name="price_max" type="number" min="1" step="any" required defaultValue={p.price_max || ''} /></label></div>
    <div className="row2"><label>Selling price — retail (₹/pc)<input name="retail_price" type="number" min="1" step="any" defaultValue={p.retail_price || ''} placeholder="Blank = auto (≈ 2.2× max wholesale)" /></label><label>Purchase price (₹/pc) — private<input name="purchase_price" type="number" min="0" step="any" defaultValue={p.purchase_price || ''} /></label></div>
    <div className="row2"><label>Stock quantity (0 = made to order)<input name="stock_qty" type="number" min="0" defaultValue={p.stock_qty || 0} /></label><label>HSN code<input name="hsn_code" maxLength={12} defaultValue={p.hsn_code || ''} placeholder="e.g. 6109" /></label></div>
    <div className="row2"><label>GST rate (%)<input name="gst_rate" type="number" min="0" max="28" step="0.5" defaultValue={p.gst_rate ?? 5} /></label><label>SKU<input name="sku" maxLength={40} defaultValue={p.sku || ''} placeholder="Auto-generated if blank" /></label></div>
    <label>Barcode (EAN / UPC)<input name="barcode" maxLength={20} defaultValue={p.barcode || ''} /></label>
    <label>Description<textarea name="description" rows="3" maxLength={2000} defaultValue={p.description || ''} /></label>
    <label>Main photo (JPG, PNG or WebP, max 5MB)<div className="upl">{image && <span style={{ position: 'relative' }}><img src={img(image, 200)} alt="" /><button type="button" className="rm" style={{ position: 'absolute', top: 2, right: 2, background: '#fff', padding: '1px 6px' }} onClick={() => setImage('')}>×</button></span>}
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={async e => { const f = e.target.files[0]; if (!f) return; try { setImage(await push(f)); setErr(''); } catch (er) { setErr(er.message); } e.target.value = ''; }} /></div></label>
    <label>Additional photos (up to 4)<div className="upl">{gallery.map(u => <span key={u} style={{ position: 'relative' }}><img src={img(u, 160)} alt="" /><button type="button" className="rm" style={{ position: 'absolute', top: 2, right: 2, background: '#fff', padding: '1px 6px' }} onClick={() => setGallery(g => g.filter(x => x !== u))}>×</button></span>)}
      {gallery.length < 4 && <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={async e => { for (const f of [...e.target.files].slice(0, 4 - gallery.length)) { try { const u = await push(f); setGallery(g => [...g, u].slice(0, 4)); } catch (er) { setErr(er.message); } } e.target.value = ''; }} />}</div></label>
    <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}><input type="checkbox" name="featured" defaultChecked={!!p.featured} style={{ width: 'auto' }} /> Feature on the storefront</label>
    <div className="form-err" role="alert">{err}</div><button className="btn btn-primary" type="submit" disabled={busy}>{id ? 'Save changes' : 'Add product'}</button></form></Modal>;
}
