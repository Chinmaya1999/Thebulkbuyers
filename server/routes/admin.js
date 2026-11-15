const router = require('express').Router();
const { q, getSetting } = require('../db');
const multer = require('multer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { requireRole, notify } = require('../auth');
const { str, int, num, slugify, isEmail, GSTIN_RE } = require('../util');
const { fields, createProduct, updateProduct } = require('../products');
const { acceptQuote, quoteForAccept } = require('../workflow');
const { SITE_DEFAULTS, getSite, saveSite } = require('../site');
const bad = (m, status = 400) => Object.assign(new Error(m), { status });
router.use(requireRole('admin'));
// Audit trail: every admin write (POST/PUT/DELETE) is recorded with who, what and the result.
router.use((req, res, next) => {
  if (req.method !== 'GET') res.on('finish', () => q.run('INSERT INTO audit_log(user_id,user_email,method,path,status,ip) VALUES(?,?,?,?,?,?)', req.user.id, req.user.email, req.method, (req.baseUrl + req.path).slice(0, 200), res.statusCode, req.ip).catch(() => {}));
  next();
});
router.get('/audit', async (req, res) => res.json(await q.all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 300')));

router.get('/stats', async (req, res) => {
  const [users, products, rfqs, orders, inquiries, monthly, signups, byStatus, byCategory, topSellers, byChannel] = await Promise.all([
    q.get("SELECT COUNT(*) n, COUNT(*) FILTER (WHERE role='buyer') buyers, COUNT(*) FILTER (WHERE role='seller') sellers, COUNT(*) FILTER (WHERE role='agent') agents, COUNT(*) FILTER (WHERE status='pending') pending FROM users WHERE role!='admin'"),
    q.get("SELECT COUNT(*) n, COUNT(*) FILTER (WHERE status='pending') pending, COUNT(*) FILTER (WHERE status='approved') live FROM products"),
    q.get("SELECT COUNT(*) n, COUNT(*) FILTER (WHERE status='open') open FROM rfqs"),
    q.get("SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN status!='cancelled' THEN total END),0) gmv, COALESCE(SUM(CASE WHEN status!='cancelled' THEN commission END),0) revenue, COUNT(*) FILTER (WHERE status IN('confirmed','in_production','quality_check','shipped')) active FROM orders"),
    q.get("SELECT COUNT(*) n, COUNT(*) FILTER (WHERE status='new') fresh FROM inquiries"),
    q.all("SELECT to_char(created_at,'YYYY-MM') m, SUM(total) gmv, SUM(commission) revenue, COUNT(*) orders FROM orders WHERE status!='cancelled' GROUP BY m ORDER BY m DESC LIMIT 8"),
    q.all("SELECT to_char(created_at,'YYYY-MM') m, COUNT(*) n FROM users WHERE role!='admin' GROUP BY m ORDER BY m DESC LIMIT 8"),
    q.all('SELECT status, COUNT(*) n FROM orders GROUP BY status'),
    q.all(`SELECT c.name, COALESCE(SUM(o.total),0) v FROM categories c
      LEFT JOIN products p ON p.category=c.id LEFT JOIN rfqs r ON r.product_id=p.id LEFT JOIN orders o ON o.rfq_id=r.id AND o.status!='cancelled' GROUP BY c.id,c.name ORDER BY v DESC`),
    q.all("SELECT u.company, u.name, COUNT(o.id) orders, COALESCE(SUM(o.total),0) v FROM users u JOIN orders o ON o.seller_id=u.id WHERE o.status!='cancelled' GROUP BY u.id ORDER BY v DESC LIMIT 5"),
    q.all("SELECT channel, COUNT(*) n, COALESCE(SUM(total),0) gmv FROM orders WHERE status!='cancelled' GROUP BY channel")
  ]);
  res.json({ users, products, rfqs, orders, inquiries, monthly: monthly.reverse(), signups: signups.reverse(), byStatus, byCategory, topSellers, byChannel });
});

/* ---------- Users (buyers, suppliers/manufacturers, agents, admins) ---------- */
const ROLES = ['buyer', 'seller', 'agent', 'admin'], STATUSES = ['active', 'pending', 'suspended'];
const strong = p => typeof p === 'string' && p.length >= 8 && p.length <= 100 && /[a-zA-Z]/.test(p) && /\d/.test(p);
const refCode = () => 'TBB' + crypto.randomBytes(3).toString('hex').toUpperCase();
async function userFields(b, selfId = 0) {
  const f = { name: str(b.name, 80), email: str(b.email, 120).toLowerCase(), phone: str(b.phone, 30), company: str(b.company, 120), country: str(b.country, 60) || 'India', gst: str(b.gst, 20).toUpperCase(), role: b.role, status: b.status || 'active', admin_notes: str(b.admin_notes, 1000), discount_pct: Math.min(30, Math.max(0, num(b.discount_pct))) };
  let err = null;
  if (f.name.length < 2) err = 'Name is required';
  else if (!isEmail(f.email)) err = 'Enter a valid email';
  else if (!ROLES.includes(f.role)) err = 'Invalid role';
  else if (!STATUSES.includes(f.status)) err = 'Invalid status';
  else if (b.discount_pct !== undefined && b.discount_pct !== '' && !(num(b.discount_pct, -1) >= 0 && num(b.discount_pct) <= 30)) err = 'Customer discount must be between 0 and 30%';
  else if (f.gst && !GSTIN_RE.test(f.gst)) err = 'GSTIN looks invalid — 15 characters, e.g. 29ABCDE1234F1Z5';
  else if (await q.get('SELECT id FROM users WHERE lower(email)=? AND id<>?', f.email, selfId)) err = 'Another account already uses this email';
  return { f, err };
}
router.get('/users', async (req, res) => {
  res.json(await q.all(`SELECT id,name,email,phone,company,country,gst,role,status,admin_notes,discount_pct,created_at,last_login,
    (SELECT COUNT(*) FROM orders WHERE buyer_id=users.id OR seller_id=users.id) orders,
    (SELECT COUNT(*) FROM products WHERE seller_id=users.id) products FROM users ORDER BY id DESC LIMIT 1000`));
});
router.post('/users', async (req, res) => {
  const { f, err } = await userFields(req.body || {});
  if (err) return res.status(400).json({ error: err });
  if (!strong(req.body?.password)) return res.status(400).json({ error: 'Password needs 8+ characters with letters and numbers' });
  const id = await q.insert(`INSERT INTO users(name,email,phone,company,country,gst,password_hash,role,status,referral_code,admin_notes,discount_pct) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    f.name, f.email, f.phone, f.company, f.country, f.gst, bcrypt.hashSync(req.body.password, 10), f.role, f.status, refCode(), f.admin_notes, f.discount_pct);
  res.status(201).json({ ok: true, id });
});
router.put('/users/:id', async (req, res) => {
  const id = int(req.params.id), u = await q.get('SELECT * FROM users WHERE id=?', id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { f, err } = await userFields({ ...u, ...req.body }, id);
  if (err) return res.status(400).json({ error: err });
  if (u.id === req.user.id && (f.role !== 'admin' || f.status !== 'active')) return res.status(400).json({ error: 'You cannot demote or suspend your own account' });
  if (u.role === 'admin' && f.role !== 'admin' && (await q.get("SELECT COUNT(*) n FROM users WHERE role='admin' AND status='active'")).n < 2) return res.status(400).json({ error: 'At least one active admin is required' });
  await q.run('UPDATE users SET name=?,email=?,phone=?,company=?,country=?,gst=?,role=?,status=?,admin_notes=?,discount_pct=? WHERE id=?', f.name, f.email, f.phone, f.company, f.country, f.gst, f.role, f.status, f.admin_notes, f.discount_pct, id);
  res.json({ ok: true });
});
router.put('/users/:id/password', async (req, res) => {
  if (!strong(req.body?.password)) return res.status(400).json({ error: 'Password needs 8+ characters with letters and numbers' });
  const r = await q.run('UPDATE users SET password_hash=?, token_version=token_version+1, failed_logins=0, locked_until=NULL WHERE id=?', bcrypt.hashSync(req.body.password, 10), int(req.params.id)); // also revokes their sessions + unlocks
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'User not found' });
});
router.delete('/users/:id', async (req, res) => {
  const id = int(req.params.id), u = await q.get('SELECT * FROM users WHERE id=?', id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  if (u.role === 'admin' && (await q.get("SELECT COUNT(*) n FROM users WHERE role='admin'")).n < 2) return res.status(400).json({ error: 'At least one admin is required' });
  if (await q.get('SELECT 1 x FROM orders WHERE buyer_id=? OR seller_id=?', id, id) || await q.get('SELECT 1 x FROM rfqs WHERE buyer_id=?', id) || await q.get('SELECT 1 x FROM quotes WHERE seller_id=?', id))
    return res.status(400).json({ error: 'This account has orders, RFQs or quotes — suspend it instead of deleting.' });
  await q.run('DELETE FROM users WHERE id=?', id); // products, wishlist, addresses etc. cascade / null out
  res.json({ ok: true });
});

/* ---------- Catalogue: full product management ---------- */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const sniff = b => b.length > 12 && (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? 'image/jpeg' : b.slice(0, 4).toString('hex') === '89504e47' ? 'image/png' : b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' ? 'image/webp' : null);
router.post('/upload', (req, res, next) => upload.single('image')(req, res, async err => {
  if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image too large (max 5MB)' : err.message });
  const mime = req.file && sniff(req.file.buffer);
  if (!mime) return res.status(400).json({ error: 'Only JPG, PNG or WebP images' });
  const id = crypto.randomBytes(12).toString('hex');
  try { await q.run('INSERT INTO images(id,mime,data) VALUES(?,?,?)', id, mime, req.file.buffer); } catch (e) { return next(e); }
  res.json({ url: '/uploads/' + id });
}));

router.get('/products', async (req, res) => {
  res.json(await q.all(`SELECT p.id,p.slug,p.name,p.sku,p.brand,p.category,p.moq,p.price_min,p.price_max,p.stock_qty,p.status,p.featured,p.views,p.image,p.seller_id,u.company seller_company,u.name seller_name
    FROM products p LEFT JOIN users u ON u.id=p.seller_id ORDER BY (p.status='pending') DESC, p.id DESC`));
});
router.get('/products/:id', async (req, res) => {
  const p = await q.get('SELECT * FROM products WHERE id=?', int(req.params.id));
  p ? res.json(p) : res.status(404).json({ error: 'Product not found' });
});
// The product's supplier/manufacturer defaults to the signed-in admin ("house" stock).
const pickSeller = async v => { const id = int(v); if (!id) return null; const u = await q.get("SELECT id FROM users WHERE id=? AND role IN ('seller','admin')", id); if (!u) throw bad('Choose a valid supplier'); return id; };
router.post('/products', async (req, res) => {
  const { f, err } = await fields(req.body || {});
  if (err) return res.status(400).json({ error: err });
  const status = ['pending', 'approved', 'rejected'].includes(req.body?.status) ? req.body.status : 'approved';
  const id = await createProduct(f, (await pickSeller(req.body?.seller_id)) || req.user.id, status);
  if (req.body?.featured) await q.run('UPDATE products SET featured=1 WHERE id=?', id);
  res.status(201).json({ ok: true, id });
});
router.put('/products/:id', async (req, res) => {
  const p = await q.get('SELECT * FROM products WHERE id=?', int(req.params.id));
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const b = req.body || {};
  if (b.name === undefined) { // quick actions from the list: status / featured only
    const status = b.status ?? p.status, featured = b.featured === undefined ? p.featured : (b.featured ? 1 : 0);
    if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    await q.run('UPDATE products SET status=?, featured=? WHERE id=?', status, featured, p.id);
    return res.json({ ok: true });
  }
  const { f, err } = await fields({ image: p.image, ...b }, p.id);
  if (err) return res.status(400).json({ error: err });
  if (b.status && !['pending', 'approved', 'rejected'].includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
  await updateProduct(p.id, f, { status: b.status, seller_id: await pickSeller(b.seller_id), featured: b.featured === undefined ? null : (b.featured ? 1 : 0) });
  res.json({ ok: true });
});
router.delete('/products/:id', async (req, res) => { await q.run('DELETE FROM products WHERE id=?', int(req.params.id)); res.json({ ok: true }); });

const COLOR = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : null;
router.post('/categories', async (req, res) => {
  const name = str(req.body?.name, 60), parentId = str(req.body?.parent_id, 80) || null;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const parent = parentId ? await q.get('SELECT id,level,color FROM categories WHERE id=?', parentId) : null;
  if (parentId && !parent) return res.status(400).json({ error: 'Parent not found' });
  const level = parent ? parent.level + 1 : 0;
  if (level > 2) return res.status(400).json({ error: 'Product types are the deepest level' });
  const id = slugify(parent ? parent.id + '-' + name : name);
  if (!id) return res.status(400).json({ error: 'Invalid name' });
  if (await q.get('SELECT id FROM categories WHERE id=?', id)) return res.status(409).json({ error: 'That name already exists here' });
  await q.run('INSERT INTO categories(id,name,blurb,color,image,level,parent_id,sort) VALUES(?,?,?,?,?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM categories WHERE level=?))', id, name, str(req.body?.blurb, 200), COLOR(req.body?.color) || parent?.color || '#923595', /^https:\/\/images\.unsplash\.com\//.test(req.body?.image || '') ? req.body.image : '', level, parentId, level);
  res.status(201).json({ ok: true, id });
});
router.put('/categories/:id', async (req, res) => {
  await q.run("UPDATE categories SET name=COALESCE(NULLIF(?,''),name), blurb=COALESCE(?,blurb), color=COALESCE(?,color) WHERE id=?", str(req.body?.name, 60), req.body?.blurb === undefined ? null : str(req.body.blurb, 200), COLOR(req.body?.color), req.params.id);
  res.json({ ok: true });
});
router.delete('/categories/:id', async (req, res) => {
  const id = req.params.id;
  if (await q.get('SELECT 1 x FROM categories WHERE parent_id=?', id)) return res.status(400).json({ error: 'Delete the items inside it first' });
  if (await q.get('SELECT 1 x FROM products WHERE category=? OR subcategory=?', id, id)) return res.status(400).json({ error: 'Move or delete the products in it first' });
  await q.run('DELETE FROM categories WHERE id=?', id); res.json({ ok: true });
});

/* ---------- RFQs & quotes — admin runs the whole quotation flow ---------- */
router.post('/rfqs', async (req, res) => {
  const b = req.body || {}, buyer = await q.get("SELECT id FROM users WHERE id=? AND role='buyer'", int(b.buyer_id));
  if (!buyer) return res.status(400).json({ error: 'Choose a buyer' });
  let title = str(b.title, 160), category = str(b.category, 40) || null, productId = int(b.product_id) || null;
  if (productId) { const p = await q.get('SELECT name,category FROM products WHERE id=?', productId); if (!p) return res.status(400).json({ error: 'Product not found' }); title = title || p.name; category = p.category; } else productId = null;
  const quantity = int(b.quantity);
  if (title.length < 3) return res.status(400).json({ error: 'Enter what the buyer needs' });
  if (quantity < 1 || quantity > 10_000_000) return res.status(400).json({ error: 'Enter a valid quantity' });
  if (category && !(await q.get('SELECT id FROM categories WHERE id=?', category))) category = null;
  const id = await q.insert('INSERT INTO rfqs(buyer_id,product_id,category,title,quantity,target_price,destination,needed_by,notes) VALUES(?,?,?,?,?,?,?,?,?)',
    buyer.id, productId, category, title, quantity, Math.max(0, num(b.target_price)), str(b.destination, 120), str(b.needed_by, 20), str(b.notes, 2000));
  res.status(201).json({ ok: true, id });
});
router.put('/rfqs/:id', async (req, res) => {
  const st = req.body?.status;
  if (!['open', 'closed'].includes(st)) return res.status(400).json({ error: 'Status must be open or closed' });
  const r = await q.run("UPDATE rfqs SET status=? WHERE id=? AND status<>'accepted'", st, int(req.params.id));
  r.changes ? res.json({ ok: true }) : res.status(400).json({ error: 'Accepted RFQs are locked' });
});
router.delete('/rfqs/:id', async (req, res) => {
  const id = int(req.params.id);
  if (await q.get('SELECT 1 x FROM orders WHERE rfq_id=?', id)) return res.status(400).json({ error: 'This RFQ has an order — cancel the order instead' });
  await q.run('DELETE FROM rfqs WHERE id=?', id); res.json({ ok: true });
});
router.post('/rfqs/:id/quotes', async (req, res) => {
  const rfq = await q.get("SELECT * FROM rfqs WHERE id=? AND status='open'", int(req.params.id));
  if (!rfq) return res.status(404).json({ error: 'RFQ is no longer open' });
  const seller = await q.get("SELECT id,company,name FROM users WHERE id=? AND role IN ('seller','admin')", int(req.body?.seller_id));
  if (!seller) return res.status(400).json({ error: 'Choose a supplier' });
  const price = num(req.body?.price), lead = int(req.body?.lead_days, 30);
  if (price <= 0) return res.status(400).json({ error: 'Enter a price per piece' });
  if (lead < 1 || lead > 365) return res.status(400).json({ error: 'Lead time must be 1–365 days' });
  const ex = await q.get('SELECT id,status FROM quotes WHERE rfq_id=? AND seller_id=?', rfq.id, seller.id);
  if (ex && ex.status !== 'pending') return res.status(400).json({ error: 'That supplier’s quote is locked' });
  if (ex) await q.run('UPDATE quotes SET price=?,lead_days=?,notes=? WHERE id=?', price, lead, str(req.body?.notes, 1000), ex.id);
  else await q.run('INSERT INTO quotes(rfq_id,seller_id,price,lead_days,notes) VALUES(?,?,?,?,?)', rfq.id, seller.id, price, lead, str(req.body?.notes, 1000));
  await notify(rfq.buyer_id, `New quote on "${rfq.title}": ₹${price}/pc`, '#quotations');
  res.status(ex ? 200 : 201).json({ ok: true });
});
router.delete('/quotes/:id', async (req, res) => {
  const r = await q.run("DELETE FROM quotes WHERE id=? AND status='pending'", int(req.params.id));
  r.changes ? res.json({ ok: true }) : res.status(400).json({ error: 'Only pending quotes can be removed' });
});
router.post('/quotes/:id/accept', async (req, res) => {
  const qt = await quoteForAccept(int(req.params.id));
  if (!qt) return res.status(404).json({ error: 'Quote not found' });
  if (qt.rfq_status !== 'open' || qt.status !== 'pending') return res.status(400).json({ error: 'This quote can no longer be accepted' });
  res.json({ ok: true, orderId: await acceptQuote(qt) });
});

/* ---------- Orders: create, edit, payments, tracking ---------- */
const ORDER_STATUS = ['confirmed', 'in_production', 'quality_check', 'shipped', 'delivered', 'cancelled'], PAY = ['unpaid', 'partial', 'paid', 'refunded'], PAYOUT = ['pending', 'paid'];
router.post('/orders', async (req, res) => {
  const b = req.body || {}, buyer = await q.get("SELECT id FROM users WHERE id=? AND role='buyer'", int(b.buyer_id));
  const seller = await q.get("SELECT id FROM users WHERE id=? AND role IN ('seller','admin')", int(b.seller_id) || req.user.id);
  if (!buyer) return res.status(400).json({ error: 'Choose a buyer' });
  if (!seller) return res.status(400).json({ error: 'Choose a supplier' });
  const product = int(b.product_id) ? await q.get('SELECT id,name FROM products WHERE id=?', int(b.product_id)) : null;
  const title = str(b.title, 160) || product?.name || '', quantity = int(b.quantity), unit = num(b.unit_price);
  if (title.length < 3) return res.status(400).json({ error: 'Enter an order title or pick a product' });
  if (quantity < 1) return res.status(400).json({ error: 'Enter a valid quantity' });
  if (unit <= 0) return res.status(400).json({ error: 'Enter the unit price' });
  const total = Math.round(unit * quantity), gst = Math.max(0, num(b.gst_rate)), pct = num(await getSetting('commission_pct', '3'), 3) / 100;
  const channel = b.channel === 'retail' ? 'retail' : 'wholesale';
  const id = await q.insert('INSERT INTO orders(buyer_id,seller_id,product_id,title,quantity,unit_price,total,gst_amount,commission,destination,channel,details) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    buyer.id, seller.id, product?.id || null, title, quantity, unit, total, Math.round(total * gst / 100), Math.round(total * pct), str(b.destination, 120), channel, str(b.details, 900));
  await notify(buyer.id, `Order #${id} has been created for you: ${title}`, '#orders');
  res.status(201).json({ ok: true, id });
});
router.put('/orders/:id', async (req, res) => {
  const o = await q.get('SELECT * FROM orders WHERE id=?', int(req.params.id)), b = req.body || {};
  if (!o) return res.status(404).json({ error: 'Order not found' });
  const status = b.status ?? o.status, pay = b.payment_status ?? o.payment_status, payout = b.payout_status ?? o.payout_status;
  if (!ORDER_STATUS.includes(status) || !PAY.includes(pay) || !PAYOUT.includes(payout)) return res.status(400).json({ error: 'Invalid status value' });
  const quantity = b.quantity === undefined ? o.quantity : int(b.quantity), unit = b.unit_price === undefined ? o.unit_price : num(b.unit_price);
  if (quantity < 1 || unit <= 0) return res.status(400).json({ error: 'Quantity and unit price must be positive' });
  const repriced = quantity !== o.quantity || unit !== o.unit_price, total = repriced ? Math.round(unit * quantity) : o.total;
  const gstAmt = repriced && o.total > 0 ? Math.round(o.gst_amount / o.total * total) : o.gst_amount;
  const commission = b.commission === undefined ? (repriced && o.total > 0 ? Math.round(o.commission / o.total * total) : o.commission) : Math.max(0, num(b.commission));
  const paid = b.paid_amount === undefined ? o.paid_amount : Math.max(0, num(b.paid_amount));
  await q.run(`UPDATE orders SET status=?,payment_status=?,payout_status=?,quantity=?,unit_price=?,total=?,gst_amount=?,commission=?,paid_amount=?,payment_ref=?,tracking_no=?,admin_notes=?,destination=?,updated_at=now() WHERE id=?`,
    status, pay, payout, quantity, unit, total, gstAmt, commission, paid, b.payment_ref === undefined ? o.payment_ref : str(b.payment_ref, 80), b.tracking_no === undefined ? o.tracking_no : str(b.tracking_no, 80),
    b.admin_notes === undefined ? o.admin_notes : str(b.admin_notes, 1000), b.destination === undefined ? o.destination : str(b.destination, 120), o.id);
  if (status !== o.status) await notify(o.buyer_id, `Order #${o.id} is now ${status.replace('_', ' ')}`, '#orders');
  if (b.tracking_no && b.tracking_no !== o.tracking_no) await notify(o.buyer_id, `Order #${o.id} tracking number: ${str(b.tracking_no, 80)}`, '#tracking');
  res.json({ ok: true });
});
router.delete('/orders/:id', async (req, res) => { await q.run('DELETE FROM orders WHERE id=?', int(req.params.id)); res.json({ ok: true }); });

/* ---------- Payments: buyer collections, supplier payouts, agent commissions ---------- */
router.get('/payments', async (req, res) => {
  const agentRate = num(await getSetting('agent_commission_pct', '1')) / 100;
  const [orders, agents] = await Promise.all([
    q.all(`SELECT o.id,o.title,o.total,o.gst_amount,o.commission,o.status,o.payment_status,o.paid_amount,o.payment_ref,o.payout_status,o.created_at,
        b.name buyer_name,b.company buyer_company,s.name seller_name,s.company seller_company
      FROM orders o JOIN users b ON b.id=o.buyer_id JOIN users s ON s.id=o.seller_id ORDER BY o.id DESC LIMIT 500`),
    q.all(`SELECT a.id,a.name,a.company,a.referral_code,COUNT(DISTINCT b.id) buyers,COALESCE(SUM(o.total) FILTER (WHERE o.status='delivered'),0) delivered
      FROM users a LEFT JOIN users b ON b.referred_by=a.id LEFT JOIN orders o ON o.buyer_id=b.id WHERE a.role='agent' GROUP BY a.id ORDER BY delivered DESC`)
  ]);
  const live = orders.filter(o => o.status !== 'cancelled'), billed = o => o.total + (o.gst_amount || 0);
  res.json({
    orders,
    totals: {
      billed: live.reduce((s, o) => s + billed(o), 0), collected: live.reduce((s, o) => s + o.paid_amount, 0),
      payout_due: live.filter(o => o.status === 'delivered' && o.payout_status === 'pending').reduce((s, o) => s + o.total - o.commission, 0),
      payout_done: live.filter(o => o.payout_status === 'paid').reduce((s, o) => s + o.total - o.commission, 0)
    },
    agents: agents.map(a => ({ ...a, earned: Math.round(a.delivered * agentRate) }))
  });
});

router.get('/inquiries', async (req, res) => res.json(await q.all('SELECT * FROM inquiries ORDER BY id DESC LIMIT 200')));
router.put('/inquiries/:id', async (req, res) => { await q.run('UPDATE inquiries SET status=? WHERE id=?', req.body?.status === 'new' ? 'new' : 'handled', int(req.params.id)); res.json({ ok: true }); });

router.get('/settings', async (req, res) => res.json({ commission_pct: num(await getSetting('commission_pct', '3')), agent_commission_pct: num(await getSetting('agent_commission_pct', '1')), shipping_policy: await getSetting('shipping_policy', ''), return_policy: await getSetting('return_policy', '') }));
router.put('/settings', async (req, res) => {
  for (const k of ['commission_pct', 'agent_commission_pct']) {
    const v = num(req.body?.[k], NaN);
    if (Number.isFinite(v) && v >= 0 && v <= 30) await q.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value', k, String(v));
  }
  for (const k of ['shipping_policy', 'return_policy']) if (typeof req.body?.[k] === 'string') await q.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value', k, req.body[k].trim().slice(0, 2000));
  res.json({ ok: true });
});

/* ---------- Website content (homepage, announcement bar, contact details, About) ---------- */
router.get('/site', async (req, res) => res.json({ content: await getSite(), defaults: SITE_DEFAULTS }));
router.put('/site', async (req, res) => { res.json({ ok: true, content: await saveSite(req.body?.content || req.body) }); });
router.delete('/inquiries/:id', async (req, res) => { await q.run('DELETE FROM inquiries WHERE id=?', int(req.params.id)); res.json({ ok: true }); });

module.exports = router;
