const router = require('express').Router();
const { q, getSetting } = require('../db');
const { requireRole, notify } = require('../auth');
const { str, int, num, slugify } = require('../util');
router.use(requireRole('admin'));

router.get('/stats', (req, res) => {
  const one = (s, ...a) => q.get(s, ...a);
  res.json({
    users: one("SELECT COUNT(*) n, SUM(role='buyer') buyers, SUM(role='seller') sellers, SUM(role='agent') agents, SUM(status='pending') pending FROM users WHERE role!='admin'"),
    products: one("SELECT COUNT(*) n, SUM(status='pending') pending, SUM(status='approved') live FROM products"),
    rfqs: one("SELECT COUNT(*) n, SUM(status='open') open FROM rfqs"),
    orders: one("SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN status!='cancelled' THEN total END),0) gmv, COALESCE(SUM(CASE WHEN status!='cancelled' THEN commission END),0) revenue, SUM(status IN('confirmed','in_production','quality_check','shipped')) active FROM orders"),
    inquiries: one("SELECT COUNT(*) n, SUM(status='new') fresh FROM inquiries"),
    monthly: q.all("SELECT strftime('%Y-%m',created_at) m, SUM(total) gmv, SUM(commission) revenue, COUNT(*) orders FROM orders WHERE status!='cancelled' GROUP BY m ORDER BY m DESC LIMIT 8").reverse(),
    signups: q.all("SELECT strftime('%Y-%m',created_at) m, COUNT(*) n FROM users WHERE role!='admin' GROUP BY m ORDER BY m DESC LIMIT 8").reverse(),
    byStatus: q.all('SELECT status, COUNT(*) n FROM orders GROUP BY status'),
    byCategory: q.all(`SELECT c.name, COALESCE(SUM(o.total),0) v FROM categories c
      LEFT JOIN products p ON p.category=c.id LEFT JOIN rfqs r ON r.product_id=p.id LEFT JOIN orders o ON o.rfq_id=r.id AND o.status!='cancelled' GROUP BY c.id ORDER BY v DESC`),
    topSellers: q.all("SELECT u.company, u.name, COUNT(o.id) orders, COALESCE(SUM(o.total),0) v FROM users u JOIN orders o ON o.seller_id=u.id WHERE o.status!='cancelled' GROUP BY u.id ORDER BY v DESC LIMIT 5")
  });
});

router.get('/users', (req, res) => {
  res.json(q.all(`SELECT id,name,email,phone,company,country,gst,role,status,created_at,last_login,
    (SELECT COUNT(*) FROM orders WHERE buyer_id=users.id OR seller_id=users.id) orders FROM users ORDER BY id DESC LIMIT 500`));
});
router.put('/users/:id', (req, res) => {
  const id = int(req.params.id), u = q.get('SELECT * FROM users WHERE id=?', id), status = req.body?.status;
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.id === req.user.id || u.role === 'admin') return res.status(400).json({ error: 'Cannot change an admin account here' });
  if (!['active', 'pending', 'suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  q.run('UPDATE users SET status=? WHERE id=?', status, id);
  if (u.role === 'seller' && u.status === 'pending' && status === 'active') notify(id, '✅ Your seller account is verified. You can now quote on RFQs.', '#rfqs');
  res.json({ ok: true });
});

router.get('/products', (req, res) => {
  res.json(q.all(`SELECT p.id,p.slug,p.name,p.category,p.moq,p.price_min,p.price_max,p.status,p.featured,p.views,p.image,u.company seller_company
    FROM products p LEFT JOIN users u ON u.id=p.seller_id ORDER BY (p.status='pending') DESC, p.id DESC`));
});
router.put('/products/:id', (req, res) => {
  const p = q.get('SELECT * FROM products WHERE id=?', int(req.params.id));
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const status = req.body?.status ?? p.status, featured = req.body?.featured === undefined ? p.featured : (req.body.featured ? 1 : 0);
  if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  q.run('UPDATE products SET status=?, featured=? WHERE id=?', status, featured, p.id);
  if (status !== p.status && p.seller_id) notify(p.seller_id, `Your product "${p.name}" was ${status}`, '#products');
  res.json({ ok: true });
});
router.delete('/products/:id', (req, res) => { q.run('DELETE FROM products WHERE id=?', int(req.params.id)); res.json({ ok: true }); });

router.post('/categories', (req, res) => {
  const name = str(req.body?.name, 60), id = slugify(name);
  if (!id) return res.status(400).json({ error: 'Name required' });
  if (q.get('SELECT id FROM categories WHERE id=?', id)) return res.status(409).json({ error: 'Category exists' });
  q.run('INSERT INTO categories(id,name,blurb,color,image,sort) VALUES(?,?,?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM categories))', id, name, str(req.body?.blurb, 200), /^#[0-9a-f]{6}$/i.test(req.body?.color) ? req.body.color : '#ff5a2c', /^https:\/\/images\.unsplash\.com\//.test(req.body?.image || '') ? req.body.image : '');
  res.status(201).json({ ok: true });
});
router.put('/categories/:id', (req, res) => {
  q.run('UPDATE categories SET name=COALESCE(NULLIF(?,\'\'),name), blurb=?, color=COALESCE(?,color) WHERE id=?', str(req.body?.name, 60), str(req.body?.blurb, 200), /^#[0-9a-f]{6}$/i.test(req.body?.color) ? req.body.color : null, req.params.id);
  res.json({ ok: true });
});
router.delete('/categories/:id', (req, res) => {
  if (q.get('SELECT 1 x FROM products WHERE category=?', req.params.id)) return res.status(400).json({ error: 'Move or delete the products in this category first' });
  q.run('DELETE FROM categories WHERE id=?', req.params.id); res.json({ ok: true });
});

router.get('/inquiries', (req, res) => res.json(q.all('SELECT * FROM inquiries ORDER BY id DESC LIMIT 200')));
router.put('/inquiries/:id', (req, res) => { q.run('UPDATE inquiries SET status=? WHERE id=?', req.body?.status === 'new' ? 'new' : 'handled', int(req.params.id)); res.json({ ok: true }); });

router.get('/settings', (req, res) => res.json({ commission_pct: num(getSetting('commission_pct', '3')), agent_commission_pct: num(getSetting('agent_commission_pct', '1')) }));
router.put('/settings', (req, res) => {
  for (const k of ['commission_pct', 'agent_commission_pct']) {
    const v = num(req.body?.[k], NaN);
    if (Number.isFinite(v) && v >= 0 && v <= 30) q.run('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)', k, String(v));
  }
  res.json({ ok: true });
});

module.exports = router;
