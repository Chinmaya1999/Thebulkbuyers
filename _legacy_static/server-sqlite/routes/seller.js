const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { q, DATA_DIR } = require('../db');
const { requireRole, notifyAdmins } = require('../auth');
const { str, num, int, slugify, parseColors, hydrateProduct } = require('../util');

router.use(requireRole('seller'));

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(DATA_DIR, 'uploads'),
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + EXT[file.mimetype])
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => EXT[file.mimetype] ? cb(null, true) : cb(new Error('Only JPG, PNG or WebP images'))
});

router.post('/upload', (req, res, next) => upload.single('image')(req, res, err => {
  if (err) return res.status(400).json({ error: err.message });
  if (!req.file) return res.status(400).json({ error: 'No image received' });
  res.json({ url: '/uploads/' + req.file.filename });
}));

router.get('/products', (req, res) => {
  res.json(q.all('SELECT p.*, c.name category_name FROM products p LEFT JOIN categories c ON c.id=p.category WHERE seller_id=? ORDER BY id DESC', req.user.id).map(hydrateProduct));
});

function fields(b) {
  const f = {
    name: str(b.name, 120), category: str(b.category, 40), fabric: str(b.fabric, 120), gsm: int(b.gsm), fit: str(b.fit, 40),
    sizes: str(b.sizes, 40) || 'S–3XL', moq: int(b.moq, 100), price_min: num(b.price_min), price_max: num(b.price_max),
    lead_days: int(b.lead_days, 30), colors: JSON.stringify(parseColors(b.colors)), description: str(b.description, 2000),
    image: /^(https:\/\/images\.unsplash\.com\/|\/uploads\/)/.test(b.image || '') ? b.image : ''
  };
  let err = null;
  if (f.name.length < 3) err = 'Product name is required';
  else if (!q.get('SELECT id FROM categories WHERE id=?', f.category)) err = 'Choose a category';
  else if (f.moq < 1) err = 'MOQ must be at least 1';
  else if (f.price_min <= 0 || f.price_max < f.price_min) err = 'Enter a valid price range (min ≤ max)';
  return { f, err };
}

router.post('/products', (req, res) => {
  const { f, err } = fields(req.body || {});
  if (err) return res.status(400).json({ error: err });
  let slug = slugify(f.name), n = 1;
  while (q.get('SELECT id FROM products WHERE slug=?', slug)) slug = `${slugify(f.name)}-${++n}`;
  const r = q.run(`INSERT INTO products(slug,seller_id,category,name,fabric,gsm,fit,sizes,moq,price_min,price_max,lead_days,colors,description,image,status)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`, slug, req.user.id, f.category, f.name, f.fabric, f.gsm, f.fit, f.sizes, f.moq, f.price_min, f.price_max, f.lead_days, f.colors, f.description, f.image);
  notifyAdmins(`Product awaiting approval: ${f.name} (${req.user.company || req.user.name})`, '#products');
  res.status(201).json({ ok: true, id: Number(r.lastInsertRowid) });
});

router.put('/products/:id', (req, res) => {
  const own = q.get('SELECT id FROM products WHERE id=? AND seller_id=?', int(req.params.id), req.user.id);
  if (!own) return res.status(404).json({ error: 'Product not found' });
  const { f, err } = fields(req.body || {});
  if (err) return res.status(400).json({ error: err });
  q.run(`UPDATE products SET category=?,name=?,fabric=?,gsm=?,fit=?,sizes=?,moq=?,price_min=?,price_max=?,lead_days=?,colors=?,description=?,image=COALESCE(NULLIF(?,''),image),status='pending' WHERE id=?`,
    f.category, f.name, f.fabric, f.gsm, f.fit, f.sizes, f.moq, f.price_min, f.price_max, f.lead_days, f.colors, f.description, f.image, own.id);
  notifyAdmins(`Product updated, needs re-approval: ${f.name}`, '#products');
  res.json({ ok: true });
});

router.delete('/products/:id', (req, res) => {
  const r = q.run('DELETE FROM products WHERE id=? AND seller_id=?', int(req.params.id), req.user.id);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Product not found' });
});

router.get('/summary', (req, res) => {
  const id = req.user.id;
  res.json({
    products: q.get('SELECT COUNT(*) n, SUM(status=\'approved\') live, SUM(status=\'pending\') pending, COALESCE(SUM(views),0) views FROM products WHERE seller_id=?', id),
    orders: q.get("SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN status!='cancelled' THEN total END),0) revenue, COALESCE(SUM(CASE WHEN status='delivered' THEN total-commission END),0) payout, SUM(status IN('confirmed','in_production','quality_check','shipped')) active FROM orders WHERE seller_id=?", id),
    openRfqs: q.get("SELECT COUNT(*) n FROM rfqs r WHERE r.status='open' AND (r.category IS NULL OR r.category IN (SELECT DISTINCT category FROM products WHERE seller_id=?)) AND NOT EXISTS(SELECT 1 FROM quotes WHERE rfq_id=r.id AND seller_id=?)", id, id).n,
    quotes: q.get("SELECT COUNT(*) n, SUM(status='accepted') won FROM quotes WHERE seller_id=?", id),
    monthly: q.all("SELECT strftime('%Y-%m',created_at) m, SUM(total) v FROM orders WHERE seller_id=? AND status!='cancelled' GROUP BY m ORDER BY m DESC LIMIT 8", id).reverse()
  });
});

module.exports = router;
