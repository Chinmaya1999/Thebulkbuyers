// RFQ → quote → order workflow, notifications and wishlist (all authenticated).
const router = require('express').Router();
const { q, getSetting } = require('../db');
const { requireAuth, requireRole, notify, notifyAdmins } = require('../auth');
const { str, num, int, GSTIN_RE } = require('../util');
const { priceCart, r2 } = require('../pricing');
const { acceptQuote, quoteForAccept } = require('../workflow');

const ORDER_FLOW = ['confirmed', 'in_production', 'quality_check', 'shipped', 'delivered'];
const inr = n => Number(n).toLocaleString('en-IN');

/* ---------- RFQs ---------- */
router.get('/rfqs', requireRole('buyer', 'admin'), async (req, res) => {
  const u = req.user, base = `SELECT r.*, b.name AS buyer_name, b.company AS buyer_company, b.country AS buyer_country,
    (SELECT COUNT(*) FROM quotes WHERE rfq_id=r.id) AS quote_count`;
  res.json(u.role === 'buyer'
    ? await q.all(`${base} FROM rfqs r JOIN users b ON b.id=r.buyer_id WHERE r.buyer_id=? ORDER BY r.id DESC`, u.id)
    : await q.all(`${base} FROM rfqs r JOIN users b ON b.id=r.buyer_id ORDER BY r.id DESC LIMIT 300`));
});

router.post('/rfqs', requireRole('buyer'), async (req, res) => {
  const b = req.body || {};
  let title = str(b.title, 160), category = str(b.category, 40) || null, productId = int(b.productId) || null;
  if (productId) {
    const p = await q.get("SELECT id,name,category FROM products WHERE id=? AND status='approved'", productId);
    if (!p) return res.status(400).json({ error: 'Product not available' });
    title = title || p.name; category = p.category;
  } else productId = null;
  const quantity = int(b.quantity);
  if (title.length < 3) return res.status(400).json({ error: 'Tell us what you need (title)' });
  if (quantity < 1 || quantity > 10_000_000) return res.status(400).json({ error: 'Enter a valid quantity' });
  if (category && !(await q.get('SELECT id FROM categories WHERE id=?', category))) category = null;
  const id = await q.insert('INSERT INTO rfqs(buyer_id,product_id,category,title,quantity,target_price,destination,needed_by,notes) VALUES(?,?,?,?,?,?,?,?,?)',
    req.user.id, productId, category, title, quantity, Math.max(0, num(b.targetPrice)), str(b.destination, 120), str(b.neededBy, 20), str(b.notes, 2000));
  await notifyAdmins(`RFQ #${id} posted by ${req.user.name}`, '#rfqs');
  res.status(201).json({ ok: true, id });
});

router.get('/rfqs/:id', requireRole('buyer', 'admin'), async (req, res) => {
  const rfq = await q.get('SELECT r.*, b.name buyer_name, b.company buyer_company FROM rfqs r JOIN users b ON b.id=r.buyer_id WHERE r.id=?', int(req.params.id));
  if (!rfq || (req.user.role === 'buyer' && rfq.buyer_id !== req.user.id)) return res.status(404).json({ error: 'RFQ not found' });
  const quotes = await q.all('SELECT qt.*, s.company seller_company, s.name seller_name FROM quotes qt JOIN users s ON s.id=qt.seller_id WHERE qt.rfq_id=? ORDER BY qt.price', rfq.id);
  res.json({ rfq, quotes });
});

router.put('/rfqs/:id/close', requireRole('buyer'), async (req, res) => {
  const r = await q.run("UPDATE rfqs SET status='closed' WHERE id=? AND buyer_id=? AND status='open'", int(req.params.id), req.user.id);
  r.changes ? res.json({ ok: true }) : res.status(400).json({ error: 'Cannot close this RFQ' });
});

/* ---------- Quotes (created by admin; buyers accept) ---------- */
router.post('/quotes/:id/accept', requireRole('buyer'), async (req, res) => {
  const qt = await quoteForAccept(int(req.params.id));
  if (!qt || qt.buyer_id !== req.user.id) return res.status(404).json({ error: 'Quote not found' });
  if (qt.rfq_status !== 'open' || qt.status !== 'pending') return res.status(400).json({ error: 'This quote can no longer be accepted' });
  res.json({ ok: true, orderId: await acceptQuote(qt) });
});

/* ---------- Cart pricing + checkout (wholesale ≥ MOQ, retail below) ---------- */
const bad = m => Object.assign(new Error(m), { status: 400 });
// Authoritative totals for the cart UI: tier pricing, GST, savings, stock validation.
router.post('/cart/price', async (req, res) => res.json(await priceCart(req.body?.items)));

const addr = a => ({ name: str(a?.name, 80), phone: str(a?.phone, 30), line1: str(a?.line1 ?? a?.address, 300), line2: str(a?.line2, 120), city: str(a?.city, 80), state: str(a?.state, 60), pincode: str(a?.pincode, 12), country: str(a?.country, 60) || 'India' });
const variantText = lines => lines.filter(l => l.qty).map(l => [l.color && l.color, l.size, '× ' + l.qty].filter(Boolean).join(' ')).join(' · ').slice(0, 900);

router.post('/orders/direct', requireRole('buyer'), async (req, res) => {
  const body = req.body || {}, ship = addr(body.shipping), bill = body.billing ? addr(body.billing) : ship, biz = body.business || {};
  const gstin = str(biz.gstin, 20).toUpperCase();
  if (!Array.isArray(body.items) || !body.items.length) return res.status(400).json({ error: 'Your cart is empty' });
  if (!ship.name || ship.phone.length < 7 || ship.line1.length < 6 || !ship.city) return res.status(400).json({ error: 'Please complete the shipping name, phone, address and city' });
  if (gstin && !GSTIN_RE.test(gstin)) return res.status(400).json({ error: 'GSTIN looks invalid — it should be 15 characters, e.g. 29ABCDE1234F1Z5' });
  const method = ['standard', 'pickup'].includes(body.shipping_method) ? body.shipping_method : 'standard', payment = ['cod', 'bank_transfer'].includes(body.payment_method) ? body.payment_method : 'cod';
  const pct = num(await getSetting('commission_pct', '3'), 3) / 100;
  const out = await q.tx(async t => {
    const priced = await priceCart(body.items, t);
    if (!priced.products.length) throw bad('One or more items are no longer available');
    if (priced.issues.length) throw bad(priced.issues[0].message);
    const made = [];
    for (const g of priced.products) {
      if (g.stock_qty > 0) { // lock + decrement ready stock (0 = made to order)
        const cur = await t.get('SELECT stock_qty FROM products WHERE id=? FOR UPDATE', g.productId);
        if (g.qty > cur.stock_qty) throw bad(`Only ${cur.stock_qty} of “${g.name}” in stock`);
        await t.run('UPDATE products SET stock_qty=stock_qty-? WHERE id=?', g.qty, g.productId);
      }
      const id = await t.insert(`INSERT INTO orders(buyer_id,seller_id,product_id,title,quantity,unit_price,total,gst_amount,commission,destination,channel,details,lines,shipping) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?::jsonb)`,
        req.user.id, g.seller_id, g.productId, g.name, g.qty, g.unit, g.taxable, g.gst, Math.round(g.taxable * pct), `${ship.city}, ${ship.country}`, g.channel, variantText(g.lines), JSON.stringify(g.lines),
        JSON.stringify({ ...ship, address: ship.line1, business: { company: str(biz.company, 120), contact: str(biz.contact, 80), email: str(biz.email, 120), phone: str(biz.phone, 30), gstin }, billing: bill, method, payment }));
      made.push({ id, total: g.taxable, gst: g.gst, grand: g.grand, channel: g.channel });
    }
    return { made, totals: priced.totals };
  });
  await notifyAdmins(`Order(s) #${out.made.map(o => o.id).join(', #')} placed by ${req.user.name}`, '#orders');
  res.status(201).json({ ok: true, orders: out.made, total: out.totals.subtotal, gst: out.totals.gst, grand: out.totals.grand });
});

/* ---------- Orders ---------- */
router.get('/orders', requireRole('buyer', 'admin'), async (req, res) => {
  const col = { buyer: 'o.buyer_id=?' }[req.user.role];
  const sql = `SELECT o.*, b.name buyer_name, b.company buyer_company, b.gst buyer_gst, b.email buyer_email, s.company seller_company, s.name seller_name, s.gst seller_gst, s.country seller_country,
      pr.slug product_slug, pr.image product_image, pr.sku product_sku, pr.hsn_code product_hsn, pr.gst_rate product_gst_rate
    FROM orders o JOIN users b ON b.id=o.buyer_id JOIN users s ON s.id=o.seller_id LEFT JOIN products pr ON pr.id=o.product_id ${col ? 'WHERE ' + col : ''} ORDER BY o.id DESC LIMIT 500`;
  res.json(col ? await q.all(sql, req.user.id) : await q.all(sql));
});

router.put('/orders/:id/status', requireRole('buyer', 'admin'), async (req, res) => {
  const o = await q.get('SELECT * FROM orders WHERE id=?', int(req.params.id));
  const next = req.body?.status;
  if (!o) return res.status(404).json({ error: 'Order not found' });
  const u = req.user;
  let allowed = false;
  if (u.role === 'admin') allowed = [...ORDER_FLOW, 'cancelled'].includes(next);
  else if (u.role === 'buyer' && o.buyer_id === u.id) allowed = (next === 'delivered' && o.status === 'shipped') || (next === 'cancelled' && o.status === 'confirmed');
  if (!allowed || o.status === next) return res.status(400).json({ error: 'That status change is not allowed' });
  await q.run('UPDATE orders SET status=?, updated_at=now() WHERE id=?', next, o.id);
  const label = next.replace('_', ' ');
  if (u.id !== o.buyer_id) await notify(o.buyer_id, `Order #${o.id} is now ${label}`, '#orders');
  res.json({ ok: true });
});

/* ---------- Notifications ---------- */
router.get('/notifications', requireAuth, async (req, res) => {
  res.json({
    items: await q.all('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 40', req.user.id),
    unread: (await q.get('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0', req.user.id)).n
  });
});
router.post('/notifications/read', requireAuth, async (req, res) => {
  await q.run('UPDATE notifications SET read=1 WHERE user_id=?', req.user.id);
  res.json({ ok: true });
});

/* ---------- Wishlist ---------- */
router.get('/wishlist', requireAuth, async (req, res) => {
  res.json(await q.all(`SELECT p.id,p.slug,p.name,p.image,p.moq,p.price_min,p.price_max,p.colors FROM wishlist w JOIN products p ON p.id=w.product_id WHERE w.user_id=? AND p.status='approved'`, req.user.id));
});
router.post('/wishlist/:productId', requireAuth, async (req, res) => {
  const pid = int(req.params.productId);
  if (!(await q.get('SELECT id FROM products WHERE id=?', pid))) return res.status(404).json({ error: 'Product not found' });
  const del = await q.run('DELETE FROM wishlist WHERE user_id=? AND product_id=?', req.user.id, pid);
  if (!del.changes) await q.run('INSERT INTO wishlist(user_id,product_id) VALUES(?,?) ON CONFLICT DO NOTHING', req.user.id, pid);
  res.json({ wished: !del.changes });
});

module.exports = router;
