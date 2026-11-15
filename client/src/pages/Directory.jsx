import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCategories } from '../hooks.js';
import { img } from '../lib.js';

export default function Directory() {
  const { tree, data, loading } = useCategories(), [q, setQ] = useState(''), needle = q.trim().toLowerCase();
  const types = (data || []).filter(n => n.level === 2).length, live = (data || []).filter(n => n.level === 2 && n.count > 0).length;
  const view = useMemo(() => tree.map(g => ({ ...g, categories: g.categories.map(c => ({ ...c, shown: needle ? c.types.filter(t => t.name.toLowerCase().includes(needle) || c.name.toLowerCase().includes(needle)) : c.types })).filter(c => c.shown.length) })).filter(g => g.categories.length), [tree, needle]);
  return <><section className="lhead"><div className="container"><div className="crumbs"><Link to="/">Home</Link>/<span>All categories</span></div><h1>The full index</h1>
    <p className="lead" style={{ marginTop: 8 }}>{types || '…'} product types across {(data || []).filter(n => n.level === 1).length || '…'} categories. Types with styles show a count — {live} are on the shelf today; any other type can be sourced through a quotation.</p>
    <input type="search" placeholder="Find a product type — saree, sneakers, hoodies…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 520, marginTop: 20 }} aria-label="Find a product type" /></div></section>
    <div className="container" style={{ paddingBlock: '30px 90px' }}>
      <div className="chips" style={{ position: 'sticky', top: 'var(--hdr)', zIndex: 20, background: 'var(--bg)', padding: '10px 0' }}>{tree.flatMap(g => g.categories).map(c => <a key={c.id} className="chip" href={'#' + c.id}>{c.name}</a>)}</div>
      {loading && <div className="skel" style={{ height: 300 }} />}
      {!loading && !view.length && <div className="empty"><h3>No product type matches “{q}”</h3><Link className="btn" to="/contact">Ask us to source it</Link></div>}
      {view.map(g => <section key={g.id} style={{ marginTop: 34 }}><p className="eyebrow" style={{ borderBottom: '1px solid var(--ink)', paddingBottom: 12 }}>{g.name}</p>
        {g.categories.map(c => <div key={c.id} id={c.id} className="dir-cat"><Link to={'/shop?cat=' + c.id} className="dir-card"><div className="ph"><img src={img(c.image, 600)} alt="" loading="lazy" /></div><h3 className="display">{c.name}</h3><p className="label">{c.count} styles · {c.types.length} types</p></Link>
          <ul className="typegrid">{c.shown.map(t => <li key={t.id}><Link to={`/shop?cat=${c.id}&sub=${t.id}`} className={t.count ? 'live' : ''}>{t.name}{t.count > 0 && <b>{t.count}</b>}</Link></li>)}</ul></div>)}</section>)}
    </div></>;
}
