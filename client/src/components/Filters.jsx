import { useState } from 'react';
import { colorName, money } from '../lib.js';
import * as Ic from './icons.jsx';

export const getList = (p, k) => (p.get(k) || '').split(',').filter(Boolean);
export const FILTER_KEYS = ['gender', 'age', 'brand', 'seller', 'minPrice', 'maxPrice', 'maxMoq', 'stock', 'color', 'size', 'fabric', 'gst', 'discount'];

function Group({ title, children, open: o = true }) {
  const [open, setOpen] = useState(o);
  return <div className="fgroup"><button onClick={() => setOpen(x => !x)} aria-expanded={open}>{title}<Ic.Down width="14" style={{ transform: open ? 'rotate(180deg)' : '', transition: '.25s' }} /></button>{open && <div className="body">{children}</div>}</div>;
}
const Check = ({ checked, onChange, label, n, type = 'checkbox', name }) => <label className="fopt"><input type={type} name={name} checked={checked} onChange={onChange} />{label}{n != null && <span className="n">{n}</span>}</label>;

// Sidebar / drawer filters. `params` is a URLSearchParams; `set(next)` replaces it.
export default function Filters({ params, set, facets, nodes }) {
  const up = (k, v) => { const n = new URLSearchParams(params); v === '' || v == null ? n.delete(k) : n.set(k, v); if (k === 'cat') n.delete('sub'); set(n); };
  const toggle = (k, v) => { const l = getList(params, k), nx = l.includes(v) ? l.filter(x => x !== v) : [...l, v]; up(k, nx.join(',')); };
  const cat = params.get('cat') || '', sub = params.get('sub') || '', cats = (nodes || []).filter(n => n.level === 1), types = (nodes || []).filter(n => n.parent_id === cat && n.count > 0);
  const f = facets || {}, list = (arr, k, label = o => o.v) => (arr || []).map(o => <Check key={o.v} checked={getList(params, k).includes(String(o.v))} onChange={() => toggle(k, String(o.v))} label={label(o)} n={o.n} />);
  const [lo, setLo] = useState(params.get('minPrice') || ''), [hi, setHi] = useState(params.get('maxPrice') || '');
  const applyPrice = () => { const n = new URLSearchParams(params); lo ? n.set('minPrice', lo) : n.delete('minPrice'); hi ? n.set('maxPrice', hi) : n.delete('maxPrice'); set(n); };
  return <div>
    <Group title="Category">
      <label className="fopt"><input type="radio" name="cat" checked={!cat} onChange={() => up('cat', '')} />All categories</label>
      {cats.map(c => <label key={c.id} className={'fopt' + (cat === c.id ? ' sel' : '')}><input type="radio" name="cat" checked={cat === c.id} onChange={() => up('cat', c.id)} />{c.name}<span className="n">{c.count}</span></label>)}</Group>
    {cat && <Group title="Subcategory">
      <label className="fopt"><input type="radio" name="sub" checked={!sub} onChange={() => up('sub', '')} />All types</label>
      {types.length ? types.map(t => <label key={t.id} className={'fopt' + (sub === t.id ? ' sel' : '')}><input type="radio" name="sub" checked={sub === t.id} onChange={() => up('sub', t.id)} />{t.name}<span className="n">{t.count}</span></label>) : <p className="mute" style={{ fontSize: 12.5 }}>No styles listed under a specific type yet.</p>}</Group>}
    {f.gender?.length > 0 && <Group title="Gender">{list(f.gender, 'gender')}</Group>}
    {f.age?.length > 0 && <Group title="Age group">{list(f.age, 'age')}</Group>}
    {f.brand?.length > 0 && <Group title="Brand">{list(f.brand, 'brand')}</Group>}
    {f.manufacturer?.length > 0 && <Group title="Manufacturer">{list(f.manufacturer, 'seller', o => o.label || 'Manufacturer')}</Group>}
    <Group title="Wholesale price (₹/pc)"><div className="range"><input type="number" min="0" placeholder={f.price?.min ?? 'Min'} value={lo} onChange={e => setLo(e.target.value)} aria-label="Minimum price" /><span>–</span><input type="number" min="0" placeholder={f.price?.max ?? 'Max'} value={hi} onChange={e => setHi(e.target.value)} aria-label="Maximum price" /></div><button className="btn sm ghost" onClick={applyPrice}>Apply</button></Group>
    <Group title="Minimum order quantity"><select value={params.get('maxMoq') || ''} onChange={e => up('maxMoq', e.target.value)} aria-label="Max MOQ"><option value="">Any MOQ</option>{[50, 100, 200, 300, 500].map(v => <option key={v} value={v}>Up to {v} pcs</option>)}</select></Group>
    <Group title="Available stock">{[['', 'Any'], ['in', 'Ready stock'], ['mto', 'Made to order']].map(([v, l]) => <Check key={v} type="radio" name="stock" checked={(params.get('stock') || '') === v} onChange={() => up('stock', v)} label={l} />)}</Group>
    {f.color?.length > 0 && <Group title="Colour"><div className="cdots">{f.color.map(c => <button key={c.v} className={'cdot' + (getList(params, 'color').includes(c.v) ? ' on' : '')} style={{ background: c.v }} title={`${colorName(c.v)} (${c.n})`} aria-label={colorName(c.v)} aria-pressed={getList(params, 'color').includes(c.v)} onClick={() => toggle('color', c.v)} />)}</div></Group>}
    {f.size?.length > 0 && <Group title="Size"><div className="sizechips">{f.size.map(s => <button key={s.v} className={getList(params, 'size').includes(s.v) ? 'on' : ''} onClick={() => toggle('size', s.v)}>{s.v}</button>)}</div></Group>}
    {f.fabric?.length > 0 && <Group title="Fabric & material" open={false}>{list(f.fabric, 'fabric')}</Group>}
    {f.gst?.length > 0 && <Group title="GST" open={false}>{list(f.gst, 'gst', o => o.v + '%')}</Group>}
    <Group title="Discount vs MRP" open={false}>{[['', 'Any'], ['25', '25% or more'], ['50', '50% or more'], ['60', '60% or more']].map(([v, l]) => <Check key={v} type="radio" name="disc" checked={(params.get('discount') || '') === v} onChange={() => up('discount', v)} label={l} />)}</Group>
  </div>;
}

// Active filter chips (removable)
export function ActiveChips({ params, set, nodes, facets }) {
  const chips = [], rm = (k, v) => { const n = new URLSearchParams(params); if (v == null) n.delete(k); else { const l = getList(params, k).filter(x => x !== v); l.length ? n.set(k, l.join(',')) : n.delete(k); } set(n); };
  const name = id => (nodes || []).find(n => n.id === id)?.name || id;
  if (params.get('cat')) chips.push([name(params.get('cat')), () => rm('cat')]);
  if (params.get('sub')) chips.push([name(params.get('sub')), () => rm('sub')]);
  if (params.get('subs')) chips.push([params.get('label') || 'Selected types', () => { const n = new URLSearchParams(params); n.delete('subs'); n.delete('label'); set(n); }]);
  if (params.get('q')) chips.push([`“${params.get('q')}”`, () => rm('q')]);
  ['gender', 'age', 'brand', 'size', 'fabric'].forEach(k => getList(params, k).forEach(v => chips.push([v, () => rm(k, v)])));
  getList(params, 'color').forEach(v => chips.push([colorName(v), () => rm('color', v)]));
  getList(params, 'seller').forEach(v => chips.push([facets?.manufacturer?.find(m => String(m.v) === v)?.label || 'Manufacturer', () => rm('seller', v)]));
  getList(params, 'gst').forEach(v => chips.push(['GST ' + v + '%', () => rm('gst', v)]));
  if (params.get('minPrice') || params.get('maxPrice')) chips.push([`${money(params.get('minPrice') || 0)} – ${params.get('maxPrice') ? money(params.get('maxPrice')) : 'any'}`, () => { const n = new URLSearchParams(params); n.delete('minPrice'); n.delete('maxPrice'); set(n); }]);
  if (params.get('maxMoq')) chips.push(['MOQ ≤ ' + params.get('maxMoq'), () => rm('maxMoq')]);
  if (params.get('stock')) chips.push([params.get('stock') === 'in' ? 'Ready stock' : 'Made to order', () => rm('stock')]);
  if (params.get('discount')) chips.push([params.get('discount') + '%+ off', () => rm('discount')]);
  if (!chips.length) return null;
  return <div className="chips">{chips.map(([l, fn], i) => <button className="chip" key={i} onClick={fn} aria-label={`Remove filter ${l}`}>{l}<Ic.Close width="12" /></button>)}<button className="link" onClick={() => { const n = new URLSearchParams(); if (params.get('sort')) n.set('sort', params.get('sort')); set(n); }}>Clear all</button></div>;
}
