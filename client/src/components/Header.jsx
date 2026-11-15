import { useSite, isInternal } from '../site.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { useCategories } from '../hooks.js';
import { img, money } from '../lib.js';
import * as Ic from './icons.jsx';
import { AnimatePresence, m } from './motion.jsx';

export const Logo = ({ light, h }) => <Link to="/" className="logo" aria-label="Bulk Buyers — home"><img src={light ? '/brand/logo-light.png' : '/brand/logo.png'} alt="Bulk Buyers" width="150" height="46" style={h ? { height: h } : undefined} /></Link>;

const NAV = [['Men', 'mens'], ['Women', 'womens'], ['Kids & Baby', 'kids'], ['Footwear', 'footwear'], ['Bags & Accessories', 'accessories'], ['Sportswear', 'sportswear'], ['Innerwear', 'innerwear'], ['Ethnic Wear', 'ethnic'], ['Uniforms', 'uniforms'], ['Winter', 'winter']];

function Announce() {
  const [i, setI] = useState(0), site = useSite(), MSGS = site.announcements.map(a => [a.title, a.text]);
  useEffect(() => { const t = setInterval(() => setI(x => x + 1), 4200); return () => clearInterval(t); }, []);
  if (!MSGS.length) return null;
  const k = i % MSGS.length;
  return <div className="announce" role="status"><AnimatePresence mode="wait"><m.span key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .35 }}>{MSGS[k][0]}{MSGS[k][1] && ' — ' + MSGS[k][1]}{site.announceLinkLabel && <Link to={isInternal(site.announceLinkUrl) ? site.announceLinkUrl : '/shop'}>{site.announceLinkLabel}</Link>}</m.span></AnimatePresence></div>;
}

/* ---------- intelligent search ---------- */
export function SearchBox({ autoFocus, onDone, className = '' }) {
  const [q, setQ] = useState(''), [res, setRes] = useState(null), [open, setOpen] = useState(false), [act, setAct] = useState(-1), nav = useNavigate(), box = useRef();
  useEffect(() => {
    const s = q.trim(); if (s.length < 2) { setRes(null); return; }
    const t = setTimeout(() => api('/search/suggest?q=' + encodeURIComponent(s)).then(setRes).catch(() => {}), 200); return () => clearTimeout(t);
  }, [q]);
  useEffect(() => { const c = e => !box.current?.contains(e.target) && setOpen(false); document.addEventListener('mousedown', c); return () => document.removeEventListener('mousedown', c); }, []);
  const go = to => { setOpen(false); setQ(''); setRes(null); onDone?.(); nav(to); };
  const flat = res ? [...res.products.map(p => '/product?p=' + p.slug), ...res.categories.map(c => c.level === 1 ? '/shop?cat=' + c.id : `/shop?cat=${c.parent_id}&sub=${c.id}`), ...res.brands.map(b => '/shop?brand=' + encodeURIComponent(b.v)), ...res.manufacturers.map(x => '/shop?seller=' + x.id)] : [];
  const submit = e => { e.preventDefault(); go(act >= 0 && flat[act] ? flat[act] : '/shop?q=' + encodeURIComponent(q.trim())); };
  const key = e => { if (e.key === 'ArrowDown') { e.preventDefault(); setAct(a => Math.min(flat.length - 1, a + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setAct(a => Math.max(-1, a - 1)); } else if (e.key === 'Escape') setOpen(false); };
  let n = -1; const idx = () => ++n;
  const empty = res && !res.products.length && !res.categories.length && !res.brands.length && !res.manufacturers.length;
  return <div className={'search ' + className} ref={box} role="search">
    <form onSubmit={submit}><input value={q} autoFocus={autoFocus} onChange={e => { setQ(e.target.value); setOpen(true); setAct(-1); }} onFocus={() => setOpen(true)} onKeyDown={key} placeholder="Search product, SKU, category, brand or manufacturer" aria-label="Search the catalogue" autoComplete="off" /><button className="go" aria-label="Search"><Ic.Search /></button></form>
    {open && q.trim().length >= 2 && res && <div className="suggest" role="listbox">
      {empty && <p className="mute" style={{ padding: 20 }}>No matches for “{q}”. Try a product type, SKU or fabric.</p>}
      {res.products.length > 0 && <><h6>Products</h6>{res.products.map(p => { const i = idx(); return <Link key={p.slug} to={'/product?p=' + p.slug} className={'sg-item' + (act === i ? ' act' : '')} onClick={() => go('/product?p=' + p.slug)} role="option"><img src={img(p.image, 120)} alt="" /><span><b>{p.name}</b><small>{p.sku} · {p.sub_name} · {money(p.price_min)}–{money(p.price_max)} · MOQ {p.moq}</small></span></Link>; })}</>}
      {res.categories.length > 0 && <><h6>Categories</h6><div>{res.categories.map(c => { const i = idx(); return <Link key={c.id} className="sg-chip" style={act === i ? { borderColor: '#171717' } : undefined} to="/shop" onClick={e => { e.preventDefault(); go(c.level === 1 ? '/shop?cat=' + c.id : `/shop?cat=${c.parent_id}&sub=${c.id}`); }}>{c.name}{c.level === 2 && <span className="mute"> · {c.parent_name}</span>}</Link>; })}</div></>}
      {(res.brands.length > 0 || res.manufacturers.length > 0) && <><h6>Brands &amp; manufacturers</h6><div style={{ paddingBottom: 10 }}>{res.brands.map(b => { const i = idx(); return <Link key={b.v} className="sg-chip" style={act === i ? { borderColor: '#171717' } : undefined} to="/shop" onClick={e => { e.preventDefault(); go('/shop?brand=' + encodeURIComponent(b.v)); }}>{b.v}</Link>; })}{res.manufacturers.map(x => { const i = idx(); return <Link key={x.id} className="sg-chip" style={act === i ? { borderColor: '#171717' } : undefined} to="/shop" onClick={e => { e.preventDefault(); go('/shop?seller=' + x.id); }}>{x.company}</Link>; })}</div></>}
      <div style={{ padding: '10px 18px 16px' }}><button className="link" onClick={submit}>See all results for “{q}”</button></div>
    </div>}
  </div>;
}

/* ---------- mega menu ---------- */
const popCache = {};
function Mega({ cat, nodes, onClose }) {
  const [pop, setPop] = useState(popCache[cat.id] || null);
  useEffect(() => { if (!popCache[cat.id]) api(`/products?cat=${cat.id}&sort=popular&limit=3`).then(r => setPop(popCache[cat.id] = r.items)).catch(() => {}); }, [cat.id]);
  const types = nodes.filter(n => n.parent_id === cat.id).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 27);
  const total = nodes.filter(n => n.parent_id === cat.id).length;
  const cols = [['New arrivals', 'new'], ['Best sellers', 'bestseller'], ['Exclusive bulk deals', 'deal'], ['Premium collection', 'price_desc']];
  return <m.div className="mega" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .22 }} onClick={onClose}>
    <div className="container mega-in">
      <div><h5>Shop by type</h5><ul className="mega-types">{types.map(t => <li key={t.id}><Link to={`/shop?cat=${cat.id}&sub=${t.id}`}>{t.name}{t.count > 0 && <sup>{t.count}</sup>}</Link></li>)}</ul>
        <Link to={`/categories#${cat.id}`} className="link" style={{ display: 'inline-block', marginTop: 12 }}>All {total} types</Link></div>
      <div className="mega-col"><h5>Featured collections</h5><ul>{cols.map(([l, s]) => <li key={s}><Link to={`/shop?cat=${cat.id}&sort=${s}`}>{l}</Link></li>)}<li><Link to={'/shop?cat=' + cat.id}>View all {cat.name}</Link></li></ul></div>
      <div><Link to={'/shop?cat=' + cat.id} className="mega-feat"><img src={img(cat.image, 800)} alt="" loading="lazy" /><span>{cat.name}</span></Link>
        {pop?.length > 0 && <><h5 style={{ marginTop: 18, marginBottom: 8 }}>Popular now</h5><div className="mega-pop">{pop.map(p => <Link key={p.id} to={'/product?p=' + p.slug}><img src={img(p.image, 300)} alt="" loading="lazy" /><small>{p.name}</small></Link>)}</div></>}</div>
    </div></m.div>;
}

function CatNav({ nodes, cats }) {
  const [open, setOpen] = useState(null), t = useRef(), loc = useLocation();
  useEffect(() => setOpen(null), [loc.pathname, loc.search]);
  const enter = id => { clearTimeout(t.current); t.current = setTimeout(() => setOpen(id), 90); };
  const leave = () => { clearTimeout(t.current); t.current = setTimeout(() => setOpen(null), 160); };
  const items = NAV.map(([label, id]) => ({ label, cat: cats.find(c => c.id === id) })).filter(x => x.cat);
  const cur = items.find(x => x.cat.id === open)?.cat;
  return <nav className="catnav" aria-label="Categories" onMouseLeave={leave} style={{ position: 'relative' }}>
    <div className="container"><ul>
      {items.map(({ label, cat }) => <li key={cat.id} className={open === cat.id ? 'open' : ''} onMouseEnter={() => enter(cat.id)}>
        <Link to={'/shop?cat=' + cat.id} aria-haspopup="true" aria-expanded={open === cat.id} onFocus={() => setOpen(cat.id)}>{label}</Link></li>)}
      <li onMouseEnter={() => { clearTimeout(t.current); setOpen(null); }}><Link to="/shop?sort=deal" className="deal">Wholesale Deals</Link></li>
    </ul></div>
    <AnimatePresence>{cur && <div onMouseEnter={() => clearTimeout(t.current)}><Mega key={cur.id} cat={cur} nodes={nodes} onClose={() => setOpen(null)} /></div>}</AnimatePresence>
  </nav>;
}

/* ---------- mobile ---------- */
export function MobileMenu({ open, onClose, nodes, cats }) {
  const [acc, setAcc] = useState(null), { user } = useAuth();
  return <AnimatePresence>{open && <>
    <m.div className="drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
    <m.aside className="panel-l" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'tween', duration: .35, ease: [.22, .8, .2, 1] }} aria-label="Menu">
      <div className="panel-h"><Logo h={34} /><button className="ic" onClick={onClose} aria-label="Close menu"><Ic.Close /></button></div>
      {NAV.map(([label, id]) => { const c = cats.find(x => x.id === id); if (!c) return null; const types = nodes.filter(n => n.parent_id === id).sort((a, b) => b.count - a.count).slice(0, 10);
        return <div className="acc-item" key={id}><button onClick={() => setAcc(acc === id ? null : id)} aria-expanded={acc === id}>{label}<Ic.Down style={{ width: 16, transform: acc === id ? 'rotate(180deg)' : '', transition: '.3s' }} /></button>
          {acc === id && <div className="sub"><Link to={'/shop?cat=' + id} onClick={onClose} style={{ fontWeight: 600 }}>Shop all {label}</Link>{types.map(t => <Link key={t.id} to={`/shop?cat=${id}&sub=${t.id}`} onClick={onClose}>{t.name}</Link>)}<Link to={'/categories#' + id} onClick={onClose} className="link" style={{ justifySelf: 'start' }}>All types</Link></div>}</div>; })}
      <div className="acc-item"><Link to="/shop?sort=deal" onClick={onClose} style={{ display: 'block', padding: '18px 24px', font: '500 13px var(--sans)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)' }}>Wholesale Deals</Link></div>
      <div style={{ padding: 24, display: 'grid', gap: 12 }}>{user ? <Link className="btn block" to="/dashboard" onClick={onClose}>My account</Link> : <><Link className="btn block" to="/login" onClick={onClose}>Sign in</Link><Link className="btn ghost block" to="/register?role=buyer" onClick={onClose}>Create business account</Link></>}
        <Link to="/contact" onClick={onClose} className="link" style={{ justifySelf: 'start' }}>Contact &amp; quotations</Link></div>
    </m.aside></>}</AnimatePresence>;
}

export function SearchOverlay({ open, onClose }) {
  return <AnimatePresence>{open && <m.div className="search-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <div className="top"><SearchBox autoFocus onDone={onClose} className="grow" /><button className="ic" onClick={onClose} aria-label="Close search"><Ic.Close /></button></div>
    <div style={{ padding: 20 }}><p className="label">Popular</p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>{['Hoodies', 'Polo T-Shirts', 'Sarees', 'Sneakers', 'School Uniforms', 'Backpacks'].map(w => <Link key={w} className="chip" to={'/shop?q=' + encodeURIComponent(w)} onClick={onClose}>{w}</Link>)}</div></div>
  </m.div>}</AnimatePresence>;
}

export default function Header({ onMenu, onSearch }) {
  const { user } = useAuth(), { count, setOpen, wish } = useCart(), { data: nodes, cats } = useCategories();
  return <><Announce /><header className="hdr">
    <div className="container hdr-main">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><button className="ic mob-only" onClick={onMenu} aria-label="Open menu"><Ic.Menu /></button><Logo /></div>
      <SearchBox className="hdr-search" />
      <div className="hdr-actions">
        <button className="ic mob-only" onClick={onSearch} aria-label="Search"><Ic.Search /></button>
        <Link className="ic" to={user ? '/dashboard' : '/login'} aria-label={user ? 'My account' : 'Sign in'}><Ic.User /></Link>
        <Link className="ic desk-only" to={user ? '/dashboard/wishlist' : '/login?next=/dashboard/wishlist'} aria-label="Wishlist"><Ic.Heart />{wish.size > 0 && <span className="cnt">{wish.size}</span>}</Link>
        <button className="ic" onClick={() => setOpen(true)} aria-label={`Cart, ${count} pieces`}><Ic.Bag />{count > 0 && <span className="cnt">{count > 999 ? '999+' : count}</span>}</button>
      </div>
    </div>
    {nodes && <CatNav nodes={nodes} cats={cats} />}
  </header></>;
}

export function BottomNav({ onMenu, onSearch }) {
  const { user } = useAuth(), { count, setOpen } = useCart(), { pathname } = useLocation();
  return <nav className="bottomnav" aria-label="Quick navigation">
    <Link to="/" className={pathname === '/' ? 'active' : ''}><Ic.Home />Home</Link>
    <button onClick={onMenu}><Ic.Layers />Categories</button>
    <button onClick={onSearch}><Ic.Search />Search</button>
    <Link to={user ? '/dashboard' : '/login'} className={pathname.startsWith('/dashboard') ? 'active' : ''}><Ic.User />Account</Link>
    <button onClick={() => setOpen(true)}><Ic.Bag />Cart{count > 0 && <span className="cnt">{count > 99 ? '99+' : count}</span>}</button>
  </nav>;
}
