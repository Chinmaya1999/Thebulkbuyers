import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAsync, useCategories } from '../hooks.js';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { useToast } from '../toast.jsx';
import { colorName, compact, dt, img, invoiceNo, mon, money, money2, num, openInvoice } from '../lib.js';
import { Bars, Donut, Empty, Fail, Greet, Kpi, Loading, Modal, Pill, Table, Track, useAct } from './ui.jsx';
import { RfqModal } from './admin.jsx';

const View = ({ r, children }) => r.loading && !r.data ? <Loading /> : r.error ? <Fail error={r.error} /> : children(r.data);
const first = u => u.name.split(' ')[0];
const grand = o => (o.total || 0) + (o.gst_amount || 0);
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/* ---------- overview ---------- */
export function BuyerOverview({ user }) {
  const r = useAsync(() => Promise.all([api('/rfqs'), api('/orders')]));
  return <View r={r}>{([rfqs, orders]) => {
    const live = orders.filter(o => o.status !== 'cancelled'), by = {};
    live.forEach(o => { const k = o.created_at.slice(0, 7); by[k] = (by[k] || 0) + o.total; });
    const months = Object.keys(by).sort().slice(-8).map(k => ({ l: mon(k), v: by[k] }));
    const waiting = rfqs.filter(x => x.status === 'open' && x.quote_count).length;
    const counts = Object.entries(orders.reduce((a, o) => (a[o.status] = (a[o.status] || 0) + 1, a), {})).map(([l, v]) => ({ l: l.replace('_', ' '), v }));
    return <>
      <Greet name={first(user)} sub="Your sourcing at a glance." action={<div style={{ display: 'flex', gap: 10 }}><Link className="btn sm" to="/shop">Browse wholesale</Link><Link className="btn sm ghost" to="/dashboard/reorder">Reorder</Link></div>} />
      {waiting > 0 && <div className="banner"><b>{waiting}</b> quotation request(s) have manufacturer quotes to compare <Link className="b p" to="/dashboard/quotations" style={{ marginLeft: 'auto' }}>Review quotes</Link></div>}
      <div className="kpis"><Kpi label="Total purchases" value={compact(live.reduce((s, o) => s + grand(o), 0))} sub={`${live.length} orders incl. GST`} /><Kpi label="GST paid" value={compact(live.reduce((s, o) => s + (o.gst_amount || 0), 0))} sub="input credit claimable" />
        <Kpi label="In progress" value={orders.filter(o => ['confirmed', 'in_production', 'quality_check', 'shipped'].includes(o.status)).length} sub="orders on the way" /><Kpi label="Outstanding" value={compact(live.reduce((x, o) => x + Math.max(0, grand(o) - (o.paid_amount || 0)), 0))} sub="unpaid invoice balance" /><Kpi label="Open quotations" value={rfqs.filter(x => x.status === 'open').length} sub="awaiting quotes" /><Kpi label="Delivered" value={orders.filter(o => o.status === 'delivered').length} sub="completed" /></div>
      <div className="g2 charts"><div className="dcard"><h3>Purchases by month</h3><div className="sub">Taxable value</div><Bars data={months} /></div><div className="dcard"><h3>Order status</h3><div className="sub">All orders</div><Donut segs={counts} /></div></div>
      <div className="dcard"><h3>Recent orders <Link className="link" to="/dashboard/orders">View all</Link></h3><div className="cards-list" style={{ marginTop: 14 }}>{orders.slice(0, 3).map(o => <div key={o.id} style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}><span><b>#{o.id}</b> · {o.title} <span className="mute">× {num(o.quantity)}</span></span><span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><b className="num">{money2(grand(o))}</b><Pill s={o.status} /></span></div>)}{!orders.length && <Empty title="No orders yet">Your first order will appear here.</Empty>}</div></div></>;
  }}</View>;
}

/* ---------- orders ---------- */
export function OrderModal({ o, onClose, user }) {
  return <Modal title={`Order #${o.id}`} onClose={onClose}>
    <div style={{ display: 'flex', gap: 14, marginBottom: 14, alignItems: 'center' }}>{o.product_image && <img src={img(o.product_image, 200)} alt="" style={{ width: 64, aspectRatio: '3/4', objectFit: 'cover' }} />}<div><b style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>{o.title}</b><br /><span className="mute">{o.product_sku} · {o.seller_company}</span></div><div style={{ marginLeft: 'auto', display: 'grid', gap: 6, justifyItems: 'end' }}><Pill s={o.channel || 'wholesale'} /><Pill s={o.status} /></div></div>
    <Track status={o.status} />
    {o.lines?.length > 0 && <div className="tblwrap" style={{ marginBottom: 14 }}><table className="tbl" style={{ minWidth: 0 }}><thead><tr><th>Colour</th><th>Size</th><th>Qty</th></tr></thead><tbody>{o.lines.map((l, i) => <tr key={i}><td>{l.color ? <span className="who"><i style={{ width: 14, height: 14, borderRadius: '50%', background: l.color, border: '1px solid #0003' }} />{colorName(l.color)}</span> : '—'}</td><td>{l.size || '—'}</td><td>{l.qty}</td></tr>)}</tbody></table></div>}
    <div className="sumbox" style={{ display: 'grid', gap: 8, fontSize: 13.5 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{num(o.quantity)} pcs × {money2(o.unit_price)}</span><span className="num">{money2(o.total)}</span></div><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>GST</span><span className="num">{money2(o.gst_amount)}</span></div><div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--ink)', paddingTop: 10, fontFamily: 'var(--serif)', fontSize: 24 }}><span>Total</span><b className="num">{money2(grand(o))}</b></div></div>
    {o.shipping && <p className="mute" style={{ marginTop: 14, fontSize: 12.5 }}>Ship to: {[o.shipping.name, o.shipping.address, o.shipping.city, o.shipping.pincode, o.shipping.country].filter(Boolean).join(', ')} · {o.shipping.method === 'pickup' ? 'Self pickup' : 'Standard dispatch'} · {o.shipping.payment === 'bank_transfer' ? 'Bank transfer' : 'Pay on delivery'}</p>}
    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}><button className="b p" onClick={() => openInvoice(o, user)}>Invoice</button>{o.product_slug && <Link className="b" to={'/product?p=' + o.product_slug} onClick={onClose}>View product</Link>}</div></Modal>;
}

export function BuyerOrders({ user }) {
  const r = useAsync(() => api('/orders')), act = useAct(r.reload), [q, setQ] = useState(''), [st, setSt] = useState(''), [ch, setCh] = useState(''), [open, setOpen] = useState(null);
  return <View r={r}>{os => { const rows = os.filter(o => (!st || o.status === st) && (!ch || o.channel === ch) && (!q || ('#' + o.id + o.title + (o.product_sku || '')).toLowerCase().includes(q.toLowerCase()))); return <>
    <Greet name={first(user)} sub="Every order, with status and GST." />
    <div className="tools"><input type="search" placeholder="Search order #, product, SKU…" value={q} onChange={e => setQ(e.target.value)} /><select value={st} onChange={e => setSt(e.target.value)}><option value="">All statuses</option>{['confirmed', 'in_production', 'quality_check', 'shipped', 'delivered', 'cancelled'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select><select value={ch} onChange={e => setCh(e.target.value)}><option value="">Wholesale &amp; retail</option><option value="wholesale">Wholesale</option><option value="retail">Retail</option></select></div>
    <Table cols={['Order', 'Product', 'Qty', 'Total (incl. GST)', 'Type', 'Status', 'Date', '']} count={rows.length} empty="No orders match">{rows.map(o => <tr key={o.id}><td><b>#{o.id}</b></td>
      <td><div className="who">{o.product_image && <img className="thumb" src={img(o.product_image, 100)} alt="" />}<div>{o.title}<small>{o.seller_company}</small></div></div></td><td>{num(o.quantity)}</td><td className="num">{money2(grand(o))}</td><td><Pill s={o.channel || 'wholesale'} /></td><td><Pill s={o.status} /></td><td>{dt(o.created_at)}</td>
      <td><div className="act"><button className="b" onClick={() => setOpen(o)}>Details</button><button className="b" onClick={() => openInvoice(o, user)}>Invoice</button>{o.status === 'shipped' && <button className="b p" onClick={() => confirm('Confirm you have received this order?') && act(() => api(`/orders/${o.id}/status`, { method: 'PUT', body: { status: 'delivered' } }), 'Marked delivered')}>Received</button>}{o.status === 'confirmed' && <button className="b d" onClick={() => confirm('Cancel this order?') && act(() => api(`/orders/${o.id}/status`, { method: 'PUT', body: { status: 'cancelled' } }), 'Order cancelled')}>Cancel</button>}</div></td></tr>)}</Table>
    {open && <OrderModal o={open} user={user} onClose={() => setOpen(null)} />}</>; }}</View>;
}

export function BuyerTracking({ user }) {
  const r = useAsync(() => api('/orders')), [sel, setSel] = useState('');
  return <View r={r}>{os => { const list = os.filter(o => o.status !== 'cancelled'), cur = list.find(o => String(o.id) === sel) || list[0]; return <>
    <Greet name={first(user)} sub="Follow each order from confirmation to delivery." />
    {!list.length ? <div className="dcard"><Empty title="Nothing to track yet">Place an order to follow it here.</Empty></div> : <>
      <div className="tools"><select value={cur.id} onChange={e => setSel(e.target.value)} aria-label="Choose an order">{list.map(o => <option key={o.id} value={o.id}>#{o.id} — {o.title} ({o.status.replace('_', ' ')})</option>)}</select></div>
      <div className="dcard"><h3>{cur.title} <Pill s={cur.status} /></h3><div className="sub">Order #{cur.id} · placed {dt(cur.created_at)} · last update {dt(cur.updated_at)}</div><Track status={cur.status} />
        <div className="meta" style={{ display: 'flex', gap: 28, flexWrap: 'wrap', fontSize: 13 }}><span>Quantity <b>{num(cur.quantity)}</b></span><span>Manufacturer <b>{cur.seller_company}</b></span><span>Destination <b>{cur.destination}</b></span><span>Total <b>{money2(grand(cur))}</b></span></div></div>
      <div className="g2e"><div className="dcard"><h3>Stages</h3><ol style={{ display: 'grid', gap: 10, marginTop: 12, paddingLeft: 18, fontSize: 13.5 }}>{['confirmed', 'in_production', 'quality_check', 'shipped', 'delivered'].map(s => <li key={s} style={{ color: ['confirmed', 'in_production', 'quality_check', 'shipped', 'delivered'].indexOf(s) <= ['confirmed', 'in_production', 'quality_check', 'shipped', 'delivered'].indexOf(cur.status) ? 'var(--ink)' : 'var(--mute)', textTransform: 'capitalize' }}>{s.replace('_', ' ')}</li>)}</ol></div>
        <div className="dcard"><h3>Need help?</h3><p className="mute" style={{ marginTop: 10, fontSize: 13.5 }}>Questions about this shipment? Contact us with your order number and we’ll check with the manufacturer.</p><Link className="btn sm ghost" style={{ marginTop: 14 }} to="/contact">Contact support</Link></div></div></>}</>; }}</View>;
}

/* ---------- quotations ---------- */
function NewQuoteModal({ onClose, onDone }) {
  const { tree } = useCategories(), [err, setErr] = useState(''), toast = useToast();
  const submit = async e => { e.preventDefault(); try { await api('/rfqs', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Quotation requested — manufacturers will respond'); onDone(); } catch (er) { setErr(er.message); } };
  return <Modal title="Request a quotation" onClose={onClose}><form className="form" onSubmit={submit}>
    <label>What do you need?<input name="title" required maxLength={160} placeholder="e.g. 1,000 oversized black hoodies with embroidered logo" /></label>
    <div className="row2"><label>Category<select name="category"><option value="">Select…</option>{tree.map(g => <optgroup key={g.id} label={g.name}>{g.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}</select></label><label>Quantity (pcs)<input name="quantity" type="number" min="1" required /></label></div>
    <div className="row2"><label>Target price / pc ($)<input name="targetPrice" type="number" min="0" /></label><label>Needed by<input name="neededBy" type="date" /></label></div>
    <label>Destination<input name="destination" placeholder="City, Country" maxLength={120} /></label><label>Specs &amp; notes<textarea name="notes" rows="3" maxLength={2000} placeholder="Fabric, GSM, colours, size split, labels, packaging, samples…" /></label>
    <div className="form-err" role="alert">{err}</div><button className="btn">Send request</button></form></Modal>;
}
export function BuyerQuotations({ user }) {
  const r = useAsync(() => api('/rfqs')), act = useAct(r.reload), [open, setOpen] = useState(null), [nq, setNq] = useState(false), nav = useNavigate();
  return <View r={r}>{rs => <>
    <Greet name={first(user)} sub="Compare manufacturer quotes and pick your supplier." action={<button className="btn sm" onClick={() => setNq(true)}>Request a quotation</button>} />
    <div className="cards-list">{rs.length ? rs.map(x => <div className="ocard" key={x.id}>
      <div className="hd"><div><h4>#{x.id} · {x.title}</h4><div className="muted">Requested {dt(x.created_at)}</div></div><Pill s={x.status} /></div>
      <div className="meta"><span><b>{num(x.quantity)}</b> pcs</span><span>Target <b>{x.target_price ? money2(x.target_price) : 'open'}</b></span><span>To <b>{x.destination || '—'}</b></span><span><b>{x.quote_count}</b> quote(s)</span></div>
      {x.notes && <p className="muted">“{x.notes}”</p>}
      <div className="foot"><button className={'b' + (x.quote_count && x.status === 'open' ? ' p' : '')} onClick={() => setOpen(x.id)}>{x.quote_count ? 'View quotes' : 'Details'}</button>{x.status === 'open' && <button className="b d" onClick={() => confirm('Close this request? Manufacturers will no longer be able to quote.') && act(() => api('/rfqs/' + x.id + '/close', { method: 'PUT' }), 'Request closed')}>Close</button>}</div></div>)
      : <Empty title="No quotations yet">Request one from any product, or use the button above.</Empty>}</div>
    {open && <RfqModal id={open} role="buyer" onClose={() => { setOpen(null); r.reload(); }} onAccepted={() => { setOpen(null); nav('/dashboard/orders'); }} />}
    {nq && <NewQuoteModal onClose={() => setNq(false)} onDone={() => { setNq(false); r.reload(); }} />}</>}</View>;
}

/* ---------- invoices ---------- */
export function BuyerInvoices({ user }) {
  const r = useAsync(() => api('/orders'));
  return <View r={r}>{os => { const rows = os.filter(o => o.status !== 'cancelled'); return <>
    <Greet name={first(user)} sub="Order invoices with GST breakdown — print or save as PDF." />
    <Table cols={['Invoice', 'Date', 'Manufacturer', 'Taxable', 'GST', 'Total', 'Payment', '']} count={rows.length} empty="No invoices yet">{rows.map(o => <tr key={o.id}><td><b>{invoiceNo(o)}</b><small>Order #{o.id}</small></td><td>{dt(o.created_at)}</td><td>{o.seller_company}{o.seller_gst && <small>GSTIN {o.seller_gst}</small>}</td><td className="num">{money2(o.total)}</td><td className="num">{money2(o.gst_amount)}</td><td className="num"><b>{money2(grand(o))}</b></td><td><Pill s={o.payment_status || 'unpaid'} />{(o.paid_amount || 0) > 0 && o.payment_status !== 'paid' && <small>{money2(o.paid_amount)} received</small>}</td><td><button className="b p" onClick={() => openInvoice(o, user)}>View / print</button></td></tr>)}</Table>
    <p className="mute" style={{ fontSize: 12 }}>These are system-generated order invoice summaries. The manufacturer issues the statutory GST tax invoice with the consignment.</p></>; }}</View>;
}

/* ---------- wishlist / saved / reorder ---------- */
export function BuyerWishlist({ user }) {
  const r = useAsync(() => api('/wishlist')), act = useAct(r.reload);
  return <View r={r}>{w => <><Greet name={first(user)} sub="Styles you’ve saved." />
    {w.length ? <div className="wish">{w.map(p => <div key={p.id} style={{ position: 'relative' }}><Link to={'/product?p=' + p.slug}><img src={img(p.image, 500)} alt={p.name} /><div><b>{p.name}</b><small>{money(p.price_min)}–{money(p.price_max)} · MOQ {p.moq}</small></div></Link><button className="rm" style={{ position: 'absolute', top: 10, right: 12, background: '#fff', padding: '3px 8px' }} onClick={() => act(() => api('/wishlist/' + p.id, { method: 'POST' }), 'Removed')}>remove</button></div>)}</div>
      : <div className="dcard"><Empty title="Nothing saved yet"><Link className="btn sm" to="/shop" style={{ marginTop: 14 }}>Browse the shop</Link></Empty></div>}</>}</View>;
}
export function BuyerSaved({ user }) {
  const [rec, setRec] = useState(() => { try { return JSON.parse(localStorage.getItem('bb_recent') || '[]'); } catch { return []; } });
  return <><Greet name={first(user)} sub="Recently viewed products on this device." action={rec.length > 0 && <button className="b" onClick={() => { localStorage.removeItem('bb_recent'); setRec([]); }}>Clear history</button>} />
    {rec.length ? <div className="wish">{rec.map(p => <Link key={p.slug} to={'/product?p=' + p.slug}><img src={img(p.image, 500)} alt={p.name} /><div><b>{p.name}</b><small>{p.sku} · from {money(p.price)}</small></div></Link>)}</div> : <div className="dcard"><Empty title="Nothing viewed yet">Products you open will appear here for quick access.</Empty></div>}</>;
}
export function BuyerReorder({ user }) {
  const r = useAsync(() => api('/orders')), { addLines } = useCart(), toast = useToast();
  return <View r={r}>{os => { const rows = os.filter(o => o.product_id && o.product_slug && o.status !== 'cancelled'); return <><Greet name={first(user)} sub="Add a past order — every colour and size — back to your cart." />
    <div className="cards-list">{rows.length ? rows.map(o => <div className="ocard" key={o.id}><div className="hd" style={{ alignItems: 'center' }}><div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><img src={img(o.product_image, 160)} alt="" style={{ width: 56, aspectRatio: '3/4', objectFit: 'cover' }} /><div><h4>{o.title}</h4><div className="muted">Order #{o.id} · {dt(o.created_at)} · {num(o.quantity)} pcs · {money2(o.unit_price)}/pc</div></div></div>
      <button className="btn sm" onClick={() => { addLines({ id: o.product_id, slug: o.product_slug, name: o.title, image: o.product_image }, o.lines?.length ? o.lines : [{ size: '', color: '', qty: o.quantity }]); toast('Order added to cart'); }}>Reorder</button></div>
      {o.details && <p className="muted" style={{ fontSize: 12 }}>{o.details}</p>}</div>) : <div className="dcard"><Empty title="No past orders to reorder">Orders you place will appear here.</Empty></div>}</div></>; }}</View>;
}

/* ---------- addresses ---------- */
function AddressModal({ a, onClose, onSaved }) {
  const [err, setErr] = useState('');
  const submit = async e => { e.preventDefault(); const body = Object.fromEntries(new FormData(e.target)); try { await api(a.id ? '/account/addresses/' + a.id : '/account/addresses', { method: a.id ? 'PUT' : 'POST', body }); onSaved(); } catch (er) { setErr(er.message); } };
  return <Modal title={a.id ? 'Edit address' : 'New address'} onClose={onClose}><form className="form" onSubmit={submit}>
    <label>Label (e.g. Warehouse, Head office)<input name="label" defaultValue={a.label} maxLength={40} /></label>
    <div className="row2"><label>Contact name<input name="name" defaultValue={a.name} required /></label><label>Phone<input name="phone" defaultValue={a.phone} required /></label></div>
    <label>Address line 1<input name="line1" defaultValue={a.line1} required /></label><label>Address line 2<input name="line2" defaultValue={a.line2} /></label>
    <div className="row3"><label>City<input name="city" defaultValue={a.city} required /></label><label>State<input name="state" defaultValue={a.state} /></label><label>PIN<input name="pincode" defaultValue={a.pincode} maxLength={12} /></label></div>
    <label>Country<input name="country" defaultValue={a.country || 'India'} /></label><div className="form-err" role="alert">{err}</div><button className="btn">Save address</button></form></Modal>;
}
export function BuyerAddresses({ user }) {
  const r = useAsync(() => api('/account/addresses')), act = useAct(r.reload), [edit, setEdit] = useState(null);
  return <View r={r}>{as => <><Greet name={first(user)} sub="Saved delivery & billing addresses." action={<button className="btn sm" onClick={() => setEdit({})}>Add address</button>} />
    <div className="addr">{as.map(a => <div className="dcard" key={a.id}><h3>{a.label || a.name} {a.is_default ? <span className="badge accent">Default</span> : null}</h3><p>{a.name} · {a.phone}</p><p className="mute">{[a.line1, a.line2, a.city, a.state, a.pincode, a.country].filter(Boolean).join(', ')}</p>
      <div className="act" style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}><button className="b" onClick={() => setEdit(a)}>Edit</button>{!a.is_default && <button className="b" onClick={() => act(() => api(`/account/addresses/${a.id}/default`, { method: 'PUT' }), 'Default updated')}>Make default</button>}<button className="b d" onClick={() => confirm('Delete this address?') && act(() => api('/account/addresses/' + a.id, { method: 'DELETE' }), 'Address deleted')}>Delete</button></div></div>)}
      {!as.length && <div className="ghost-box"><b style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--ink)' }}>No saved addresses</b><span>Add one to speed up checkout.</span></div>}</div>
    {edit && <AddressModal a={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); r.reload(); }} />}</>}</View>;
}

/* ---------- profile / gst / settings ---------- */
function useProfileSave() {
  const toast = useToast(), { refresh, user } = useAuth();
  return async (patch) => { await api('/auth/me', { method: 'PUT', body: { name: user.name, company: user.company, phone: user.phone, country: user.country, gst: user.gst, gst_legal_name: user.gst_legal_name, ...patch } }); await refresh(); toast('Saved'); };
}
export function BuyerProfile({ user }) {
  const save = useProfileSave(), toast = useToast();
  return <><Greet name={first(user)} sub="Your business details." />
    <div className="dcard" style={{ maxWidth: 720 }}><form className="form" onSubmit={async e => { e.preventDefault(); try { await save(Object.fromEntries(new FormData(e.target))); } catch (er) { toast(er.message); } }}>
      <div className="row2"><label>Contact name<input name="name" defaultValue={user.name} required /></label><label>Email<input value={user.email} disabled readOnly /></label></div>
      <div className="row2"><label>Company / business name<input name="company" defaultValue={user.company} /></label><label>Phone<input name="phone" defaultValue={user.phone} /></label></div>
      <label>Country<input name="country" defaultValue={user.country} /></label><button className="btn" style={{ justifySelf: 'start' }}>Save changes</button></form></div></>;
}
export function BuyerGst({ user }) {
  const save = useProfileSave(), toast = useToast(), [err, setErr] = useState(''), [v, setV] = useState(user.gst || '');
  const valid = v === '' || GSTIN.test(v.toUpperCase());
  return <><Greet name={first(user)} sub="Add your GSTIN so it appears on every order and invoice." />
    <div className="dcard" style={{ maxWidth: 720 }}><form className="form" onSubmit={async e => { e.preventDefault(); setErr(''); if (!valid) return setErr('GSTIN looks invalid — 15 characters, e.g. 29ABCDE1234F1Z5'); try { await save({ gst: v.toUpperCase(), gst_legal_name: new FormData(e.target).get('gst_legal_name') }); } catch (er) { setErr(er.message); toast(er.message); } }}>
      <label>GSTIN<input value={v} onChange={e => setV(e.target.value.toUpperCase())} maxLength={15} placeholder="29ABCDE1234F1Z5" aria-invalid={!valid} /></label>
      {v && <p className={valid ? 'mute' : 'form-err'} style={{ fontSize: 12.5 }}>{valid ? `Format valid · state code ${v.slice(0, 2)} · PAN ${v.slice(2, 12)}. (Format is checked here; it is not verified against the GST portal.)` : 'Format not recognised.'}</p>}
      <label>Legal / trade name<input name="gst_legal_name" defaultValue={user.gst_legal_name || ''} placeholder="As registered with GST" /></label>
      <div className="form-err" role="alert">{err}</div><button className="btn" style={{ justifySelf: 'start' }}>Save GST details</button></form></div></>;
}
export function BuyerSettings({ user }) {
  const toast = useToast(), [err, setErr] = useState('');
  return <><Greet name={first(user)} sub="Password and account security." />
    <div className="dcard" style={{ maxWidth: 520 }}><h3>Change password</h3><form className="form" style={{ marginTop: 14 }} onSubmit={async e => { e.preventDefault(); const f = e.target; try { await api('/auth/password', { method: 'PUT', body: Object.fromEntries(new FormData(f)) }); f.reset(); setErr(''); toast('Password updated'); } catch (er) { setErr(er.message); } }}>
      <label>Current password<input name="current" type="password" required autoComplete="current-password" /></label><label>New password<input name="next" type="password" required minLength={8} autoComplete="new-password" /></label>
      <div className="form-err" role="alert">{err}</div><button className="btn" style={{ justifySelf: 'start' }}>Update password</button></form></div></>;
}
