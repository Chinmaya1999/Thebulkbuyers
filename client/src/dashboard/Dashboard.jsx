import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { dt } from '../lib.js';
import * as A from './admin.jsx';
import * as B from './buyer.jsx';
import * as G from './agent.jsx';
import * as S from './seller.jsx';
import Profile from './Profile.jsx';
import { m, AnimatePresence } from '../components/motion.jsx';

// role → [route, label, component]
const ROLES = {
  admin: [['overview', 'Overview', A.AdminOverview], ['orders', 'Orders', A.AdminOrders], ['rfqs', 'Quotation requests', A.AdminRfqs], ['products', 'Products', A.AdminProducts], ['categories', 'Categories', A.AdminCategories], ['users', 'Users & suppliers', A.AdminUsers], ['payments', 'Payments', A.AdminPayments], ['inquiries', 'Inquiries', A.AdminInquiries], ['site', 'Website content', A.AdminSite], ['settings', 'Settings', A.AdminSettings]],
  buyer: [['overview', 'Overview', B.BuyerOverview], ['orders', 'My orders', B.BuyerOrders], ['tracking', 'Order tracking', B.BuyerTracking], ['quotations', 'My quotations', B.BuyerQuotations], ['invoices', 'Invoices', B.BuyerInvoices], ['wishlist', 'Wishlist', B.BuyerWishlist], ['saved', 'Saved products', B.BuyerSaved], ['reorder', 'Reorder', B.BuyerReorder], ['addresses', 'Addresses', B.BuyerAddresses], ['profile', 'Business profile', B.BuyerProfile], ['gst', 'GST details', B.BuyerGst], ['settings', 'Account settings', B.BuyerSettings]],
  seller: [['overview', 'Overview', S.SellerOverview], ['products', 'My products', S.SellerProducts], ['orders', 'Orders', S.SellerOrders], ['rfqs', 'Quotation requests', S.SellerRfqs], ['payouts', 'Payouts', S.SellerPayouts], ['profile', 'Business profile', Profile]],
  agent: [['overview', 'Overview', G.AgentOverview], ['buyers', 'My buyers', G.AgentBuyers], ['commissions', 'Commissions', G.AgentCommissions], ['profile', 'My profile', Profile]],
};
const LABEL = { admin: 'Administrator', buyer: 'Business buyer', agent: 'Sales agent', seller: 'Manufacturer / supplier' };
const ALIAS = { rfqs: 'quotations', newrfq: 'quotations' };

function Bell() {
  const [open, setOpen] = useState(false), [n, setN] = useState({ items: [], unread: 0 }), ref = useRef(), nav = useNavigate(), loc = useLocation(), { user } = useAuth();
  const load = () => api('/notifications').then(setN).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 45000); return () => clearInterval(t); }, []);
  useEffect(() => { load(); setOpen(false); }, [loc.pathname]);
  useEffect(() => { const c = e => !ref.current?.contains(e.target) && setOpen(false); addEventListener('click', c); return () => removeEventListener('click', c); }, []);
  const go = link => { const k = (link || '#overview').replace('#', ''); nav('/dashboard/' + (user.role === 'buyer' && ALIAS[k] ? ALIAS[k] : k)); };
  return <div style={{ position: 'relative' }} ref={ref}>
    <button className="iconbtn" aria-label="Notifications" onClick={() => setOpen(o => !o)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" /></svg>{n.unread > 0 && <span className="dot">{n.unread}</span>}</button>
    {open && <div className="notif"><header>Notifications <button onClick={async () => { await api('/notifications/read', { method: 'POST' }); load(); }}>Mark all read</button></header>
      <ul>{n.items.length ? n.items.map(x => <li key={x.id} className={x.read ? '' : 'unread'}><a href={x.link} onClick={e => { e.preventDefault(); setOpen(false); go(x.link); }}>{x.text}</a><small>{dt(x.created_at)}</small></li>) : <li>You’re all caught up</li>}</ul></div>}</div>;
}

export default function Dashboard() {
  const { user, logout } = useAuth(), nav = useNavigate(), { '*': view } = useParams(), loc = useLocation(), [open, setOpen] = useState(false);
  useEffect(() => { scrollTo(0, 0); setOpen(false); }, [loc.pathname]);
  useEffect(() => { document.title = 'My account — Bulk Buyers'; }, []);
  const items = ROLES[user.role], key = user.role === 'buyer' && ALIAS[view] ? ALIAS[view] : view, cur = items.find(i => i[0] === key);
  if (!cur) return <Navigate to="/dashboard/overview" replace />;
  if (key !== view) return <Navigate to={'/dashboard/' + key} replace />;
  const View = cur[2];
  return <div className={'dsh' + (open ? ' open' : '')} data-role={user.role}>
    <aside className="dside" aria-label="Account navigation">
      <Link to="/" className="logo"><img src="/brand/logo.png" alt="Bulk Buyers" /></Link>
      <div className="who"><div className="avatar">{user.name.trim()[0].toUpperCase()}</div><div><b>{user.name}</b><small>{LABEL[user.role]}</small></div></div>
      <nav className="dnav">{items.map(([k, l]) => <Link key={k} to={'/dashboard/' + k} className={key === k ? 'on' : ''}>{l}</Link>)}</nav>
      <div className="foot"><Link to="/shop" className="link" style={{ justifySelf: 'start' }}>Back to the shop</Link><button className="link" style={{ justifySelf: 'start', color: 'var(--mute)' }} onClick={async () => { await logout(); nav('/'); }}>Sign out</button></div>
    </aside>
    <div className="dmain"><div className="dtop"><button className="iconbtn menu-b" aria-label="Menu" onClick={() => setOpen(o => !o)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7h18M3 12h18M3 17h18" /></svg></button><h1 className="display">{cur[1]}</h1><Bell /></div>
      <AnimatePresence mode="wait"><m.main className="dcontent" key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .22 }}><View user={user} /></m.main></AnimatePresence></div>
  </div>;
}
