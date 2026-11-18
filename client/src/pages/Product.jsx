import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { useCart } from '../cart.jsx';
import { img, money, money2, srcSet } from '../lib.js';
import BulkMatrix from '../components/BulkMatrix.jsx';
import ProductCard from '../components/ProductCard.jsx';
import Carousel from '../components/Carousel.jsx';
import * as Ic from '../components/icons.jsx';
import { AnimatePresence, m, Reveal } from '../components/motion.jsx';

const SIZE_GUIDE = [['S', '52', '68'], ['M', '55', '70'], ['L', '58', '72'], ['XL', '61', '74'], ['XXL', '64', '76'], ['3XL', '67', '78']];

function Gallery({ p }) {
  const imgs = [p.image, ...(p.gallery || [])].filter(Boolean), [i, setI] = useState(0), [zoom, setZoom] = useState(false), [lb, setLb] = useState(false), st = useRef(), mt = useRef();
  useEffect(() => setI(0), [p.id]);
  const move = e => { const r = st.current.getBoundingClientRect(); st.current.style.setProperty('--ox', ((e.clientX - r.left) / r.width * 100) + '%'); st.current.style.setProperty('--oy', ((e.clientY - r.top) / r.height * 100) + '%'); };
  const [dot, setDot] = useState(0);
  return <div><div className={'gal' + (imgs.length > 1 ? '' : ' solo')}>
    {imgs.length > 1 && <div className="thumbs">{imgs.map((u, k) => <button key={u} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Image ${k + 1}`}><img src={img(u, 200)} alt="" loading="lazy" /></button>)}</div>}
    <div className="stage" ref={st} onMouseEnter={() => matchMedia('(hover:hover)').matches && setZoom(true)} onMouseLeave={() => setZoom(false)} onMouseMove={move} onClick={() => setLb(true)} role="button" tabIndex={0} aria-label="Open full-size image" onKeyDown={e => e.key === 'Enter' && setLb(true)}>
      <AnimatePresence mode="wait"><m.img key={imgs[i]} src={img(imgs[i], 1600)} srcSet={srcSet(imgs[i])} sizes="(max-width:1000px) 100vw, 55vw" alt={p.name} className={zoom ? 'zoomed' : ''} style={zoom ? { transform: 'scale(2)' } : undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .25 }} fetchpriority="high" /></AnimatePresence>
      <span className="hint">Hover to zoom · click to enlarge</span></div>
    <div className="carousel-m" ref={mt} onScroll={e => setDot(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>{imgs.map(u => <img key={u} src={img(u, 1000)} alt={p.name} loading="lazy" />)}</div></div>
    {imgs.length > 1 && <div className="dots-m">{imgs.map((_, k) => <i key={k} className={k === dot ? 'on' : ''} />)}</div>}
    <AnimatePresence>{lb && <m.div className="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLb(false)} role="dialog" aria-label="Full-size image"><img src={img(imgs[i], 3200)} alt={p.name} /></m.div>}</AnimatePresence></div>;
}

export default function Product() {
  const [sp] = useSearchParams(), slug = sp.get('p') || '', nav = useNavigate(), { wish, toggleWish } = useCart(), initialQty = +sp.get('qty') || 0;
  const { data, error, loading } = useAsync(() => api('/products/' + encodeURIComponent(slug)), [slug]);
  const together = useAsync(() => api(`/products/${encodeURIComponent(slug)}/together`).catch(() => []), [slug]);
  const pol = useAsync(() => api('/policies').catch(() => null), []);
  const apiRef = useRef(), [totals, setTotals] = useState({ total: 0, unit: 0 });
  const p = data?.product;

  useEffect(() => { // SEO: title, description, structured data; recently viewed
    if (!p) return;
    document.title = `${p.name} (${p.sku}) — Wholesale | Bulk Buyers`;
    const md = document.querySelector('meta[name=description]'); const prev = md?.content; if (md) md.content = `${p.name} — wholesale $${p.price_min}–$${p.price_max} per piece, MOQ ${p.moq}. ${p.fabric}. ${p.sub_name || p.category_name}.`.slice(0, 300);
    const ld = document.createElement('script'); ld.type = 'application/ld+json';
    ld.text = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.sku, image: [p.image, ...(p.gallery || [])].filter(Boolean), description: p.description, brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined, category: [p.category_name, p.sub_name].filter(Boolean).join(' > '),
      offers: { '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: p.price_min, highPrice: p.price_max, offerCount: p.price_tiers?.length || 1, availability: p.stock_qty > 0 || p.stock_qty === 0 ? 'https://schema.org/InStock' : undefined } });
    document.head.appendChild(ld);
    try { const r = JSON.parse(localStorage.getItem('bb_recent') || '[]').filter(x => x.slug !== p.slug); r.unshift({ slug: p.slug, name: p.name, image: p.image, price: p.price_min, sku: p.sku }); localStorage.setItem('bb_recent', JSON.stringify(r.slice(0, 12))); } catch { /* storage unavailable */ }
    return () => { ld.remove(); if (md && prev != null) md.content = prev; };
  }, [p]);

  if (loading) return <div className="container pdp"><div className="skel" style={{ aspectRatio: '4/5' }} /><div style={{ display: 'grid', gap: 14 }}><div className="skel" style={{ height: 40 }} /><div className="skel" style={{ height: 20, width: '50%' }} /><div className="skel" style={{ height: 320 }} /></div></div>;
  if (error || !p) return <div className="container"><div className="empty"><h3>Product not found</h3><p className="mute">It may have been removed or is awaiting approval.</p><Link className="btn" to="/shop">Back to collections</Link></div></div>;
  const on = wish.has(p.id), apparel = !['footwear', 'accessories'].includes(p.category);
  const together4 = (together.data || []).slice(0, 4), tot = totals.total;

  return <div className={tot > 0 ? 'has-sticky' : ''}><div className="container">
    <div className="crumbs" style={{ paddingTop: 22 }}><Link to="/">Home</Link>/<Link to="/shop">Shop</Link>/<Link to={'/shop?cat=' + p.category}>{p.category_name}</Link>{p.sub_name && <>/<Link to={`/shop?cat=${p.category}&sub=${p.subcategory}`}>{p.sub_name}</Link></>}</div>
    <div className="pdp">
      <Gallery p={p} />
      <div className="pinfo">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{p.featured ? <span className="badge">Featured</span> : null}{p.discount_pct >= 40 && <span className="badge accent">Bulk −{p.discount_pct}% vs MRP</span>}<span className="badge mute">{p.group_name}</span></div>
        <div><p className="eyebrow">{p.brand || p.seller_company}</p><h1 className="display" style={{ marginTop: 8 }}>{p.name}</h1></div>
        <div className="meta-line"><span>SKU <b>{p.sku}</b></span><span>By <Link to={'/shop?seller=' + p.seller_id} style={{ textDecoration: 'underline' }}><b>{p.seller_company}</b></Link></span><span>MOQ <b>{p.moq} pcs</b></span></div>
        <div className="pprice"><b className="num">{money2(p.price_min)}{p.price_max !== p.price_min && ` – ${money2(p.price_max)}`}</b><span className="mute">per pc, wholesale (excl. GST)</span><s className="num">MRP {money(p.mrp)}</s></div>
        <div className="pbox" id="order"><BulkMatrix p={p} initialQty={initialQty} onTotals={setTotals} apiRef={apiRef} /></div>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="link" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }} onClick={() => toggleWish(p.id, () => nav('/login?next=' + encodeURIComponent(`/product?p=${p.slug}`)))}><Ic.Heart width="15" style={{ fill: on ? 'currentColor' : 'none' }} />{on ? 'Saved to wishlist' : 'Add to wishlist'}</button>
          <span className="label" style={{ display: 'inline-flex', gap: 8 }}><Ic.Shield width="15" />Verified manufacturer</span><span className="label" style={{ display: 'inline-flex', gap: 8 }}><Ic.Truck width="15" />Ships from factory</span></div>
      </div></div>

    <Reveal><div className="accordion" style={{ maxWidth: 920, marginBottom: 80 }}>
      <details open><summary>Product description</summary><div className="bd"><p>{p.description}</p></div></details>
      <details><summary>Fabric details</summary><div className="bd"><table className="spec"><tbody><tr><td>Fabric / material</td><td>{p.fabric || '—'}</td></tr>{p.gsm > 0 && <tr><td>Weight</td><td>{p.gsm} {p.gsm < 30 ? 'oz' : 'GSM'}</td></tr>}{p.pattern && <tr><td>Pattern</td><td>{p.pattern}</td></tr>}{p.season && <tr><td>Season</td><td>{p.season}</td></tr>}</tbody></table></div></details>
      <details><summary>Specifications</summary><div className="bd"><table className="spec"><tbody>
        <tr><td>Category</td><td>{[p.group_name, p.category_name, p.sub_name].filter(Boolean).join(' › ')}</td></tr><tr><td>SKU</td><td>{p.sku}</td></tr>{p.brand && <tr><td>Brand</td><td>{p.brand}</td></tr>}<tr><td>Manufacturer</td><td>{p.seller_company}</td></tr>
        {(p.gender || p.age_group) && <tr><td>For</td><td>{[p.gender, p.age_group].filter(Boolean).join(' · ')}</td></tr>}<tr><td>Fit</td><td>{p.fit || '—'}</td></tr><tr><td>Sizes</td><td>{p.size_options.join(', ')}</td></tr><tr><td>Colours</td><td>{p.colors.length}</td></tr>
        <tr><td>MOQ</td><td>{p.moq} pcs</td></tr><tr><td>Lead time</td><td>{p.lead_days} days (made to order)</td></tr>{p.hsn_code && <tr><td>HSN code</td><td>{p.hsn_code}</td></tr>}<tr><td>GST</td><td>{p.gst_rate}%</td></tr>{p.barcode && <tr><td>Barcode</td><td>{p.barcode}</td></tr>}
        <tr><td>Availability</td><td>{p.stock_qty > 0 ? `${p.stock_qty.toLocaleString('en-US')} pcs ready stock` : 'Made to order'}</td></tr></tbody></table></div></details>
      {apparel && <details><summary>Size guide</summary><div className="bd"><p className="mute">Indicative garment measurements in cm. Exact grading is confirmed in the manufacturer’s tech pack — ask for it with your quotation.</p>
        <table className="sg"><thead><tr><th>Size</th><th>Chest</th><th>Length</th></tr></thead><tbody>{SIZE_GUIDE.map(r => <tr key={r[0]}>{r.map(c => <td key={c}>{c}</td>)}</tr>)}</tbody></table></div></details>}
      <details><summary>Shipping information</summary><div className="bd">{pol.data?.shipping || 'Loading…'}</div></details>
      <details><summary>Return policy</summary><div className="bd">{pol.data?.returns || 'Loading…'}</div></details>
    </div></Reveal>

    {together4.length > 0 && <section className="section tight"><div className="sec-head"><div><p className="eyebrow">Complete the order</p><h2 className="h-lg">Frequently purchased together</h2></div></div>
      <div className="pgrid">{together4.map(x => <ProductCard key={x.id} p={x} />)}</div></section>}
    {data.related.length > 0 && <section className="section tight" style={{ paddingBottom: 90 }}><div className="sec-head"><div><p className="eyebrow">You may also like</p><h2 className="h-lg">Related products</h2></div></div>
      <Carousel label="Related products">{data.related.map(x => <ProductCard key={x.id} p={x} />)}</Carousel></section>}
  </div>
    <div className="stickybar" role="region" aria-label="Order summary"><div><b className="num" style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>{tot} pcs</b><div className="label">{tot > 0 ? money2(tot * totals.unit) + ' excl. GST' : 'Select quantities above'}</div></div>
      <button className="btn" onClick={() => tot > 0 ? apiRef.current?.add() : document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' })}>{tot > 0 ? 'Add to cart' : 'Select sizes'}</button></div>
  </div>;
}
