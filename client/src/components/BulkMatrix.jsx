import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { useToast } from '../toast.jsx';
import { colorName, money2, openSpecSheet, spreadPack } from '../lib.js';
import * as Ic from './icons.jsx';
import { m } from './motion.jsx';

// The core wholesale experience: a size × colour quantity grid with live tier pricing, GST and MOQ/stock validation.
export default function BulkMatrix({ p, compact, initialQty = 0, onTotals, apiRef }) {
  const nav = useNavigate(), toast = useToast(), { user } = useAuth(), { addLines } = useCart();
  const sizes = p.size_options?.length ? p.size_options : ['Free size'], colors = p.colors?.length ? p.colors : [''];
  const [q, setQ] = useState({}), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const k = (c, s) => c + '|' + s;
  useEffect(() => { setQ(initialQty > 0 ? Object.fromEntries(spreadPack(initialQty, sizes, colors[0]).map(l => [k(l.color, l.size), l.qty])) : {}); }, [p.id]); // eslint-disable-line
  const lines = useMemo(() => colors.flatMap(c => sizes.map(s => ({ color: c, size: s, qty: Math.max(0, Math.trunc(Number(q[k(c, s)]) || 0)) }))).filter(l => l.qty > 0), [q, colors, sizes]);
  const total = lines.reduce((s, l) => s + l.qty, 0), items = lines.length;
  const tiers = p.price_tiers || [], wholesale = total >= p.moq, tier = wholesale ? [...tiers].reverse().find(t => total >= t.min_qty) : null;
  const unit = wholesale ? tier.price : p.retail_price, base = tiers[0]?.price ?? unit, taxable = unit * total, gst = taxable * (p.gst_rate || 0) / 100;
  const bulk = wholesale ? (base - unit) * total : 0, mrpSave = Math.max(0, p.mrp - unit) * total;
  const overStock = p.stock_qty > 0 && total > p.stock_qty;
  useEffect(() => { onTotals?.({ total, unit, wholesale }); }, [total, unit, wholesale]); // eslint-disable-line
  const set = (c, s, v) => { setErr(''); setQ(o => ({ ...o, [k(c, s)]: v === '' ? '' : Math.max(0, Math.min(100000, Math.trunc(+v) || 0)) })); };
  const rowTotal = c => sizes.reduce((s, z) => s + (+q[k(c, z)] || 0), 0), colTotal = s => colors.reduce((a, c) => a + (+q[k(c, s)] || 0), 0);
  const need = () => { if (!total) { setErr('Enter a quantity in at least one size and colour.'); return false; } if (overStock) { setErr(`Only ${p.stock_qty} pcs are in stock.`); return false; } return true; };
  const add = () => { if (!need()) return; addLines(p, lines); toast(`${total} pcs added to cart`); };
  const buy = () => { if (!need()) return; if (!wholesale) { setErr(`Bulk purchase needs at least ${p.moq} pcs (you have ${total}). Add ${p.moq - total} more, or use Add to cart for retail pricing.`); return; } addLines(p, lines, { openDrawer: false }); nav('/checkout'); };
  const quote = async () => {
    if (!user) return nav('/login?next=' + encodeURIComponent(`/product?p=${p.slug}`));
    if (user.role !== 'buyer') return setErr('Quotations can be requested from a buyer account.');
    if (!total) return setErr('Enter the quantities you would like quoted.');
    setBusy(true); try { await api('/rfqs', { method: 'POST', body: { productId: p.id, quantity: total, notes: 'Variants: ' + lines.map(l => [l.color && colorName(l.color), l.size, '×' + l.qty].filter(Boolean).join(' ')).join(', ') } }); toast('Quotation requested — manufacturers will respond'); nav('/dashboard/quotations'); } catch (e) { setErr(e.message); } setBusy(false);
  };
  if (apiRef) apiRef.current = { add, total };
  const fillMoq = () => { setErr(''); setQ(Object.fromEntries(spreadPack(p.moq, sizes, colors[0]).map(l => [k(l.color, l.size), l.qty]))); };

  return <div className="grid-gap" style={{ display: 'grid', gap: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}><p className="label">Enter quantities by colour &amp; size</p>
      <span style={{ display: 'flex', gap: 16 }}><button className="link" onClick={fillMoq}>Fill MOQ pack</button>{total > 0 && <button className="link" style={{ color: 'var(--mute)' }} onClick={() => setQ({})}>Clear</button>}</span></div>
    <div className="mx-wrap"><table className="mx"><thead><tr><th>Colour</th>{sizes.map(s => <th key={s}>{s}</th>)}<th>Total</th></tr></thead>
      <tbody>{colors.map(c => <tr key={c || 'x'}><td><span className="cname">{c && <i style={{ background: c }} />}{c ? colorName(c) : 'Standard'}</span></td>
        {sizes.map(s => <td key={s}><input inputMode="numeric" type="number" min="0" className={+q[k(c, s)] > 0 ? 'has' : ''} value={q[k(c, s)] ?? ''} placeholder="0" aria-label={`${c ? colorName(c) : ''} ${s} quantity`} onChange={e => set(c, s, e.target.value)} /></td>)}
        <td className="tot num">{rowTotal(c) || '—'}</td></tr>)}</tbody>
      <tfoot><tr><td>Total</td>{sizes.map(s => <td key={s} className="num">{colTotal(s) || '—'}</td>)}<td className="num">{total || '—'}</td></tr></tfoot></table></div>

    <div className="tierbar" aria-label="Bulk price tiers">{[{ min_qty: 1, price: p.retail_price, retail: true }, ...tiers].map((t, i, a) => { const on = t.retail ? !wholesale : tier === t || tier?.min_qty === t.min_qty; return <m.div key={i} className={on ? 'on' : ''} layout><small>{t.retail ? `1–${p.moq - 1} pcs` : `${t.min_qty}${i === a.length - 1 ? '+' : '–' + (a[i + 1].min_qty - 1)} pcs`}</small><b className="num">${t.price}</b></m.div>; })}</div>

    {total > 0 && !wholesale && <div className="notice warn">Add <b>{p.moq - total}</b> more pcs to unlock wholesale pricing — {money2(tiers[0]?.price)} vs {money2(p.retail_price)} retail per piece (MOQ {p.moq}).</div>}
    {wholesale && <div className="notice ok"><Ic.Check width="14" style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Wholesale pricing applied — {tier.min_qty}+ pcs tier.</div>}
    {p.stock_qty > 0 ? <p className={'stock ' + (overStock ? '' : 'in')} style={overStock ? { color: 'var(--err)' } : undefined}>{overStock ? `Only ${p.stock_qty} pcs in stock` : `In stock · ${p.stock_qty.toLocaleString('en-US')} pcs ready`}{p.stock_qty < p.moq && ' (below MOQ — retail quantities only)'}</p> : <p className="stock mto">Made to order · lead time {p.lead_days} days</p>}

    <div className="pbox" style={{ background: 'var(--bg)' }}><div className="sumbox">
      <div><span>Total quantity</span><b className="num">{total.toLocaleString('en-US')} pcs</b></div><div><span>Total items (variants)</span><span className="num">{items}</span></div>
      <div><span>Price per unit {wholesale ? '(tier)' : '(retail)'}</span><span className="num">{money2(unit)}</span></div>
      <div><span>Subtotal</span><span className="num">{money2(taxable)}</span></div>
      {bulk > 0 && <div className="save"><span>Bulk discount</span><span className="num">− {money2(bulk)}</span></div>}
      <div><span>GST ({p.gst_rate}%)</span><span className="num">{money2(gst)}</span></div>
      <div className="grand"><span>Grand total</span><span className="num">{money2(taxable + gst)}</span></div>
      {mrpSave > 0 && <p className="mute" style={{ fontSize: 12 }}>You save {money2(mrpSave)} against MRP {money2(p.mrp)}/pc.</p>}</div></div>

    <div className="form-err" role="alert">{err}</div>
    <div className="acts"><button className="btn block" onClick={add}>Add all selected variants to cart</button>
      {!compact && <><div className="two"><button className="btn ghost block" onClick={buy}>Buy in bulk</button><button className="btn ghost block" disabled={busy} onClick={quote}>Request quotation</button></div>
        <button className="link" style={{ justifySelf: 'start', display: 'inline-flex', gap: 8, alignItems: 'center' }} onClick={() => !openSpecSheet(p) && toast('Allow pop-ups to download the spec sheet')}><Ic.Download width="14" />Download product details</button></>}</div>
  </div>;
}
