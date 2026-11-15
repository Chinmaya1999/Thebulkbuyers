// Integration test. Needs a running API with demo data:  BASE=http://localhost:3000 npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const BASE = process.env.BASE || 'http://localhost:3000';

async function client(email, password) {
  let cookie = '';
  const call = async (method, path, body) => {
    const isForm = body instanceof FormData;
    const r = await fetch(BASE + '/api' + path, {
      method, headers: { ...(body && !isForm ? { 'content-type': 'application/json' } : {}), cookie },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined
    });
    const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  if (email) assert.equal((await call('POST', '/auth/login', { email, password })).status, 200);
  return call.bind(null) && Object.assign(call, {});
}
const memo = f => { let p; return () => (p ||= f()); }; // one login per role keeps us under the login rate limit
const buyer = memo(() => client('buyer@demo.com', 'Demo@12345'));
const admin = memo(() => client('admin@thebulkbuyers.com', process.env.ADMIN_PASSWORD || 'Admin@12345'));

test('public catalogue', async () => {
  const c = await client();
  const r = await c('GET', '/products?limit=5');
  assert.equal(r.status, 200); assert.ok(r.data.total > 0); assert.ok(Array.isArray(r.data.items[0].colors));
  assert.equal((await c('GET', "/products?q=' OR 1=1--")).data.total, 0);
});

test('auth rules', async () => {
  const c = await client();
  assert.equal((await c('POST', '/auth/login', { email: 'buyer@demo.com', password: 'nope' })).status, 401);
  assert.equal((await c('GET', '/orders')).status, 401);
  assert.equal((await c('GET', '/auth/me')).data.user, null);
  const eve = await client(), reg = await eve('POST', '/auth/register', { name: 'Eve', email: `eve${Date.now()}@x.com`, password: 'abc12345', role: 'admin' });
  assert.equal(reg.status, 201); assert.equal((await eve('GET', '/auth/me')).data.user.role, 'buyer', 'self-registration can only create buyers');
  const b = await buyer();
  assert.equal((await b('GET', '/admin/products')).status, 403);
  assert.equal((await c('POST', '/auth/login', { email: 'seller@demo.com', password: 'Demo@12345' })).status, 403, 'supplier accounts are admin-managed (no sign-in)');
  assert.equal((await b('GET', '/admin/stats')).status, 403);
});

test('RFQ → admin quote → buyer accepts → admin fulfils → delivery', async () => {
  const b = await buyer(), ad = await admin();
  const sellerId = (await ad('GET', '/admin/users')).data.find(u => u.role === 'seller').id;
  const created = await b('POST', '/rfqs', { productId: 1, quantity: 900, targetPrice: 120, destination: 'Paris' });
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.equal((await ad('POST', `/admin/rfqs/${id}/quotes`, { seller_id: sellerId, price: 130, lead_days: 25 })).status, 201);
  assert.equal((await b('POST', `/admin/rfqs/${id}/quotes`, { seller_id: sellerId, price: 1 })).status, 403, 'buyers cannot quote');
  const { quotes } = (await b('GET', `/rfqs/${id}`)).data;
  assert.equal(quotes.length, 1);
  const acc = await b('POST', `/quotes/${quotes[0].id}/accept`);
  assert.equal(acc.status, 200);
  assert.equal((await b('POST', `/quotes/${quotes[0].id}/accept`)).status, 400, 'cannot accept twice');
  const oid = acc.data.orderId;
  for (const st of ['in_production', 'quality_check', 'shipped']) assert.equal((await ad('PUT', `/admin/orders/${oid}`, { status: st })).status, 200);
  assert.equal((await b('PUT', `/admin/orders/${oid}`, { status: 'delivered' })).status, 403, 'buyers cannot use admin order edit');
  assert.equal((await b('PUT', `/orders/${oid}/status`, { status: 'delivered' })).status, 200);
  const done = await ad('PUT', `/admin/orders/${oid}`, { payment_status: 'paid', paid_amount: 117000, tracking_no: 'AWB1', payout_status: 'paid' }); assert.equal(done.status, 200);
  const row = (await ad('GET', '/orders')).data.find(o => o.id === oid); assert.equal(row.payment_status, 'paid'); assert.equal(row.tracking_no, 'AWB1');
  assert.equal((await ad('DELETE', `/admin/orders/${oid}`)).status, 200);
});

test('admin manages users, orders and website content', async () => {
  const ad = await admin(), c = await client();
  const email = `t${Date.now()}@test.com`;
  const mk = await ad('POST', '/admin/users', { name: 'Temp Supplier', email, role: 'seller', password: 'Passw0rd1', company: 'Temp Co' }); assert.equal(mk.status, 201);
  assert.equal((await ad('POST', '/admin/users', { name: 'Dup', email, role: 'buyer', password: 'Passw0rd1' })).status, 400, 'duplicate email');
  assert.equal((await ad('PUT', `/admin/users/${mk.data.id}`, { company: 'Renamed Co' })).status, 200);
  assert.equal((await ad('GET', '/admin/users')).data.find(u => u.id === mk.data.id).company, 'Renamed Co');
  const manual = await ad('POST', '/admin/orders', { buyer_id: (await ad('GET', '/admin/users')).data.find(u => u.role === 'buyer').id, seller_id: mk.data.id, title: 'Manual order', quantity: 10, unit_price: 100 }); assert.equal(manual.status, 201);
  assert.equal((await ad('DELETE', `/admin/users/${mk.data.id}`)).status, 400, 'accounts with orders cannot be deleted');
  assert.equal((await ad('DELETE', `/admin/orders/${manual.data.id}`)).status, 200);
  assert.equal((await ad('DELETE', `/admin/users/${mk.data.id}`)).status, 200);
  assert.equal((await ad('PUT', '/admin/users/1', { role: 'buyer' })).status, 400, 'cannot demote the last admin');
  const saved = await ad('PUT', '/admin/site', { content: { hero: { line2: 'TEST HERO' }, contact: { phone: '+91 11111 22222' } } }); assert.equal(saved.status, 200);
  const site = (await c('GET', '/site')).data; assert.equal(site.hero.line2, 'TEST HERO'); assert.equal(site.contact.phone, '+91 11111 22222'); assert.ok(site.hero.lead, 'unset fields keep defaults');
  await ad('PUT', '/admin/site', { content: null });
  assert.equal((await c('PUT', '/admin/site', {})).status, 401);
});

test('admin dashboard stats', async () => {
  const a = await admin();
  const r = await a('GET', '/admin/stats');
  assert.equal(r.status, 200); assert.ok(r.data.orders.gmv > 0); assert.ok(Array.isArray(r.data.monthly));
});

test('admin image upload is stored in Postgres and validated', async () => {
  const s = await admin();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const f = new FormData(); f.append('image', new Blob([png], { type: 'image/png' }), 'x.png');
  const up = await s('POST', '/admin/upload', f);
  assert.equal(up.status, 200);
  const img = await fetch(BASE + up.data.url); assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/png');
  const bad = new FormData(); bad.append('image', new Blob([Buffer.from('<script>alert(1)</script>')], { type: 'image/png' }), 'x.png');
  assert.equal((await s('POST', '/admin/upload', bad)).status, 400);
});

test('retail (B2C) checkout creates channel=retail orders visible to admin', async () => {
  const b = await buyer(), s = await admin();
  const list = await (await client())('GET', '/products?limit=5');
  const p = list.data.items.find(x => x.retail_price > 0);
  assert.ok(p, 'products expose retail_price');
  assert.equal((await b('POST', '/orders/direct', { items: [], shipping: {} })).status, 400);
  const ship = { name: 'Test Customer', phone: '9876543210', address: '12 Test Street', city: 'Pune', pincode: '411001' };
  assert.equal((await b('POST', '/orders/direct', { items: [{ productId: p.id, qty: 100001 }], shipping: ship })).status, 400);
  const ok = await b('POST', '/orders/direct', { items: [{ productId: p.id, qty: 2, size: 'M', color: '#111' }], shipping: ship });
  assert.equal(ok.status, 201); assert.equal(ok.data.total, p.retail_price * 2);
  const orders = (await b('GET', '/orders')).data;
  assert.ok(orders.some(o => o.id === ok.data.orders[0].id && o.channel === 'retail'));
  assert.equal((await (await client())('POST', '/orders/direct', { items: [{ productId: p.id, qty: 1 }], shipping: ship })).status, 401);
  assert.equal((await s('POST', '/orders/direct', { items: [{ productId: p.id, qty: 1 }], shipping: ship })).status, 403, 'admins do not check out');
});

test('catalogue hierarchy: groups → 10 categories → product types, with filters & facets', async () => {
  const c = await client();
  const nodes = (await c('GET', '/categories')).data;
  assert.equal(nodes.filter(n => n.level === 0).length, 2);
  assert.equal(nodes.filter(n => n.level === 1).length, 10);
  assert.ok(nodes.filter(n => n.level === 2).length >= 281);
  assert.ok(nodes.find(n => n.id === 'footwear').parent_id === 'fashion-lifestyle');
  const sub = nodes.find(n => n.level === 2 && n.count > 0);
  const bySub = (await c('GET', `/products?sub=${sub.id}`)).data;
  assert.equal(bySub.total, sub.count); assert.ok(bySub.items.every(p => p.subcategory === sub.id));
  assert.ok((await c('GET', '/products?group=fashion-lifestyle')).data.items.every(p => ['footwear', 'accessories'].includes(p.category)));
  const g = (await c('GET', '/products?gender=Women')).data; assert.ok(g.total > 0 && g.items.every(p => p.gender === 'Women'));
  const f = (await c('GET', '/facets')).data; assert.ok(f.gender.length && f.season.length);
  assert.ok(!('purchase_price' in bySub.items[0]), 'purchase price must stay private');
});

test('admin product master attributes: SKU, type validation, private purchase price', async () => {
  const s = await admin(), base = { name: 'API Test Hoodie', category: 'mens', moq: 100, price_min: 200, price_max: 300, brand: 'TestCo', gender: 'Men', age_group: 'Adult', season: 'Winter', pattern: 'Solid', hsn_code: '6110', gst_rate: 5, purchase_price: 150, stock_qty: 25, colors: '#111111' };
  assert.equal((await s('POST', '/admin/products', { ...base, subcategory: 'womens-leggings' })).status, 400, 'type must belong to the category');
  assert.equal((await s('POST', '/admin/products', { ...base, category: 'nope' })).status, 400);
  const ok = await s('POST', '/admin/products', { ...base, subcategory: 'mens-hoodies' }); assert.equal(ok.status, 201);
  const mine = (await s('GET', `/admin/products/${ok.data.id}`)).data;
  assert.match(mine.sku, /^TBB-MEN-\d{5}$/); assert.equal(mine.purchase_price, 150); assert.equal(mine.hsn_code, '6110'); assert.equal(mine.retail_price, Math.round(300 * 2.2 / 10) * 10 - 1);
  assert.equal((await s('POST', '/admin/products', { ...base, subcategory: 'mens-hoodies', sku: mine.sku })).status, 400, 'duplicate SKU rejected');
});

test('retail stock: 0 = made-to-order; otherwise enforced and decremented', async () => {
  const b = await buyer(), c = await client();
  const sneaker = (await c('GET', '/products?q=Flyknit')).data.items[0]; assert.ok(sneaker.stock_qty > 0);
  const ship = { name: 'T', phone: '9876543210', address: '12 Test Street', city: 'Pune' };
  assert.equal((await b('POST', '/orders/direct', { items: [{ productId: sneaker.id, qty: sneaker.stock_qty + 1 }], shipping: ship })).status, 400, 'cannot exceed stock');
  assert.equal((await b('POST', '/orders/direct', { items: [{ productId: sneaker.id, qty: 1 }], shipping: ship })).status, 201);
  assert.equal((await c('GET', '/products?q=Flyknit')).data.items[0].stock_qty, sneaker.stock_qty - 1);
});

test('cart pricing: retail below MOQ, tiered wholesale + GST at/above MOQ (server is the source of truth)', async () => {
  const c = await client(), p = (await c('GET', '/products?q=Classic%20Crew')).data.items[0];
  assert.ok(p.price_tiers.length >= 2 && p.price_tiers[0].min_qty === p.moq);
  const retail = (await c('POST', '/cart/price', { items: [{ productId: p.id, qty: 3, size: 'M', color: '#111' }] })).data;
  assert.equal(retail.products[0].channel, 'retail'); assert.equal(retail.products[0].unit, p.retail_price); assert.equal(retail.products[0].toWholesale, p.moq - 3);
  // split across variants: qty is summed per product before the tier is chosen
  const lines = [{ productId: p.id, qty: p.moq, size: 'M', color: '#111' }, { productId: p.id, qty: p.moq, size: 'L', color: '#fff' }];
  const w = (await c('POST', '/cart/price', { items: lines })).data.products[0];
  assert.equal(w.channel, 'wholesale'); assert.equal(w.qty, p.moq * 2); assert.equal(w.unit, p.price_tiers.find(t => t.min_qty === p.moq * 2).price);
  assert.equal(w.gst, Math.round(w.taxable * p.gst_rate) / 100); assert.equal(w.lines.length, 2);
});

test('bulk checkout from the variant matrix creates a wholesale order with GST, lines and business details', async () => {
  const b = await buyer(), c = await client(), p = (await c('GET', '/products?q=Classic%20Crew')).data.items[0];
  const body = { items: [{ productId: p.id, qty: p.moq, size: 'M', color: '#111' }, { productId: p.id, qty: 20, size: 'L', color: '#fff' }], shipping: { name: 'Buyer', phone: '9876543210', line1: '5 Mill Road', city: 'Surat', pincode: '395003' },
    business: { company: 'Walker Retail', gstin: '29ABCDE1234F1Z5' }, shipping_method: 'standard', payment_method: 'bank_transfer' };
  assert.equal((await b('POST', '/orders/direct', { ...body, business: { gstin: 'BADGSTIN' } })).status, 400);
  const ok = await b('POST', '/orders/direct', body); assert.equal(ok.status, 201);
  assert.equal(ok.data.orders.length, 1); assert.equal(ok.data.orders[0].channel, 'wholesale'); assert.ok(ok.data.gst > 0); assert.equal(ok.data.grand, Math.round((ok.data.total + ok.data.gst) * 100) / 100);
  const o = (await b('GET', '/orders')).data.find(x => x.id === ok.data.orders[0].id);
  assert.equal(o.quantity, p.moq + 20); assert.equal(o.lines.length, 2); assert.equal(o.shipping.business.gstin, '29ABCDE1234F1Z5'); assert.equal(o.shipping.payment, 'bank_transfer'); assert.ok(o.product_slug);
});

test('listing filters (size, colour, fabric, discount, stock, manufacturer) and contextual facets', async () => {
  const c = await client(), f = (await c('GET', '/facets?cat=mens')).data;
  assert.ok(f.size.length && f.color.length && f.fabric.length && f.manufacturer.length && f.price.max > 0);
  const colour = f.color[0].v; assert.ok((await c('GET', `/products?cat=mens&color=${encodeURIComponent(colour)}`)).data.items.every(p => p.colors.includes(colour)));
  assert.ok((await c('GET', `/products?size=${encodeURIComponent(f.size[0].v)}`)).data.total > 0);
  assert.ok((await c('GET', '/products?fabric=Cotton')).data.items.every(p => /cotton/i.test(p.fabric)));
  assert.ok((await c('GET', '/products?discount=50')).data.items.every(p => p.discount_pct >= 50));
  assert.ok((await c('GET', '/products?stock=in')).data.items.every(p => p.stock_qty > 0));
  assert.ok((await c('GET', `/products?seller=${f.manufacturer[0].v}`)).data.items.every(p => p.seller_id === f.manufacturer[0].v));
  const sorted = (await c('GET', '/products?sort=bestseller&limit=3')).data; assert.ok(sorted.items.length);
});

test('search suggestions, manufacturers, policies and frequently-bought-together', async () => {
  const c = await client(), s = (await c('GET', '/search/suggest?q=hood')).data;
  assert.ok(s.products.length && s.products[0].sku); assert.ok(s.categories.some(x => /hoodie/i.test(x.name)));
  assert.equal((await c('GET', '/search/suggest?q=h')).data.products.length, 0);
  const m = (await c('GET', '/manufacturers')).data; assert.ok(m.length && m[0].company && m[0].n > 0);
  assert.ok((await c('GET', '/policies')).data.shipping.length > 20);
  const t = (await c('GET', '/products/classic-crew-neck-tee/together')).data; assert.ok(Array.isArray(t) && t.length > 0);
});

test('saved addresses and GSTIN on the business profile', async () => {
  const b = await buyer(), a = { label: 'Warehouse', name: 'Store Mgr', phone: '9876543210', line1: '7 Industrial Area', city: 'Pune', state: 'MH', pincode: '411019' };
  assert.equal((await b('POST', '/account/addresses', { ...a, phone: '1' })).status, 400);
  const id = (await b('POST', '/account/addresses', a)).data.id; assert.ok(id);
  assert.equal((await b('PUT', `/account/addresses/${id}/default`)).status, 200);
  assert.ok((await b('GET', '/account/addresses')).data.some(x => x.id === id && x.is_default === 1));
  assert.equal((await b('DELETE', `/account/addresses/${id}`)).status, 200);
  assert.equal((await (await client())('GET', '/account/addresses')).status, 401);
  assert.equal((await b('PUT', '/auth/me', { name: 'James Walker', gst: 'nope' })).status, 400);
  assert.equal((await b('PUT', '/auth/me', { name: 'James Walker', company: 'Walker Retail Ltd', phone: '+91 98765 43210', country: 'United Kingdom', gst: '' })).status, 200);
});

test('demo catalogue: every product type has at least one live product, across all 10 categories', async () => {
  const nodes = (await (await client())('GET', '/categories')).data, types = nodes.filter(n => n.level === 2);
  assert.ok(types.length >= 281); assert.equal(types.filter(t => t.count === 0).length, 0, 'empty types: ' + types.filter(t => t.count === 0).map(t => t.id).join(', '));
  for (const c of nodes.filter(n => n.level === 1)) assert.ok(c.count >= 15, `${c.id} has only ${c.count} products`);
  const all = (await (await client())('GET', '/products?limit=100')).data; assert.ok(all.total >= 281);
  assert.ok(all.items.every(p => p.image && p.sku && p.price_max > p.price_min && p.size_options.length && p.colors.length));
});
