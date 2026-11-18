import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAsync, useCategories } from '../hooks.js';
import { img, srcSet, unsplash } from '../lib.js';
import ProductCard from '../components/ProductCard.jsx';
import Carousel from '../components/Carousel.jsx';
import { GridSkeleton } from '../components/Skeleton.jsx';
import * as Ic from '../components/icons.jsx';
import { useSite, isInternal } from '../site.js';
import { m, Reveal, useReducedMotion } from '../components/motion.jsx';

const HERO = unsplash('photo-1483985988355-763728e1935b', 2600), HERO2 = unsplash('photo-1507679799987-c73779587ccf', 900), CTA_BG = unsplash('photo-1445205170230-053b83016050', 2400);

// The 16 discovery tiles. `cat` = a whole category; `match` = product types (by name) across categories.
const TILES = [
  { label: "Men's Fashion", cat: 'mens' }, { label: "Women's Fashion", cat: 'womens' }, { label: 'Kids & Baby', cat: 'kids' },
  { label: 'T-Shirts & Polos', match: /(^|\s)(t-shirts?|polo)/i }, { label: 'Shirts & Tops', match: /(shirts|tops|blouses|tunics)$/i, not: /(t-shirts|sweatshirts)/i },
  { label: 'Jeans & Trousers', match: /(jeans|trousers|pants|chinos|jeggings|palazzos|joggers)/i }, { label: 'Dresses & Gowns', match: /(dress|gown)/i },
  { label: 'Jackets & Hoodies', match: /(jacket|hoodie|windcheater|parka|blazer)/i }, { label: 'Sweaters & Knitwear', match: /(sweater|cardigan|woollen|beanie|knit)/i },
  { label: 'Activewear', cat: 'sportswear' }, { label: 'Innerwear & Nightwear', cat: 'innerwear' },
  { label: 'Footwear & Shoes', cat: 'footwear' }
];
const season = () => { const mo = new Date().getMonth() + 1; return [11, 12, 1, 2].includes(mo) ? 'Winter' : [3, 4, 5, 6].includes(mo) ? 'Summer' : mo === 10 ? 'Festive' : 'Autumn'; };
const COLLECTIONS = [['New arrivals', 'sort=new'], ['Trending wholesale', 'sort=popular'], ['Best sellers', 'sort=bestseller'], ['Premium collections', 'sort=price_desc'], [`Seasonal essentials · ${season()}`, `season=${season()}&sort=popular`], ['Exclusive bulk deals', 'sort=deal']];
const ADV = [[Ic.Tag, 'Competitive bulk pricing', 'Tiered per-piece prices fall as your quantity grows — see every tier before you order.'], [Ic.Layers, 'Flexible quantity ordering', 'Order from the manufacturer’s MOQ. Below it, buy at retail price — no minimums blocking a sample order.'], [Ic.Grid, 'Size & colour variants', 'One matrix, every variant. Enter quantities by colour and size and see totals update live.'], [Ic.Shield, 'Reliable order processing', 'Stock is checked, prices are verified on the server, and each stage is tracked to delivery.'], [Ic.Doc, 'Business-friendly purchasing', 'GSTIN on file, GST shown on every line, quotations on request and an invoice with GST breakdown for every order.'], [Ic.Refresh, 'Easy repeat ordering', 'Reorder any past order — variants and quantities — into your cart in one click.']];

function Hero({ stats }) {
  const reduce = useReducedMotion(), { hero: H } = useSite(), cta = (u, c, k) => isInternal(u) ? <Link to={u} className={c}>{k}</Link> : <a href={u} className={c}>{k}</a>;
  return <section className="hero" aria-label="Featured">
    <div className="hero-copy">
      <m.p className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .1 }}>{H.eyebrow}</m.p>
      <h1 className="display h-xl">{[H.line1, H.line2, <em key="f">{H.accent}</em>].filter(Boolean).map((l, i) => <span key={i} style={{ display: 'block', overflow: 'hidden' }}><m.span style={{ display: 'block' }} initial={reduce ? false : { y: '105%' }} animate={{ y: 0 }} transition={{ duration: 1, delay: .15 + i * .12, ease: [.22, .8, .2, 1] }}>{l}</m.span></span>)}</h1>
      <m.p className="lead" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .6, duration: .8 }}>{H.lead}</m.p>
      <m.div className="hero-ctas" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .75, duration: .8 }}>{cta(H.cta1Url, 'btn', H.cta1Label)}{cta(H.cta2Url, 'btn ghost', H.cta2Label)}</m.div>
      {stats && <div className="hero-meta"><div><b className="num">{stats.products}</b><span>Styles</span></div><div><b className="num">{stats.sellers}</b><span>Manufacturers</span></div><div><b className="num">{stats.orders}</b><span>Orders placed</span></div></div>}
    </div>
    <div className="hero-media">
      <m.div className="main" initial={reduce ? false : { scale: 1.12 }} animate={{ scale: 1 }} transition={{ duration: 2.4, ease: [.22, .8, .2, 1] }}><img src={HERO} srcSet={srcSet(HERO.split('?')[0], [900, 1400, 2000, 2600])} sizes="(max-width:900px) 100vw, 58vw" alt="Editorial fashion photograph of a model in a tailored burgundy coat" fetchpriority="high" /></m.div>
      <m.div className="inset" initial={reduce ? false : { opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .9, duration: 1 }}><img src={HERO2} alt="Menswear tailoring" loading="lazy" /></m.div>
      <span className="cap">{H.caption}</span></div></section>;
}

export default function Home() {
  const stats = useAsync(() => api('/stats').catch(() => null)), { data: nodes, cats } = useCategories();
  const all = useAsync(() => api('/products?limit=100&sort=popular').then(r => r.items).catch(() => []), []);
  const mfr = useAsync(() => api('/manufacturers').catch(() => []), []);
  const [tab, setTab] = useState(0), [coll, setColl] = useState({}), [cl, setCl] = useState(true);
  useEffect(() => { document.title = 'Bulk Buyers — Wholesale Garments & Apparel Marketplace'; }, []);
  useEffect(() => { if (coll[tab]) { setCl(false); return; } setCl(true); api(`/products?${COLLECTIONS[tab][1]}&limit=10`).then(r => setColl(c => ({ ...c, [tab]: r.items }))).catch(() => setColl(c => ({ ...c, [tab]: [] }))).finally(() => setCl(false)); /* eslint-disable-next-line */ }, [tab]);

  const tiles = useMemo(() => { if (!nodes) return []; const types = nodes.filter(n => n.level === 2);
    return TILES.map(t => { let subs = [], count = 0, href;
      if (t.cat) { const c = nodes.find(n => n.id === t.cat); count = c?.count || 0; href = '/shop?cat=' + t.cat; var fallback = c?.image; }
      else { const ms = types.filter(n => t.match.test(n.name) && !(t.not && t.not.test(n.name)) && (!t.only || n.parent_id === t.only)); subs = ms.map(n => n.id); count = ms.reduce((s, n) => s + n.count, 0); href = `/shop?subs=${subs.join(',')}&label=${encodeURIComponent(t.label)}`; fallback = ''; }
      const hit = (all.data || []).find(p => t.cat ? p.category === t.cat : subs.includes(p.subcategory));
      return { ...t, count, href, image: hit?.image || fallback }; }); }, [nodes, all.data]);

  return <>
    <Hero stats={stats.data} />
    <section className="section" aria-labelledby="disc"><div className="container">
      <Reveal className="sec-head"><div><p className="eyebrow">Category discovery</p><h2 id="disc" className="display h-lg">Shop by category</h2></div><Link className="link" to="/categories">Browse the full index</Link></Reveal>
      <div className="tiles">{tiles.length ? tiles.map((t, i) => <Reveal key={t.label} delay={(i % 4) * .06} y={20}><Link to={t.href} className={'tile' + (t.image ? '' : ' empty')}>{t.image && <img src={img(t.image, 800)} srcSet={srcSet(t.image, [400, 700, 1000])} sizes="(max-width:640px) 50vw, 25vw" alt="" loading="lazy" />}<span className="arr"><Ic.Arrow width="16" /></span>
        <div className="meta"><h3 className="display">{t.label}</h3><small>{t.count} {t.count === 1 ? 'style' : 'styles'}</small></div></Link></Reveal>) : Array.from({ length: 8 }, (_, i) => <div key={i} className="skel tile" />)}</div>
    </div></section>

    <section className="section white" aria-labelledby="coll"><div className="container">
      <Reveal className="sec-head"><div><p className="eyebrow">Featured collections</p><h2 id="coll" className="display h-lg">Curated for buyers</h2></div>
        <div className="tabs-inline" role="tablist">{COLLECTIONS.map(([l], i) => <button key={l} role="tab" aria-selected={tab === i} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>{l}</button>)}</div></Reveal>
      {cl ? <GridSkeleton n={4} /> : coll[tab]?.length ? <Carousel label={COLLECTIONS[tab][0]}>{coll[tab].map(p => <ProductCard key={p.id} p={p} />)}</Carousel> : <div className="empty"><h3>Nothing here yet</h3><p className="mute">No products match this collection right now.</p></div>}
    </div></section>

    <section className="section" aria-labelledby="adv"><div className="container">
      <Reveal className="sec-head"><div><p className="eyebrow">Wholesale advantages</p><h2 id="adv" className="display h-lg">Built for the way<br />businesses buy</h2></div></Reveal>
      <Reveal><div className="adv">{ADV.map(([I, h, p]) => <div key={h}><I /><h3 className="display">{h}</h3><p>{p}</p></div>)}</div></Reveal>
    </div></section>

    {mfr.data?.length > 0 && <section className="section white" aria-labelledby="mf"><div className="container">
      <Reveal className="sec-head"><div><p className="eyebrow">Featured manufacturers</p><h2 id="mf" className="display h-lg">The makers behind the collections</h2></div><Link className="link" to="/shop">Shop all manufacturers</Link></Reveal>
      <div className="mfr">{mfr.data.slice(0, 6).map((x, i) => <Reveal key={x.id} delay={(i % 3) * .08}><Link to={'/shop?seller=' + x.id} className="mfr-card"><div><p className="label">{(x.categories || []).slice(0, 3).join(' · ')}</p><p className="name">{x.company}</p></div>
        <div className="imgs">{(x.images || []).slice(0, 3).map(u => <img key={u} src={img(u, 400)} alt="" loading="lazy" />)}</div><span className="link" style={{ justifySelf: 'start' }}>{x.n} {x.n === 1 ? 'style' : 'styles'} →</span></Link></Reveal>)}</div>
    </div></section>}

    <section className="cta-band section dark" style={{ padding: 0 }}><div className="bg"><img src={img(CTA_BG.split('?')[0], 2000)} alt="" loading="lazy" /></div>
      <div className="container in"><Reveal><p className="eyebrow">For businesses</p></Reveal><Reveal delay={.08}><h2 className="display h-xl" style={{ maxWidth: '16ch', color: '#fff' }}>BUILD YOUR BUSINESS WITH BETTER SOURCING</h2></Reveal>
        <Reveal delay={.16}><p className="lead" style={{ margin: '0 auto', color: '#d6d1c5' }}>Discover collections, compare wholesale prices, and simplify your bulk purchasing.</p></Reveal>
        <Reveal delay={.24}><div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}><Link className="btn light" to="/shop">Start shopping</Link><Link className="btn line-light" to="/register?role=buyer">Create business account</Link></div></Reveal></div></section>
  </>;
}
