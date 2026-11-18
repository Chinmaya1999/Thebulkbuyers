import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../cart.jsx';
import { colorName, img, money2 } from '../lib.js';
import * as Ic from '../components/icons.jsx';
import { AnimatePresence, m } from '../components/motion.jsx';

export function Summary({ t, pricing, cta }) {
  return <aside className="summary" aria-label="Order summary"><h3 className="h-sm" style={{ fontSize: 26 }}>Order summary</h3>
    {!t ? <div className="skel" style={{ height: 160 }} /> : <div className="sumbox" style={{ opacity: pricing ? .55 : 1, transition: 'opacity .2s' }}>
      <div><span>Quantity</span><span className="num">{t.qty.toLocaleString('en-US')} pcs · {t.items} variants</span></div>
      <div><span>Subtotal</span><span className="num">{money2(t.subtotal)}</span></div>
      {t.customerSavings > 0 && <div className="save"><span>Your negotiated discount</span><span className="num">− {money2(t.customerSavings)}</span></div>}
      {t.bulkSavings > 0 && <div className="save"><span>Bulk discount applied</span><span className="num">− {money2(t.bulkSavings)}</span></div>}
      <div><span>Shipping</span><span className="mute">Confirmed on dispatch</span></div>
      <div className="grand"><span>Total</span><span className="num">{money2(t.grand)}</span></div>
      {t.mrpSavings > 0 && <p className="mute" style={{ fontSize: 12 }}>You save {money2(t.mrpSavings)} against MRP.</p>}</div>}
    {cta}</aside>;
}

export default function CartPage() {
  const { items, priced, pricing, setQty, remove, removeProduct, clear } = useCart(), nav = useNavigate();
  const groups = priced?.products || [], t = priced?.totals, blocked = !priced || priced.issues.length > 0;
  return <div className="container"><div className="crumbs" style={{ paddingTop: 22 }}><Link to="/">Home</Link>/<span>Cart</span></div>
    <h1 className="h-lg" style={{ margin: '14px 0 6px' }}>Your cart</h1>
    {!items.length ? <div className="empty"><h3>Your cart is empty</h3><p className="mute">Order size-and-colour matrices in bulk from any product page.</p><Link className="btn" to="/shop">Explore collections</Link></div> :
    <div className="cartpage"><div>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--ink)', paddingBottom: 10 }}><span className="label">{groups.length || '…'} product{groups.length === 1 ? '' : 's'} · grouped by variant</span><button className="rm" onClick={() => confirm('Remove everything from your cart?') && clear()}>Clear cart</button></div>
      {!priced && <div className="skel" style={{ height: 260, marginTop: 20 }} />}
      <AnimatePresence initial={false}>{groups.map(g => <m.div className="citem" key={g.productId} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}>
        <Link to={'/product?p=' + g.slug}><img src={img(g.image, 300)} alt="" /></Link>
        <div><Link to={'/product?p=' + g.slug}><h3 className="display">{g.name}</h3></Link><p className="label" style={{ marginTop: 4 }}>SKU {g.sku} · {g.seller_company}</p>
          <p style={{ marginTop: 8, fontSize: 13 }}><span className={'badge ' + (g.channel === 'wholesale' ? '' : 'mute')}>{g.channel === 'wholesale' ? 'Wholesale tier' : 'Retail pricing'}</span> <b className="num" style={{ marginLeft: 8 }}>{money2(g.unit)}</b> / pc {g.channel === 'wholesale' && g.bulkSavings > 0 && <span style={{ color: 'var(--ok)', marginLeft: 8 }}>bulk discount − {money2(g.bulkSavings)}</span>}</p>
          {g.toWholesale > 0 && <div className="notice warn" style={{ marginTop: 10, padding: '9px 12px' }}>Add <b>{g.toWholesale}</b> more pcs of this style for wholesale pricing (MOQ {g.moq}).</div>}
          {g.errors.map(e => <p className="form-err" key={e} style={{ marginTop: 8 }}>{e}</p>)}
          <div className="vlines">{items.filter(i => i.productId === g.productId).map(i => <div className="vline" key={i.key}><span className="cname"><i style={{ background: i.color }} />{i.color ? colorName(i.color) : 'Standard'} · {i.size}</span>
            <span className="qstep"><button aria-label="Decrease" onClick={() => setQty(i.key, i.qty - 1)}><Ic.Minus width="13" /></button><input type="number" min="0" value={i.qty} aria-label={`Quantity ${i.size}`} onChange={e => setQty(i.key, +e.target.value || 0)} /><button aria-label="Increase" onClick={() => setQty(i.key, i.qty + 1)}><Ic.Plus width="13" /></button></span>
            <button className="rm" onClick={() => remove(i.key)}>remove</button></div>)}</div></div>
        <div className="right" style={{ textAlign: 'right', display: 'grid', alignContent: 'space-between', justifyItems: 'end' }}><div><b className="num" style={{ fontSize: 20 }}>{money2(g.taxable)}</b><div className="label">{g.qty} pcs</div></div><button className="rm" onClick={() => removeProduct(g.productId)}>Remove product</button></div>
      </m.div>)}</AnimatePresence>
      <Link to="/shop" className="link" style={{ display: 'inline-block', marginTop: 26 }}>Continue shopping</Link></div>
      <Summary t={t} pricing={pricing} cta={<><button className="btn block" disabled={blocked || pricing} onClick={() => nav('/checkout')}>Proceed to checkout</button>{priced?.issues.map(i => <p className="form-err" key={i.message}>{i.message}</p>)}<p className="label" style={{ textAlign: 'center' }}>Invoice with GST breakdown for every order</p></>} />
    </div>}</div>;
}
