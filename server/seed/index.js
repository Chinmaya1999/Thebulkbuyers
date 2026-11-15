const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { q, migrate } = require('../db');
const taxonomy = require('./taxonomy');
const demo = require('./demo-catalogue');
const { parseSizes } = require('../util');

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const subId = (cat, name) => `${cat}-${slug(name)}`;
const U = id => `https://images.unsplash.com/${id}`; // sized at render time (?w=...)
const IMG = {
  tee1: U('photo-1521572163474-6864f9cf17ab'), tees: U('photo-1489987707025-afc232f7ea0f'), folded: U('photo-1562157873-818bc0726f68'),
  white: U('photo-1581655353564-df123a1eb820'), graphic: U('photo-1576566588028-4147f3842f27'), green: U('photo-1523381210434-271e8be1f52b'),
  manwhite: U('photo-1571945153237-4929e783af4a'), jeans: U('photo-1542272604-787c3835535d'), chino: U('photo-1544441893-675973e31985'),
  shorts: U('photo-1591195853828-11db59a44f6b'), chambray: U('photo-1596755094514-f87e34085b2c'), leather: U('photo-1551028719-00167b16eac5'),
  sweat: U('photo-1620799140408-edc6dcb6d633'), hood: U('photo-1556821840-3a63f95609a7'), hoodBrown: U('photo-1578768079052-aa76e52ff62e'),
  olive: U('photo-1544022613-e87ca75a784a'), bomber: U('photo-1591047139829-d91aecb6caea'), colourRack: U('photo-1520006403909-838d6b92c22e'),
  dress: U('photo-1572804013309-59a88b7e92f1'), stripe: U('photo-1583496661160-fb5886a0aaaa'), jeansStack: U('photo-1604176354204-9268737828e4'),
  trouser: U('photo-1584865288642-42078afe6942'), chinoWalk: U('photo-1473966968600-fa801b869a1a'), suit: U('photo-1594938298603-c8148c4dae35'),
  womanTee: U('photo-1503342217505-b0a15ec3261c'), darkJeans: U('photo-1624378439575-d8705ad7ae80'), whiteFlat: U('photo-1620799139834-6b8f844fbe61'),
  knit: U('photo-1434389677669-e08b4cac3105'), gym: U('photo-1517836357463-d25dfeac3438'), yoga: U('photo-1571019613454-1cb2f99b2d8b'),
  kids: U('photo-1503944583220-79d8926ad5e2'), kidCardigan: U('photo-1519238263530-99bdd11df2ea'), baby: U('photo-1522771930-78848d9293e8'),
  saree: U('photo-1610030469983-98e550d6193c'), lehenga: U('photo-1617627143750-d86bc21e42bb'), salwar: U('photo-1583391733956-3750e0ff4e8b'),
  uniShirt: U('photo-1603252109303-2751441dd157'), shirtsFlat: U('photo-1602810318383-e386cc2a3ccf'),
  sneakerRed: U('photo-1542291026-7eec264c27ff'), sneakerBrown: U('photo-1549298916-b41d501d3772'), sneakerPastel: U('photo-1595950653106-6c9ebd614d3a'),
  cap: U('photo-1588850561407-ed78c282e89b'), backpack: U('photo-1553062407-98eeb64c6a62'), handbag: U('photo-1584917865442-de89df76afd3'), beanie: U('photo-1576871337632-b9aef4c17ab9')
};
const CAT_IMG = { mens: IMG.tee1, womens: IMG.dress, kids: IMG.kids, sportswear: IMG.yoga, innerwear: IMG.folded, winter: IMG.olive, ethnic: IMG.saree, uniforms: IMG.uniShirt, footwear: IMG.sneakerRed, accessories: IMG.cap };

// existing demo styles → [image, category, product type, gender, age, season, pattern, HSN, stock]
const META = {
  'classic-crew-neck-tee': [IMG.tee1, 'mens', 'Round Neck T-Shirts', 'Men', 'Adult', 'All Season', 'Solid', '6109', 3000],
  'oversized-drop-shoulder-tee': [IMG.graphic, 'mens', 'T-Shirts', 'Unisex', 'Adult', 'Summer', 'Graphic', '6109', 0],
  'pique-polo-shirt': [IMG.green, 'mens', 'Polo T-Shirts', 'Men', 'Adult', 'All Season', 'Solid', '6105', 0],
  'dry-fit-performance-tee': [IMG.womanTee, 'sportswear', 'Sports T-Shirts', 'Unisex', 'Adult', 'All Season', 'Solid', '6109', 0],
  'henley-full-sleeve-tee': [IMG.white, 'mens', 'T-Shirts', 'Men', 'Adult', 'Autumn', 'Solid', '6109', 0],
  'pullover-hoodie': [IMG.hood, 'mens', 'Hoodies', 'Unisex', 'Adult', 'Winter', 'Solid', '6110', 1800],
  'zipper-hoodie': [IMG.hoodBrown, 'mens', 'Hoodies', 'Men', 'Adult', 'Winter', 'Solid', '6110', 0],
  'crew-sweatshirt': [IMG.sweat, 'mens', 'Sweatshirts', 'Unisex', 'Adult', 'Winter', 'Solid', '6110', 0],
  'jogger-track-pants': [IMG.chinoWalk, 'mens', 'Joggers', 'Men', 'Adult', 'All Season', 'Solid', '6103', 0],
  'slim-fit-stretch-jeans': [IMG.darkJeans, 'mens', 'Slim Fit Jeans', 'Men', 'Adult', 'All Season', 'Solid', '6203', 0],
  'cargo-pants-six-pocket': [IMG.chino, 'mens', 'Cargo Pants', 'Men', 'Adult', 'All Season', 'Solid', '6203', 0],
  'stretch-chino-trousers': [IMG.trouser, 'mens', 'Chinos', 'Men', 'Adult', 'All Season', 'Solid', '6203', 0],
  'oxford-button-down-shirt': [IMG.chambray, 'mens', 'Casual Shirts', 'Men', 'Adult', 'All Season', 'Solid', '6205', 0],
  'linen-blend-shirt': [IMG.stripe, 'mens', 'Casual Shirts', 'Men', 'Adult', 'Summer', 'Solid', '6205', 0],
  'corporate-uniform-shirt': [IMG.uniShirt, 'uniforms', 'Office Shirts', 'Unisex', 'Adult', 'All Season', 'Solid', '6205', 0],
  'varsity-baseball-jacket': [IMG.leather, 'winter', 'Bomber Jackets', 'Unisex', 'Adult', 'Winter', 'Colour-block', '6201', 0],
  'quilted-puffer-jacket': [IMG.olive, 'winter', 'Puffer Jackets', 'Unisex', 'Adult', 'Winter', 'Quilted', '6201', 0],
  'windcheater-bomber-jacket': [IMG.bomber, 'winter', 'Windcheaters', 'Unisex', 'Adult', 'Autumn', 'Solid', '6201', 0],
  'cotton-straight-kurti': [IMG.colourRack, 'womens', 'Kurtis', 'Women', 'Adult', 'Summer', 'Printed', '6204', 0],
  'rayon-maxi-dress': [IMG.dress, 'womens', 'Maxi Dresses', 'Women', 'Adult', 'Summer', 'Printed', '6204', 0],
  'kids-tee-and-shorts-set': [IMG.kids, 'kids', 'Kids T-Shirts', 'Unisex', 'Kids', 'Summer', 'Solid', '6109', 0],
  'four-way-stretch-leggings': [IMG.whiteFlat, 'womens', 'Leggings', 'Women', 'Adult', 'All Season', 'Solid', '6104', 0],
  'industrial-coverall': [IMG.jeansStack, 'uniforms', 'Workwear Coveralls', 'Unisex', 'Adult', 'All Season', 'Solid', '6211', 0],
  'medical-scrub-set': [IMG.manwhite, 'uniforms', 'Hospital Uniforms', 'Unisex', 'Adult', 'All Season', 'Solid', '6211', 0],
  'gym-training-shorts': [IMG.gym, 'sportswear', 'Sports Shorts', 'Men', 'Adult', 'Summer', 'Solid', '6112', 0]
};
const OLD_CAT = { tees: 'mens', fleece: 'mens', denim: 'mens', shirts: 'mens', outer: 'winter', women: 'womens', work: 'uniforms', active: 'sportswear' };

// New demo styles covering the rest of the catalogue. seller: key into SELLERS below.
const EXTRA = [
  { slug: 'bear-hood-baby-sleepsuit', name: 'Bear Hood Baby Sleepsuit', seller: 'tiruppur', cat: 'kids', type: 'Baby Sleepsuits', gender: 'Unisex', age: 'Baby', season: 'Winter', pattern: 'Solid', hsn: '6111', fabric: 'Organic Cotton Fleece', gsm: 280, fit: 'Relaxed', sizes: '0–3M, 3–6M, 6–12M, 12–18M', moq: 300, price: [260, 380], lead: 30, colors: ['#8d7b6b', '#e8dcc8', '#bcd2e8'], image: IMG.baby, desc: 'Zip-through hooded sleepsuit with soft bear ears, nickel-free zipper and fold-over mitts. Skin-safe dyes.' },
  { slug: 'boys-cardigan-party-set', name: 'Boys Cardigan & Shorts Party Set', seller: 'tiruppur', cat: 'kids', type: 'Kids Party Wear', gender: 'Boys', age: 'Kids', season: 'Autumn', pattern: 'Colour-block', hsn: '6111', fabric: 'Cotton Knit', gsm: 240, fit: 'Regular', sizes: '2Y–10Y', moq: 250, price: [340, 520], lead: 32, colors: ['#1f3a5f', '#2f6fff', '#e8dcc8'], image: IMG.kidCardigan, desc: 'Button cardigan with contrast placket plus matching shorts. Bow-tie ready for festive wear.' },
  { slug: 'seamless-yoga-leggings', name: 'Seamless Yoga Leggings', seller: 'tiruppur', cat: 'sportswear', type: 'Yoga Pants', gender: 'Women', age: 'Adult', season: 'All Season', pattern: 'Solid', hsn: '6104', fabric: 'Nylon Spandex Seamless', gsm: 230, fit: 'Skinny', sizes: 'XS–XL', moq: 400, price: [210, 340], lead: 28, colors: ['#e0553a', '#111114', '#6b6fd6'], image: IMG.yoga, desc: 'High-rise seamless knit with four-way stretch, squat-proof opacity and flat-lock seams.' },
  { slug: 'banarasi-silk-saree', name: 'Banarasi Silk Blend Saree', seller: 'surat', cat: 'ethnic', type: 'Sarees', gender: 'Women', age: 'Adult', season: 'Festive', pattern: 'Woven Zari', hsn: '5007', fabric: 'Silk Blend', gsm: 0, fit: '6.3 m with blouse piece', sizes: 'Free size', moq: 100, price: [780, 1850], lead: 35, colors: ['#4a2c6b', '#b5361f', '#1f6e4f'], image: IMG.saree, desc: 'Zari-woven border and pallu with matching running blouse piece. Dry-clean care label included.' },
  { slug: 'embroidered-salwar-kameez-set', name: 'Embroidered Salwar Kameez Set', seller: 'surat', cat: 'ethnic', type: 'Salwar Kameez', gender: 'Women', age: 'Adult', season: 'Festive', pattern: 'Embroidered', hsn: '6204', fabric: 'Georgette Blend', gsm: 110, fit: 'Straight', sizes: 'S–3XL', moq: 150, price: [620, 1180], lead: 32, colors: ['#f2ede2', '#2c8f69', '#d6457a'], image: IMG.salwar, desc: 'Three-piece set with embroidered yoke, churidar bottom and chiffon dupatta.' },
  { slug: 'silk-blend-lehenga-set', name: 'Silk Blend Bridal Lehenga Set', seller: 'surat', cat: 'ethnic', type: 'Lehengas', gender: 'Women', age: 'Adult', season: 'Festive', pattern: 'Embroidered', hsn: '6204', fabric: 'Silk Blend', gsm: 0, fit: 'A-Line', sizes: 'Free size (adjustable)', moq: 50, price: [2400, 5200], lead: 45, colors: ['#b5361f', '#d6457a', '#1f3a5f'], image: IMG.lehenga, desc: 'Hand-finished zardozi lehenga with blouse and net dupatta. Made to measure on request.' },
  { slug: 'merino-knit-beanie', name: 'Rib Knit Beanie (Pack of 3)', seller: 'agra', cat: 'accessories', type: 'Beanies', gender: 'Unisex', age: 'Adult', season: 'Winter', pattern: 'Ribbed', hsn: '6505', fabric: 'Acrylic-Wool Blend', gsm: 0, fit: 'One size', sizes: 'Free size', moq: 300, price: [90, 160], lead: 22, colors: ['#3b3a3e', '#e7a8b8', '#2f4f3a'], image: IMG.beanie, desc: 'Fold-over rib beanie with woven label patch. Custom logo patch available.' },
  { slug: 'trucker-mesh-cap', name: 'Trucker Mesh Cap', seller: 'agra', cat: 'accessories', type: 'Caps', gender: 'Unisex', age: 'Adult', season: 'Summer', pattern: 'Solid', hsn: '6505', fabric: 'Cotton Front + Mesh Back', gsm: 0, fit: 'Adjustable snapback', sizes: 'Free size', moq: 500, price: [70, 140], lead: 20, colors: ['#ffffff', '#111114', '#923595'], image: IMG.cap, desc: 'Five-panel foam-front trucker with snap closure — embroidery or screen print ready.' },
  { slug: 'urban-daypack', name: 'Urban Commuter Daypack', seller: 'agra', cat: 'accessories', type: 'Backpacks', gender: 'Unisex', age: 'Adult', season: 'All Season', pattern: 'Solid', hsn: '4202', fabric: 'Water-repellent Polyester', gsm: 0, fit: '22 L', sizes: 'One size', moq: 200, price: [380, 640], lead: 30, colors: ['#1f2b44', '#111114', '#474647'], image: IMG.backpack, desc: 'Padded 15-inch laptop sleeve, hidden back pocket and breathable mesh straps.' },
  { slug: 'structured-top-handle-bag', name: 'Structured Top-Handle Handbag', seller: 'agra', cat: 'accessories', type: 'Handbags', gender: 'Women', age: 'Adult', season: 'All Season', pattern: 'Solid', hsn: '4202', fabric: 'PU Leather', gsm: 0, fit: 'Medium', sizes: 'One size', moq: 100, price: [520, 980], lead: 30, colors: ['#d4442a', '#111114', '#c9a97a'], image: IMG.handbag, desc: 'Rigid-frame handbag with turn-lock closure, detachable strap and suede-feel lining.' },
  { slug: 'runner-knit-sneaker', name: 'Flyknit Runner Sneaker', seller: 'agra', cat: 'footwear', type: 'Running Shoes', gender: 'Unisex', age: 'Adult', season: 'All Season', pattern: 'Solid', hsn: '6404', fabric: 'Knit Upper, EVA Sole', gsm: 0, fit: 'Regular', sizes: 'UK 6–11', moq: 120, price: [720, 1240], lead: 38, colors: ['#b3262d', '#111114', '#f2ede2'], image: IMG.sneakerRed, desc: 'Breathable one-piece knit upper, cushioned EVA midsole and rubber outsole.', stock: 720 },
  { slug: 'heritage-leather-sneaker', name: 'Heritage Low-Top Sneaker', seller: 'agra', cat: 'footwear', type: 'Casual Shoes', gender: 'Unisex', age: 'Adult', season: 'All Season', pattern: 'Solid', hsn: '6403', fabric: 'Canvas & Leatherette', gsm: 0, fit: 'Regular', sizes: 'UK 6–11', moq: 120, price: [860, 1480], lead: 38, colors: ['#a9743c', '#25232a'], image: IMG.sneakerBrown, desc: 'Vulcanised low-top with contrast stitch and padded collar.' },
  { slug: 'pastel-court-sneaker', name: 'Pastel Court Sneaker', seller: 'agra', cat: 'footwear', type: 'Sneakers', gender: 'Women', age: 'Adult', season: 'All Season', pattern: 'Colour-block', hsn: '6404', fabric: 'Synthetic Leather', gsm: 0, fit: 'Regular', sizes: 'UK 3–8', moq: 120, price: [780, 1320], lead: 38, colors: ['#e7bfd1', '#bfd4f2', '#f2ede2'], image: IMG.sneakerPastel, desc: 'Layered pastel court sneaker with chunky sole and perforated toe box.' },
  { slug: 'cotton-rib-vest-3pack', name: 'Cotton Rib Vest (Pack of 3)', seller: 'tiruppur', cat: 'innerwear', type: "Men's Vests", gender: 'Men', age: 'Adult', season: 'Summer', pattern: 'Ribbed', hsn: '6109', fabric: 'Combed Cotton Rib', gsm: 160, fit: 'Slim', sizes: 'S–3XL', moq: 600, price: [140, 240], lead: 24, colors: ['#ffffff', '#111114', '#8a8a8a'], image: IMG.folded, desc: 'Soft 1×1 rib vests with tag-free neck label and reinforced armholes. Pack of 3.' },
  { slug: 'lounge-night-suit-set', name: 'Cotton Lounge Night Suit', seller: 'tiruppur', cat: 'innerwear', type: 'Night Suits', gender: 'Unisex', age: 'Adult', season: 'All Season', pattern: 'Solid', hsn: '6208', fabric: 'Cotton Jersey', gsm: 170, fit: 'Relaxed', sizes: 'S–3XL', moq: 400, price: [320, 560], lead: 28, colors: ['#e8dcc8', '#bcd2e8', '#2f4f3a'], image: IMG.whiteFlat, desc: 'Drawstring pyjama with crew-neck tee. Pre-washed for a lived-in feel.' },
  { slug: 'wool-blend-knit-poncho', name: 'Wool-Blend Knit Poncho', seller: 'ludhiana', cat: 'winter', type: 'Woollen Tops', gender: 'Women', age: 'Adult', season: 'Winter', pattern: 'Open Knit', hsn: '6110', fabric: 'Wool-Acrylic Blend', gsm: 0, fit: 'Oversized', sizes: 'Free size', moq: 150, price: [540, 980], lead: 34, colors: ['#e8dcc8', '#7a5c3a'], image: IMG.knit, desc: 'Open-knit poncho with fringe hem — a winter layering best-seller.' },
  { slug: 'school-uniform-shirt', name: 'School Uniform Shirt', seller: 'ludhiana', cat: 'uniforms', type: 'School Uniforms', gender: 'Unisex', age: 'Kids', season: 'All Season', pattern: 'Check', hsn: '6205', fabric: 'Poly-Cotton Check', gsm: 120, fit: 'Regular', sizes: '6Y–16Y', moq: 500, price: [170, 290], lead: 26, colors: ['#1f3a5f', '#f2ede2'], image: IMG.shirtsFlat, desc: 'Stain-resistant, colour-fast check shirt with school-crest embroidery option.' },
  { slug: 'distressed-denim-shorts', name: 'High-Rise Distressed Denim Shorts', seller: 'tiruppur', cat: 'womens', type: 'Shorts', gender: 'Women', age: 'Adult', season: 'Summer', pattern: 'Distressed', hsn: '6204', fabric: '100% Cotton Denim', gsm: 0, fit: 'High-rise', sizes: 'XS–XL', moq: 300, price: [310, 520], lead: 34, colors: ['#a9c4e8', '#3a5a8a'], image: IMG.shorts, desc: 'Rolled-hem shorts with rip detailing and light stone wash.' }
];
const SELLERS = { tiruppur: 'seller@demo.com', ludhiana: 'seller2@demo.com', kolkata: 'seller3@demo.com', surat: 'seller4@demo.com', agra: 'seller5@demo.com' };

function loadCatalogue() {
  const src = fs.readFileSync(path.join(__dirname, 'catalogue-source.js'), 'utf8');
  const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(src, ctx); return ctx.window.TBB;
}
const hash = p => bcrypt.hashSync(p, 10);
const refCode = () => 'TBB' + crypto.randomBytes(3).toString('hex').toUpperCase();
const retailOf = max => Math.round(max * 2.2 / 10) * 10 - 1;

/* ---- taxonomy: groups → categories → product types (never overwrites admin edits) ---- */
async function seedTaxonomy() {
  await q.tx(async t => {
    for (const [gi, g] of taxonomy.entries()) {
      await t.run("INSERT INTO categories(id,name,level,parent_id,sort) VALUES(?,?,0,NULL,?) ON CONFLICT(id) DO NOTHING", g.id, g.name, gi * 100);
      for (const [ci, c] of g.categories.entries()) {
        await t.run('INSERT INTO categories(id,name,blurb,color,image,level,parent_id,sort) VALUES(?,?,?,?,?,1,?,?) ON CONFLICT(id) DO NOTHING', c.id, c.name, c.blurb, c.color, CAT_IMG[c.id] || '', g.id, gi * 100 + ci + 1);
        await t.run("UPDATE categories SET parent_id=?, level=1, image=CASE WHEN COALESCE(image,'')='' THEN ? ELSE image END WHERE id=?", g.id, CAT_IMG[c.id] || '', c.id);
        for (const [ti, name] of c.types.entries())
          await t.run('INSERT INTO categories(id,name,color,level,parent_id,sort) VALUES(?,?,?,2,?,?) ON CONFLICT(id) DO NOTHING', subId(c.id, name), name, c.color, c.id, ti);
      }
    }
  });
}

/* ---- move products/RFQs from the old 8-category scheme into the new hierarchy, then retire old categories ---- */
async function migrateTaxonomy() {
  const old = await q.all("SELECT id FROM categories WHERE id = ANY(?::text[])", Object.keys(OLD_CAT));
  if (!old.length) return;
  const ids = old.map(o => o.id);
  for (const [slugKey, m] of Object.entries(META)) {
    const [image, cat, type, gender, age, season, pattern, hsn, stock] = m;
    await q.run(`UPDATE products SET category=?, subcategory=?, gender=?, age_group=?, season=?, pattern=?, hsn_code=?, stock_qty=?, image=COALESCE(NULLIF(image,''),?)
      WHERE slug=? AND category = ANY(?::text[])`, cat, subId(cat, type), gender, age, season, pattern, hsn, stock, image, slugKey, ids);
  }
  for (const [o, n] of Object.entries(OLD_CAT)) {
    await q.run('UPDATE products SET category=? WHERE category=?', n, o);
    await q.run('UPDATE rfqs SET category=? WHERE category=?', n, o);
  }
  await q.run('DELETE FROM categories WHERE id = ANY(?::text[])', ids);
}

async function seedCore() {
  await seedTaxonomy();
  await migrateTaxonomy();
  for (const r of await q.all('SELECT id,sizes FROM products WHERE size_options IS NULL')) await q.run('UPDATE products SET size_options=?::jsonb WHERE id=?', JSON.stringify(parseSizes(r.sizes)), r.id);
  await q.run("UPDATE products SET sku='TBB-'||upper(left(category,3))||'-'||lpad(id::text,5,'0') WHERE sku IS NULL OR sku=''");
  if (!(await q.get("SELECT id FROM users WHERE role='admin'"))) {
    const email = (process.env.ADMIN_EMAIL || 'admin@thebulkbuyers.com').toLowerCase();
    let pw = process.env.ADMIN_PASSWORD;
    if (!pw) {
      pw = process.env.NODE_ENV === 'production' ? crypto.randomBytes(9).toString('base64url') : 'Admin@12345';
      console.log(`\n  ► Admin account created\n    email:    ${email}\n    password: ${pw}\n    (set ADMIN_EMAIL / ADMIN_PASSWORD env vars to choose your own)\n`);
    }
    await q.run("INSERT INTO users(name,email,password_hash,role,status,referral_code,company) VALUES('Platform Admin',?,?,'admin','active',?,'The Bulk Buyers')", email, hash(pw), refCode());
  }
}

async function addProduct(p) {
  const id = await q.insert(`INSERT INTO products(slug,seller_id,category,subcategory,name,fabric,gsm,fit,sizes,moq,price_min,price_max,retail_price,lead_days,colors,description,image,status,featured,views,
      gender,age_group,season,pattern,hsn_code,gst_rate,stock_qty,brand,size_options)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb)`,
    p.slug, p.seller_id, p.category, p.subcategory, p.name, p.fabric, p.gsm, p.fit, p.sizes, p.moq, p.price[0], p.price[1], retailOf(p.price[1]), p.lead,
    JSON.stringify(p.colors), p.desc, p.image, p.status || 'approved', p.featured || 0, p.views || 0, p.gender, p.age, p.season, p.pattern, p.hsn, p.gst ?? 5, p.stock || 0, p.brand || '', JSON.stringify(parseSizes(p.sizes)));
  await q.run('UPDATE products SET sku=? WHERE id=?', `TBB-${p.category.slice(0, 3).toUpperCase()}-${String(id).padStart(5, '0')}`, id);
  return id;
}

async function seedExtras() {
  const pw = hash('Demo@12345');
  const mk = async (name, email, company) => (await q.get('SELECT id FROM users WHERE email=?', email))?.id
    ?? await q.insert("INSERT INTO users(name,email,password_hash,role,status,company,country,referral_code,phone) VALUES(?,?,?,'seller','active',?,'India',?,'+91 98765 43210')", name, email, pw, company, refCode());
  const sellers = { tiruppur: (await q.get('SELECT id FROM users WHERE email=?', SELLERS.tiruppur))?.id, ludhiana: (await q.get('SELECT id FROM users WHERE email=?', SELLERS.ludhiana))?.id,
    surat: await mk('Meera Patel', SELLERS.surat, 'Surat Ethnic Looms'), agra: await mk('Rohit Verma', SELLERS.agra, 'Agra Footcraft & Leather') };
  let n = 0;
  for (const e of EXTRA) {
    if (await q.get('SELECT id FROM products WHERE slug=?', e.slug)) continue;
    if (!sellers[e.seller]) continue;
    await addProduct({ ...e, seller_id: sellers[e.seller], category: e.cat, subcategory: subId(e.cat, e.type), featured: n % 5 === 0 ? 1 : 0, views: 60 + (n * 53) % 300 }); n++;
  }
  if (n) console.log(`  ► Added ${n} demo styles across kids, ethnic, footwear, accessories, innerwear & more`);
}

// One original demo product for every product type that has none yet → the whole 281-type catalogue is browsable.
async function seedFullCatalogue() {
  const pw = hash('Demo@12345'), sellers = {};
  for (const [key, [name, email, company]] of Object.entries(demo.DEMO_SELLERS))
    sellers[key] = (await q.get('SELECT id FROM users WHERE email=?', email))?.id ?? await q.insert("INSERT INTO users(name,email,password_hash,role,status,company,country,referral_code,phone) VALUES(?,?,?,'seller','active',?,'India',?,'+91 98765 43210')", name, email, pw, company, refCode());
  const have = new Set((await q.all("SELECT DISTINCT subcategory FROM products WHERE subcategory IS NOT NULL AND status='approved'")).map(r => r.subcategory));
  let n = 0, i = 0;
  for (const g of taxonomy) for (const c of g.categories) for (const type of c.types) {
    i++; if (have.has(subId(c.id, type))) continue;
    const p = demo.build(c.id, type, subId, i);
    let slugBase = slug(p.name), sl = slugBase, k = 1; while (await q.get('SELECT 1 x FROM products WHERE slug=?', sl)) sl = `${slugBase}-${++k}`;
    await addProduct({ ...p, slug: sl, seller_id: sellers[p.seller], category: p.cat, subcategory: p.sub }); n++;
  }
  if (n) console.log(`  ► Demo catalogue: added ${n} products so every one of the ${i} product types has stock on the shelf`);
}

async function seedDemo(cat) {
  if (!(await q.get("SELECT id FROM users WHERE email='seller@demo.com'"))) {
    const pw = hash('Demo@12345');
    const mk = (name, email, role, company, status = 'active', country = 'India', ref = null) =>
      q.insert('INSERT INTO users(name,email,password_hash,role,status,company,country,referral_code,referred_by,phone) VALUES(?,?,?,?,?,?,?,?,?,?)', name, email, pw, role, status, company, country, refCode(), ref, '+91 98765 43210');
    const s1 = await mk('Rajesh Kumar', 'seller@demo.com', 'seller', 'Tiruppur Knit Exports'), s2 = await mk('Anita Sharma', 'seller2@demo.com', 'seller', 'Ludhiana Fleece Mills'), s3 = await mk('Imran Khan', 'seller3@demo.com', 'seller', 'Kolkata Denim Works', 'pending');
    const ag = await mk('Vikram Mehta', 'agent@demo.com', 'agent', 'Mehta Sourcing');
    const agCode = (await q.get('SELECT referral_code c FROM users WHERE id=?', ag)).c;
    const b1 = await mk('James Walker', 'buyer@demo.com', 'buyer', 'Walker Retail Ltd', 'active', 'United Kingdom', ag), b2 = await mk('Fatima Al Nuaimi', 'buyer2@demo.com', 'buyer', 'Gulf Fashion Trading', 'active', 'UAE', ag), b3 = await mk('Sarah Müller', 'buyer3@demo.com', 'buyer', 'Müller Merch GmbH', 'active', 'Germany');
    const sellerFor = { tees: s1, active: s1, fleece: s2, outer: s2, denim: s3, shirts: s1, women: s1, work: s2 };
    const ids = [];
    for (const [i, p] of cat.products.entries()) {
      const [image, c, type, gender, age, season, pattern, hsn, stock] = META[p.slug];
      ids.push(await addProduct({ slug: p.slug, seller_id: sellerFor[p.cat], category: c, subcategory: subId(c, type), name: p.name, fabric: p.fabric, gsm: p.gsm, fit: p.fit, sizes: p.sizes, moq: p.moq, price: p.price, lead: p.lead, colors: p.colors, desc: p.desc,
        image, status: i === 20 ? 'pending' : 'approved', featured: i % 4 === 0 ? 1 : 0, views: 40 + ((i * 37) % 400), gender, age, season, pattern, hsn, stock }));
    }
    const statuses = ['delivered', 'delivered', 'delivered', 'shipped', 'in_production', 'quality_check', 'confirmed'], buyers = [b1, b2, b3], dests = ['London, UK', 'Dubai, UAE', 'Hamburg, Germany'];
    for (let i = 0; i < 22; i++) {
      const k = (i * 5) % ids.length, p = cat.products[k], c = META[p.slug][1];
      const qty = p.moq * (1 + (i % 6)), bid = buyers[i % 3], sid = sellerFor[p.cat], days = Math.max(0, 7 - Math.floor(i / 3.2)) * 30 + ((i * 3) % 20);
      const rfq = await q.insert(`INSERT INTO rfqs(buyer_id,product_id,category,title,quantity,target_price,destination,notes,status,created_at) VALUES(?,?,?,?,?,?,?,?,'accepted', now() - make_interval(days => ?))`, bid, ids[k], c, p.name, qty, Math.round(p.price[0] * 0.95), dests[i % 3], 'Custom labels, polybag packing.', days);
      const price = Math.round(p.price[0] + (p.price[1] - p.price[0]) * 0.3);
      const quote = await q.insert(`INSERT INTO quotes(rfq_id,seller_id,price,lead_days,notes,status,created_at) VALUES(?,?,?,?,?,'accepted', now() - make_interval(days => ?))`, rfq, sid, price, p.lead, 'FOB Mumbai. 30% advance.', days);
      const total = price * qty;
      await q.run(`INSERT INTO orders(rfq_id,quote_id,buyer_id,seller_id,product_id,title,quantity,unit_price,total,commission,destination,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?, now() - make_interval(days => ?), now() - make_interval(days => ?))`, rfq, quote, bid, sid, ids[k], p.name, qty, price, total, Math.round(total * 0.03), dests[i % 3], statuses[i % statuses.length], days, days);
    }
    for (const [k, bid, qty] of [[0, b1, 1200], [9, b2, 800], [12, b3, 500], [3, b1, 2000]]) {
      const p = cat.products[k];
      await q.run('INSERT INTO rfqs(buyer_id,product_id,category,title,quantity,target_price,destination,notes) VALUES(?,?,?,?,?,?,?,?)', bid, ids[k], META[p.slug][1], p.name, qty, Math.round(p.price[0] * 0.92), 'Rotterdam, Netherlands', 'Need samples before bulk. Private label.');
    }
    await q.run("INSERT INTO inquiries(name,email,company,message) VALUES('Daniel Cho','daniel@example.com','Seoul Streetwear','Looking for a long-term hoodie manufacturer, 5k pcs/month.')");
    await q.run('INSERT INTO notifications(user_id,text,link) VALUES(?,?,?)', s1, 'New RFQ matches your catalogue: Classic Crew Neck T-Shirt ×1200', '#rfqs');
    console.log(`  ► Demo data loaded. Logins (password Demo@12345): buyer@demo.com · seller@demo.com · agent@demo.com  | agent referral code: ${agCode}`);
  }
  await seedExtras();
  await seedFullCatalogue();
  // Demo only: ready stock should cover at least one MOQ so wholesale checkout works end-to-end.
  await q.run('UPDATE products SET stock_qty = moq * 6 WHERE stock_qty > 0 AND stock_qty < moq');
}

async function run() {
  await migrate();
  await seedCore();
  const demo = process.env.SEED_DEMO ? process.env.SEED_DEMO === 'true' : process.env.NODE_ENV !== 'production';
  if (demo) await seedDemo(loadCatalogue());
}
module.exports = { run, subId };
if (require.main === module) run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
