import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { useAsync } from '../hooks.js';
import { colorName, money2 } from '../lib.js';
import { Summary } from './Cart.jsx';
import * as Ic from '../components/icons.jsx';

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const blank = { name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' };
const AddressFields = ({ v, set, prefix }) => <div className="form">
  <div className="row2"><label>Full name<input value={v.name} onChange={e => set({ ...v, name: e.target.value })} required autoComplete={prefix + ' name'} /></label><label>Phone<input value={v.phone} onChange={e => set({ ...v, phone: e.target.value })} required autoComplete={prefix + ' tel'} /></label></div>
  <label>Address line 1<input value={v.line1} onChange={e => set({ ...v, line1: e.target.value })} required autoComplete={prefix + ' address-line1'} /></label>
  <label>Address line 2 (optional)<input value={v.line2} onChange={e => set({ ...v, line2: e.target.value })} autoComplete={prefix + ' address-line2'} /></label>
  <div className="row3"><label>City<input value={v.city} onChange={e => set({ ...v, city: e.target.value })} required autoComplete={prefix + ' address-level2'} /></label><label>State<input value={v.state} onChange={e => set({ ...v, state: e.target.value })} autoComplete={prefix + ' address-level1'} /></label><label>PIN / postcode<input value={v.pincode} onChange={e => set({ ...v, pincode: e.target.value })} maxLength={12} autoComplete={prefix + ' postal-code'} /></label></div>
  <label>Country<input value={v.country} onChange={e => set({ ...v, country: e.target.value })} /></label></div>;

export default function Checkout() {
  const { user } = useAuth(), { items, priced, pricing, clear } = useCart();
  const saved = useAsync(() => user ? api('/account/addresses') : Promise.resolve([]), [user?.id]);
  const [biz, setBiz] = useState({ company: '', contact: '', email: '', phone: '', gstin: '' }), [ship, setShip] = useState(blank), [bill, setBill] = useState(blank), [same, setSame] = useState(true);
  const [method, setMethod] = useState('standard'), [pay, setPay] = useState('cod'), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(null);
  useEffect(() => { if (user) { setBiz(b => ({ ...b, company: user.company || '', contact: user.name, email: user.email, phone: user.phone || '', gstin: user.gst || '' })); setShip(s => ({ ...s, name: user.name, phone: user.phone || '', country: user.country || 'India' })); } }, [user]);
  useEffect(() => { const d = saved.data?.find(a => a.is_default) || saved.data?.[0]; if (d) setShip({ name: d.name, phone: d.phone, line1: d.line1, line2: d.line2, city: d.city, state: d.state, pincode: d.pincode, country: d.country }); }, [saved.data]);
  const t = priced?.totals;

  if (done) return <div className="container" style={{ maxWidth: 760, padding: '70px var(--gut)' }}><p className="eyebrow">Order placed</p><h1 className="h-xl" style={{ margin: '14px 0 20px' }}>Thank you.</h1>
    <p className="lead">{done.orders.length} order{done.orders.length > 1 ? 's' : ''} created — {done.orders.map(o => '#' + o.id).join(', ')}. Total {money2(done.grand)} ({pay === 'cod' ? 'pay on delivery' : 'bank transfer details follow on confirmation'}). Each manufacturer has been notified.</p>
    <div style={{ display: 'flex', gap: 12, marginTop: 30, flexWrap: 'wrap' }}><Link className="btn" to="/dashboard/orders">Track my orders</Link><Link className="btn ghost" to="/dashboard/invoices">View invoices</Link><Link className="btn ghost" to="/shop">Continue shopping</Link></div></div>;
  if (!items.length) return <div className="container"><div className="empty"><h3>Your cart is empty</h3><Link className="btn" to="/shop">Explore collections</Link></div></div>;
  if (user === undefined) return null;
  if (!user) return <div className="container" style={{ padding: '70px var(--gut)', maxWidth: 680 }}><p className="eyebrow">Checkout</p><h1 className="h-lg" style={{ margin: '12px 0 16px' }}>Sign in to place your order</h1><p className="lead">Create a free business account to order, track shipments and download GST invoices. Your cart is saved.</p><div style={{ display: 'flex', gap: 12, marginTop: 26 }}><Link className="btn" to="/login?next=/checkout">Sign in</Link><Link className="btn ghost" to="/register?role=buyer&next=/checkout">Create business account</Link></div></div>;
  if (user.role !== 'buyer') return <div className="container"><div className="empty"><h3>Buyer accounts only</h3><p className="mute">Orders can be placed from a buyer account.</p></div></div>;

  const submit = async e => {
    e.preventDefault(); setErr('');
    const g = biz.gstin.trim().toUpperCase(); if (g && !GSTIN.test(g)) return setErr('GSTIN looks invalid — 15 characters, e.g. 29ABCDE1234F1Z5');
    setBusy(true);
    try { const r = await api('/orders/direct', { method: 'POST', body: { items: items.map(i => ({ productId: i.productId, qty: i.qty, size: i.size, color: i.color })), shipping: ship, billing: same ? null : bill, business: { ...biz, gstin: g }, shipping_method: method, payment_method: pay } }); clear(); setDone(r); scrollTo(0, 0); }
    catch (er) { setErr(er.message); setBusy(false); }
  };
  return <div className="container"><div className="crumbs" style={{ paddingTop: 22 }}><Link to="/cart">Cart</Link>/<span>Checkout</span></div><h1 className="h-lg" style={{ margin: '14px 0 22px' }}>Checkout</h1>
    <div className="steps"><span className="on">1 Business &amp; address</span><i /><span className="on">2 Delivery &amp; payment</span><i /><span>3 Confirmation</span></div>
    <form className="cartpage" onSubmit={submit} style={{ paddingTop: 0 }}><div className="card-box">
      <section className="cd-sec"><h3>Business information</h3><div className="row2"><label>Company / business name<input value={biz.company} onChange={e => setBiz({ ...biz, company: e.target.value })} autoComplete="organization" /></label><label>GSTIN (if applicable)<input value={biz.gstin} onChange={e => setBiz({ ...biz, gstin: e.target.value.toUpperCase() })} maxLength={15} placeholder="29ABCDE1234F1Z5" /></label></div>
        <div className="row3"><label>Contact person<input value={biz.contact} onChange={e => setBiz({ ...biz, contact: e.target.value })} required autoComplete="name" /></label><label>Email<input type="email" value={biz.email} onChange={e => setBiz({ ...biz, email: e.target.value })} required autoComplete="email" /></label><label>Phone<input value={biz.phone} onChange={e => setBiz({ ...biz, phone: e.target.value })} autoComplete="tel" /></label></div></section>
      <section className="cd-sec"><h3>Shipping address</h3>
        {saved.data?.length > 0 && <label>Saved addresses<select onChange={e => { const a = saved.data.find(x => String(x.id) === e.target.value); a && setShip({ name: a.name, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, pincode: a.pincode, country: a.country }); }} defaultValue=""><option value="" disabled>Choose a saved address…</option>{saved.data.map(a => <option key={a.id} value={a.id}>{a.label || a.name} — {a.line1}, {a.city}</option>)}</select></label>}
        <AddressFields v={ship} set={setShip} prefix="shipping" /></section>
      <section className="cd-sec"><h3>Billing address</h3><label className="fopt" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 14, color: 'var(--ink)' }}><input type="checkbox" checked={same} onChange={e => setSame(e.target.checked)} />Same as shipping address</label>{!same && <AddressFields v={bill} set={setBill} prefix="billing" />}</section>
      <section className="cd-sec"><h3>Shipping method</h3>{[['standard', 'Standard dispatch from factory', 'Freight charges and dispatch date are confirmed by the manufacturer on acceptance.'], ['pickup', 'Self pickup / own transport', 'Collect from the manufacturer or send your transporter.']].map(([v, l, d]) => <label key={v} className={'opt' + (method === v ? ' on' : '')}><input type="radio" name="method" checked={method === v} onChange={() => setMethod(v)} /><span><b>{l}</b><small>{d}</small></span></label>)}</section>
      <section className="cd-sec" style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}><h3>Payment method</h3>{[['cod', 'Pay on delivery', 'Pay the manufacturer when goods arrive.'], ['bank_transfer', 'Bank transfer (NEFT / RTGS)', 'Bank details are shared by the manufacturer once the order is confirmed.']].map(([v, l, d]) => <label key={v} className={'opt' + (pay === v ? ' on' : '')}><input type="radio" name="pay" checked={pay === v} onChange={() => setPay(v)} /><span><b>{l}</b><small>{d}</small></span></label>)}
        <p className="mute" style={{ fontSize: 12 }}>Online card/UPI payment is not enabled on this site yet.</p></section>
    </div>
    <div style={{ display: 'grid', gap: 18, alignContent: 'start', position: 'sticky', top: 'calc(var(--hdr) + 16px)' }}>
      <Summary t={t} pricing={pricing} cta={<><div style={{ display: 'grid', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 12 }}>{(priced?.products || []).map(g => <div key={g.productId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}><span>{g.name} × {g.qty}<br /><span className="mute">{items.filter(i => i.productId === g.productId).map(i => `${i.color ? colorName(i.color) + ' ' : ''}${i.size}×${i.qty}`).join(', ')}</span></span><b className="num">{money2(g.taxable)}</b></div>)}</div>
        <div className="form-err" role="alert">{err}</div><button className="btn block" disabled={busy || pricing || !priced || priced.issues.length > 0}>{busy ? 'Placing order…' : 'Place order'}</button>{priced?.issues.map(i => <p className="form-err" key={i.message}>{i.message}</p>)}</>} />
      <p className="label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Ic.Shield width="15" />Prices &amp; stock re-verified when you place the order</p></div></form></div>;
}
