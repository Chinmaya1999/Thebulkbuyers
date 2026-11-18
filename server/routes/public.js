const router = require('express').Router();
const { q, getSetting } = require('../db');
const { optionalAuth, notifyAdmins } = require('../auth');
const { str, num, int, isEmail, page, parseSizes } = require('../util');
const { tiersOf } = require('../pricing');

// purchase_price is deliberately NOT selectable here — it is private to the seller/admin.
const CARD = `p.id,p.slug,p.name,p.category,p.subcategory,p.seller_id,p.fabric,p.gsm,p.fit,p.sizes,p.size_options,p.moq,p.price_min,p.price_max,p.retail_price,p.lead_days,p.colors,p.image,p.gallery,p.featured,p.description,p.created_at,
  p.sku,p.brand,p.gender,p.age_group,p.pattern,p.season,p.hsn_code,p.gst_rate,p.stock_qty,p.barcode,p.views,
  c.name AS category_name, c.color AS category_color, sc.name AS sub_name, g.name AS group_name, g.id AS group_id, u.company AS seller_company`;
const FROM = `FROM products p LEFT JOIN categories c ON c.id=p.category LEFT JOIN categories sc ON sc.id=p.subcategory LEFT JOIN categories g ON g.id=c.parent_id LEFT JOIN users u ON u.id=p.seller_id
  LEFT JOIN (SELECT product_id, COUNT(*) n FROM orders WHERE status<>'cancelled' AND product_id IS NOT NULL GROUP BY product_id) bs ON bs.product_id=p.id`;

const shape = p => p && ({ ...p, size_options: p.size_options || parseSizes(p.sizes), gallery: p.gallery || [], mrp: p.retail_price, price_tiers: tiersOf(p),
  discount_pct: p.retail_price > 0 ? Math.max(0, Math.round((1 - p.price_min / p.retail_price) * 100)) : 0 });

const HIDDEN = ['accessories', 'ethnic', 'uniforms'];
const list = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x).trim()).filter(Boolean).slice(0, 30);
const FABRICS = { Cotton: 'cotton', Polyester: 'poly', Nylon: 'nylon', Denim: 'denim', Fleece: 'fleece', Wool: 'wool', Silk: 'silk', Linen: 'linen', 'Rayon / Viscose': '(rayon|viscose)', Leather: 'leather', Canvas: 'canvas', Acrylic: 'acrylic', 'Spandex / Elastane': '(spandex|elastane)', Georgette: 'georgette' };

// Category scope + free-text search (used by both listings and facets)
function scope(req) {
  const where = ["p.status='approved'", "p.category <> ALL('{accessories,ethnic,uniforms}'::text[])"], args = [];
  const cat = str(req.query.cat, 60); if (cat) { where.push('p.category=?'); args.push(cat); }
  const sub = str(req.query.sub, 80); if (sub) { where.push('p.subcategory=?'); args.push(sub); }
  const subs = list(req.query.subs); if (subs.length) { where.push('p.subcategory = ANY(?::text[])'); args.push(subs); }
  const group = str(req.query.group, 60); if (group) { where.push('c.parent_id=?'); args.push(group); }
  const s = str(req.query.q, 60);
  if (s) { where.push('(p.name ILIKE ? OR p.fabric ILIKE ? OR p.description ILIKE ? OR p.brand ILIKE ? OR p.sku ILIKE ? OR sc.name ILIKE ? OR c.name ILIKE ? OR u.company ILIKE ?)'); for (let i = 0; i < 8; i++) args.push(`%${s}%`); }
  if (req.query.featured) where.push('p.featured=1');
  return { where, args };
}
// Attribute filters (multi-select values are comma separated)
function facetFilters(req) {
  const where = [], args = [];
  const any = (col, v) => { if (v.length) { where.push(`${col} = ANY(?::text[])`); args.push(v); } };
  any('p.gender', list(req.query.gender)); any('p.age_group', list(req.query.age)); any('p.season', list(req.query.season)); any('p.brand', list(req.query.brand)); any('p.pattern', list(req.query.pattern));
  const sellers = list(req.query.seller).map(Number).filter(Boolean); if (sellers.length) { where.push('p.seller_id = ANY(?::int[])'); args.push(sellers); }
  const gst = list(req.query.gst).map(Number).filter(n => !isNaN(n)); if (gst.length) { where.push('p.gst_rate = ANY(?::float8[])'); args.push(gst); }
  const colors = list(req.query.color); if (colors.length) { where.push('jsonb_exists_any(p.colors, ?::text[])'); args.push(colors); }
  const sizes = list(req.query.size); if (sizes.length) { where.push('jsonb_exists_any(p.size_options, ?::text[])'); args.push(sizes); }
  const fabrics = list(req.query.fabric).filter(f => FABRICS[f]); if (fabrics.length) { where.push('(' + fabrics.map(() => 'p.fabric ~* ?').join(' OR ') + ')'); fabrics.forEach(f => args.push(FABRICS[f])); }
  const minP = num(req.query.minPrice); if (minP > 0) { where.push('p.price_max >= ?'); args.push(minP); }
  const maxP = num(req.query.maxPrice); if (maxP > 0) { where.push('p.price_min <= ?'); args.push(maxP); }
  const maxMoq = num(req.query.maxMoq); if (maxMoq > 0) { where.push('p.moq <= ?'); args.push(maxMoq); }
  if (req.query.stock === 'in') where.push('p.stock_qty > 0'); else if (req.query.stock === 'mto') where.push('p.stock_qty = 0');
  const disc = num(req.query.discount); if (disc > 0) { where.push('p.retail_price > 0 AND (1 - p.price_min / p.retail_price) * 100 >= ?'); args.push(disc); }
  return { where, args };
}

router.get('/categories', async (req, res) => {
  res.json(await q.all(`SELECT c.id,c.name,c.blurb,c.color,c.image,c.level,c.parent_id,c.sort,
    CASE c.level
      WHEN 2 THEN (SELECT COUNT(*) FROM products p WHERE p.subcategory=c.id AND p.status='approved')
      WHEN 1 THEN (SELECT COUNT(*) FROM products p WHERE p.category=c.id AND p.status='approved')
      ELSE (SELECT COUNT(*) FROM products p JOIN categories k ON k.id=p.category WHERE k.parent_id=c.id AND p.status='approved') END AS count
    FROM categories c WHERE c.id <> ALL('{accessories,ethnic,uniforms}'::text[]) AND COALESCE(c.parent_id,'') <> ALL('{accessories,ethnic,uniforms}'::text[]) ORDER BY c.level, c.sort, c.name`));
});

router.get('/products', async (req, res) => {
  const a = scope(req), b = facetFilters(req), where = [...a.where, ...b.where], args = [...a.args, ...b.args];
  const order = { price_asc: 'p.price_min ASC', price_desc: 'p.price_max DESC', moq: 'p.moq ASC', popular: 'p.views DESC', new: 'p.created_at DESC, p.id DESC',
    deal: '(1 - p.price_min / NULLIF(p.retail_price,0)) DESC NULLS LAST', bestseller: 'COALESCE(bs.n,0) DESC, p.views DESC' }[req.query.sort] || 'p.featured DESC, p.views DESC';
  const { limit, offset, page: pg } = page(req, 24);
  const total = (await q.get(`SELECT COUNT(*) n ${FROM} WHERE ${where.join(' AND ')}`, ...args)).n;
  const items = (await q.all(`SELECT ${CARD} ${FROM} WHERE ${where.join(' AND ')} ORDER BY ${order}, p.id LIMIT ? OFFSET ?`, ...args, limit, offset)).map(shape);
  res.json({ items, total, page: pg, pages: Math.ceil(total / limit) });
});

// Filter options that exist within the current category/search scope (counts reflect that scope).
router.get('/facets', async (req, res) => {
  const { where, args } = scope(req), W = where.join(' AND ');
  const col = c => q.all(`SELECT ${c} v, COUNT(*) n ${FROM} WHERE ${W} AND COALESCE(${c}::text,'')<>'' GROUP BY ${c} ORDER BY n DESC, v LIMIT 40`, ...args);
  const json = (c) => q.all(`SELECT e v, COUNT(*) n ${FROM}, jsonb_array_elements_text(${c}) e WHERE ${W} GROUP BY e ORDER BY n DESC, e LIMIT 40`, ...args);
  const [gender, age, season, pattern, brand, gst, color, size, seller, range] = await Promise.all([
    col('p.gender'), col('p.age_group'), col('p.season'), col('p.pattern'), col('p.brand'), col('p.gst_rate'), json('p.colors'), json('COALESCE(p.size_options, \'[]\'::jsonb)'),
    q.all(`SELECT u.id v, u.company label, COUNT(*) n ${FROM} WHERE ${W} GROUP BY u.id, u.company ORDER BY n DESC LIMIT 30`, ...args),
    q.get(`SELECT MIN(p.price_min) lo, MAX(p.price_max) hi, MAX(p.moq) moq ${FROM} WHERE ${W}`, ...args)
  ]);
  const fabric = (await Promise.all(Object.entries(FABRICS).map(async ([label, re]) => ({ v: label, n: (await q.get(`SELECT COUNT(*) n ${FROM} WHERE ${W} AND p.fabric ~* ?`, ...args, re)).n })))).filter(f => f.n > 0).sort((a, b) => b.n - a.n);
  res.json({ gender, age, season, pattern, brand, gst, color, size, fabric, manufacturer: seller.map(s => ({ v: s.v, label: s.label, n: s.n })), price: { min: Math.floor(range.lo || 0), max: Math.ceil(range.hi || 0), moq: range.moq || 0 } });
});

// Quick order: resolve SKUs to live products (up to 200 at a time). Unknown/hidden SKUs are simply absent from the result.
router.get('/products/by-sku', async (req, res) => {
  const skus = [...new Set(String(req.query.skus || '').split(',').map(x => x.trim().toUpperCase()).filter(Boolean))].slice(0, 200);
  if (!skus.length) return res.json([]);
  res.json((await q.all(`SELECT ${CARD} ${FROM} WHERE p.status='approved' AND upper(p.sku) = ANY(?::text[])`, skus)).map(shape));
});

router.get('/products/:slug', optionalAuth, async (req, res) => {
  const p = await q.get(`SELECT ${CARD} ${FROM} WHERE p.slug=? AND p.status='approved'`, req.params.slug);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  await q.run('UPDATE products SET views=views+1 WHERE id=?', p.id);
  const related = (await q.all(`SELECT ${CARD} ${FROM} WHERE p.category=? AND p.id!=? AND p.status='approved' ORDER BY (p.subcategory=?) DESC, p.views DESC LIMIT 8`, p.category, p.id, p.subcategory)).map(shape);
  const wished = req.user ? !!(await q.get('SELECT 1 x FROM wishlist WHERE user_id=? AND product_id=?', req.user.id, p.id)) : false;
  res.json({ product: shape(p), related, wished });
});

// "Frequently purchased together": other products bought by the same buyers; topped up from the same category.
router.get('/products/:slug/together', async (req, res) => {
  const p = await q.get("SELECT id,category FROM products WHERE slug=? AND status='approved'", req.params.slug);
  if (!p) return res.json([]);
  const ids = (await q.all(`SELECT o2.product_id id, COUNT(*) n FROM orders o1 JOIN orders o2 ON o2.buyer_id=o1.buyer_id AND o2.product_id<>o1.product_id
    WHERE o1.product_id=? AND o2.product_id IS NOT NULL GROUP BY o2.product_id ORDER BY n DESC LIMIT 4`, p.id)).map(r => r.id);
  const rows = ids.length ? await q.all(`SELECT ${CARD} ${FROM} WHERE p.id = ANY(?::int[]) AND p.status='approved'`, ids) : [];
  if (rows.length < 4) rows.push(...await q.all(`SELECT ${CARD} ${FROM} WHERE p.category=? AND p.id<>? AND p.status='approved' AND p.id <> ALL(?::int[]) ORDER BY p.views DESC LIMIT ?`, p.category, p.id, [p.id, ...rows.map(r => r.id)], 4 - rows.length));
  res.json(rows.map(shape));
});

// Search-as-you-type: products (name/SKU/brand), categories & types, brands, manufacturers.
router.get('/search/suggest', async (req, res) => {
  const s = str(req.query.q, 60); if (s.length < 2) return res.json({ products: [], categories: [], brands: [], manufacturers: [] });
  const like = `%${s}%`;
  const [products, categories, brands, manufacturers] = await Promise.all([
    q.all(`SELECT p.slug,p.name,p.sku,p.image,p.price_min,p.price_max,p.moq,sc.name sub_name FROM products p LEFT JOIN categories sc ON sc.id=p.subcategory WHERE p.status='approved' AND p.category <> ALL('{accessories,ethnic,uniforms}'::text[]) AND (p.name ILIKE ? OR p.sku ILIKE ? OR p.brand ILIKE ? OR p.fabric ILIKE ? OR sc.name ILIKE ?) ORDER BY (p.name ILIKE ?) DESC, p.views DESC LIMIT 6`, like, like, like, like, like, `${s}%`),
    q.all(`SELECT c.id,c.name,c.level,c.parent_id,(SELECT name FROM categories k WHERE k.id=c.parent_id) parent_name FROM categories c WHERE c.level IN (1,2) AND c.id <> ALL('{accessories,ethnic,uniforms}'::text[]) AND COALESCE(c.parent_id,'') <> ALL('{accessories,ethnic,uniforms}'::text[]) AND c.name ILIKE ? ORDER BY c.level, c.name LIMIT 6`, like),
    q.all(`SELECT brand v, COUNT(*) n FROM products WHERE status='approved' AND brand ILIKE ? GROUP BY brand LIMIT 4`, like),
    q.all(`SELECT u.id, u.company FROM users u WHERE u.role='seller' AND u.status='active' AND u.company ILIKE ? AND EXISTS (SELECT 1 FROM products p WHERE p.seller_id=u.id AND p.status='approved') LIMIT 3`, like)
  ]);
  res.json({ products, categories, brands, manufacturers });
});

// Verified manufacturers with live listings (company names; no logos are stored, so the UI uses wordmarks).
router.get('/manufacturers', async (req, res) => {
  const rows = await q.all(`SELECT u.id, u.company, u.country, COUNT(p.id) n,
      (SELECT array_agg(DISTINCT c.name) FROM products p2 JOIN categories c ON c.id=p2.category WHERE p2.seller_id=u.id AND p2.status='approved') categories,
      (SELECT array_agg(i) FROM (SELECT image i FROM products p3 WHERE p3.seller_id=u.id AND p3.status='approved' AND COALESCE(p3.image,'')<>'' ORDER BY p3.views DESC LIMIT 3) x) images
    FROM users u JOIN products p ON p.seller_id=u.id AND p.status='approved' WHERE u.role='seller' AND u.status='active' GROUP BY u.id ORDER BY n DESC LIMIT 12`);
  res.json(rows);
});

router.get('/site', async (req, res) => res.json(await require('../site').getSite()));

router.get('/policies', async (req, res) => {
  res.json({
    shipping: (await getSetting('shipping_policy', '')) || ('Wholesale orders ship from the factory partner. Freight charges and dispatch timelines are confirmed when the order is accepted. Retail orders are dispatched by the factory partner and paid on delivery.'),
    returns: (await getSetting('return_policy', '')) || ('Please inspect goods on delivery and report any defect or short-shipment within 48 hours. Made-to-order and custom-labelled goods are not returnable unless defective.')
  });
});

router.get('/stats', async (req, res) => {
  const [products, sellers, buyers, orders] = await Promise.all([
    q.get("SELECT COUNT(*) n FROM products WHERE status='approved'"), q.get("SELECT COUNT(*) n FROM users WHERE role='seller' AND status='active'"),
    q.get("SELECT COUNT(*) n FROM users WHERE role='buyer'"), q.get('SELECT COUNT(*) n FROM orders')
  ]);
  res.json({ products: products.n, sellers: sellers.n, buyers: buyers.n, orders: orders.n });
});

router.post('/inquiries', async (req, res) => {
  const b = req.body || {}, name = str(b.name, 80), email = str(b.email, 120), message = str(b.message, 2000);
  if (!name || !isEmail(email) || message.length < 5) return res.status(400).json({ error: 'Please fill name, a valid email and your message' });
  await q.run('INSERT INTO inquiries(name,email,phone,company,message) VALUES(?,?,?,?,?)', name, email, str(b.phone, 30), str(b.company, 120), message);
  await notifyAdmins(`New inquiry from ${name}`, '#inquiries');
  res.status(201).json({ ok: true });
});

// Seller-uploaded images live in Postgres, so hosting needs no persistent disk.
const serveUpload = async (req, res) => {
  const img = await q.get('SELECT mime,data FROM images WHERE id=?', req.params.id.replace(/\.[a-z]+$/, ''));
  if (!img) return res.status(404).end();
  res.set({ 'Content-Type': img.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' }).send(img.data);
};

module.exports = router;
module.exports.serveUpload = serveUpload;
module.exports.shape = shape;
