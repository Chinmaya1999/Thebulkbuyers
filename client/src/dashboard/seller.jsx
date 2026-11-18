import { useState } from 'react';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { colorName, compact, dt, img, mon, money, num } from '../lib.js';
import { Banner, Bars, Empty, Fail, Greet, HBars, Kpi, Loading, Modal, Pill, Table, useAct } from './ui.jsx';
import ProductForm from './ProductForm.jsx';

const View = ({ r, children }) => r.loading && !r.data ? <Loading /> : r.error ? <Fail error={r.error} /> : children(r.data);
const first = u => (u.company || u.name).split(' ')[0];
const NEXT = { confirmed: ['in_production', 'Start production'], in_production: ['quality_check', 'Send to QC'], quality_check: ['shipped', 'Mark shipped'] };

/* ---------- overview ---------- */
export function SellerOverview({ user }) {
  const r = useAsync(() => api('/seller/summary'));
  return <View r={r}>{d => <>
    <Greet name={first(user)} sub="Your catalogue, orders and earnings at a glance." />
    {d.status !== 'active' && <Banner>Your supplier account is <b>{d.status}</b>. You can prepare your catalogue now; our team will activate your account and approve your listings.</Banner>}
    {d.open_rfqs > 0 && <Banner><b>{d.open_rfqs}</b> open quotation request(s) you haven’t quoted on yet.</Banner>}
    <div className="kpis">
      <Kpi label="Live products" value={d.products.live} sub={`${d.products.pending} awaiting approval`} />
      <Kpi label="Orders" value={d.orders.orders} sub={`${d.orders.active} in progress`} />
      <Kpi label="Sales" value={compact(d.orders.sales)} sub="taxable order value" />
      <Kpi label="Your earnings" value={compact(d.orders.net)} sub="after platform commission" />
      <Kpi label="Payout due" value={money(d.orders.payout_due)} sub="delivered, not yet paid" />
      <Kpi label="Paid out" value={money(d.orders.paid_out)} sub="received" /></div>
    <div className="g2 charts"><div className="dcard"><h3>Sales by month</h3><div className="sub">Taxable value</div><Bars data={d.months.map(x => ({ l: mon(x.m), v: x.v }))} /></div>
      <div className="dcard"><h3>Top products</h3><div className="sub">By sales value</div><HBars rows={d.top.map(t => ({ l: t.title, v: t.v }))} /></div></div></>}</View>;
}

/* ---------- products ---------- */
export function SellerProducts({ user }) {
  const r = useAsync(() => api('/seller/products')), act = useAct(r.reload), [edit, setEdit] = useState(null), [q, setQ] = useState('');
  return <View r={r}>{all => { const ps = all.filter(p => !q || (p.name + (p.sku || '')).toLowerCase().includes(q.toLowerCase())); return <>
    <Greet name={first(user)} sub={`${all.length} products · new listings go live after admin approval.`} action={<button className="btn btn-primary btn-sm" onClick={() => setEdit({})}>+ Add product</button>} />
    <div className="tools"><input type="search" placeholder="Search name or SKU…" value={q} onChange={e => setQ(e.target.value)} /></div>
    <Table cols={['Product', 'MOQ', 'Price', 'Stock', 'Views', 'Status', '']} count={ps.length} empty="No products yet — add your first one.">{ps.map(p => <tr key={p.id}>
      <td><div className="who"><img className="thumb" src={img(p.image, 120)} alt="" /><div>{p.status === 'approved' ? <a href={'/product?p=' + p.slug} target="_blank" rel="noreferrer">{p.name}</a> : p.name}<small>{[p.sku, p.category].filter(Boolean).join(' · ')}</small></div></div></td>
      <td>{num(p.moq)}</td><td>{money(p.price_min)}–{money(p.price_max)}</td><td>{p.stock_qty || 'MTO'}</td><td>{p.views}</td><td><Pill s={p.status === 'approved' ? 'live' : p.status === 'rejected' ? 'hidden' : 'pending'} /></td>
      <td><div className="act"><button className="b p" onClick={() => setEdit({ id: p.id })}>Edit</button>
        <button className="b d" onClick={() => confirm('Delete this product permanently?') && act(() => api('/seller/products/' + p.id, { method: 'DELETE' }), 'Deleted')}>Delete</button></div></td></tr>)}</Table>
    {edit && <ProductForm seller id={edit.id} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); r.reload(); }} />}</>; }}</View>;
}

/* ---------- orders ---------- */
function OrderModal({ o, onClose, onSaved }) {
  const act = useAct(onSaved), [trk, setTrk] = useState(o.tracking_no || '');
  const step = NEXT[o.status];
  return <Modal title={`Order #${o.id}`} onClose={onClose}>
    <p><b style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>{o.title}</b><br /><span className="mute">{o.buyer_company || o.buyer_name} · {o.destination || 'No destination'} · {dt(o.created_at)}</span></p>
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '12px 0' }}><span><b>{num(o.quantity)}</b> pcs × {money(o.unit_price)}</span><span>Value <b>{money(o.total)}</b></span><span>Platform fee <b>{money(o.commission)}</b></span><span>Your earnings <b>{money(o.total - o.commission)}</b></span><Pill s={o.status} /></div>
    {o.lines?.length > 0 && <div className="tblwrap" style={{ marginBottom: 14 }}><table className="tbl" style={{ minWidth: 0 }}><thead><tr><th>Colour</th><th>Size</th><th>Qty</th></tr></thead><tbody>{o.lines.map((l, i) => <tr key={i}><td>{l.color ? colorName(l.color) : '—'}</td><td>{l.size || '—'}</td><td>{l.qty}</td></tr>)}</tbody></table></div>}
    {o.status !== 'cancelled' && o.status !== 'delivered' && <div className="form"><label>Tracking / LR number<input value={trk} onChange={e => setTrk(e.target.value)} maxLength={80} placeholder="Courier or transport tracking no." /></label>
      <div style={{ display: 'flex', gap: 8 }}>{step && <button className="b p" onClick={() => act(() => api(`/seller/orders/${o.id}/status`, { method: 'PUT', body: { status: step[0], tracking_no: trk } }), `Order is now ${step[0].replace('_', ' ')}`).then(onClose)}>{step[1]}</button>}
        <button className="b" onClick={() => act(() => api(`/seller/orders/${o.id}/status`, { method: 'PUT', body: { tracking_no: trk } }), 'Tracking saved').then(onClose)}>Save tracking</button></div></div>}
  </Modal>;
}

export function SellerOrders({ user }) {
  const r = useAsync(() => api('/seller/orders')), [st, setSt] = useState(''), [open, setOpen] = useState(null);
  return <View r={r}>{os => { const rows = os.filter(o => !st || o.status === st); return <>
    <Greet name={first(user)} sub="Orders placed with you — move them through production and dispatch." />
    <div className="tools"><select value={st} onChange={e => setSt(e.target.value)}><option value="">All statuses</option>{['confirmed', 'in_production', 'quality_check', 'shipped', 'delivered', 'cancelled'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
    <Table cols={['Order', 'Buyer', 'Qty', 'Value', 'Your earnings', 'Status', '']} count={rows.length} empty="No orders yet.">{rows.map(o => <tr key={o.id}>
      <td><b>#{o.id}</b> · {o.title}<br /><span className="mute">{dt(o.created_at)}</span></td><td>{o.buyer_company || o.buyer_name}</td><td>{num(o.quantity)}</td><td className="num">{money(o.total)}</td><td className="num">{money(o.total - o.commission)}</td><td><Pill s={o.status} /></td>
      <td><button className="b p" onClick={() => setOpen(o)}>{NEXT[o.status] ? 'Update' : 'View'}</button></td></tr>)}</Table>
    {open && <OrderModal o={open} onClose={() => setOpen(null)} onSaved={r.reload} />}</>; }}</View>;
}

/* ---------- quotation requests ---------- */
function QuoteModal({ x, onClose, onSaved }) {
  const [err, setErr] = useState('');
  const submit = async e => { e.preventDefault(); setErr(''); try { await api(`/seller/rfqs/${x.id}/quote`, { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); onSaved(); onClose(); } catch (er) { setErr(er.message); } };
  return <Modal title={x.title} onClose={onClose}>
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 10 }}><span><b>{num(x.quantity)}</b> pcs</span>{x.target_price > 0 && <span>Target <b>{money(x.target_price)}</b>/pc</span>}{x.destination && <span>To <b>{x.destination}</b></span>}{x.needed_by && <span>Needed by <b>{x.needed_by}</b></span>}</div>
    {x.notes && <p className="muted">“{x.notes}”</p>}
    <form className="form" onSubmit={submit}><div className="row2"><label>Your price ($/pc)<input name="price" type="number" min="1" step="any" required defaultValue={x.quote_price || ''} /></label><label>Lead time (days)<input name="lead_days" type="number" min="1" max="365" required defaultValue={x.quote_lead || 30} /></label></div>
      <label>Notes<textarea name="notes" rows="3" maxLength={1000} defaultValue={x.quote_notes || ''} /></label><div className="form-err" role="alert">{err}</div>
      <button className="btn btn-primary" type="submit">{x.quote_id ? 'Update quote' : 'Send quote'}</button></form></Modal>;
}

export function SellerRfqs({ user }) {
  const r = useAsync(() => api('/seller/rfqs')), [open, setOpen] = useState(null);
  return <View r={r}>{rs => <>
    <Greet name={first(user)} sub="Buyer requests for quotation — send your best price and lead time." />
    <Table cols={['Request', 'Qty', 'Target', 'Needed by', 'Your quote', '']} count={rs.length} empty="No open requests right now.">{rs.map(x => <tr key={x.id}>
      <td><b>{x.title}</b><br /><span className="mute">{dt(x.created_at)} · {x.destination || '—'}</span></td><td>{num(x.quantity)}</td><td>{x.target_price > 0 ? money(x.target_price) : '—'}</td><td>{x.needed_by || '—'}</td>
      <td>{x.quote_id ? <><b>{money(x.quote_price)}</b> · {x.quote_lead}d <Pill s={x.quote_status} /></> : <span className="mute">Not quoted</span>}</td>
      <td>{(!x.quote_id || x.quote_status === 'pending') && <button className="b p" onClick={() => setOpen(x)}>{x.quote_id ? 'Revise' : 'Quote'}</button>}</td></tr>)}</Table>
    {open && <QuoteModal x={open} onClose={() => setOpen(null)} onSaved={r.reload} />}</>}</View>;
}

/* ---------- payouts ---------- */
export function SellerPayouts({ user }) {
  const r = useAsync(() => api('/seller/payouts'));
  return <View r={r}>{d => { const net = o => o.total - o.commission, due = d.orders.filter(o => o.status === 'delivered' && o.payout_status === 'pending'), paid = d.orders.filter(o => o.payout_status === 'paid'), sum = a => a.reduce((s, o) => s + net(o), 0); return <>
    <Greet name={first(user)} sub={`You earn the order value minus ${d.commission_pct}% platform commission. Payouts are released after delivery.`} />
    <div className="kpis"><Kpi label="Payout due" value={money(sum(due))} sub={`${due.length} delivered orders`} /><Kpi label="Paid out" value={money(sum(paid))} sub={`${paid.length} orders`} /><Kpi label="In progress" value={money(sum(d.orders.filter(o => !['delivered', 'cancelled'].includes(o.status))))} sub="not yet delivered" /></div>
    <Table cols={['Order', 'Order value', 'Commission', 'Your earnings', 'Order status', 'Payout']} count={d.orders.length} empty="No orders yet.">{d.orders.map(o => <tr key={o.id}>
      <td><b>#{o.id}</b> · {o.title}<br /><span className="mute">{dt(o.created_at)}</span></td><td className="num">{money(o.total)}</td><td className="num">{money(o.commission)}</td><td className="num"><b>{money(net(o))}</b></td><td><Pill s={o.status} /></td><td><Pill s={o.payout_status} /></td></tr>)}</Table></>; }}</View>;
}
