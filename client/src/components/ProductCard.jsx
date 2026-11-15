import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../cart.jsx';
import { useToast } from '../toast.jsx';
import { img, money, money2, spreadPack, srcSet } from '../lib.js';
import * as Ic from './icons.jsx';
import { AnimatePresence, m } from './motion.jsx';
import BulkMatrix from './BulkMatrix.jsx';

export function QuickView({ p, onClose }) {
  return <m.div className="modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <m.div className="modal" role="dialog" aria-modal="true" aria-label={'Quick view: ' + p.name} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ duration: .35, ease: [.22, .8, .2, 1] }}>
      <button className="x" onClick={onClose} aria-label="Close"><Ic.Close width="20" /></button>
      <div className="qv"><div className="im"><img src={img(p.image, 1000)} alt={p.name} /></div>
        <div className="info"><p className="label">{p.sub_name || p.category_name} · {p.sku}</p><h3 className="h-md">{p.name}</h3>
          <div className="pprice"><b>{money2(p.price_min)}–{money2(p.price_max)}</b><span className="mute">per pc · MOQ {p.moq}</span><s>MRP {money(p.mrp)}</s></div>
          <BulkMatrix p={p} compact /><Link className="link" to={'/product?p=' + p.slug} onClick={onClose} style={{ justifySelf: 'start' }}>View full details</Link></div></div>
    </m.div></m.div>;
}

export default function ProductCard({ p, view = 'grid' }) {
  const { wish, toggleWish, addLines } = useCart(), toast = useToast(), nav = useNavigate(), [qv, setQv] = useState(false), on = wish.has(p.id);
  const sizes = p.size_options || [], alt = p.gallery?.[0];
  const quickAdd = () => { const lines = spreadPack(p.moq, sizes.length ? sizes : ['Free size'], p.colors?.[0] || ''); addLines(p, lines); toast(`MOQ pack of ${p.moq} pcs added`); };
  const mto = p.stock_qty === 0;
  return <><m.article className="pc" layout={false}>
    <div className="pc-media"><Link to={'/product?p=' + p.slug} className="pc-img" aria-label={p.name}>
      <img src={img(p.image, 700)} srcSet={srcSet(p.image, [400, 700, 1000, 1400])} sizes="(max-width:900px) 50vw, 25vw" alt={p.name} loading="lazy" decoding="async" />
      {alt && <img className="alt" src={img(alt, 700)} alt="" loading="lazy" />}
      <span className="pc-badges">{p.discount_pct >= 40 && <span className="badge accent">Bulk −{p.discount_pct}%</span>}{p.featured ? <span className="badge">Featured</span> : null}</span></Link>
    <button className={'pc-wish' + (on ? ' on' : '')} aria-label={on ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={on} onClick={() => toggleWish(p.id, () => nav('/login?next=' + encodeURIComponent('/product?p=' + p.slug)))}><Ic.Heart /></button>
    <div className="pc-actions"><button onClick={() => setQv(true)}><Ic.Eye width="14" style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />Quick view</button><button onClick={quickAdd}>Add MOQ pack</button></div></div>
    <div className="pc-body">
      <span className="pc-brand">{p.brand || p.seller_company}</span>
      <Link to={'/product?p=' + p.slug} className="pc-name">{p.name}</Link>
      <span className="pc-sku">SKU {p.sku}</span>
      <div className="pc-price"><b className="num">{money2(p.price_min)}{p.price_max !== p.price_min && `–${money2(p.price_max)}`}</b><span className="per">/ pc wholesale</span><s>MRP {money(p.mrp)}</s></div>
      <div className="pc-meta"><span>MOQ <b>{p.moq}</b></span><i className="dot" /><span className={'stock ' + (mto ? 'mto' : 'in')}>{mto ? 'Made to order' : `In stock · ${p.stock_qty.toLocaleString('en-IN')}`}</span></div>
      <div className="pc-meta" style={{ marginTop: 6 }}><span className="sw-dots">{(p.colors || []).slice(0, 6).map(c => <i key={c} style={{ background: c }} />)}{p.colors?.length > 6 && <small>+{p.colors.length - 6}</small>}</span></div>
      {sizes.length > 0 && <div className="sizes-mini">{sizes.slice(0, 6).map(s => <span key={s}>{s}</span>)}{sizes.length > 6 && <span>+{sizes.length - 6}</span>}</div>}
    </div></m.article>
    <AnimatePresence>{qv && <QuickView p={p} onClose={() => setQv(false)} />}</AnimatePresence></>;
}
