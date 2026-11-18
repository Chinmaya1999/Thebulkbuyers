// Seller (manufacturer) dashboard API: own catalogue, orders to fulfil, RFQs to quote on, and payouts.
const router = require('express').Router();
const { q, getSetting } = require('../db');
const { requireRole, notify, notifyAdmins } = require('../auth');
const { str, num, int } = require('../util');
const { fields, createProduct, updateProduct } = require('../products');

router.use(requireRole('seller'));
router.post('/upload', require('../upload'));

/* ---------- overview ---------- */
router.get('/summary', async (req, res) => {
  const id = req.user.id;
  const [pc, oc, months, top, rfqs] = await Promise.all([
    q.get(`SELECT COUNT(*) total, COUNT(*) FILTER (WHERE status='approved') live, COUNT(*) FILTER (WHERE status='pending') pending, COUNT(*) FILTER (WHERE status='rejected') hidden, COALESCE(SUM(views),0) views FROM products WHERE seller_id=?`, id),
    q.get(`SELECT COUNT(*) FILTER (WHERE status!='cancelled') orders,
        COUNT(*) FILTER (WHERE status IN ('confirmed','in_production','quality_check','shipped')) active,
        COALESCE(SUM(total) FILTER (WHERE status!='cancelled'),0) sales,
        COALESCE(SUM(total-commission) FILTER (WHERE status!='cancelled'),0) net,
        COALESCE(SUM(total-commission) FILTER (WHERE status='delivered' AND payout_status='pending'),0) payout_due,
        COALESCE(SUM(total-commission) FILTER (WHERE payout_status='paid' AND status!='cancelled'),0) paid_out
      FROM orders WHERE seller_id=?`, id),
    q.all(`SELECT to_char(created_at,'YYYY-MM') m, SUM(total) v FROM orders WHERE seller_id=? AND status!='cancelled' GROUP BY m ORDER BY m DESC LIMIT 8`, id),
    q.all(`SELECT title, SUM(quantity) qty, SUM(total) v FROM orders WHERE seller_id=? AND status!='cancelled' GROUP BY title ORDER BY v DESC LIMIT 5`, id),
    q.get(`SELECT COUNT(*) n FROM rfqs r WHERE r.status='open' AND NOT EXISTS (SELECT 1 FROM quotes x WHERE x.rfq_id=r.id AND x.seller_id=?)`, id)
  ]);
  res.json({ products: pc, orders: oc, months: months.reverse(), top, open_rfqs: rfqs.n, status: req.user.status });
});

/* ---------- catalogue ---------- */
router.get('/products', async (req, res) => {
  res.json(await q.all(`SELECT id,slug,name,sku,brand,category,moq,price_min,price_max,stock_qty,status,views,image FROM products WHERE seller_id=? ORDER BY id DESC`, req.user.id));
});
router.get('/products/:id', async (req, res) => {
  const p = await q.get('SELECT * FROM products WHERE id=? AND seller_id=?', int(req.params.id), req.user.id);
  p ? res.json(p) : res.status(404).json({ error: 'Product not found' });
});
// New listings go to the admin for approval before they appear on the storefront.
router.post('/products', async (req, res) => {
  const { f, err } = await fields(req.body || {});
  if (err) return res.status(400).json({ error: err });
  const id = await createProduct(f, req.user.id, 'pending');
  await notifyAdmins(`New product from ${req.user.company || req.user.name}: ${f.name}`, '#products');
  res.status(201).json({ ok: true, id });
});
router.put('/products/:id', async (req, res) => {
  const p = await q.get('SELECT * FROM products WHERE id=? AND seller_id=?', int(req.params.id), req.user.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const { f, err } = await fields({ image: p.image, ...(req.body || {}) }, p.id);
  if (err) return res.status(400).json({ error: err });
  await updateProduct(p.id, f); // status/featured stay under admin control
  res.json({ ok: true });
});
router.delete('/products/:id', async (req, res) => {
  const r = await q.run('DELETE FROM products WHERE id=? AND seller_id=?', int(req.params.id), req.user.id);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Product not found' });
});

/* ---------- orders to fulfil ---------- */
const STEPS = ['confirmed', 'in_production', 'quality_check', 'shipped'];
router.get('/orders', async (req, res) => {
  res.json(await q.all(`SELECT o.id,o.title,o.quantity,o.unit_price,o.total,o.commission,o.status,o.payout_status,o.tracking_no,o.destination,o.channel,o.lines,o.created_at,o.updated_at,
      b.company buyer_company, b.name buyer_name
    FROM orders o JOIN users b ON b.id=o.buyer_id WHERE o.seller_id=? ORDER BY o.id DESC LIMIT 500`, req.user.id));
});
// Sellers move an order forward through production and dispatch; delivery is confirmed by the buyer or admin.
router.put('/orders/:id/status', async (req, res) => {
  const o = await q.get('SELECT * FROM orders WHERE id=? AND seller_id=?', int(req.params.id), req.user.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  const next = req.body?.status, tracking = req.body?.tracking_no === undefined ? o.tracking_no : str(req.body.tracking_no, 80);
  if (next === undefined || next === o.status) { // tracking number only
    await q.run('UPDATE orders SET tracking_no=?, updated_at=now() WHERE id=?', tracking, o.id);
    return res.json({ ok: true });
  }
  const from = STEPS.indexOf(o.status), to = STEPS.indexOf(next);
  if (from < 0 || to <= from) return res.status(400).json({ error: 'That status change is not allowed' });
  await q.run('UPDATE orders SET status=?, tracking_no=?, updated_at=now() WHERE id=?', next, tracking, o.id);
  await notify(o.buyer_id, `Order #${o.id} is now ${next.replace('_', ' ')}`, '#orders');
  res.json({ ok: true });
});

/* ---------- quotation requests ---------- */
router.get('/rfqs', async (req, res) => {
  res.json(await q.all(`SELECT r.id,r.title,r.category,r.quantity,r.target_price,r.destination,r.needed_by,r.notes,r.created_at,
      x.id quote_id, x.price quote_price, x.lead_days quote_lead, x.notes quote_notes, x.status quote_status
    FROM rfqs r LEFT JOIN quotes x ON x.rfq_id=r.id AND x.seller_id=?
    WHERE r.status='open' OR x.id IS NOT NULL ORDER BY (x.id IS NULL) DESC, r.id DESC LIMIT 200`, req.user.id));
});
router.post('/rfqs/:id/quote', async (req, res) => {
  if (req.user.status !== 'active') return res.status(403).json({ error: 'Your account is awaiting approval — you can quote once it is active.' });
  const rfq = await q.get("SELECT * FROM rfqs WHERE id=? AND status='open'", int(req.params.id));
  if (!rfq) return res.status(404).json({ error: 'This request is no longer open' });
  const price = num(req.body?.price), lead = int(req.body?.lead_days, 30);
  if (price <= 0) return res.status(400).json({ error: 'Enter a price per piece' });
  if (lead < 1 || lead > 365) return res.status(400).json({ error: 'Lead time must be 1–365 days' });
  const ex = await q.get('SELECT id,status FROM quotes WHERE rfq_id=? AND seller_id=?', rfq.id, req.user.id);
  if (ex && ex.status !== 'pending') return res.status(400).json({ error: 'Your quote is locked' });
  if (ex) await q.run('UPDATE quotes SET price=?,lead_days=?,notes=? WHERE id=?', price, lead, str(req.body?.notes, 1000), ex.id);
  else await q.run('INSERT INTO quotes(rfq_id,seller_id,price,lead_days,notes) VALUES(?,?,?,?,?)', rfq.id, req.user.id, price, lead, str(req.body?.notes, 1000));
  await notify(rfq.buyer_id, `New quote on "${rfq.title}": ₹${price}/pc`, '#quotations');
  res.status(ex ? 200 : 201).json({ ok: true });
});

/* ---------- payouts ---------- */
router.get('/payouts', async (req, res) => {
  const pct = num(await getSetting('commission_pct', '3'), 3);
  res.json({ commission_pct: pct, orders: await q.all(`SELECT id,title,total,commission,status,payout_status,created_at FROM orders WHERE seller_id=? AND status!='cancelled' ORDER BY id DESC LIMIT 500`, req.user.id) });
});

module.exports = router;
