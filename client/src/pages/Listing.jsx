import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useCategories } from '../hooks.js';
import Filters, { ActiveChips } from '../components/Filters.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { GridSkeleton } from '../components/Skeleton.jsx';
import * as Ic from '../components/icons.jsx';
import { AnimatePresence, m } from '../components/motion.jsx';

const SORTS = [['', 'Featured'], ['new', 'New arrivals'], ['bestseller', 'Best sellers'], ['popular', 'Most viewed'], ['deal', 'Biggest bulk discount'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['moq', 'Lowest MOQ']];
const PAGE = 12;

export default function Listing() {
  const [params, setParams] = useSearchParams(), qs = params.toString(), { data: nodes } = useCategories();
  const [items, setItems] = useState([]), [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 }), [loading, setLoading] = useState(true), [more, setMore] = useState(false), [err, setErr] = useState('');
  const [facets, setFacets] = useState(null), [view, setView] = useState(() => localStorage.getItem('bb_view') || 'grid'), [drawer, setDrawer] = useState(false), sentinel = useRef();
  const set = n => setParams(n, { replace: true });
  const cat = nodes?.find(n => n.id === params.get('cat')), sub = nodes?.find(n => n.id === params.get('sub'));

  const fetchPage = async (page, append) => {
    const n = new URLSearchParams(qs); n.set('page', page); n.set('limit', PAGE);
    append ? setMore(true) : setLoading(true); setErr('');
    try { const r = await api('/products?' + n); setItems(p => append ? [...p, ...r.items] : r.items); setMeta({ total: r.total, page: r.page, pages: r.pages }); } catch (e) { setErr(e.message); } finally { setLoading(false); setMore(false); }
  };
  useEffect(() => { fetchPage(1, false); /* eslint-disable-next-line */ }, [qs]);
  useEffect(() => { const n = new URLSearchParams(); ['cat', 'sub', 'subs', 'q', 'group'].forEach(k => params.get(k) && n.set(k, params.get(k))); api('/facets?' + n).then(setFacets).catch(() => {}); /* eslint-disable-next-line */ }, [params.get('cat'), params.get('sub'), params.get('q')]);
  useEffect(() => { localStorage.setItem('bb_view', view); }, [view]);
  // infinite scroll
  useEffect(() => {
    if (!sentinel.current || meta.page >= meta.pages) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !more && !loading) fetchPage(meta.page + 1, true); }, { rootMargin: '600px' });
    io.observe(sentinel.current); return () => io.disconnect(); // eslint-disable-next-line
  }, [meta, more, loading]);

  const title = useMemo(() => sub?.name || cat?.name || params.get('label') || (params.get('q') ? `Results for “${params.get('q')}”` : params.get('sort') === 'deal' ? 'Wholesale deals' : params.get('sort') === 'new' ? 'New arrivals' : 'All collections'), [sub, cat, params]);
  useEffect(() => { document.title = `${title} — Wholesale | Bulk Buyers`; }, [title]);
  const sortVal = params.get('sort') || '';

  return <>
    <section className="lhead"><div className="container">
      <div className="crumbs"><Link to="/">Home</Link>/<Link to="/shop">Shop</Link>{cat && <>/<Link to={'/shop?cat=' + cat.id}>{cat.name}</Link></>}{sub && <>/<span>{sub.name}</span></>}</div>
      <h1>{title}</h1><p className="mute">{cat && !sub ? cat.blurb : 'Compare wholesale prices, MOQs and stock across verified manufacturers.'}</p></div></section>
    <div className="container layout">
      <aside className="filters desk" aria-label="Filters"><Filters params={params} set={set} facets={facets} nodes={nodes} /></aside>
      <div>
        <div className="toolbar"><div className="left">
          <button className="btn sm ghost mob-only" onClick={() => setDrawer(true)}><Ic.Filter /> Filters</button>
          <span className="label" aria-live="polite">{loading ? 'Loading…' : `${meta.total.toLocaleString('en-US')} product${meta.total === 1 ? '' : 's'}`}</span></div>
          <div className="left"><label className="label desk-only" htmlFor="sort">Sort</label><select id="sort" value={sortVal} onChange={e => { const n = new URLSearchParams(params); e.target.value ? n.set('sort', e.target.value) : n.delete('sort'); set(n); }}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <div className="viewtoggle desk-only" role="group" aria-label="View"><button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label="Grid view" aria-pressed={view === 'grid'}><Ic.Grid /></button><button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label="List view" aria-pressed={view === 'list'}><Ic.List /></button></div></div></div>
        <ActiveChips params={params} set={set} nodes={nodes} facets={facets} />
        {err && <div className="notice err">Couldn’t load products: {err} <button className="link" onClick={() => fetchPage(1, false)}>Retry</button></div>}
        {loading ? <GridSkeleton n={8} wide /> : items.length ? <div className={'pgrid wide' + (view === 'list' ? ' plist' : '')}>{items.map(p => <ProductCard key={p.id} p={p} view={view} />)}</div>
          : <div className="empty"><h3>No products match</h3><p className="mute">{sub ? <>No styles are listed under <b>{sub.name}</b> yet — post an RFQ and manufacturers will quote.</> : 'Try removing a filter or searching a different term.'}</p><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}><button className="btn ghost" onClick={() => set(new URLSearchParams())}>Clear filters</button><Link className="btn" to="/dashboard/quotations">Request a quotation</Link></div></div>}
        {more && <div style={{ marginTop: 30 }}><GridSkeleton n={3} wide /></div>}
        {!loading && meta.page < meta.pages && <div className="pager"><div className="sentinel" ref={sentinel} /><button className="btn ghost" disabled={more} onClick={() => fetchPage(meta.page + 1, true)}>Load more</button><span className="label">Showing {items.length} of {meta.total}</span></div>}
      </div></div>
    <AnimatePresence>{drawer && <><m.div className="drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
      <m.aside className="panel-l" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'tween', duration: .35, ease: [.22, .8, .2, 1] }} aria-label="Filters">
        <div className="panel-h"><h3>Filters</h3><button className="ic" onClick={() => setDrawer(false)} aria-label="Close filters"><Ic.Close /></button></div>
        <div style={{ padding: '0 24px', flex: 1 }}><Filters params={params} set={set} facets={facets} nodes={nodes} /></div>
        <div style={{ padding: 20, borderTop: '1px solid var(--line)', position: 'sticky', bottom: 0, background: '#fff' }}><button className="btn block" onClick={() => setDrawer(false)}>Show {meta.total} results</button></div></m.aside></>}</AnimatePresence>
  </>;
}
