// RFQ → quote → order workflow, notifications and wishlist (all authenticated).
const router = require('express').Router();
const { q, getSetting } = require('../db');
const { requireAuth, requireRole, notify, notifyAdmins } = require('../auth');
const { str, num, int, page, hydrateProduct } = require('../util');

const ORDER_FLOW = ['confirmed', 'in_production', 'quality_check', 'shipped', 'delivered'];

/* ---------- RFQs ---------- */
router.get('/rfqs', requireRole('buyer', 'seller', 'admin'), (req, res) => {
  const u = req.user, base = `SELECT r.*, b.name AS buyer_name, b.company AS buyer_company, b.country AS buyer_country,
    (SELECT COUNT(*) FROM quotes WHERE rfq_id=r.id) AS quote_count`;
  let rows;
  if (u.role === 'buyer') rows = q.all(`${base} FROM rfqs r JOIN users b ON b.id=r.buyer_id WHERE r.buyer_id=? ORDER BY r.id DESC`, u.id);
  else if (u.role === 'admin') rows = q.all(`${base} FROM rfqs r JOIN users b ON b.id=r.buyer_id ORDER BY r.id DESC LIMIT 300`);
  else rows = q.all(`${base}, (SELECT id FROM quotes WHERE rfq_id=r.id AND seller_id=?) AS my_quote_id,
      (SELECT status FROM quotes WHERE rfq_id=r.id AND seller_id=?) AS my_quote_status,
      (SELECT price FROM quotes WHERE rfq_id=r.id AND seller_id=?) AS my_quote_price
      FROM rfqs r JOIN users b ON b.id=r.buyer_id
      WHERE (r.status='open' AND (r.category IS NULL OR r.category IN (SELECT DISTINCT category FROM products WHERE seller_id=?)))
         OR r.id IN (SELECT rfq_id FROM quotes WHERE seller_id=?) ORDER BY r.id DESC`, u.id, u.id, u.id, u.id, u.id);
  res.json(rows);
});

router.post('/rfqs', requireRole('buyer'), (req, res) => {
  const b = req.body || {};
  let title = str(b.title, 160), category = str(b.category, 40) || null, productId = int(b.productId) || null;
  if (productId) {
    const p = q.get("SELECT id,name,category FROM products WHERE id=? AND status='approved'", productId);
    if (!p) return res.status(400).json({ error: 'Product not available' });
    title = title || p.name; category = p.category;
  } else productId = null;
  const quantity = int(b.quantity);
  if (title.length < 3) return res.status(400).json({ error: 'Tell us what you need (title)' });
  if (quantity < 1 || quantity > 10_000_000) return res.status(400).json({ error: 'Enter a valid quantity' });
  if (category && !q.get('SELECT id FROM categories WHERE id=?', category)) category = null;
  const r = q.run('INSERT INTO rfqs(buyer_id,product_id,category,title,quantity,target_price,destination,needed_by,notes) VALUES(?,?,?,?,?,?,?,?,?)',
    req.user.id, productId, category, title, quantity, Math.max(0, num(b.targetPrice)), str(b.destination, 120), str(b.neededBy, 20), str(b.notes, 2000));
  // Alert sellers who list in this category + admins.
  const sellers = category ? q.all("SELECT DISTINCT u.id FROM users u JOIN products p ON p.seller_id=u.id WHERE u.status='active' AND p.category=?", category)
                           : q.all("SELECT id FROM users WHERE role='seller' AND status='active'");
  sellers.forEach(s => notify(s.id, `New RFQ: ${title} × ${quantity.toLocaleString('en-IN')}`, '#rfqs'));
  notifyAdmins(`RFQ #${r.lastInsertRowid} posted by ${req.user.name}`, '#rfqs');
  res.status(201).json({ ok: true, id: Number(r.lastInsertRowid) });
});

function canSeeRfq(user, rfq) {
  if (user.role === 'admin') return true;
  if (user.role === 'buyer') return rfq.buyer_id === user.id;
  return user.role === 'seller';
}
router.get('/rfqs/:id', requireRole('buyer', 'seller', 'admin'), (req, res) => {
  const rfq = q.get('SELECT r.*, b.name buyer_name, b.company buyer_company FROM rfqs r JOIN users b ON b.id=r.buyer_id WHERE r.id=?', int(req.params.id));
  if (!rfq || !canSeeRfq(req.user, rfq)) return res.status(404).json({ error: 'RFQ not found' });
  let quotes = q.all('SELECT qt.*, s.company seller_company, s.name seller_name FROM quotes qt JOIN users s ON s.id=qt.seller_id WHERE qt.rfq_id=? ORDER BY qt.price', rfq.id);
  if (req.user.role === 'seller') quotes = quotes.filter(x => x.seller_id === req.user.id);
  if (req.user.role !== 'buyer' && req.user.role !== 'admin') delete rfq.buyer_name;
  res.json({ rfq, quotes });
});

router.put('/rfqs/:id/close', requireRole('buyer'), (req, res) => {
  const r = q.run("UPDATE rfqs SET status='closed' WHERE id=? AND buyer_id=? AND status='open'", int(req.params.id), req.user.id);
  r.changes ? res.json({ ok: true }) : res.status(400).json({ error: 'Cannot close this RFQ' });
});

/* ---------- Quotes ---------- */
router.post('/rfqs/:id/quotes', requireRole('seller'), (req, res) => {
  if (req.user.status !== 'active') return res.status(403).json({ error: 'Your seller account is awaiting admin verification' });
  const rfq = q.get("SELECT * FROM rfqs WHERE id=? AND status='open'", int(req.params.id));
  if (!rfq) return res.status(404).json({ error: 'RFQ is no longer open' });
  const price = num(req.body?.price), lead = int(req.body?.leadDays, 30);
  if (price <= 0) return res.status(400).json({ error: 'Enter a price per piece' });
  if (lead < 1 || lead > 365) return res.status(400).json({ error: 'Lead time must be 1–365 days' });
  const existing = q.get('SELECT id,status FROM quotes WHERE rfq_id=? AND seller_id=?', rfq.id, req.user.id);
  if (existing && existing.status !== 'pending') return res.status(400).json({ error: 'This quote can no longer be edited' });
  if (existing) q.run('UPDATE quotes SET price=?,lead_days=?,notes=? WHERE id=?', price, lead, str(req.body?.notes, 1000), existing.id);
  else q.run('INSERT INTO quotes(rfq_id,seller_id,price,lead_days,notes) VALUES(?,?,?,?,?)', rfq.id, req.user.id, price, lead, str(req.body?.notes, 1000));
  notify(rfq.buyer_id, `${req.user.company || req.user.name} quoted ₹${price}/pc on "${rfq.title}"`, '#rfqs');
  res.status(existing ? 200 : 201).json({ ok: true });
});

router.post('/quotes/:id/accept', requireRole('buyer'), (req, res) => {
  const qt = q.get('SELECT qt.*, r.buyer_id, r.title, r.quantity, r.destination, r.status rfq_status FROM quotes qt JOIN rfqs r ON r.id=qt.rfq_id WHERE qt.id=?', int(req.params.id));
  if (!qt || qt.buyer_id !== req.user.id) return res.status(404).json({ error: 'Quote not found' });
  if (qt.rfq_status !== 'open' || qt.status !== 'pending') return res.status(400).json({ error: 'This quote can no longer be accepted' });
  const pct = num(getSetting('commission_pct', '3'), 3) / 100;
  const total = Math.round(qt.price * qt.quantity);
  const orderId = q.tx(() => {
    q.run("UPDATE quotes SET status='accepted' WHERE id=?", qt.id);
    q.all("SELECT seller_id FROM quotes WHERE rfq_id=? AND id!=? AND status='pending'", qt.rfq_id, qt.id).forEach(o => notify(o.seller_id, `Buyer chose another quote for "${qt.title}"`, '#rfqs'));
    q.run("UPDATE quotes SET status='rejected' WHERE rfq_id=? AND id!=? AND status='pending'", qt.rfq_id, qt.id);
    q.run("UPDATE rfqs SET status='accepted' WHERE id=?", qt.rfq_id);
    return Number(q.run('INSERT INTO orders(rfq_id,quote_id,buyer_id,seller_id,title,quantity,unit_price,total,commission,destination) VALUES(?,?,?,?,?,?,?,?,?,?)',
      qt.rfq_id, qt.id, qt.buyer_id, qt.seller_id, qt.title, qt.quantity, qt.price, total, Math.round(total * pct), qt.destination).lastInsertRowid);
  });
  notify(qt.seller_id, `🎉 Quote accepted — order #${orderId} for "${qt.title}" (₹${total.toLocaleString('en-IN')})`, '#orders');
  notifyAdmins(`Order #${orderId} confirmed — ₹${total.toLocaleString('en-IN')}`, '#orders');
  res.json({ ok: true, orderId });
});

/* ---------- Orders ---------- */
router.get('/orders', requireRole('buyer', 'seller', 'admin'), (req, res) => {
  const col = { buyer: 'o.buyer_id=?', seller: 'o.seller_id=?' }[req.user.role];
  const sql = `SELECT o.*, b.name buyer_name, b.company buyer_company, s.company seller_company, s.name seller_name
    FROM orders o JOIN users b ON b.id=o.buyer_id JOIN users s ON s.id=o.seller_id ${col ? 'WHERE ' + col : ''} ORDER BY o.id DESC LIMIT 500`;
  res.json(col ? q.all(sql, req.user.id) : q.all(sql));
});

router.put('/orders/:id/status', requireRole('buyer', 'seller', 'admin'), (req, res) => {
  const o = q.get('SELECT * FROM orders WHERE id=?', int(req.params.id));
  const next = req.body?.status;
  if (!o) return res.status(404).json({ error: 'Order not found' });
  const u = req.user, curIdx = ORDER_FLOW.indexOf(o.status);
  let allowed = false;
  if (u.role === 'admin') allowed = [...ORDER_FLOW, 'cancelled'].includes(next);
  else if (u.role === 'seller' && o.seller_id === u.id) allowed = (ORDER_FLOW.indexOf(next) === curIdx + 1 && next !== 'delivered') || (next === 'cancelled' && o.status === 'confirmed');
  else if (u.role === 'buyer' && o.buyer_id === u.id) allowed = (next === 'delivered' && o.status === 'shipped') || (next === 'cancelled' && o.status === 'confirmed');
  if (!allowed || o.status === next) return res.status(400).json({ error: 'That status change is not allowed' });
  q.run("UPDATE orders SET status=?, updated_at=datetime('now') WHERE id=?", next, o.id);
  const label = next.replace('_', ' ');
  if (u.id !== o.buyer_id) notify(o.buyer_id, `Order #${o.id} is now ${label}`, '#orders');
  if (u.id !== o.seller_id) notify(o.seller_id, `Order #${o.id} is now ${label}`, '#orders');
  res.json({ ok: true });
});

/* ---------- Notifications ---------- */
router.get('/notifications', requireAuth, (req, res) => {
  res.json({
    items: q.all('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 40', req.user.id),
    unread: q.get('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0', req.user.id).n
  });
});
router.post('/notifications/read', requireAuth, (req, res) => {
  q.run('UPDATE notifications SET read=1 WHERE user_id=?', req.user.id);
  res.json({ ok: true });
});

/* ---------- Wishlist ---------- */
router.get('/wishlist', requireAuth, (req, res) => {
  res.json(q.all(`SELECT p.id,p.slug,p.name,p.image,p.moq,p.price_min,p.price_max,p.colors FROM wishlist w JOIN products p ON p.id=w.product_id WHERE w.user_id=? AND p.status='approved'`, req.user.id).map(hydrateProduct));
});
router.post('/wishlist/:productId', requireAuth, (req, res) => {
  const pid = int(req.params.productId);
  if (!q.get('SELECT id FROM products WHERE id=?', pid)) return res.status(404).json({ error: 'Product not found' });
  const has = q.get('SELECT 1 x FROM wishlist WHERE user_id=? AND product_id=?', req.user.id, pid);
  if (has) q.run('DELETE FROM wishlist WHERE user_id=? AND product_id=?', req.user.id, pid);
  else q.run('INSERT INTO wishlist(user_id,product_id) VALUES(?,?)', req.user.id, pid);
  res.json({ wished: !has });
});

module.exports = router;
