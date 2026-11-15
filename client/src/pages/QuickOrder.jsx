import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useCart } from '../cart.jsx';
import { useToast } from '../toast.jsx';
import { colorName, money2, spreadPack } from '../lib.js';

// Quick order: paste or upload SKU lines (sku, qty[, size, colour]) → matched to live products → added to the cart together.
// Prices, tiers, MOQ, stock and GST are NOT computed here — the cart is priced and validated by the server.
const TEMPLATE = 'sku,qty,size,color\nTBB-MEN-00001,120,M,#111111\nTBB-MEN-00002,300,,\n';

// Minimal CSV/TSV/“sku qty” parser: tolerates quotes, header row, commas, tabs, semicolons or spaces.
export function parseLines(text) {
  const rows = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    const cells = line.split(/[,\t;]|\s{2,}|\s(?=\d+\s*$)/).map(c => c.replace(/^"|"$/g, '').trim());
    if (/^sku$/i.test(cells[0])) continue; // header
    const qty = Math.trunc(Number(cells[1]));
    rows.push({ sku: (cells[0] || '').toUpperCase(), qty: Number.isFinite(qty) ? qty : 0, size: cells[2] || '', color: cells[3] || '', raw: line });
  }
  return rows.slice(0, 500);
}

export default function QuickOrder() {
  const { addLines } = useCart(), toast = useToast();
  const [text, setText] = useState(''), [res, setRes] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const rows = useMemo(() => parseLines(text), [text]);

  const check = async () => {
    setErr(''); setBusy(true);
    try {
      const skus = [...new Set(rows.map(r => r.sku).filter(Boolean))];
      const found = skus.length ? await api('/products/by-sku?skus=' + encodeURIComponent(skus.join(','))) : [];
      const bySku = Object.fromEntries(found.map(p => [p.sku.toUpperCase(), p]));
      setRes(rows.map(r => {
        const p = bySku[r.sku]; if (!p) return { ...r, error: r.sku ? 'SKU not found' : 'Missing SKU' };
        if (r.qty < 1) return { ...r, p, error: 'Enter a quantity of 1 or more' };
        const sizes = p.size_options?.length ? p.size_options : ['Free size'], colors = p.colors?.length ? p.colors : [''];
        let color = colors[0];
        if (r.color) { const m = colors.find(c => c.toLowerCase() === r.color.toLowerCase() || colorName(c).toLowerCase() === r.color.toLowerCase()); if (!m) return { ...r, p, error: `Colour “${r.color}” is not available` }; color = m; }
        let lines;
        if (r.size) { const s = sizes.find(x => x.toLowerCase() === r.size.toLowerCase()); if (!s) return { ...r, p, error: `Size “${r.size}” is not available (${sizes.join(', ')})` }; lines = [{ size: s, color, qty: r.qty }]; }
        else lines = spreadPack(r.qty, sizes, color); // no size given → spread the quantity across the size range
        return { ...r, p, lines, note: r.size ? '' : 'Spread across sizes' };
      }));
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const ok = (res || []).filter(r => !r.error), bad = (res || []).filter(r => r.error);
  const addAll = () => {
    ok.forEach(r => addLines(r.p, r.lines, { openDrawer: false }));
    toast(`${ok.reduce((s, r) => s + r.qty, 0)} pcs from ${ok.length} line(s) added — prices & MOQ are checked in your cart`);
    setRes(bad.length ? bad : null); if (!bad.length) setText('');
  };
  const onFile = async e => { const f = e.target.files[0]; if (!f) return; if (f.size > 1e6) return setErr('File too large (max 1 MB)'); setText(await f.text()); setRes(null); e.target.value = ''; };
  const template = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' })); a.download = 'quick-order-template.csv'; a.click(); URL.revokeObjectURL(a.href); };

  return <section className="section"><div className="container" style={{ maxWidth: 980 }}>
    <p className="eyebrow">Wholesale procurement</p><h1 className="display h-lg" style={{ margin: '10px 0 8px' }}>Quick order</h1>
    <p className="lead" style={{ marginBottom: 26 }}>Already know your SKUs? Paste them below or upload a CSV — one line per SKU: <code>sku, qty, size, colour</code>. Size and colour are optional.</p>
    <div className="form card-box">
      <label>Order lines<textarea rows="8" value={text} onChange={e => { setText(e.target.value); setRes(null); }} placeholder={'TBB-MEN-00001, 120, M, #111111\nTBB-MEN-00002, 300'} spellCheck="false" style={{ fontFamily: 'ui-monospace, monospace' }} /></label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn" type="button" onClick={check} disabled={busy || !rows.length}>{busy ? 'Checking…' : `Check ${rows.length || ''} line${rows.length === 1 ? '' : 's'}`}</button>
        <label className="btn ghost" style={{ cursor: 'pointer', margin: 0 }}>Upload CSV<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onFile} hidden /></label>
        <button className="link" type="button" onClick={template}>Download template</button></div>
      <div className="form-err" role="alert">{err}</div></div>
    {res && <div style={{ marginTop: 28 }}>
      {ok.length > 0 && <><h2 className="display h-md" style={{ marginBottom: 12 }}>Ready to add ({ok.length})</h2>
        <div className="tblwrap"><table className="tbl"><thead><tr><th>SKU</th><th>Product</th><th>Qty</th><th>Variant</th><th>MOQ</th><th>Wholesale price</th></tr></thead><tbody>{ok.map((r, i) => <tr key={i}><td>{r.p.sku}</td><td><Link to={'/product?p=' + r.p.slug}>{r.p.name}</Link></td><td>{r.qty}</td>
          <td>{r.lines.length === 1 ? [r.lines[0].color && colorName(r.lines[0].color), r.lines[0].size].filter(Boolean).join(' · ') : r.note}</td><td>{r.p.moq}{r.qty < r.p.moq && <small style={{ color: '#a35' }}>below MOQ — retail price applies</small>}</td><td>{money2(r.p.price_min)}–{money2(r.p.price_max)}</td></tr>)}</tbody></table></div>
        <button className="btn" style={{ marginTop: 16 }} onClick={addAll}>Add {ok.length} line{ok.length === 1 ? '' : 's'} to cart</button></>}
      {bad.length > 0 && <><h2 className="display h-md" style={{ margin: '28px 0 12px', color: '#a33' }}>Needs attention ({bad.length})</h2>
        <ul style={{ display: 'grid', gap: 8 }}>{bad.map((r, i) => <li key={i} className="notice" style={{ margin: 0 }}><b>{r.raw}</b> — {r.error}</li>)}</ul></>}</div>}
  </div></section>;
}
