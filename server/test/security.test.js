// Authentication, authorization and full admin-option tests.
// Needs a running API with demo data. To avoid rate-limit noise start it with:
//   API_LIMIT=5000 LOGIN_LIMIT=500 REGISTER_LIMIT=500 node server/server.js     then     BASE=http://localhost:3000 node --test server/test/security.test.js
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const BASE = process.env.BASE || 'http://localhost:3000';
const ADMIN_PW = process.env.ADMIN_PASSWORD || 'Admin@12345';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const uniq = () => `${Date.now()}${Math.floor(Math.random() * 1e4)}`;

async function client(email, password) {
  let cookie = '';
  const call = async (method, path, body, headers = {}) => {
    const isForm = body instanceof FormData;
    const r = await fetch(BASE + path.replace(/^(?!\/uploads)/, '/api'), {
      method, headers: { ...(body && !isForm ? { 'content-type': 'application/json' } : {}), cookie, ...headers }, body: body ? (isForm ? body : JSON.stringify(body)) : undefined
    });
    const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  call.cookie = () => cookie; call.setCookie = c => { cookie = c; };
  if (email) { const r = await call('POST', '/auth/login', { email, password }); assert.equal(r.status, 200, `login ${email}`); }
  return call;
}
const memo = f => { let p; return () => (p ||= f()); };
const admin = memo(() => client('admin@thebulkbuyers.com', ADMIN_PW));
const demoBuyer = memo(() => client('buyer@demo.com', 'Demo@12345'));
async function newBuyer(extra = {}) {
  const c = await client(), email = `u${uniq()}@test.com`;
  const r = await c('POST', '/auth/register', { name: 'Test Buyer', email, password: 'Passw0rd1', ...extra });
  assert.equal(r.status, 201); c.email = email; return c;
}
const firstProduct = async () => (await (await client())('GET', '/products?limit=1')).data.items[0];
const supplierId = async ad => (await ad('GET', '/admin/users')).data.find(u => u.role === 'seller').id;

/* ---------------- AUTHORIZATION ---------------- */
test('authz matrix: admin endpoints reject anonymous (401) and buyers (403)', async () => {
  const anon = await client(), b = await demoBuyer(), a = await admin();
  const reads = ['/admin/stats', '/admin/users', '/admin/products', '/admin/products/1', '/admin/inquiries', '/admin/settings', '/admin/payments', '/admin/site', '/admin/audit'];
  for (const p of reads) {
    assert.equal((await anon('GET', p)).status, 401, 'anon GET ' + p);
    assert.equal((await b('GET', p)).status, 403, 'buyer GET ' + p);
    assert.equal((await a('GET', p)).status, 200, 'admin GET ' + p);
  }
  const writes = [['POST', '/admin/users'], ['PUT', '/admin/users/1'], ['PUT', '/admin/users/1/password'], ['DELETE', '/admin/users/1'], ['POST', '/admin/products'], ['PUT', '/admin/products/1'], ['DELETE', '/admin/products/1'],
    ['POST', '/admin/categories'], ['PUT', '/admin/categories/x'], ['DELETE', '/admin/categories/x'], ['POST', '/admin/rfqs'], ['PUT', '/admin/rfqs/1'], ['DELETE', '/admin/rfqs/1'], ['POST', '/admin/rfqs/1/quotes'],
    ['DELETE', '/admin/quotes/1'], ['POST', '/admin/quotes/1/accept'], ['POST', '/admin/orders'], ['PUT', '/admin/orders/1'], ['DELETE', '/admin/orders/1'], ['PUT', '/admin/inquiries/1'], ['DELETE', '/admin/inquiries/1'],
    ['PUT', '/admin/settings'], ['PUT', '/admin/site'], ['POST', '/admin/upload']];
  for (const [m, p] of writes) {
    assert.equal((await anon(m, p, {})).status, 401, `anon ${m} ${p}`);
    assert.equal((await b(m, p, {})).status, 403, `buyer ${m} ${p}`);
  }
});

test('authz: sign-in required endpoints, buyer-only endpoints, removed seller/agent APIs', async () => {
  const anon = await client(), a = await admin(), b = await demoBuyer();
  for (const p of ['/orders', '/rfqs', '/wishlist', '/notifications', '/account/addresses', '/rfqs/1'])
    assert.equal((await anon('GET', p)).status, 401, 'anon ' + p);
  for (const [m, p] of [['POST', '/rfqs'], ['POST', '/orders/direct'], ['POST', '/quotes/1/accept'], ['PUT', '/rfqs/1/close']]) {
    assert.equal((await anon(m, p, {})).status, 401, `anon ${m} ${p}`);
    assert.equal((await a(m, p, {})).status, 403, `admin cannot act as buyer: ${m} ${p}`);
  }
  assert.equal((await anon('GET', '/auth/me')).data.user, null);
  for (const p of ['/seller/summary', '/seller/products']) assert.equal((await b('GET', p)).status, 403, p + ' is seller-only');
  assert.equal((await b('GET', '/agent/summary')).status, 403, 'agent API is agent-only');
  assert.equal((await anon('POST', '/seller/products', {})).status, 401);
  assert.equal((await b('POST', '/rfqs/1/quotes', { price: 5 })).status, 404, 'sellers can no longer quote via the old route');
  // public endpoints stay public
  for (const p of ['/products?limit=1', '/categories', '/facets', '/site', '/policies', '/stats', '/manufacturers', '/search/suggest?q=shirt']) assert.equal((await anon('GET', p)).status, 200, p);
});

test('authz: buyers only see and change their own data', async () => {
  const a = await admin(), A = await newBuyer(), B = await newBuyer(), p = await firstProduct();
  const rfq = await A('POST', '/rfqs', { productId: p.id, quantity: 500, destination: 'Pune' }); assert.equal(rfq.status, 201);
  assert.equal((await B('GET', `/rfqs/${rfq.data.id}`)).status, 404, 'B cannot read A\'s RFQ');
  assert.equal((await B('PUT', `/rfqs/${rfq.data.id}/close`)).status, 400, 'B cannot close A\'s RFQ');
  assert.ok(!(await B('GET', '/rfqs')).data.some(r => r.id === rfq.data.id));
  await a('POST', `/admin/rfqs/${rfq.data.id}/quotes`, { seller_id: await supplierId(a), price: 100, lead_days: 10 });
  const quote = (await A('GET', `/rfqs/${rfq.data.id}`)).data.quotes[0];
  assert.equal((await B('POST', `/quotes/${quote.id}/accept`)).status, 404, 'B cannot accept A\'s quote');
  const oid = (await A('POST', `/quotes/${quote.id}/accept`)).data.orderId;
  assert.ok(!(await B('GET', '/orders')).data.some(o => o.id === oid));
  assert.notEqual((await B('PUT', `/orders/${oid}/status`, { status: 'cancelled' })).status, 200, 'B cannot cancel A\'s order');
  const addr = await A('POST', '/account/addresses', { name: 'A', phone: '9876543210', line1: '12 Test Street', city: 'Pune' }); assert.equal(addr.status, 201);
  assert.equal((await B('PUT', `/account/addresses/${addr.data.id}`, { name: 'Hacked', phone: '9876543210', line1: 'x street', city: 'Y' })).status, 404);
  assert.equal((await B('DELETE', `/account/addresses/${addr.data.id}`)).status, 200); // no-op for B…
  assert.equal((await A('GET', '/account/addresses')).data.length, 1, '…and A\'s address survives');
  await A('POST', `/wishlist/${p.id}`); assert.equal((await B('GET', '/wishlist')).data.length, 0);
  // buyer cancel rules: allowed while confirmed, not once shipped
  assert.equal((await A('PUT', `/orders/${oid}/status`, { status: 'cancelled' })).status, 200);
  const rfq2 = await A('POST', '/rfqs', { productId: p.id, quantity: 400 });
  await a('POST', `/admin/rfqs/${rfq2.data.id}/quotes`, { seller_id: await supplierId(a), price: 90 });
  const o2 = (await A('POST', `/quotes/${(await A('GET', `/rfqs/${rfq2.data.id}`)).data.quotes[0].id}/accept`)).data.orderId;
  await a('PUT', `/admin/orders/${o2}`, { status: 'shipped' });
  assert.equal((await A('PUT', `/orders/${o2}/status`, { status: 'cancelled' })).status, 400, 'cannot cancel after shipping');
  assert.equal((await A('PUT', `/orders/${o2}/status`, { status: 'shipped' })).status, 400, 'buyer cannot set arbitrary statuses');
  assert.equal((await A('PUT', `/orders/${o2}/status`, { status: 'delivered' })).status, 200);
});

/* ---------------- AUTHENTICATION ---------------- */
test('authn: credentials, enumeration safety, tampered/garbage tokens, logout', async () => {
  const c = await client();
  const wrong = await c('POST', '/auth/login', { email: 'buyer@demo.com', password: 'wrong' }), unknown = await c('POST', '/auth/login', { email: 'nobody@nowhere.com', password: 'wrong' });
  assert.equal(wrong.status, 401); assert.equal(unknown.status, 401); assert.equal(wrong.data.error, unknown.data.error, 'same message for wrong password and unknown email');
  assert.equal((await c('POST', '/auth/login', {})).status, 401);
  assert.equal((await c('POST', '/auth/login', { email: { $ne: '' }, password: { $ne: '' } })).status, 401, 'object payloads rejected');
  assert.equal((await c('POST', '/auth/login', { email: "' OR 1=1--", password: 'x' })).status, 401);
  for (const bad of ['tbb_token=garbage', 'tbb_token=a.b.c', 'tbb_token=']) { c.setCookie(bad); assert.equal((await c('GET', '/auth/me')).data.user, null); assert.equal((await c('GET', '/orders')).status, 401); }
  // token signed with the wrong secret
  const jwt = require('jsonwebtoken'); c.setCookie('tbb_token=' + jwt.sign({ id: 1, role: 'admin', tv: 0 }, 'not-the-secret')); assert.equal((await c('GET', '/admin/stats')).status, 401, 'forged admin token rejected');
  // alg=none token
  const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ id: 1, role: 'admin' })).toString('base64url') + '.';
  c.setCookie('tbb_token=' + none); assert.equal((await c('GET', '/admin/stats')).status, 401, 'alg=none rejected');
  const b = await client('buyer@demo.com', 'Demo@12345');
  assert.equal((await b('GET', '/auth/me')).data.user.role, 'buyer'); assert.ok(!('password_hash' in (await b('GET', '/auth/me')).data.user), 'no hash leaked');
  assert.ok(!('token_version' in (await b('GET', '/auth/me')).data.user));
  await b('POST', '/auth/logout'); b.setCookie(''); assert.equal((await b('GET', '/orders')).status, 401);
});

test('authn: registration rules (buyer-only, strong passwords, unique email)', async () => {
  const c = await client(), email = `r${uniq()}@test.com`;
  assert.equal((await c('POST', '/auth/register', { name: 'A', email, password: 'Passw0rd1' })).status, 400, 'short name');
  assert.equal((await c('POST', '/auth/register', { name: 'Alice', email: 'not-an-email', password: 'Passw0rd1' })).status, 400);
  assert.equal((await c('POST', '/auth/register', { name: 'Alice', email, password: 'short1' })).status, 400, 'short password');
  assert.equal((await c('POST', '/auth/register', { name: 'Alice', email, password: 'onlyletters' })).status, 400, 'no digit');
  const ok = await c('POST', '/auth/register', { name: 'Alice', email, password: 'Passw0rd1', role: 'admin' });
  assert.equal(ok.status, 201); assert.equal(ok.data.role, 'buyer', 'role escalation ignored');
  const sell = await c('POST', '/auth/register', { name: 'Mallory', email: `m${uniq()}@test.com`, password: 'Passw0rd1', role: 'seller' }); assert.equal(sell.data.role, 'buyer', 'cannot self-register as supplier');
  assert.equal((await (await client())('POST', '/auth/register', { name: 'Alice 2', email: email.toUpperCase(), password: 'Passw0rd1' })).status, 409, 'duplicate email is case-insensitive');
});

test('authn: password change revokes other sessions; wrong current password rejected', async () => {
  const one = await newBuyer(), two = await client(one.email, 'Passw0rd1');
  assert.equal((await two('GET', '/auth/me')).data.user.email, one.email);
  assert.equal((await one('PUT', '/auth/password', { current: 'nope', next: 'NewPassw0rd2' })).status, 400);
  assert.equal((await one('PUT', '/auth/password', { current: 'Passw0rd1', next: 'weak' })).status, 400);
  assert.equal((await one('PUT', '/auth/password', { current: 'Passw0rd1', next: 'NewPassw0rd2' })).status, 200);
  assert.equal((await two('GET', '/auth/me')).data.user, null, 'other session revoked');
  assert.equal((await one('GET', '/auth/me')).data.user.email, one.email, 'this device stays signed in');
  assert.equal((await (await client())('POST', '/auth/login', { email: one.email, password: 'Passw0rd1' })).status, 401, 'old password dead');
  assert.equal((await (await client())('POST', '/auth/login', { email: one.email, password: 'NewPassw0rd2' })).status, 200);
});

test('authn: lockout after repeated failures; admin reset unlocks and revokes sessions', async () => {
  const a = await admin(), u = await newBuyer(), uid = (await u('GET', '/auth/me')).data.user.id, c = await client();
  for (let i = 0; i < 5; i++) assert.equal((await c('POST', '/auth/login', { email: u.email, password: 'bad' + i })).status, 401);
  assert.equal((await c('POST', '/auth/login', { email: u.email, password: 'Passw0rd1' })).status, 429, 'locked even with the right password');
  assert.equal((await u('GET', '/auth/me')).data.user.email, u.email, 'existing session unaffected by lockout');
  assert.equal((await a('PUT', `/admin/users/${uid}/password`, { password: 'weak' })).status, 400);
  assert.equal((await a('PUT', `/admin/users/${uid}/password`, { password: 'ResetPassw0rd3' })).status, 200);
  assert.equal((await u('GET', '/auth/me')).data.user, null, 'admin reset revokes sessions');
  assert.equal((await (await client())('POST', '/auth/login', { email: u.email, password: 'ResetPassw0rd3' })).status, 200, 'reset unlocks the account');
  assert.equal((await a('PUT', '/admin/users/999999/password', { password: 'ResetPassw0rd3' })).status, 404);
});

test('authn: suspended accounts are signed out immediately and blocked from login; supplier/agent accounts cannot sign in', async () => {
  const a = await admin(), u = await newBuyer(), uid = (await u('GET', '/auth/me')).data.user.id;
  assert.equal((await a('PUT', `/admin/users/${uid}`, { status: 'suspended' })).status, 200);
  assert.equal((await u('GET', '/orders')).status, 401, 'live session killed');
  const l = await (await client())('POST', '/auth/login', { email: u.email, password: 'Passw0rd1' }); assert.equal(l.status, 403);
  assert.equal((await a('PUT', `/admin/users/${uid}`, { status: 'active' })).status, 200);
  assert.equal((await (await client())('POST', '/auth/login', { email: u.email, password: 'Passw0rd1' })).status, 200);
  const email = `s${uniq()}@test.com`, mk = await a('POST', '/admin/users', { name: 'Sup', email, role: 'agent', password: 'Passw0rd1' }); assert.equal(mk.status, 201);
  const ag = await client(); assert.equal((await ag('POST', '/auth/login', { email, password: 'Passw0rd1' })).status, 200, 'agent can sign in'); assert.equal((await ag('GET', '/agent/summary')).status, 200); assert.equal((await ag('GET', '/admin/users')).status, 403, 'agent is not admin');
  assert.equal((await a('DELETE', `/admin/users/${mk.data.id}`)).status, 200);
});

test('CSRF: cross-site unsafe requests blocked, same-origin allowed', async () => {
  const b = await demoBuyer(), host = new URL(BASE).host;
  assert.equal((await b('POST', '/wishlist/1', undefined, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await b('PUT', '/auth/me', { name: 'x' }, { origin: 'null' })).status, 403);
  assert.equal((await b('POST', '/wishlist/1', undefined, { origin: 'http://' + host })).status, 200);
  await b('POST', '/wishlist/1'); // toggle back to the original state
  assert.equal((await b('GET', '/wishlist', undefined, { origin: 'https://evil.example' })).status, 200, 'safe methods unaffected');
});

test('admin safeguards: cannot delete/demote/suspend self or the last admin; audit trail records writes', async () => {
  const a = await admin(), me = (await a('GET', '/auth/me')).data.user;
  assert.equal((await a('DELETE', `/admin/users/${me.id}`)).status, 400);
  assert.equal((await a('PUT', `/admin/users/${me.id}`, { role: 'buyer' })).status, 400);
  assert.equal((await a('PUT', `/admin/users/${me.id}`, { status: 'suspended' })).status, 400);
  assert.equal((await a('DELETE', '/admin/users/999999')).status, 404);
  const mk = await a('POST', '/admin/users', { name: 'Audit Probe', email: `p${uniq()}@test.com`, role: 'buyer', password: 'Passw0rd1' });
  await a('DELETE', `/admin/users/${mk.data.id}`); await sleep(250);
  const log = (await a('GET', '/admin/audit')).data;
  assert.ok(log.some(l => l.method === 'POST' && l.path === '/api/admin/users' && l.status === 201 && l.user_email === me.email), 'create logged');
  assert.ok(log.some(l => l.method === 'DELETE' && l.path === `/api/admin/users/${mk.data.id}`), 'delete logged');
  assert.ok(!log.some(l => l.method === 'GET'), 'reads are not logged');
});

/* ---------------- ADMIN OPTIONS (every feature) ---------------- */
test('admin: user CRUD + validation', async () => {
  const a = await admin(), email = `c${uniq()}@test.com`;
  const bad = [{ name: 'X', email }, { name: 'Valid', email: 'bad' }, { name: 'Valid', email, role: 'god' }, { name: 'Valid', email, role: 'buyer', status: 'weird' }, { name: 'Valid', email, role: 'buyer', gst: 'BADGST' }, { name: 'Valid', email, role: 'buyer', password: 'weak' }];
  for (const b of bad) assert.equal((await a('POST', '/admin/users', { password: 'Passw0rd1', ...b })).status, 400, JSON.stringify(b));
  const mk = await a('POST', '/admin/users', { name: 'Full User', email, role: 'seller', status: 'pending', password: 'Passw0rd1', company: 'Co', phone: '99999', gst: '29ABCDE1234F1Z5', admin_notes: 'vip' });
  assert.equal(mk.status, 201);
  let row = (await a('GET', '/admin/users')).data.find(u => u.id === mk.data.id);
  assert.equal(row.role, 'seller'); assert.equal(row.status, 'pending'); assert.equal(row.gst, '29ABCDE1234F1Z5'); assert.equal(row.admin_notes, 'vip');
  assert.ok(!('password_hash' in row));
  assert.equal((await a('PUT', `/admin/users/${mk.data.id}`, { status: 'active', company: 'New Co', role: 'agent' })).status, 200);
  row = (await a('GET', '/admin/users')).data.find(u => u.id === mk.data.id); assert.equal(row.status, 'active'); assert.equal(row.company, 'New Co'); assert.equal(row.role, 'agent'); assert.equal(row.name, 'Full User', 'partial update keeps other fields');
  assert.equal((await a('PUT', `/admin/users/${mk.data.id}`, { email: 'buyer@demo.com' })).status, 400, 'email must stay unique');
  assert.equal((await a('PUT', '/admin/users/999999', { name: 'x' })).status, 404);
  assert.equal((await a('DELETE', `/admin/users/${mk.data.id}`)).status, 200);
});

test('admin: product lifecycle — create, edit, hide/publish, feature, supplier, validation, delete', async () => {
  const a = await admin(), pub = await client(), name = `Lifecycle Tee ${uniq()}`;
  const base = { name, category: 'mens', subcategory: 'mens-hoodies', moq: 50, price_min: 100, price_max: 160, stock_qty: 10, gst_rate: 12, colors: '#111111, #ffffff', sizes: 'S–XL', purchase_price: 70 };
  for (const b of [{ name: 'x' }, { category: 'nope' }, { subcategory: 'womens-leggings' }, { moq: 0 }, { price_min: 0 }, { price_min: 200, price_max: 100 }]) assert.equal((await a('POST', '/admin/products', { ...base, ...b })).status, 400, JSON.stringify(b));
  assert.equal((await a('POST', '/admin/products', { ...base, seller_id: 999999 })).status, 400, 'unknown supplier');
  const mk = await a('POST', '/admin/products', base); assert.equal(mk.status, 201);
  const id = mk.data.id, full = (await a('GET', `/admin/products/${id}`)).data;
  assert.equal(full.status, 'approved'); assert.equal(full.purchase_price, 70); assert.deepEqual(full.size_options, ['S', 'M', 'L', 'XL']); assert.match(full.sku, /^TBB-MEN-/);
  const live = () => pub('GET', `/products?q=${encodeURIComponent(name)}`).then(r => r.data.items);
  assert.equal((await live()).length, 1); assert.ok(!('purchase_price' in (await live())[0]), 'purchase price private');
  assert.equal((await a('PUT', `/admin/products/${id}`, { status: 'rejected' })).status, 200);
  assert.equal((await live()).length, 0, 'hidden products leave the catalogue'); assert.equal((await pub('GET', `/products/${full.slug}`)).status, 404);
  assert.equal((await a('PUT', `/admin/products/${id}`, { status: 'bogus' })).status, 400);
  assert.equal((await a('PUT', `/admin/products/${id}`, { status: 'approved', featured: true })).status, 200);
  assert.equal((await pub('GET', '/products?featured=1&limit=100')).data.items.some(p => p.id === id), true, 'featured listing');
  assert.equal((await a('PUT', `/admin/products/${id}`, { ...base, name: name + ' v2', price_max: 180, stock_qty: 0, status: 'approved', seller_id: await supplierId(a) })).status, 200);
  const edited = (await a('GET', `/admin/products/${id}`)).data; assert.equal(edited.price_max, 180); assert.equal(edited.stock_qty, 0); assert.equal(edited.name, name + ' v2'); assert.equal(edited.sku, full.sku, 'SKU kept');
  const other = (await a('POST', '/admin/products', { ...base, name: name + ' other' })).data.id;
  assert.equal((await a('PUT', `/admin/products/${other}`, { ...base, name: name + ' other', sku: full.sku })).status, 400, 'duplicate SKU');
  assert.equal((await a('GET', '/admin/products/999999')).status, 404); assert.equal((await a('PUT', '/admin/products/999999', { status: 'approved' })).status, 404);
  for (const i of [id, other]) assert.equal((await a('DELETE', `/admin/products/${i}`)).status, 200);
  assert.equal((await a('GET', `/admin/products/${id}`)).status, 404);
});

test('admin: categories CRUD with hierarchy rules', async () => {
  const a = await admin(), pub = await client(), nodes = (await pub('GET', '/categories')).data, group = nodes.find(n => n.level === 0).id, nm = 'Zz Cat ' + uniq();
  assert.equal((await a('POST', '/admin/categories', {})).status, 400);
  assert.equal((await a('POST', '/admin/categories', { name: 'x', parent_id: 'nope' })).status, 400);
  const cat = await a('POST', '/admin/categories', { name: nm, parent_id: group, blurb: 'b', color: '#123456' }); assert.equal(cat.status, 201);
  assert.equal((await a('POST', '/admin/categories', { name: nm, parent_id: group })).status, 409, 'duplicate');
  const type = await a('POST', '/admin/categories', { name: 'Zz Type', parent_id: cat.data.id }); assert.equal(type.status, 201);
  assert.equal((await a('POST', '/admin/categories', { name: 'Too deep', parent_id: type.data.id })).status, 400, 'types are the deepest level');
  assert.equal((await a('PUT', `/admin/categories/${cat.data.id}`, { name: nm + ' R', color: '#654321' })).status, 200);
  const got = (await pub('GET', '/categories')).data.find(n => n.id === cat.data.id); assert.equal(got.name, nm + ' R'); assert.equal(got.color, '#654321');
  assert.equal((await a('DELETE', `/admin/categories/${cat.data.id}`)).status, 400, 'cannot delete a category that has types');
  const p = await a('POST', '/admin/products', { name: 'Cat Probe Product', category: cat.data.id, subcategory: type.data.id, moq: 10, price_min: 10, price_max: 20 }); assert.equal(p.status, 201);
  assert.equal((await a('DELETE', `/admin/categories/${type.data.id}`)).status, 400, 'cannot delete a type that has products');
  await a('DELETE', `/admin/products/${p.data.id}`);
  assert.equal((await a('DELETE', `/admin/categories/${type.data.id}`)).status, 200); assert.equal((await a('DELETE', `/admin/categories/${cat.data.id}`)).status, 200);
});

test('admin: RFQ + quote management (create, quote, update, lock, accept, close/reopen, delete)', async () => {
  const a = await admin(), B = await newBuyer(), bid = (await B('GET', '/auth/me')).data.user.id, sid = await supplierId(a);
  for (const b of [{}, { buyer_id: bid }, { buyer_id: bid, title: 'abc' }, { buyer_id: bid, title: 'abc', quantity: 0 }, { buyer_id: 999999, title: 'abc', quantity: 5 }]) assert.equal((await a('POST', '/admin/rfqs', b)).status, 400, JSON.stringify(b));
  const rfq = await a('POST', '/admin/rfqs', { buyer_id: bid, title: 'Admin-raised RFQ', quantity: 800, target_price: 90, destination: 'Delhi', category: 'mens' }); assert.equal(rfq.status, 201);
  const id = rfq.data.id;
  assert.ok((await B('GET', '/rfqs')).data.some(r => r.id === id), 'buyer sees RFQ raised for them');
  for (const b of [{ seller_id: sid }, { seller_id: sid, price: 0 }, { seller_id: sid, price: 5, lead_days: 999 }, { seller_id: 999999, price: 5 }]) assert.equal((await a('POST', `/admin/rfqs/${id}/quotes`, b)).status, 400, JSON.stringify(b));
  assert.equal((await a('POST', `/admin/rfqs/${id}/quotes`, { seller_id: sid, price: 100, lead_days: 20 })).status, 201);
  assert.equal((await a('POST', `/admin/rfqs/${id}/quotes`, { seller_id: sid, price: 95, lead_days: 15 })).status, 200, 'same supplier updates its quote');
  const q1 = (await B('GET', `/rfqs/${id}`)).data.quotes; assert.equal(q1.length, 1); assert.equal(q1[0].price, 95);
  const me = (await a('GET', '/auth/me')).data.user.id;
  assert.equal((await a('POST', `/admin/rfqs/${id}/quotes`, { seller_id: me, price: 110 })).status, 201, 'admin can quote from own stock');
  const quotes = (await B('GET', `/rfqs/${id}`)).data.quotes; assert.equal(quotes.length, 2); assert.equal(quotes[0].price, 95, 'sorted by price');
  assert.equal((await a('DELETE', `/admin/quotes/${quotes[1].id}`)).status, 200);
  assert.equal((await a('PUT', `/admin/rfqs/${id}`, { status: 'closed' })).status, 200);
  assert.equal((await a('POST', `/admin/rfqs/${id}/quotes`, { seller_id: sid, price: 90 })).status, 404, 'closed RFQs take no quotes');
  assert.equal((await a('PUT', `/admin/rfqs/${id}`, { status: 'open' })).status, 200);
  assert.equal((await a('PUT', `/admin/rfqs/${id}`, { status: 'accepted' })).status, 400, 'status limited to open/closed');
  const acc = await a('POST', `/admin/quotes/${quotes[0].id}/accept`); assert.equal(acc.status, 200);
  assert.equal((await a('POST', `/admin/quotes/${quotes[0].id}/accept`)).status, 400, 'no double accept');
  assert.equal((await a('PUT', `/admin/rfqs/${id}`, { status: 'closed' })).status, 400, 'accepted RFQs are locked');
  assert.equal((await a('DELETE', `/admin/quotes/${quotes[0].id}`)).status, 400, 'accepted quotes cannot be removed');
  assert.equal((await a('DELETE', `/admin/rfqs/${id}`)).status, 400, 'RFQ with an order cannot be deleted');
  const order = (await a('GET', '/orders')).data.find(o => o.id === acc.data.orderId); assert.equal(order.unit_price, 95); assert.equal(order.total, 95 * 800);
  assert.equal((await a('DELETE', `/admin/orders/${order.id}`)).status, 200); assert.equal((await a('DELETE', `/admin/rfqs/${id}`)).status, 200);
  // buyer closes own RFQ
  const own = await B('POST', '/rfqs', { title: 'Buyer RFQ', quantity: 100 }); assert.equal((await B('PUT', `/rfqs/${own.data.id}/close`)).status, 200); assert.equal((await B('PUT', `/rfqs/${own.data.id}/close`)).status, 400);
  assert.equal((await B('POST', '/rfqs', { title: 'ab', quantity: 5 })).status, 400); assert.equal((await B('POST', '/rfqs', { title: 'Valid title', quantity: 0 })).status, 400);
});

test('admin: order management (create, edit, payments, tracking, validation, delete)', async () => {
  const a = await admin(), B = await newBuyer(), bid = (await B('GET', '/auth/me')).data.user.id, p = await firstProduct();
  for (const b of [{}, { buyer_id: bid }, { buyer_id: bid, title: 'Order x', quantity: 0, unit_price: 5 }, { buyer_id: bid, title: 'Order x', quantity: 5, unit_price: 0 }, { buyer_id: 999999, title: 'Order x', quantity: 5, unit_price: 5 }, { buyer_id: bid, title: 'Order x', quantity: 5, unit_price: 5, seller_id: 999999 }])
    assert.equal((await a('POST', '/admin/orders', b)).status, 400, JSON.stringify(b));
  const mk = await a('POST', '/admin/orders', { buyer_id: bid, product_id: p.id, quantity: 200, unit_price: 150, gst_rate: 5, channel: 'wholesale', destination: 'Surat' }); assert.equal(mk.status, 201);
  const id = mk.data.id, get = async () => (await a('GET', '/orders')).data.find(o => o.id === id);
  let o = await get(); assert.equal(o.title, p.name); assert.equal(o.total, 30000); assert.equal(o.gst_amount, 1500); assert.equal(o.status, 'confirmed'); assert.equal(o.payment_status, 'unpaid'); assert.equal(o.seller_id, (await a('GET', '/auth/me')).data.user.id, 'defaults to own stock');
  assert.ok((await B('GET', '/orders')).data.some(x => x.id === id), 'buyer sees order created for them');
  assert.ok((await B('GET', '/notifications')).data.items.some(n => n.text.includes(`#${id}`)), 'buyer notified');
  assert.equal((await a('PUT', `/admin/orders/${id}`, { status: 'teleported' })).status, 400); assert.equal((await a('PUT', `/admin/orders/${id}`, { payment_status: 'maybe' })).status, 400);
  assert.equal((await a('PUT', `/admin/orders/${id}`, { payout_status: 'x' })).status, 400); assert.equal((await a('PUT', `/admin/orders/${id}`, { unit_price: -1 })).status, 400); assert.equal((await a('PUT', `/admin/orders/${id}`, { quantity: 0 })).status, 400);
  assert.equal((await a('PUT', '/admin/orders/999999', { status: 'shipped' })).status, 404);
  for (const st of ['in_production', 'quality_check', 'shipped', 'delivered']) { assert.equal((await a('PUT', `/admin/orders/${id}`, { status: st })).status, 200); assert.equal((await get()).status, st); }
  assert.equal((await a('PUT', `/admin/orders/${id}`, { quantity: 300, unit_price: 100 })).status, 200); o = await get(); assert.equal(o.total, 30000); assert.equal(o.gst_amount, 1500, 'GST scales with total'); assert.equal(o.status, 'delivered');
  assert.equal((await a('PUT', `/admin/orders/${id}`, { unit_price: 200 })).status, 200); o = await get(); assert.equal(o.total, 60000); assert.equal(o.gst_amount, 3000);
  assert.equal((await a('PUT', `/admin/orders/${id}`, { payment_status: 'partial', paid_amount: 20000, payment_ref: 'UTR123', tracking_no: 'AWB777', admin_notes: 'call buyer', commission: 1800 })).status, 200);
  o = await get(); assert.equal(o.payment_status, 'partial'); assert.equal(o.paid_amount, 20000); assert.equal(o.payment_ref, 'UTR123'); assert.equal(o.tracking_no, 'AWB777'); assert.equal(o.commission, 1800);
  assert.ok((await B('GET', '/notifications')).data.items.some(n => n.text.includes('AWB777')), 'tracking number notified');
  const pay = (await a('GET', '/admin/payments')).data, row = pay.orders.find(x => x.id === id);
  assert.equal(row.payment_status, 'partial'); assert.ok(pay.totals.billed > 0 && pay.totals.collected >= 20000); assert.ok(Array.isArray(pay.agents));
  const dueBefore = pay.totals.payout_due;
  await a('PUT', `/admin/orders/${id}`, { payout_status: 'paid', payment_status: 'paid', paid_amount: 63000 });
  assert.equal((await a('GET', '/admin/payments')).data.totals.payout_due, dueBefore - (60000 - 1800), 'paying out reduces payouts due');
  assert.equal((await a('PUT', `/admin/orders/${id}`, { status: 'cancelled' })).status, 200);
  assert.equal((await a('DELETE', `/admin/orders/${id}`)).status, 200); assert.equal(await get(), undefined);
});

test('admin: inquiries, settings, site content, stats, upload', async () => {
  const a = await admin(), pub = await client();
  assert.equal((await pub('POST', '/inquiries', { name: 'x' })).status, 400); assert.equal((await pub('POST', '/inquiries', { name: 'Zed', email: 'bad', message: 'hello there' })).status, 400);
  assert.equal((await pub('POST', '/inquiries', { name: 'Zed', email: 'zed@test.com', message: 'Need 1000 shirts' })).status, 201);
  const inq = (await a('GET', '/admin/inquiries')).data.find(i => i.email === 'zed@test.com' && i.status === 'new'); assert.ok(inq);
  assert.equal((await a('PUT', `/admin/inquiries/${inq.id}`, { status: 'handled' })).status, 200); assert.equal((await a('GET', '/admin/inquiries')).data.find(i => i.id === inq.id).status, 'handled');
  assert.equal((await a('DELETE', `/admin/inquiries/${inq.id}`)).status, 200); assert.ok(!(await a('GET', '/admin/inquiries')).data.some(i => i.id === inq.id));
  // settings
  const s0 = (await a('GET', '/admin/settings')).data;
  await a('PUT', '/admin/settings', { commission_pct: 99, agent_commission_pct: -4 }); const s1 = (await a('GET', '/admin/settings')).data; assert.equal(s1.commission_pct, s0.commission_pct, 'out-of-range ignored'); assert.equal(s1.agent_commission_pct, s0.agent_commission_pct);
  await a('PUT', '/admin/settings', { commission_pct: 4.5, shipping_policy: 'Ships in 3 days', return_policy: 'No returns' }); assert.equal((await a('GET', '/admin/settings')).data.commission_pct, 4.5);
  const pol = (await pub('GET', '/policies')).data; assert.equal(pol.shipping, 'Ships in 3 days'); assert.equal(pol.returns, 'No returns');
  await a('PUT', '/admin/settings', { commission_pct: s0.commission_pct, shipping_policy: s0.shipping_policy, return_policy: s0.return_policy });
  // site content
  const site = await a('PUT', '/admin/site', { content: { announcements: [{ title: 'Sale', text: 'Today' }], announceLinkLabel: 'Go', hero: { line1: 'HELLO', accent: '' }, footer: { legal: 'Line1\nLine2' }, about: { title: 'About us' } } }); assert.equal(site.status, 200);
  const pubSite = (await pub('GET', '/site')).data;
  assert.deepEqual(pubSite.announcements, [{ title: 'Sale', text: 'Today' }]); assert.equal(pubSite.hero.line1, 'HELLO'); assert.ok(pubSite.hero.accent, 'blank falls back to default'); assert.equal(pubSite.footer.legal, 'Line1\nLine2'); assert.equal(pubSite.about.title, 'About us');
  await a('PUT', '/admin/site', { content: { announcements: [] } }); assert.deepEqual((await pub('GET', '/site')).data.announcements, [], 'admin can empty the announcement bar');
  await a('PUT', '/admin/site', { content: { hero: { eyebrow: '<script>alert(1)</script>'.repeat(40) } } }); assert.ok((await pub('GET', '/site')).data.hero.eyebrow.length <= 400, 'length capped');
  await a('PUT', '/admin/site', { content: null }); assert.equal((await pub('GET', '/site')).data.announcements.length, 3, 'reset restores defaults');
  // stats
  const st = (await a('GET', '/admin/stats')).data; for (const k of ['users', 'products', 'rfqs', 'orders', 'inquiries', 'monthly', 'byStatus', 'byCategory', 'topSellers', 'byChannel']) assert.ok(k in st, k);
  // upload validation
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const f = new FormData(); f.append('image', new Blob([png], { type: 'image/png' }), 'a.png'); const up = await a('POST', '/admin/upload', f); assert.equal(up.status, 200); assert.match(up.data.url, /^\/uploads\/[a-f0-9]{24}$/);
  assert.equal((await fetch(BASE + up.data.url)).headers.get('x-content-type-options'), 'nosniff');
  const svg = new FormData(); svg.append('image', new Blob(['<svg onload=alert(1)></svg>'], { type: 'image/svg+xml' }), 'a.svg'); assert.equal((await a('POST', '/admin/upload', svg)).status, 400, 'svg rejected');
  const big = new FormData(); big.append('image', new Blob([Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)])], { type: 'image/png' }), 'big.png'); assert.equal((await a('POST', '/admin/upload', big)).status, 400, '>5MB rejected');
  assert.equal((await a('POST', '/admin/upload', new FormData())).status, 400);
});

/* ---------------- B2B PRICING & QUICK ORDER ---------------- */
test('quick order: SKU lookup resolves live products only', async () => {
  const pub = await client(), a = await admin(), list = (await pub('GET', '/products?limit=3')).data.items;
  const skus = list.map(p => p.sku);
  const got = (await pub('GET', `/products/by-sku?skus=${skus.join(',').toLowerCase()},NOPE-000`)).data;
  assert.equal(got.length, skus.length, 'case-insensitive, unknown SKUs omitted'); assert.ok(got.every(p => Array.isArray(p.size_options) && !('purchase_price' in p)), 'variant data present, purchase price private');
  assert.deepEqual((await pub('GET', '/products/by-sku')).data, []);
  const hidden = list[0]; await a('PUT', `/admin/products/${hidden.id}`, { status: 'rejected' });
  assert.ok(!(await pub('GET', `/products/by-sku?skus=${hidden.sku}`)).data.length, 'hidden products are not orderable by SKU');
  await a('PUT', `/admin/products/${hidden.id}`, { status: 'approved' });
  assert.equal((await pub('GET', `/products/${hidden.slug}`)).status, 200, 'route order: /products/:slug still works');
});

test('customer-specific pricing: admin sets % off wholesale; cart and checkout apply it server-side', async () => {
  const a = await admin(), B = await newBuyer(), anon = await client(), me = (await B('GET', '/auth/me')).data.user;
  const p = (await anon('GET', '/products?limit=100')).data.items.find(x => x.stock_qty === 0 && x.moq >= 10);
  assert.ok(p, 'a made-to-order product exists');
  const whole = { items: [{ productId: p.id, qty: p.moq, size: 'M', color: '#111' }] }, retail = { items: [{ productId: p.id, qty: 1, size: 'M', color: '#111' }] };
  const base = (await anon('POST', '/cart/price', whole)).data.products[0];
  assert.equal(me.discount_pct, 0); assert.equal((await B('POST', '/cart/price', whole)).data.products[0].unit, base.unit, 'no discount by default');
  for (const bad of [-1, 31, 'abc']) assert.equal((await a('PUT', `/admin/users/${me.id}`, { discount_pct: bad })).status, 400, 'discount ' + bad);
  assert.equal((await a('PUT', `/admin/users/${me.id}`, { discount_pct: 10 })).status, 200);
  const d = (await B('POST', '/cart/price', whole)).data, line = d.products[0], r2 = n => Math.round(n * 100) / 100;
  assert.equal(line.unit, r2(base.unit * 0.9), '10% off the tier price'); assert.equal(line.customerDiscountPct, 10); assert.ok(d.totals.customerSavings > 0);
  assert.equal(line.taxable, r2(line.unit * p.moq)); assert.equal(line.gst, r2(line.taxable * line.gst_rate / 100), 'GST on the discounted amount');
  assert.equal((await anon('POST', '/cart/price', whole)).data.products[0].unit, base.unit, 'anonymous price unaffected');
  assert.equal((await B('POST', '/cart/price', retail)).data.products[0].unit, p.retail_price, 'retail (below MOQ) is not discounted');
  const ship = { name: 'Buyer', phone: '9876543210', address: '12 Test Street', city: 'Pune' };
  const o = await B('POST', '/orders/direct', { items: whole.items, shipping: ship }); assert.equal(o.status, 201);
  const row = (await B('GET', '/orders')).data.find(x => x.id === o.data.orders[0].id); assert.equal(row.unit_price, line.unit, 'order stored at the discounted price'); assert.equal(row.channel, 'wholesale');
  assert.equal((await a('PUT', `/admin/users/${me.id}`, { discount_pct: 0 })).status, 200);
  assert.equal((await B('POST', '/cart/price', whole)).data.products[0].unit, base.unit, 'removing the discount restores list price');
  assert.equal((await a('POST', '/admin/users', { name: 'Disc', email: `d${uniq()}@test.com`, role: 'buyer', password: 'Passw0rd1', discount_pct: 99 })).status, 400);
});

test('dashboard data: orders expose payment status so invoices and outstanding balance are accurate', async () => {
  const a = await admin(), B = await newBuyer(), bid = (await B('GET', '/auth/me')).data.user.id, p = await firstProduct();
  const id = (await a('POST', '/admin/orders', { buyer_id: bid, product_id: p.id, quantity: 100, unit_price: 100, gst_rate: 5 })).data.id;
  const get = async () => (await B('GET', '/orders')).data.find(o => o.id === id);
  let o = await get(); assert.equal(o.payment_status, 'unpaid'); assert.equal(o.paid_amount, 0); assert.equal(o.total + o.gst_amount, 10500);
  await a('PUT', `/admin/orders/${id}`, { payment_status: 'partial', paid_amount: 4000 }); o = await get(); assert.equal(o.payment_status, 'partial'); assert.equal(o.total + o.gst_amount - o.paid_amount, 6500, 'outstanding balance');
  await a('PUT', `/admin/orders/${id}`, { admin_notes: 'buyer is slow to pay', commission: 123, payout_status: 'paid' }); o = await get();
  for (const k of ['admin_notes', 'commission', 'payout_status']) assert.ok(!(k in o), `${k} must not be visible to the buyer`);
  assert.equal((await a('GET', '/orders')).data.find(x => x.id === id).admin_notes, 'buyer is slow to pay', 'admin still sees it');
});

/* ---------------- BUYER FLOWS ---------------- */
test('buyer: checkout validation, wishlist, notifications, addresses, GST profile', async () => {
  const B = await newBuyer(), pub = await client(), p = await firstProduct(), ship = { name: 'Buyer', phone: '9876543210', address: '12 Test Street', city: 'Pune', pincode: '411001' };
  assert.equal((await B('POST', '/orders/direct', { items: [{ productId: p.id, qty: 1 }], shipping: { ...ship, phone: '1' } })).status, 400, 'bad phone');
  assert.equal((await B('POST', '/orders/direct', { items: [{ productId: p.id, qty: 1 }], shipping: ship, business: { gstin: 'BADGSTIN' } })).status, 400, 'bad GSTIN');
  assert.equal((await B('POST', '/orders/direct', { items: [{ productId: 999999, qty: 1 }], shipping: ship })).status, 400, 'unknown product');
  assert.equal((await B('POST', '/orders/direct', { items: [{ productId: p.id, qty: -5 }], shipping: ship })).status, 400, 'negative qty');
  const ok = await B('POST', '/orders/direct', { items: [{ productId: p.id, qty: 1, size: 'M', color: '#111' }], shipping: ship, payment_method: 'bank_transfer' }); assert.equal(ok.status, 201);
  const o = (await B('GET', '/orders')).data.find(x => x.id === ok.data.orders[0].id); assert.equal(o.status, 'confirmed'); assert.equal(o.shipping.method, 'standard'); assert.equal(o.shipping.payment, 'bank_transfer');
  assert.ok((await (await admin())('GET', '/orders')).data.some(x => x.id === o.id), 'admin sees every order');
  // wishlist toggle
  assert.equal((await B('POST', `/wishlist/${p.id}`)).data.wished, true); assert.equal((await B('GET', '/wishlist')).data.length, 1); assert.equal((await B('POST', `/wishlist/${p.id}`)).data.wished, false); assert.equal((await B('POST', '/wishlist/999999')).status, 404);
  // notifications
  const n0 = (await B('GET', '/notifications')).data; await B('POST', '/notifications/read'); assert.equal((await B('GET', '/notifications')).data.unread, 0);
  // profile
  assert.equal((await B('PUT', '/auth/me', { name: '' })).status, 400); assert.equal((await B('PUT', '/auth/me', { name: 'Okay', gst: 'BAD' })).status, 400);
  assert.equal((await B('PUT', '/auth/me', { name: 'Okay Name', company: 'ACME', gst: '29ABCDE1234F1Z5' })).status, 200); assert.equal((await B('GET', '/auth/me')).data.user.company, 'ACME');
  // addresses
  assert.equal((await B('POST', '/account/addresses', { name: 'x' })).status, 400);
  const a1 = await B('POST', '/account/addresses', { name: 'Home', phone: '9876543210', line1: '1 Main Road', city: 'Pune' }), a2 = await B('POST', '/account/addresses', { name: 'Shop', phone: '9876543210', line1: '2 Main Road', city: 'Surat' });
  assert.equal((await B('GET', '/account/addresses')).data.find(x => x.id === a1.data.id).is_default, 1, 'first address is default');
  assert.equal((await B('PUT', `/account/addresses/${a2.data.id}/default`)).status, 200); const list = (await B('GET', '/account/addresses')).data; assert.equal(list.find(x => x.id === a2.data.id).is_default, 1); assert.equal(list.find(x => x.id === a1.data.id).is_default, 0);
  assert.equal((await B('DELETE', `/account/addresses/${a1.data.id}`)).status, 200); assert.equal((await B('GET', '/account/addresses')).data.length, 1);
  assert.equal((await pub('POST', '/cart/price', { items: [{ productId: p.id, qty: 1 }] })).status, 200, 'cart pricing is public');
  assert.ok(n0);
});

test('robustness: malformed input never crashes the API', async () => {
  const a = await admin(), c = await client();
  for (const [m, path, body] of [['POST', '/admin/products', { name: 5, category: {} }], ['PUT', '/admin/orders/abc', { status: [] }], ['POST', '/admin/users', 'not json object'], ['POST', '/admin/products', { name: 'nul\u0000byte', category: 'mens', moq: 1, price_min: 1, price_max: 2 }], ['PUT', '/admin/orders/1', { quantity: 99999999999 }], ['GET', '/products?limit=-5&page=abc'], ['GET', '/products?minPrice=NaN&sort=;drop table'], ['GET', '/products/%00'], ['GET', '/admin/products/abc']]) {
    const r = await (m === 'GET' && !path.startsWith('/admin') ? c : a)(m, path, body); assert.ok(r.status < 500, `${m} ${path} -> ${r.status}`);
  }
  assert.equal((await c('GET', '/does-not-exist')).status, 404);
  assert.equal((await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad json' })).status, 400);
  assert.equal((await fetch(BASE + '/healthz')).status, 200);
});

test('seller: sign-in, own catalogue (pending approval), order fulfilment, RFQ quoting, isolation', async () => {
  const a = await admin(), buyer = await newBuyer(), bid = (await buyer('GET', '/auth/me')).data.user.id;
  const mkSeller = async tag => { const email = `sel${tag}${uniq()}@test.com`, r = await a('POST', '/admin/users', { name: 'Seller ' + tag, email, role: 'seller', password: 'Passw0rd1', company: 'Co ' + tag }); assert.equal(r.status, 201); const c = await client(email, 'Passw0rd1'); return { c, id: r.data.id }; };
  const s1 = await mkSeller('A'), s2 = await mkSeller('B');
  assert.equal((await s1.c('GET', '/admin/users')).status, 403, 'seller is not admin');
  assert.equal((await s1.c('GET', '/agent/summary')).status, 403);
  const base = { name: `Lifecycle Tee Seller ${uniq()}`, category: 'mens', subcategory: 'mens-hoodies', moq: 50, price_min: 100, price_max: 160, stock_qty: 10, gst_rate: 12, colors: '#111111', sizes: 'S–XL' };
  assert.equal((await s1.c('POST', '/seller/products', { ...base, name: 'x' })).status, 400);
  const mk = await s1.c('POST', '/seller/products', base); assert.equal(mk.status, 201);
  const pid = mk.data.id, mine = (await s1.c('GET', '/seller/products')).data;
  assert.equal(mine.find(p => p.id === pid).status, 'pending', 'new listings await admin approval');
  assert.equal((await s2.c('GET', '/seller/products')).data.length, 0, 'sellers only see their own products');
  assert.equal((await s2.c('GET', `/seller/products/${pid}`)).status, 404); assert.equal((await s2.c('PUT', `/seller/products/${pid}`, base)).status, 404); assert.equal((await s2.c('DELETE', `/seller/products/${pid}`)).status, 404);
  assert.equal((await s1.c('PUT', `/seller/products/${pid}`, { ...base, price_max: 170, status: 'approved' })).status, 200);
  assert.equal((await s1.c('GET', `/seller/products/${pid}`)).data.status, 'pending', 'sellers cannot publish themselves');
  const o = await a('POST', '/admin/orders', { buyer_id: bid, seller_id: s1.id, title: 'Seller order', quantity: 100, unit_price: 100, gst_rate: 5 }); assert.equal(o.status, 201);
  const orders = (await s1.c('GET', '/seller/orders')).data; assert.equal(orders.length, 1); assert.equal((await s2.c('GET', '/seller/orders')).data.length, 0);
  assert.equal((await s2.c('PUT', `/seller/orders/${o.data.id}/status`, { status: 'in_production' })).status, 404);
  assert.equal((await s1.c('PUT', `/seller/orders/${o.data.id}/status`, { status: 'delivered' })).status, 400, 'only the buyer/admin confirm delivery');
  assert.equal((await s1.c('PUT', `/seller/orders/${o.data.id}/status`, { status: 'shipped', tracking_no: 'TRK1' })).status, 200);
  assert.equal((await s1.c('PUT', `/seller/orders/${o.data.id}/status`, { status: 'confirmed' })).status, 400, 'cannot go backwards');
  assert.equal((await s1.c('GET', '/seller/orders')).data[0].tracking_no, 'TRK1');
  const sum = (await s1.c('GET', '/seller/summary')).data; assert.equal(sum.orders.orders, 1); assert.equal(sum.products.pending, 1);
  const rfq = await a('POST', '/admin/rfqs', { buyer_id: bid, title: 'Need polos', quantity: 500 }); assert.equal(rfq.status, 201);
  assert.ok((await s1.c('GET', '/seller/rfqs')).data.some(r => r.id === rfq.data.id));
  assert.equal((await s1.c('POST', `/seller/rfqs/${rfq.data.id}/quote`, { price: 0 })).status, 400);
  assert.equal((await s1.c('POST', `/seller/rfqs/${rfq.data.id}/quote`, { price: 120, lead_days: 20 })).status, 201);
  assert.equal((await s1.c('POST', `/seller/rfqs/${rfq.data.id}/quote`, { price: 110, lead_days: 15 })).status, 200, 'seller can revise a pending quote');
  assert.equal((await s1.c('GET', '/seller/payouts')).data.orders.length, 1);
  assert.equal((await s1.c('DELETE', `/seller/products/${pid}`)).status, 200);
});

// Leave the dev database as we found it: remove every throw-away @test.com account and the records they created.
after(async () => {
  const a = await admin(), users = (await a('GET', '/admin/users')).data.filter(u => /@test\.com$/.test(u.email)), ids = new Set(users.map(u => u.id));
  for (const o of (await a('GET', '/orders')).data) if (ids.has(o.buyer_id) || ids.has(o.seller_id)) await a('DELETE', `/admin/orders/${o.id}`);
  for (const r of (await a('GET', '/rfqs')).data) if (ids.has(r.buyer_id)) await a('DELETE', `/admin/rfqs/${r.id}`);
  for (const u of users) await a('DELETE', `/admin/users/${u.id}`);
  for (const p of (await a('GET', '/admin/products')).data) if (/^(Lifecycle Tee|Cat Probe)/.test(p.name)) await a('DELETE', `/admin/products/${p.id}`);
});
