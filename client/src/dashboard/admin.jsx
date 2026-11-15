import { useState } from 'react';
import { api } from '../api.js';
import { useAsync, useCategories } from '../hooks.js';
import ProductForm from './ProductForm.jsx';
import { refreshSite } from '../site.js';
import { img, money, compact, dt, mon, num } from '../lib.js';
import { Bars, Donut, HBars, Greet, Kpi, Pill, Table, Empty, Loading, Fail, Banner, Modal, useAct } from './ui.jsx';
import { Link } from 'react-router-dom';

const View = ({ r, children }) => r.loading && !r.data ? <Loading /> : r.error ? <Fail error={r.error} /> : children(r.data);

export function AdminOverview({ user }) {
  const r = useAsync(() => api('/admin/stats'));
  return <View r={r}>{s => <>
    <Greet name={first(user)} sub="Platform health at a glance." />
    {s.users.pending > 0 && <Banner><b>{s.users.pending}</b> account(s) waiting for verification <Link className="b p" to="/dashboard/users" style={{ marginLeft: 'auto' }}>Review</Link></Banner>}
    {s.products.pending > 0 && <Banner><b>{s.products.pending}</b> product(s) waiting for approval <Link className="b p" to="/dashboard/products" style={{ marginLeft: 'auto' }}>Review</Link></Banner>}
    <div className="kpis">
      <Kpi label="GMV (gross)" value={compact(s.orders.gmv)} sub={`${s.orders.n} orders`} /><Kpi label="Platform revenue" value={compact(s.orders.revenue)} sub="commission earned" />
      <Kpi label="Active orders" value={s.orders.active || 0} sub="in progress" /><Kpi label="Users" value={s.users.n} sub={`${s.users.buyers} buyers · ${s.users.sellers} sellers · ${s.users.agents} agents`} />
      <Kpi label="Open RFQs" value={s.rfqs.open || 0} sub={`of ${s.rfqs.n} total`} /><Kpi label="Live products" value={s.products.live || 0} sub={`${s.products.pending || 0} pending`} /></div>
    <div className="g2 charts"><div className="dcard"><h3>Gross merchandise value</h3><div className="sub">Last 8 months</div><Bars data={s.monthly.map(m => ({ l: mon(m.m), v: m.gmv }))} /></div>
      <div className="dcard"><h3>Orders by status</h3><div className="sub">All time</div><Donut segs={s.byStatus.map(x => ({ l: x.status.replace('_', ' '), v: x.n }))} /></div></div>
    <div className="g2e charts"><div className="dcard"><h3>Revenue by category</h3><div className="sub">Order value</div><HBars rows={s.byCategory.filter(c => c.v > 0).map(c => ({ l: c.name, v: c.v }))} /></div>
      <div className="dcard"><h3>Top sellers</h3><div className="sub">By order value</div><HBars rows={s.topSellers.map(t => ({ l: t.company || t.name, v: t.v }))} /></div></div>
    <div className="g2e charts"><div className="dcard"><h3>Retail vs wholesale</h3><div className="sub">Order value by channel</div><HBars rows={s.byChannel.map(c => ({ l: (c.channel === 'retail' ? 'B2C retail' : 'B2B wholesale') + ' · ' + c.n + ' orders', v: c.gmv }))} /></div>
    <div className="dcard"><h3>New sign-ups</h3><div className="sub">Per month</div><Bars data={s.signups.map(m => ({ l: mon(m.m), v: m.n }))} fmt={v => v} /></div></div></>}</View>;
}

const first = u => u.name.split(' ')[0];
const sel = { padding: '7px 10px', borderRadius: 10, fontSize: 12.5, width: 'auto' };
const ORDER_STATUS = ['confirmed', 'in_production', 'quality_check', 'shipped', 'delivered', 'cancelled'];
const PAY_STATUS = ['unpaid', 'partial', 'paid', 'refunded'];
const Field = ({ label, children }) => <label>{label}{children}</label>;

/* ---------------- Users ---------------- */
function UserModal({ u, onClose, onSaved }) {
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), editing = !!u.id;
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api(editing ? '/admin/users/' + u.id : '/admin/users', { method: editing ? 'PUT' : 'POST', body: Object.fromEntries(new FormData(e.target)) }); onSaved(); } catch (er) { setErr(er.message); setBusy(false); }
  };
  return <Modal title={editing ? 'Edit account' : 'New account'} onClose={onClose}><form className="form" onSubmit={submit}>
    <div className="row2"><Field label="Full name"><input name="name" required maxLength={80} defaultValue={u.name || ''} /></Field><Field label="Email"><input name="email" type="email" required defaultValue={u.email || ''} /></Field></div>
    <div className="row2"><Field label="Role"><select name="role" defaultValue={u.role || 'buyer'}><option value="buyer">Buyer</option><option value="seller">Supplier / manufacturer</option><option value="agent">Agent</option><option value="admin">Admin</option></select></Field>
      <Field label="Status"><select name="status" defaultValue={u.status || 'active'}><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select></Field></div>
    <div className="row2"><Field label="Company"><input name="company" maxLength={120} defaultValue={u.company || ''} /></Field><Field label="Phone"><input name="phone" maxLength={30} defaultValue={u.phone || ''} /></Field></div>
    <div className="row2"><Field label="Country"><input name="country" maxLength={60} defaultValue={u.country || 'India'} /></Field><Field label="GSTIN"><input name="gst" maxLength={20} defaultValue={u.gst || ''} /></Field></div>
    {!editing && <Field label="Password (8+ characters, letters and numbers)"><input name="password" type="text" required minLength={8} autoComplete="off" /></Field>}
    <Field label="Internal notes (never shown to the user)"><textarea name="admin_notes" rows="2" maxLength={1000} defaultValue={u.admin_notes || ''} /></Field>
    <div className="form-err" role="alert">{err}</div><button className="btn btn-primary" type="submit" disabled={busy}>{editing ? 'Save changes' : 'Create account'}</button></form></Modal>;
}

export function AdminUsers({ user }) {
  const r = useAsync(() => api('/admin/users')), act = useAct(r.reload);
  const [q, setQ] = useState(''), [role, setRole] = useState(''), [edit, setEdit] = useState(null);
  const set = (id, status) => act(() => api('/admin/users/' + id, { method: 'PUT', body: { status } }), 'User updated');
  const resetPw = id => { const password = prompt('Set a new password (8+ characters, letters and numbers):'); password && act(() => api('/admin/users/' + id + '/password', { method: 'PUT', body: { password } }), 'Password changed'); };
  return <View r={r}>{us => { const rows = us.filter(u => (!role || u.role === role) && (!q || (u.name + u.email + u.company + u.role).toLowerCase().includes(q.toLowerCase()))); return <>
    <Greet name={first(user)} sub="Create, edit and verify every buyer, supplier, agent and admin account." action={<button className="btn btn-primary btn-sm" onClick={() => setEdit({})}>+ New account</button>} />
    <div className="tools"><input type="search" placeholder="Search name, email, company…" value={q} onChange={e => setQ(e.target.value)} />
      <select value={role} onChange={e => setRole(e.target.value)}><option value="">All roles</option>{['buyer', 'seller', 'agent', 'admin'].map(x => <option key={x}>{x}</option>)}</select></div>
    <Table cols={['User', 'Role', 'Company', 'Status', 'Orders', 'Joined', '']} count={rows.length}>{rows.map(u => <tr key={u.id}>
      <td><div className="who"><div className="avatar" style={{ width: 36, height: 36 }}>{u.name[0]}</div><div>{u.name}<small>{u.email}</small></div></div></td>
      <td><Pill s={u.role} /></td><td>{u.company || '—'}<small>{u.country}{u.gst ? ' · GST ' + u.gst : ''}</small></td><td><Pill s={u.status} /></td><td>{u.orders}</td><td>{dt(u.created_at)}</td>
      <td><div className="act"><button className="b" onClick={() => setEdit(u)}>Edit</button>
        {u.status !== 'active' && <button className="b p" onClick={() => set(u.id, 'active')}>{u.status === 'pending' ? 'Verify' : 'Reactivate'}</button>}
        {u.status !== 'suspended' && u.id !== user.id && <button className="b d" onClick={() => set(u.id, 'suspended')}>Suspend</button>}
        <button className="b" onClick={() => resetPw(u.id)}>Password</button>
        {u.id !== user.id && <button className="b d" onClick={() => confirm(`Delete ${u.name} permanently?`) && act(() => api('/admin/users/' + u.id, { method: 'DELETE' }), 'Account deleted')}>Delete</button>}</div></td></tr>)}</Table>
    {edit && <UserModal u={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); r.reload(); }} />}</>; }}</View>;
}

/* ---------------- Products ---------------- */
export function AdminProducts({ user }) {
  const r = useAsync(() => api('/admin/products')), act = useAct(r.reload), [edit, setEdit] = useState(null), [q, setQ] = useState(''), [st, setSt] = useState('');
  const put = (id, body, m) => act(() => api('/admin/products/' + id, { method: 'PUT', body }), m);
  return <View r={r}>{all => { const ps = all.filter(p => (!st || p.status === st) && (!q || (p.name + (p.sku || '') + (p.brand || '') + (p.seller_company || '')).toLowerCase().includes(q.toLowerCase()))); return <>
    <Greet name={first(user)} sub={`${all.length} products · add, edit, price, stock and publish everything from here.`} action={<button className="btn btn-primary btn-sm" onClick={() => setEdit({})}>+ Add product</button>} />
    <div className="tools"><input type="search" placeholder="Search name, SKU, brand, supplier…" value={q} onChange={e => setQ(e.target.value)} />
      <select value={st} onChange={e => setSt(e.target.value)}><option value="">All statuses</option><option value="approved">Live</option><option value="pending">Pending</option><option value="rejected">Hidden</option></select></div>
    <Table cols={['Product', 'Supplier', 'MOQ', 'Price', 'Stock', 'Views', 'Status', '']} count={ps.length}>{ps.map(p => <tr key={p.id}>
      <td><div className="who"><img className="thumb" src={img(p.image, 120)} alt="" /><div><a href={'/product?p=' + p.slug} target="_blank" rel="noreferrer">{p.name}</a><small>{[p.sku, p.category].filter(Boolean).join(' · ')}</small></div></div></td>
      <td>{p.seller_company || p.seller_name || '—'}</td><td>{p.moq}</td><td>{money(p.price_min)}–{money(p.price_max)}</td><td>{p.stock_qty || 'MTO'}</td><td>{p.views}</td><td><Pill s={p.status} />{p.featured ? ' ★' : ''}</td>
      <td><div className="act"><button className="b p" onClick={() => setEdit({ id: p.id })}>Edit</button>
        {p.status !== 'approved' ? <button className="b" onClick={() => put(p.id, { status: 'approved' }, 'Product is live')}>Publish</button> : <button className="b" onClick={() => put(p.id, { status: 'rejected' }, 'Product hidden')}>Hide</button>}
        <button className="b" onClick={() => put(p.id, { featured: !p.featured }, 'Updated')}>{p.featured ? 'Unfeature' : 'Feature'}</button>
        <button className="b d" onClick={() => confirm('Delete this product permanently?') && act(() => api('/admin/products/' + p.id, { method: 'DELETE' }), 'Deleted')}>Delete</button></div></td></tr>)}</Table>
    {edit && <ProductForm id={edit.id} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); r.reload(); }} />}</>; }}</View>;
}

/* ---------------- RFQs & quotes ---------------- */
// Buyers use this read/accept view; admin gets the full toolkit (quote on behalf of suppliers, accept, close, delete).
export function RfqModal({ id, role, onClose, onAccepted }) {
  const r = useAsync(() => api('/rfqs/' + id)), act = useAct(r.reload), admin = role === 'admin';
  const users = useAsync(() => admin ? api('/admin/users') : Promise.resolve([]), [admin]);
  const [err, setErr] = useState('');
  const addQuote = async e => { e.preventDefault(); setErr(''); try { await api('/admin/rfqs/' + id + '/quotes', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); r.reload(); } catch (er) { setErr(er.message); } };
  return <Modal title={r.data?.rfq.title || 'RFQ'} onClose={onClose}>{!r.data ? <p className="muted">Loading…</p> : (() => { const { rfq, quotes } = r.data, can = (role === 'buyer' || admin) && rfq.status === 'open', suppliers = (users.data || []).filter(u => u.role === 'seller' || u.role === 'admin'); return <>
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16, fontSize: 14 }}>{admin && <span>Buyer <b>{rfq.buyer_company || rfq.buyer_name}</b></span>}<span><b>{num(rfq.quantity)}</b> pcs</span><span>Target <b>{rfq.target_price ? money(rfq.target_price) : 'open'}</b></span><span>To <b>{rfq.destination || '—'}</b></span><Pill s={rfq.status} /></div>
    {rfq.notes && <p className="muted" style={{ marginBottom: 18 }}>“{rfq.notes}”</p>}
    <h4 style={{ marginBottom: 10 }}>Quotes ({quotes.length})</h4>
    {quotes.length ? <div className="cards-list">{quotes.map((q, i) => <div className="ocard" key={q.id}>
      <div className="hd"><div><h4>{q.seller_company || q.seller_name} {i === 0 && quotes.length > 1 && <span className="pill ok">Lowest</span>}</h4><div className="muted">{q.notes || 'No notes'}</div></div><Pill s={q.status} /></div>
      <div className="meta"><span><b>{money(q.price)}</b> / pc</span><span>Total <b>{money(q.price * rfq.quantity)}</b></span><span>Lead <b>{q.lead_days} days</b></span></div>
      {can && q.status === 'pending' && <div className="foot"><button className="b p" onClick={async () => confirm('Accept this quote and create the order?') && await act(async () => { await api(admin ? '/admin/quotes/' + q.id + '/accept' : '/quotes/' + q.id + '/accept', { method: 'POST' }); onAccepted?.(); }, 'Order created 🎉')}>{admin ? 'Accept for buyer' : 'Accept'} &amp; create order</button>
        {admin && <button className="b d" onClick={() => act(() => api('/admin/quotes/' + q.id, { method: 'DELETE' }), 'Quote removed')}>Remove</button>}</div>}</div>)}</div>
      : <p className="muted">No quotes yet.</p>}
    {admin && rfq.status === 'open' && <form className="form" style={{ marginTop: 22 }} onSubmit={addQuote}><h4>Add a supplier quote</h4>
      <div className="row2"><Field label="Supplier"><select name="seller_id" required><option value="">Select…</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.company || s.name}{s.role === 'admin' ? ' (own stock)' : ''}</option>)}</select></Field>
        <Field label="Price / pc (₹)"><input name="price" type="number" min="1" step="any" required /></Field></div>
      <div className="row2"><Field label="Lead time (days)"><input name="lead_days" type="number" min="1" max="365" defaultValue="30" required /></Field><Field label="Notes"><input name="notes" maxLength={1000} /></Field></div>
      <div className="form-err" role="alert">{err}</div><button className="btn btn-primary btn-sm" type="submit">Add quote</button></form>}
    {admin && rfq.status !== 'accepted' && <div className="foot" style={{ marginTop: 18, display: 'flex', gap: 8 }}><button className="b" onClick={() => act(() => api('/admin/rfqs/' + id, { method: 'PUT', body: { status: rfq.status === 'open' ? 'closed' : 'open' } }), 'RFQ updated')}>{rfq.status === 'open' ? 'Close RFQ' : 'Reopen RFQ'}</button></div>}</>; })()}</Modal>;
}

function NewRfq({ onClose, onSaved }) {
  const users = useAsync(() => api('/admin/users')), { tree } = useCategories(), [err, setErr] = useState('');
  const submit = async e => { e.preventDefault(); setErr(''); try { await api('/admin/rfqs', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); onSaved(); } catch (er) { setErr(er.message); } };
  return <Modal title="New quotation request" onClose={onClose}><form className="form" onSubmit={submit}>
    <Field label="Buyer"><select name="buyer_id" required><option value="">Select…</option>{(users.data || []).filter(u => u.role === 'buyer').map(u => <option key={u.id} value={u.id}>{u.company || u.name} — {u.email}</option>)}</select></Field>
    <Field label="What is needed"><input name="title" required minLength={3} maxLength={160} placeholder="e.g. 2,000 polo T-shirts, 220 GSM" /></Field>
    <div className="row2"><Field label="Quantity"><input name="quantity" type="number" min="1" required /></Field><Field label="Target price / pc (₹)"><input name="target_price" type="number" min="0" step="any" /></Field></div>
    <div className="row2"><Field label="Category"><select name="category"><option value="">—</option>{tree.map(g => <optgroup key={g.id} label={g.name}>{g.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}</select></Field><Field label="Destination"><input name="destination" maxLength={120} /></Field></div>
    <Field label="Needed by"><input name="needed_by" type="date" /></Field><Field label="Notes"><textarea name="notes" rows="3" maxLength={2000} /></Field>
    <div className="form-err" role="alert">{err}</div><button className="btn btn-primary" type="submit">Create RFQ</button></form></Modal>;
}

export function AdminRfqs({ user }) {
  const r = useAsync(() => api('/rfqs')), act = useAct(r.reload), [open, setOpen] = useState(null), [add, setAdd] = useState(false);
  return <View r={r}>{rs => <>
    <Greet name={first(user)} sub="Every buyer request — add supplier quotes and convert them to orders." action={<button className="btn btn-primary btn-sm" onClick={() => setAdd(true)}>+ New RFQ</button>} />
    <Table cols={['#', 'Request', 'Buyer', 'Qty', 'Target', 'Quotes', 'Status', 'Posted', '']} count={rs.length}>{rs.map(x => <tr key={x.id}><td>{x.id}</td><td>{x.title}<small>{x.destination}</small></td>
      <td>{x.buyer_company || x.buyer_name}<small>{x.buyer_country}</small></td><td>{num(x.quantity)}</td><td>{x.target_price ? money(x.target_price) : '—'}</td><td>{x.quote_count}</td><td><Pill s={x.status} /></td><td>{dt(x.created_at)}</td>
      <td><div className="act"><button className="b p" onClick={() => setOpen(x.id)}>Manage</button><button className="b d" onClick={() => confirm('Delete this RFQ and its quotes?') && act(() => api('/admin/rfqs/' + x.id, { method: 'DELETE' }), 'RFQ deleted')}>Delete</button></div></td></tr>)}</Table>
    {open && <RfqModal id={open} role="admin" onClose={() => { setOpen(null); r.reload(); }} onAccepted={() => { setOpen(null); r.reload(); }} />}
    {add && <NewRfq onClose={() => setAdd(false)} onSaved={() => { setAdd(false); r.reload(); }} />}</>}</View>;
}

/* ---------------- Orders ---------------- */
function OrderModal({ o, onClose, onSaved }) {
  const users = useAsync(() => api('/admin/users')), products = useAsync(() => api('/admin/products')), [err, setErr] = useState(''), [busy, setBusy] = useState(false), editing = !!o.id;
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api(editing ? '/admin/orders/' + o.id : '/admin/orders', { method: editing ? 'PUT' : 'POST', body: Object.fromEntries(new FormData(e.target)) }); onSaved(); } catch (er) { setErr(er.message); setBusy(false); }
  };
  const U = users.data || [];
  return <Modal title={editing ? `Order #${o.id}` : 'New order'} onClose={onClose}><form className="form" onSubmit={submit}>
    {!editing && <><div className="row2"><Field label="Buyer"><select name="buyer_id" required><option value="">Select…</option>{U.filter(u => u.role === 'buyer').map(u => <option key={u.id} value={u.id}>{u.company || u.name}</option>)}</select></Field>
      <Field label="Supplier"><select name="seller_id"><option value="">Our own stock (admin)</option>{U.filter(u => u.role === 'seller').map(u => <option key={u.id} value={u.id}>{u.company || u.name}</option>)}</select></Field></div>
      <div className="row2"><Field label="Product (optional)"><select name="product_id"><option value="">— custom order —</option>{(products.data || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Title (if no product)"><input name="title" maxLength={160} /></Field></div></>}
    <div className="row2"><Field label="Quantity (pcs)"><input name="quantity" type="number" min="1" required defaultValue={o.quantity || ''} /></Field><Field label="Unit price (₹)"><input name="unit_price" type="number" min="0.01" step="any" required defaultValue={o.unit_price || ''} /></Field></div>
    {!editing && <div className="row2"><Field label="GST rate (%)"><input name="gst_rate" type="number" min="0" max="28" step="0.5" defaultValue="5" /></Field><Field label="Channel"><select name="channel"><option value="wholesale">Wholesale (B2B)</option><option value="retail">Retail (B2C)</option></select></Field></div>}
    {editing && <><div className="row2"><Field label="Order status"><select name="status" defaultValue={o.status}>{ORDER_STATUS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></Field><Field label="Tracking / AWB no."><input name="tracking_no" maxLength={80} defaultValue={o.tracking_no || ''} /></Field></div>
      <div className="row2"><Field label="Payment status"><select name="payment_status" defaultValue={o.payment_status}>{PAY_STATUS.map(s => <option key={s}>{s}</option>)}</select></Field><Field label="Amount received (₹)"><input name="paid_amount" type="number" min="0" step="any" defaultValue={o.paid_amount || 0} /></Field></div>
      <div className="row2"><Field label="Payment reference (UTR / cheque)"><input name="payment_ref" maxLength={80} defaultValue={o.payment_ref || ''} /></Field><Field label="Platform commission (₹)"><input name="commission" type="number" min="0" step="any" defaultValue={o.commission || 0} /></Field></div>
      <div className="row2"><Field label="Supplier payout"><select name="payout_status" defaultValue={o.payout_status}><option value="pending">Pending</option><option value="paid">Paid out</option></select></Field><Field label="Destination"><input name="destination" maxLength={120} defaultValue={o.destination || ''} /></Field></div>
      <Field label="Internal notes"><textarea name="admin_notes" rows="2" maxLength={1000} defaultValue={o.admin_notes || ''} /></Field></>}
    {!editing && <><Field label="Destination"><input name="destination" maxLength={120} /></Field><Field label="Details / variants"><input name="details" maxLength={900} placeholder="e.g. Black M ×200 · Navy L ×300" /></Field></>}
    {editing && o.shipping && <div className="ship">Ship to: {o.shipping.name} · {o.shipping.phone} — {o.shipping.address}, {o.shipping.city} {o.shipping.pincode}, {o.shipping.country}</div>}
    <div className="form-err" role="alert">{err}</div><button className="btn btn-primary" type="submit" disabled={busy}>{editing ? 'Save order' : 'Create order'}</button></form></Modal>;
}

export function AdminOrders({ user }) {
  const r = useAsync(() => api('/orders')), act = useAct(r.reload), [edit, setEdit] = useState(null), [st, setSt] = useState('');
  return <View r={r}>{all => { const os = all.filter(o => !st || o.status === st); return <>
    <Greet name={first(user)} sub="Create, price, track and settle every order." action={<button className="btn btn-primary btn-sm" onClick={() => setEdit({})}>+ New order</button>} />
    <div className="tools"><select value={st} onChange={e => setSt(e.target.value)}><option value="">All statuses</option>{ORDER_STATUS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
    <Table cols={['#', 'Order', 'Buyer', 'Supplier', 'Value', 'Payment', 'Status', 'Updated', '']} count={os.length}>{os.map(o => <tr key={o.id}><td>{o.id}</td><td>{o.title}<small>{num(o.quantity)} pcs × {money(o.unit_price)}{o.tracking_no ? ' · AWB ' + o.tracking_no : ''}</small></td>
      <td>{o.buyer_company || o.buyer_name}</td><td>{o.seller_company || o.seller_name}</td><td>{money(o.total)}<small>comm. {money(o.commission)}</small></td><td><Pill s={o.payment_status || 'unpaid'} /></td>
      <td><select value={o.status} onChange={e => act(() => api('/admin/orders/' + o.id, { method: 'PUT', body: { status: e.target.value } }), 'Order updated')} style={sel}>
        {ORDER_STATUS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></td><td>{dt(o.updated_at)}</td>
      <td><div className="act"><button className="b p" onClick={() => setEdit(o)}>Edit</button><button className="b d" onClick={() => confirm(`Delete order #${o.id} permanently?`) && act(() => api('/admin/orders/' + o.id, { method: 'DELETE' }), 'Order deleted')}>Delete</button></div></td></tr>)}</Table>
    {edit && <OrderModal o={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); r.reload(); }} />}</>; }}</View>;
}

/* ---------------- Payments ---------------- */
export function AdminPayments({ user }) {
  const r = useAsync(() => api('/admin/payments')), act = useAct(r.reload);
  const put = (id, body, m) => act(() => api('/admin/orders/' + id, { method: 'PUT', body }), m);
  return <View r={r}>{d => <>
    <Greet name={first(user)} sub="Money in from buyers, money out to suppliers and agents." />
    <div className="kpis"><Kpi label="Billed (incl. GST)" value={compact(d.totals.billed)} sub="active orders" /><Kpi label="Collected" value={compact(d.totals.collected)} sub={`${compact(Math.max(0, d.totals.billed - d.totals.collected))} outstanding`} />
      <Kpi label="Supplier payouts due" value={compact(d.totals.payout_due)} sub="delivered, unpaid" /><Kpi label="Paid to suppliers" value={compact(d.totals.payout_done)} sub="after commission" /></div>
    <div className="dcard" style={{ marginTop: 18 }}><h3>Orders</h3><div className="sub">Record receipts and payouts</div>
      <Table cols={['#', 'Order', 'Buyer', 'Billed', 'Received', 'Payment', 'Supplier', 'Payout', '']} count={d.orders.length}>{d.orders.map(o => <tr key={o.id}><td>{o.id}</td><td>{o.title}<small>{o.status.replace('_', ' ')}</small></td><td>{o.buyer_company || o.buyer_name}</td>
        <td>{money(o.total + (o.gst_amount || 0))}</td>
        <td><input type="number" min="0" defaultValue={o.paid_amount} style={{ width: 110, ...sel }} onBlur={e => Number(e.target.value) !== o.paid_amount && put(o.id, { paid_amount: e.target.value }, 'Amount saved')} /></td>
        <td><select value={o.payment_status} style={sel} onChange={e => put(o.id, { payment_status: e.target.value }, 'Payment updated')}>{PAY_STATUS.map(s => <option key={s}>{s}</option>)}</select></td>
        <td>{o.seller_company || o.seller_name}<small>owed {money(o.total - o.commission)}</small></td>
        <td><select value={o.payout_status} style={sel} onChange={e => put(o.id, { payout_status: e.target.value }, 'Payout updated')}><option value="pending">pending</option><option value="paid">paid out</option></select></td><td /></tr>)}</Table></div>
    <div className="dcard" style={{ marginTop: 18 }}><h3>Agent commissions</h3><div className="sub">On referred buyers’ delivered orders</div>
      <Table cols={['Agent', 'Code', 'Referred buyers', 'Delivered value', 'Commission earned']} count={d.agents.length} empty="No agents yet — add one under Users.">{d.agents.map(a => <tr key={a.id}><td>{a.name}<small>{a.company}</small></td><td>{a.referral_code}</td><td>{a.buyers}</td><td>{money(a.delivered)}</td><td><b>{money(a.earned)}</b></td></tr>)}</Table></div></>}</View>;
}

export function AdminCategories({ user }) {
  const r = useAsync(() => api('/categories')), act = useAct(r.reload), [edit, setEdit] = useState(null), [typesOf, setTypesOf] = useState(null);
  const save = async e => { e.preventDefault(); const body = Object.fromEntries(new FormData(e.target)); if (await act(() => api(edit.id ? '/admin/categories/' + edit.id : '/admin/categories', { method: edit.id ? 'PUT' : 'POST', body: edit.id ? body : { ...body, parent_id: edit.parent_id || body.parent_id } }), 'Saved')) setEdit(null); };
  return <View r={r}>{nodes => { const groups = nodes.filter(n => n.level === 0), cats = nodes.filter(n => n.level === 1), kids = id => nodes.filter(n => n.parent_id === id); return <>
    <Greet name={first(user)} sub={`${cats.length} categories · ${nodes.filter(n => n.level === 2).length} product types`} action={<button className="btn btn-primary btn-sm" onClick={() => setEdit({ parent_id: groups[0]?.id })}>+ New category</button>} />
    <Table cols={['Category', 'Group', 'Types', 'Styles', '']} count={cats.length}>{cats.map(c => <tr key={c.id}><td><div className="who"><span style={{ width: 14, height: 14, borderRadius: '50%', background: c.color, border: '1.5px solid #25232a' }} />{c.name}<small>{c.id}</small></div></td>
      <td>{groups.find(g => g.id === c.parent_id)?.name}</td><td>{kids(c.id).length}</td><td>{c.count}</td>
      <td><div className="act"><button className="b p" onClick={() => setTypesOf(c.id)}>Manage types</button><button className="b" onClick={() => setEdit(c)}>Edit</button><button className="b d" onClick={() => confirm('Delete this category?') && act(() => api('/admin/categories/' + c.id, { method: 'DELETE' }), 'Category deleted')}>Delete</button></div></td></tr>)}</Table>
    {edit && <Modal title={edit.id ? 'Edit category' : 'New category'} onClose={() => setEdit(null)}><form className="form" onSubmit={save}>
      <label>Name<input name="name" required defaultValue={edit.name || ''} /></label>
      {!edit.id && <label>Group<select name="parent_id" defaultValue={edit.parent_id}>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
      <label>Description<input name="blurb" defaultValue={edit.blurb || ''} /></label><label>Accent colour<input name="color" type="color" defaultValue={edit.color || '#923595'} style={{ height: 48, padding: 4 }} /></label><button className="btn btn-primary" type="submit">Save</button></form></Modal>}
    {typesOf && <TypesModal cat={cats.find(c => c.id === typesOf)} types={kids(typesOf)} onClose={() => setTypesOf(null)} act={act} />}</>; }}</View>;
}

function TypesModal({ cat, types, onClose, act }) {
  const [name, setName] = useState('');
  const add = async e => { e.preventDefault(); if (await act(() => api('/admin/categories', { method: 'POST', body: { name, parent_id: cat.id } }), 'Type added')) setName(''); };
  return <Modal title={cat.name + ' — types'} onClose={onClose}>
    <form onSubmit={add} style={{ display: 'flex', gap: 10, marginBottom: 18 }}><input value={name} onChange={e => setName(e.target.value)} placeholder="New product type, e.g. Rain Jackets" required maxLength={60} /><button className="btn btn-primary btn-sm" type="submit">Add</button></form>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{types.map(t => <span key={t.id} className="pill" style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '6px 10px', textTransform: 'none' }}>{t.name}{t.count > 0 && <b style={{ color: 'var(--purple)' }}>{t.count}</b>}
      <button title="Rename" style={{ background: 'none', border: 0, fontSize: 12 }} onClick={() => { const n = prompt('Rename type', t.name); n && n.trim() && act(() => api('/admin/categories/' + t.id, { method: 'PUT', body: { name: n } }), 'Renamed'); }}>✎</button>
      <button title="Delete" style={{ background: 'none', border: 0, color: 'var(--rust)' }} onClick={() => confirm(`Delete “${t.name}”?`) && act(() => api('/admin/categories/' + t.id, { method: 'DELETE' }), 'Deleted')}>×</button></span>)}</div></Modal>;
}

export function AdminInquiries({ user }) {
  const r = useAsync(() => api('/admin/inquiries')), act = useAct(r.reload);
  return <View r={r}>{is => <>
    <Greet name={first(user)} sub="Messages from the contact form." />
    <div className="cards-list">{is.length ? is.map(i => <div className="ocard" key={i.id}><div className="hd"><div><h4>{i.name} <span className="muted">· {i.company || 'no company'}</span></h4><div className="muted"><a href={'mailto:' + i.email}>{i.email}</a> {i.phone} · {dt(i.created_at)}</div></div><Pill s={i.status} /></div>
      <p>{i.message}</p><div className="foot">{i.status === 'new' && <button className="b p" onClick={() => act(() => api('/admin/inquiries/' + i.id, { method: 'PUT', body: { status: 'handled' } }), 'Marked handled')}>Mark handled</button>}<button className="b d" onClick={() => confirm('Delete this inquiry?') && act(() => api('/admin/inquiries/' + i.id, { method: 'DELETE' }), 'Deleted')}>Delete</button></div></div>) : <Empty title="No inquiries yet" />}</div></>}</View>;
}

export function AdminSettings({ user }) {
  const r = useAsync(() => api('/admin/settings')), act = useAct();
  return <View r={r}>{s => <>
    <Greet name={first(user)} sub="Platform economics." />
    <div className="dcard" style={{ maxWidth: 560 }}><form className="form" onSubmit={e => { e.preventDefault(); act(() => api('/admin/settings', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }), 'Settings saved'); }}>
      <label>Seller commission on confirmed orders (%)<input name="commission_pct" type="number" step="0.1" min="0" max="30" defaultValue={s.commission_pct} /></label>
      <label>Agent commission on referred buyers' delivered orders (%)<input name="agent_commission_pct" type="number" step="0.1" min="0" max="30" defaultValue={s.agent_commission_pct} /></label>
      <label>Shipping information (shown on product pages)<textarea name="shipping_policy" rows="4" maxLength={2000} defaultValue={s.shipping_policy} placeholder="Leave blank to use the default text" /></label>
      <label>Return policy (shown on product pages)<textarea name="return_policy" rows="4" maxLength={2000} defaultValue={s.return_policy} placeholder="Leave blank to use the default text" /></label>
      <button className="btn btn-primary" type="submit">Save settings</button></form></div></>}</View>;
}

/* ---------------- Website content ---------------- */
export function AdminSite({ user }) {
  const r = useAsync(() => api('/admin/site'));
  return <View r={r}>{d => <SiteForm user={user} initial={d.content} defaults={d.defaults} />}</View>;
}
function SiteForm({ user, initial, defaults }) {
  const [c, setC] = useState(initial), act = useAct(), [busy, setBusy] = useState(false);
  const set = (path, v) => setC(p => { const n = structuredClone(p); let o = n; const k = path.split('.'); k.slice(0, -1).forEach(x => (o = o[x])); o[k.at(-1)] = v; return n; });
  const T = (path, label, props = {}) => { const v = path.split('.').reduce((o, k) => o[k], c); return <Field label={label}>{props.area ? <textarea rows="3" value={v} onChange={e => set(path, e.target.value)} /> : <input value={v} onChange={e => set(path, e.target.value)} {...props} />}</Field>; };
  const save = async e => { e.preventDefault(); setBusy(true); await act(async () => { await api('/admin/site', { method: 'PUT', body: { content: c } }); await refreshSite(); }, 'Website updated — live now'); setBusy(false); };
  const ann = c.announcements;
  return <>
    <Greet name={first(user)} sub="Edit the text on the public website. Changes go live as soon as you save." action={<a className="btn btn-sm" href="/" target="_blank" rel="noreferrer">View site</a>} />
    <form className="form" onSubmit={save} style={{ display: 'grid', gap: 18 }}>
      <div className="dcard"><h3>Announcement bar</h3><div className="sub">Rotating messages above the header</div>
        {ann.map((a, i) => <div className="row2" key={i} style={{ alignItems: 'end' }}>{T(`announcements.${i}.title`, 'Headline')}{T(`announcements.${i}.text`, 'Detail')}<button type="button" className="b d" onClick={() => set('announcements', ann.filter((_, k) => k !== i))}>Remove</button></div>)}
        {ann.length < 8 && <button type="button" className="b" style={{ marginTop: 8 }} onClick={() => set('announcements', [...ann, { title: '', text: '' }])}>+ Add message</button>}
        <div className="row2" style={{ marginTop: 12 }}>{T('announceLinkLabel', 'Link label')}{T('announceLinkUrl', 'Link URL (e.g. /shop?sort=deal)')}</div></div>
      <div className="dcard"><h3>Homepage hero</h3><div className="sub">The first thing visitors see</div>
        {T('hero.eyebrow', 'Small heading')}
        <div className="row2">{T('hero.line1', 'Title line 1')}{T('hero.line2', 'Title line 2')}</div>{T('hero.accent', 'Title line 3 (highlighted)')}{T('hero.lead', 'Intro text', { area: true })}
        <div className="row2">{T('hero.cta1Label', 'Button 1 label')}{T('hero.cta1Url', 'Button 1 link')}</div><div className="row2">{T('hero.cta2Label', 'Button 2 label')}{T('hero.cta2Url', 'Button 2 link')}</div>{T('hero.caption', 'Image caption')}</div>
      <div className="dcard"><h3>Contact details</h3><div className="sub">Footer, Contact page and the WhatsApp button</div>
        <div className="row2">{T('contact.phone', 'Phone')}{T('contact.whatsapp', 'WhatsApp (country code + number, no +)')}</div>{T('contact.email', 'Email', { type: 'email' })}{T('contact.address', 'Office address', { area: true })}</div>
      <div className="dcard"><h3>About page</h3>{T('about.title', 'Headline')}{T('about.lead', 'Intro', { area: true })}</div>
      <div className="dcard"><h3>Footer</h3>{T('footer.legal', 'Company line(s) — one per row', { area: true })}{T('footer.newsletterTitle', 'Newsletter headline')}{T('footer.newsletterText', 'Newsletter text')}</div>
      <div style={{ display: 'flex', gap: 10 }}><button className="btn btn-primary" type="submit" disabled={busy}>Save & publish</button>
        <button type="button" className="btn btn-sm" onClick={() => confirm('Reset all website text to the original defaults?') && setC(structuredClone(defaults))}>Reset to defaults</button></div></form></>;
}
