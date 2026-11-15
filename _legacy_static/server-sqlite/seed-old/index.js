const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { q } = require('../db');

const U = id => `https://images.unsplash.com/${id}`; // sized at render time (?w=...)
const IMG = {
  tee1: U('photo-1521572163474-6864f9cf17ab'), tees: U('photo-1489987707025-afc232f7ea0f'), folded: U('photo-1562157873-818bc0726f68'),
  white: U('photo-1581655353564-df123a1eb820'), black: U('photo-1618354691373-d851c5c3a990'), graphic: U('photo-1576566588028-4147f3842f27'),
  green: U('photo-1523381210434-271e8be1f52b'), manwhite: U('photo-1571945153237-4929e783af4a'), jeans: U('photo-1542272604-787c3835535d'),
  chino: U('photo-1544441893-675973e31985'), shorts: U('photo-1591195853828-11db59a44f6b'), chambray: U('photo-1596755094514-f87e34085b2c'),
  leather: U('photo-1551028719-00167b16eac5'), sweat: U('photo-1620799140408-edc6dcb6d633'), hood: U('photo-1556821840-3a63f95609a7'),
  hoodBrown: U('photo-1578768079052-aa76e52ff62e'), olive: U('photo-1544022613-e87ca75a784a'), bomber: U('photo-1591047139829-d91aecb6caea'),
  rack: U('photo-1445205170230-053b83016050'), knit: U('photo-1558769132-cb1aea458c5e'), colourRack: U('photo-1520006403909-838d6b92c22e'),
  dress: U('photo-1572804013309-59a88b7e92f1'), stripe: U('photo-1583496661160-fb5886a0aaaa'), jeansStack: U('photo-1604176354204-9268737828e4'),
  trouser: U('photo-1584865288642-42078afe6942'), chinoWalk: U('photo-1473966968600-fa801b869a1a'), suit: U('photo-1594938298603-c8148c4dae35'),
  store: U('photo-1567401893414-76b7b1e5a7a5'), womanTee: U('photo-1503342217505-b0a15ec3261c'), darkJeans: U('photo-1624378439575-d8705ad7ae80'),
  whiteFlat: U('photo-1620799139834-6b8f844fbe61'), flat: U('photo-1556905055-8f358a7a47b2')
};
const PRODUCT_IMG = {
  'classic-crew-neck-tee': IMG.tee1, 'oversized-drop-shoulder-tee': IMG.graphic, 'pique-polo-shirt': IMG.green,
  'dry-fit-performance-tee': IMG.womanTee, 'henley-full-sleeve-tee': IMG.white, 'pullover-hoodie': IMG.hood,
  'zipper-hoodie': IMG.hoodBrown, 'crew-sweatshirt': IMG.sweat, 'jogger-track-pants': IMG.chinoWalk,
  'slim-fit-stretch-jeans': IMG.darkJeans, 'cargo-pants-six-pocket': IMG.chino, 'stretch-chino-trousers': IMG.trouser,
  'oxford-button-down-shirt': IMG.chambray, 'linen-blend-shirt': IMG.stripe, 'corporate-uniform-shirt': IMG.suit,
  'varsity-baseball-jacket': IMG.leather, 'quilted-puffer-jacket': IMG.olive, 'windcheater-bomber-jacket': IMG.bomber,
  'cotton-straight-kurti': IMG.colourRack, 'rayon-maxi-dress': IMG.dress, 'kids-tee-and-shorts-set': IMG.folded,
  'four-way-stretch-leggings': IMG.whiteFlat, 'industrial-coverall': IMG.jeansStack, 'medical-scrub-set': IMG.manwhite,
  'gym-training-shorts': IMG.shorts
};
const CAT_IMG = { tees: IMG.tees, fleece: IMG.hood, denim: IMG.jeans, shirts: IMG.chambray, outer: IMG.leather, women: IMG.dress, work: IMG.suit, active: IMG.shorts };

function loadCatalogue() {
  const src = fs.readFileSync(path.join(__dirname, 'catalogue-source.js'), 'utf8');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.window.TBB;
}

const hash = p => bcrypt.hashSync(p, 10);
const refCode = () => 'TBB' + crypto.randomBytes(3).toString('hex').toUpperCase();

function seedCore() {
  const cat = loadCatalogue();
  cat.categories.forEach((c, i) =>
    q.run('INSERT OR IGNORE INTO categories(id,name,blurb,color,image,sort) VALUES(?,?,?,?,?,?)', c.id, c.name, c.blurb, c.c, CAT_IMG[c.id] || '', i));

  // Admin account — password from env in production; random (and printed once) if not supplied.
  if (!q.get("SELECT id FROM users WHERE role='admin'")) {
    const email = process.env.ADMIN_EMAIL || 'admin@thebulkbuyers.com';
    let pw = process.env.ADMIN_PASSWORD;
    if (!pw) {
      pw = process.env.NODE_ENV === 'production' ? crypto.randomBytes(9).toString('base64url') : 'Admin@12345';
      console.log(`\n  ► Admin account created\n    email:    ${email}\n    password: ${pw}\n    (set ADMIN_EMAIL / ADMIN_PASSWORD env vars to choose your own)\n`);
    }
    q.run("INSERT INTO users(name,email,password_hash,role,status,referral_code,company) VALUES('Platform Admin',?,?,'admin','active',?,'The Bulk Buyers')", email, hash(pw), refCode());
  }
  return cat;
}

function seedDemo(cat) {
  if (q.get("SELECT id FROM users WHERE email='seller@demo.com'")) return;
  const pw = hash('Demo@12345');
  const mk = (name, email, role, company, status = 'active', country = 'India', ref = null) =>
    Number(q.run('INSERT INTO users(name,email,password_hash,role,status,company,country,referral_code,referred_by,phone) VALUES(?,?,?,?,?,?,?,?,?,?)',
      name, email, pw, role, status, company, country, refCode(), ref, '+91 98765 43210').lastInsertRowid);

  const s1 = mk('Rajesh Kumar', 'seller@demo.com', 'seller', 'Tiruppur Knit Exports', 'active');
  const s2 = mk('Anita Sharma', 'seller2@demo.com', 'seller', 'Ludhiana Fleece Mills', 'active');
  const s3 = mk('Imran Khan', 'seller3@demo.com', 'seller', 'Kolkata Denim Works', 'pending');
  const ag = mk('Vikram Mehta', 'agent@demo.com', 'agent', 'Mehta Sourcing');
  const agCode = q.get('SELECT referral_code c FROM users WHERE id=?', ag).c;
  const b1 = mk('James Walker', 'buyer@demo.com', 'buyer', 'Walker Retail Ltd', 'active', 'United Kingdom', ag);
  const b2 = mk('Fatima Al Nuaimi', 'buyer2@demo.com', 'buyer', 'Gulf Fashion Trading', 'active', 'UAE', ag);
  const b3 = mk('Sarah Müller', 'buyer3@demo.com', 'buyer', 'Müller Merch GmbH', 'active', 'Germany');

  const sellerFor = { tees: s1, active: s1, fleece: s2, outer: s2, denim: s3, shirts: s1, women: s1, work: s2 };
  const ids = [];
  cat.products.forEach((p, i) => {
    const r = q.run(`INSERT INTO products(slug,seller_id,category,name,fabric,gsm,fit,sizes,moq,price_min,price_max,lead_days,colors,description,image,status,featured,views)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      p.slug, sellerFor[p.cat], p.cat, p.name, p.fabric, p.gsm, p.fit, p.sizes, p.moq, p.price[0], p.price[1], p.lead,
      JSON.stringify(p.colors), p.desc, PRODUCT_IMG[p.slug] || '', i === 20 ? 'pending' : 'approved', i % 4 === 0 ? 1 : 0, 40 + ((i * 37) % 400));
    ids.push(Number(r.lastInsertRowid));
  });

  // Historic RFQs → quotes → orders spread over 8 months so dashboards have real charts.
  const statuses = ['delivered', 'delivered', 'delivered', 'shipped', 'in_production', 'quality_check', 'confirmed'];
  const buyers = [b1, b2, b3];
  for (let i = 0; i < 22; i++) {
    const pid = ids[(i * 5) % ids.length], p = cat.products[(i * 5) % ids.length];
    const qty = p.moq * (1 + (i % 6)), bid = buyers[i % 3], sid = sellerFor[p.cat];
    const monthsAgo = 7 - Math.floor(i / 3.2);
    const when = `datetime('now','-${Math.max(0, monthsAgo)} months','-${(i * 3) % 20} days')`;
    const rfq = Number(q.run(`INSERT INTO rfqs(buyer_id,product_id,category,title,quantity,target_price,destination,notes,status,created_at)
      VALUES(?,?,?,?,?,?,?,?,'accepted',${when})`, bid, pid, p.cat, p.name, qty, Math.round(p.price[0] * 0.95), ['London, UK', 'Dubai, UAE', 'Hamburg, Germany'][i % 3], 'Custom labels, polybag packing.').lastInsertRowid);
    const price = Math.round(p.price[0] + (p.price[1] - p.price[0]) * 0.3);
    const quote = Number(q.run(`INSERT INTO quotes(rfq_id,seller_id,price,lead_days,notes,status,created_at) VALUES(?,?,?,?,?,'accepted',${when})`, rfq, sid, price, p.lead, 'FOB Mumbai. 30% advance.').lastInsertRowid);
    const total = price * qty;
    q.run(`INSERT INTO orders(rfq_id,quote_id,buyer_id,seller_id,title,quantity,unit_price,total,commission,destination,status,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,${when},${when})`, rfq, quote, bid, sid, p.name, qty, price, total, Math.round(total * 0.03), ['London, UK', 'Dubai, UAE', 'Hamburg, Germany'][i % 3], statuses[i % statuses.length]);
  }
  // Open RFQs waiting for quotes.
  [[0, b1, 1200], [9, b2, 800], [12, b3, 500], [3, b1, 2000]].forEach(([k, bid, qty]) => {
    const p = cat.products[k];
    q.run(`INSERT INTO rfqs(buyer_id,product_id,category,title,quantity,target_price,destination,notes) VALUES(?,?,?,?,?,?,?,?)`,
      bid, ids[k], p.cat, p.name, qty, Math.round(p.price[0] * 0.92), 'Rotterdam, Netherlands', 'Need samples before bulk. Private label.');
  });
  q.run("INSERT INTO inquiries(name,email,company,message) VALUES('Daniel Cho','daniel@example.com','Seoul Streetwear','Looking for a long-term hoodie manufacturer, 5k pcs/month.')");
  q.run('INSERT INTO notifications(user_id,text,link) VALUES(?,?,?)', s1, 'New RFQ matches your catalogue: Classic Crew Neck T-Shirt ×1200', '#rfqs');
  console.log(`  ► Demo data loaded. Logins (password Demo@12345): buyer@demo.com · seller@demo.com · agent@demo.com  | agent referral code: ${agCode}`);
}

function run() {
  const cat = seedCore();
  const demo = process.env.SEED_DEMO ? process.env.SEED_DEMO === 'true' : process.env.NODE_ENV !== 'production';
  if (demo) seedDemo(cat);
}
module.exports = { run };
if (require.main === module) run();
