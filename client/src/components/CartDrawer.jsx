import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../cart.jsx';
import { colorName, img, money, money2 } from '../lib.js';
import * as Ic from './icons.jsx';
import { AnimatePresence, m } from './motion.jsx';

export default function CartDrawer() {
  const { open, setOpen, items, priced, pricing, setQty, remove, count } = useCart(), nav = useNavigate();
  useEffect(() => { if (!open) return; const k = e => e.key === 'Escape' && setOpen(false); addEventListener('keydown', k); document.body.style.overflow = 'hidden'; return () => { removeEventListener('keydown', k); document.body.style.overflow = ''; }; }, [open, setOpen]);
  const groups = priced?.products || [], t = priced?.totals;
  return <AnimatePresence>{open && <>
    <m.div className="drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
    <m.aside className="panel-r" role="dialog" aria-label="Shopping cart" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: .38, ease: [.22, .8, .2, 1] }}>
      <div className="panel-h"><h3>Cart <span className="mute num" style={{ fontSize: 16, fontFamily: 'var(--sans)' }}>({count} pcs)</span></h3><button className="ic" onClick={() => setOpen(false)} aria-label="Close cart"><Ic.Close /></button></div>
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 24px' }}>
        {!items.length && <div className="empty" style={{ padding: '70px 0' }}><h3>Your cart is empty</h3><p className="mute">Add a size &amp; colour matrix from any product.</p><Link className="btn" to="/shop" onClick={() => setOpen(false)}>Explore collections</Link></div>}
        {groups.map(g => <div key={g.productId} style={{ padding: '18px 0', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', gap: 14 }}><img src={img(g.image, 200)} alt="" style={{ width: 70, aspectRatio: '3/4', objectFit: 'cover' }} />
            <div style={{ flex: 1 }}><Link to={'/product?p=' + g.slug} onClick={() => setOpen(false)} className="h-sm" style={{ fontFamily: 'var(--serif)', fontSize: 20, lineHeight: 1.1, display: 'block' }}>{g.name}</Link>
              <p className="label" style={{ marginTop: 4 }}>{g.channel === 'wholesale' ? 'Wholesale' : 'Retail'} · {money2(g.unit)}/pc · {g.qty} pcs</p>
              {g.toWholesale > 0 && <p style={{ fontSize: 11.5, color: 'var(--accent-d)', marginTop: 4 }}>Add {g.toWholesale} more for wholesale pricing</p>}
              {g.errors.map(e => <p key={e} className="form-err" style={{ marginTop: 4 }}>{e}</p>)}</div>
            <b className="num">{money(g.taxable)}</b></div>
          <div className="vlines">{items.filter(i => i.productId === g.productId).map(i => <div className="vline" key={i.key}><span className="cname"><i style={{ background: i.color }} />{i.color ? colorName(i.color) : '—'} · {i.size}</span>
            <span className="qstep"><button aria-label="Less" onClick={() => setQty(i.key, i.qty - 1)}><Ic.Minus width="13" /></button><input type="number" min="0" value={i.qty} aria-label="Quantity" onChange={e => setQty(i.key, +e.target.value || 0)} /><button aria-label="More" onClick={() => setQty(i.key, i.qty + 1)}><Ic.Plus width="13" /></button></span>
            <button className="rm" style={{ marginLeft: 'auto' }} onClick={() => remove(i.key)}>remove</button></div>)}</div></div>)}
        {items.length > 0 && !priced && <div className="skel" style={{ height: 120, margin: '20px 0' }} />}
      </div>
      {items.length > 0 && t && <div style={{ padding: '18px 24px', borderTop: '1px solid var(--ink)', display: 'grid', gap: 10, background: '#fff' }}>
        <div className="sumbox"><div><span>Subtotal</span><b className="num">{money2(t.subtotal)}</b></div>{t.bulkSavings > 0 && <div className="save"><span>Bulk discount</span><span className="num">− {money2(t.bulkSavings)}</span></div>}<div><span>GST</span><span className="num">{money2(t.gst)}</span></div><div className="grand"><span>Total</span><span className="num">{money2(t.grand)}</span></div></div>
        <div className="acts"><button className="btn block" disabled={pricing || priced.issues.length > 0} onClick={() => { setOpen(false); nav('/checkout'); }}>Checkout</button><button className="btn ghost block" onClick={() => { setOpen(false); nav('/cart'); }}>View full cart</button></div></div>}
    </m.aside></>}</AnimatePresence>;
}
