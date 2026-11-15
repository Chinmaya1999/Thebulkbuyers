const router = require('express').Router();
const { q } = require('../db');
const { optionalAuth, notifyAdmins } = require('../auth');
const { str, num, isEmail, page, hydrateProduct } = require('../util');

const CARD = `p.id,p.slug,p.name,p.category,p.fabric,p.gsm,p.fit,p.sizes,p.moq,p.price_min,p.price_max,p.lead_days,p.colors,p.image,p.featured,p.description,
  c.name AS category_name, c.color AS category_color, u.company AS seller_company`;
const FROM = `FROM products p LEFT JOIN categories c ON c.id=p.category LEFT JOIN users u ON u.id=p.seller_id`;

router.get('/categories', (req, res) => {
  res.json(q.all(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category=c.id AND p.status='approved') AS count FROM categories c ORDER BY sort,name`));
});

router.get('/products', (req, res) => {
  const where = ["p.status='approved'"], args = [];
  const cat = str(req.query.cat, 40); if (cat) { where.push('p.category=?'); args.push(cat); }
  const s = str(req.query.q, 60); if (s) { where.push('(p.name LIKE ? OR p.fabric LIKE ? OR p.description LIKE ?)'); args.push(`%${s}%`, `%${s}%`, `%${s}%`); }
  const maxMoq = num(req.query.maxMoq); if (maxMoq > 0) { where.push('p.moq<=?'); args.push(maxMoq); }
  const maxPrice = num(req.query.maxPrice); if (maxPrice > 0) { where.push('p.price_min<=?'); args.push(maxPrice); }
  if (req.query.featured) where.push('p.featured=1');
  const order = { price_asc: 'p.price_min ASC', price_desc: 'p.price_min DESC', moq: 'p.moq ASC', popular: 'p.views DESC', new: 'p.id DESC' }[req.query.sort] || 'p.featured DESC, p.views DESC';
  const { limit, offset, page: pg } = page(req, 24);
  const total = q.get(`SELECT COUNT(*) n ${FROM} WHERE ${where.join(' AND ')}`, ...args).n;
  const items = q.all(`SELECT ${CARD} ${FROM} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`, ...args, limit, offset).map(hydrateProduct);
  res.json({ items, total, page: pg, pages: Math.ceil(total / limit) });
});

router.get('/products/:slug', optionalAuth, (req, res) => {
  const p = q.get(`SELECT ${CARD} ${FROM} WHERE p.slug=? AND p.status='approved'`, req.params.slug);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  q.run('UPDATE products SET views=views+1 WHERE id=?', p.id);
  const related = q.all(`SELECT ${CARD} ${FROM} WHERE p.category=? AND p.id!=? AND p.status='approved' LIMIT 4`, p.category, p.id).map(hydrateProduct);
  const wished = req.user ? !!q.get('SELECT 1 x FROM wishlist WHERE user_id=? AND product_id=?', req.user.id, p.id) : false;
  res.json({ product: hydrateProduct(p), related, wished });
});

router.get('/stats', (req, res) => {
  res.json({
    products: q.get("SELECT COUNT(*) n FROM products WHERE status='approved'").n,
    sellers: q.get("SELECT COUNT(*) n FROM users WHERE role='seller' AND status='active'").n,
    buyers: q.get("SELECT COUNT(*) n FROM users WHERE role='buyer'").n,
    orders: q.get('SELECT COUNT(*) n FROM orders').n
  });
});

router.post('/inquiries', (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 80), email = str(b.email, 120), message = str(b.message, 2000);
  if (!name || !isEmail(email) || message.length < 5) return res.status(400).json({ error: 'Please fill name, a valid email and your message' });
  q.run('INSERT INTO inquiries(name,email,phone,company,message) VALUES(?,?,?,?,?)', name, email, str(b.phone, 30), str(b.company, 120), message);
  notifyAdmins(`New inquiry from ${name}`, '#inquiries');
  res.status(201).json({ ok: true });
});

module.exports = router;
