// Generates an ORIGINAL demo product for every product type in the taxonomy (names, specs, prices and descriptions are
// synthetic — nothing is copied from any retailer). Deterministic: the same type always yields the same product.
const U = id => `https://images.unsplash.com/${id}`;
const P = { // verified stock photos, grouped by what they actually show
  tee: [U('photo-1521572163474-6864f9cf17ab'), U('photo-1489987707025-afc232f7ea0f'), U('photo-1581655353564-df123a1eb820'), U('photo-1562157873-818bc0726f68'), U('photo-1523381210434-271e8be1f52b'), U('photo-1618354691373-d851c5c3a990')],
  graphicTee: [U('photo-1576566588028-4147f3842f27'), U('photo-1571945153237-4929e783af4a')],
  shirt: [U('photo-1596755094514-f87e34085b2c'), U('photo-1583496661160-fb5886a0aaaa'), U('photo-1603252109303-2751441dd157'), U('photo-1602810318383-e386cc2a3ccf')],
  denim: [U('photo-1542272604-787c3835535d'), U('photo-1624378439575-d8705ad7ae80'), U('photo-1604176354204-9268737828e4'), U('photo-1516762689617-e1cffcef479d')],
  denimShorts: [U('photo-1591195853828-11db59a44f6b')],
  trouser: [U('photo-1544441893-675973e31985'), U('photo-1584865288642-42078afe6942'), U('photo-1473966968600-fa801b869a1a')],
  hoodie: [U('photo-1556821840-3a63f95609a7'), U('photo-1578768079052-aa76e52ff62e'), U('photo-1620799140408-edc6dcb6d633'), U('photo-1517841905240-472988babdf9')],
  jacket: [U('photo-1551028719-00167b16eac5'), U('photo-1544022613-e87ca75a784a'), U('photo-1591047139829-d91aecb6caea'), U('photo-1601924994987-69e26d50dc26')],
  coat: [U('photo-1539533018447-63fcce2678e3'), U('photo-1483985988355-763728e1935b')],
  suit: [U('photo-1507679799987-c73779587ccf'), U('photo-1594938298603-c8148c4dae35')],
  knit: [U('photo-1434389677669-e08b4cac3105'), U('photo-1558769132-cb1aea458c5e')],
  dress: [U('photo-1572804013309-59a88b7e92f1'), U('photo-1595777457583-95e059d581b8'), U('photo-1567401893414-76b7b1e5a7a5')],
  womenTop: [U('photo-1503342217505-b0a15ec3261c'), U('photo-1520006403909-838d6b92c22e'), U('photo-1583496661160-fb5886a0aaaa')],
  leggings: [U('photo-1571019613454-1cb2f99b2d8b'), U('photo-1620799139834-6b8f844fbe61')],
  saree: [U('photo-1610030469983-98e550d6193c')], lehenga: [U('photo-1617627143750-d86bc21e42bb')], salwar: [U('photo-1583391733956-3750e0ff4e8b')],
  kids: [U('photo-1503944583220-79d8926ad5e2'), U('photo-1519238263530-99bdd11df2ea'), U('photo-1471286174890-9c112ffca5b4')],
  baby: [U('photo-1522771930-78848d9293e8'), U('photo-1514090458221-65bb69cf63e6')],
  sport: [U('photo-1517836357463-d25dfeac3438'), U('photo-1515886657613-9f3515b0c78f'), U('photo-1571019613454-1cb2f99b2d8b')],
  innerwear: [U('photo-1562157873-818bc0726f68'), U('photo-1620799139834-6b8f844fbe61')],
  work: [U('photo-1603252109303-2751441dd157'), U('photo-1604176354204-9268737828e4'), U('photo-1571945153237-4929e783af4a')],
  sneaker: [U('photo-1542291026-7eec264c27ff'), U('photo-1595950653106-6c9ebd614d3a'), U('photo-1560769629-975ec94e6a86'), U('photo-1595341888016-a392ef81b7de'), U('photo-1491553895911-0055eca6402d'), U('photo-1556906781-9a412961c28c'), U('photo-1604671801908-6f0c6a092c05'), U('photo-1606107557195-0e29a4b5b4aa')],
  formalShoe: [U('photo-1614252235316-8c857d38b5f4'), U('photo-1560343090-f0409e92791a')], boot: [U('photo-1608256246200-53e635b5b65f'), U('photo-1582897085656-c636d006a246'), U('photo-1549298916-b41d501d3772')],
  heel: [U('photo-1535043934128-cf0b28d52f95'), U('photo-1543163521-1bf539c55dd2'), U('photo-1519415943484-9fa1873496d4')],
  cap: [U('photo-1588850561407-ed78c282e89b'), U('photo-1521369909029-2afed882baee')], beanie: [U('photo-1618354691792-d1d42acfd860'), U('photo-1576871337632-b9aef4c17ab9')],
  bag: [U('photo-1584917865442-de89df76afd3')], backpack: [U('photo-1553062407-98eeb64c6a62'), U('photo-1580087256394-dc596e1c8f4f')],
  belt: [U('photo-1624222247344-550fb60583dc')], tie: [U('photo-1589756823695-278bc923f962')], socks: [U('photo-1586350977771-b3b0abd50c82')], glasses: [U('photo-1572635196237-14b3f281503f')]
};
const CAT_FALLBACK = { mens: 'tee', womens: 'womenTop', kids: 'kids', sportswear: 'sport', innerwear: 'innerwear', winter: 'jacket', ethnic: 'saree', uniforms: 'work', footwear: 'sneaker', accessories: 'bag' };

const PAL = { // colour palettes per category
  mens: ['#111111', '#ffffff', '#1f3a5f', '#808080', '#6b6a4a', '#7a1f2b', '#c9b79a'], womens: ['#111111', '#f2ede2', '#d6457a', '#e7a8b8', '#1f3a5f', '#2f6b4f', '#e4a82e'],
  kids: ['#2f6fff', '#e0553a', '#ffd23f', '#e7a8b8', '#2f6b4f', '#ffffff'], sportswear: ['#111111', '#2f6fff', '#e0553a', '#c6ff3d', '#808080', '#923595'],
  innerwear: ['#ffffff', '#111111', '#e8dcc8', '#808080', '#1f3a5f', '#e7a8b8'], winter: ['#111111', '#3b3a3e', '#7a5c3a', '#1f3a5f', '#6b6a4a', '#7a1f2b'],
  ethnic: ['#7a1f2b', '#2f6b4f', '#e4a82e', '#1f3a5f', '#d6457a', '#4a2c6b'], uniforms: ['#ffffff', '#1f3a5f', '#808080', '#111111', '#2a6f7a', '#c2571a'],
  footwear: ['#111111', '#ffffff', '#7a5c3a', '#1f3a5f', '#c9402f', '#808080'], accessories: ['#111111', '#7a5c3a', '#1f3a5f', '#808080', '#c9402f', '#e8dcc8']
};
const ADJ = { mens: ['Classic', 'Essential', 'Signature', 'Urban', 'Heritage', 'Premium', 'Everyday'], womens: ['Modern', 'Essential', 'Signature', 'Elegant', 'Everyday', 'Premium', 'Chic'], kids: ['Playful', 'Soft-Touch', 'Everyday', 'Happy', 'Comfy', 'Bright'], sportswear: ['Pro', 'Active', 'Flex', 'Performance', 'Training', 'Dynamic'],
  innerwear: ['Comfort', 'Soft', 'Everyday', 'Essential', 'Breathable'], winter: ['Cozy', 'Heritage', 'Alpine', 'Premium', 'Warm', 'Classic'], ethnic: ['Royal', 'Festive', 'Heritage', 'Elegant', 'Artisan', 'Classic'], uniforms: ['Professional', 'Heavy-Duty', 'Standard', 'Premium', 'Everyday', 'Durable'],
  footwear: ['Urban', 'Classic', 'Everyday', 'Premium', 'Signature', 'Active'], accessories: ['Classic', 'Everyday', 'Signature', 'Urban', 'Premium', 'Essential'] };

const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => { let a = hash(seed); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
const round5 = n => Math.round(n / 5) * 5;

// ---- type-driven specification ----
function spec(cat, type) {
  const t = type.toLowerCase(), o = { fabric: 'Cotton Blend', gsm: 180, fit: 'Regular', sizes: 'S–3XL', pattern: 'Solid', season: 'All Season', hsn: '6109', price: [140, 260], moq: 300, lead: 30, image: CAT_FALLBACK[cat], what: 'garment' };
  const set = (re, patch) => { if (re.test(t)) Object.assign(o, patch); };
  // category defaults
  if (cat === 'womens') Object.assign(o, { hsn: '6106', sizes: 'XS–XXL', price: [180, 380] });
  if (cat === 'kids') Object.assign(o, { sizes: '2Y–10Y', gsm: 160, price: [120, 260], moq: 350, hsn: '6111' });
  if (cat === 'sportswear') Object.assign(o, { fabric: 'Polyester Micro-Mesh', gsm: 140, fit: 'Athletic', sizes: 'XS–XXL', price: [130, 320], hsn: '6112', moq: 400 });
  if (cat === 'innerwear') Object.assign(o, { fabric: 'Combed Cotton Jersey', gsm: 150, fit: 'Regular', price: [70, 220], moq: 600, hsn: '6107' });
  if (cat === 'winter') Object.assign(o, { season: 'Winter', gsm: 300, price: [380, 1100], moq: 200, hsn: '6110', fabric: 'Brushed Fleece' });
  if (cat === 'ethnic') Object.assign(o, { season: 'Festive', fabric: 'Cotton Silk Blend', gsm: 110, pattern: 'Printed', price: [450, 1500], moq: 120, hsn: '6204', sizes: 'S–3XL', lead: 36 });
  if (cat === 'uniforms') Object.assign(o, { fabric: 'Poly-Cotton Twill', gsm: 200, price: [190, 560], moq: 400, hsn: '6211', lead: 28 });
  if (cat === 'footwear') Object.assign(o, { fabric: 'Synthetic Upper, EVA Sole', gsm: 0, sizes: 'UK 6–11', price: [520, 1250], moq: 120, hsn: '6404', fit: 'Regular', lead: 38, what: 'footwear' });
  if (cat === 'accessories') Object.assign(o, { fabric: 'Cotton Blend', gsm: 0, sizes: 'Free size', price: [60, 240], moq: 400, hsn: '6217', fit: 'One size', what: 'accessory' });
  // ---- garment types ----
  set(/t-shirt|tee|tank|crop|tops?$|henley/, { fabric: '100% Combed Cotton Jersey', gsm: 180, hsn: '6109', price: [100, 220], image: 'tee' });
  set(/polo/, { fabric: 'Cotton Pique', gsm: 220, hsn: '6105', price: [170, 290], image: 'tee' });
  set(/v-neck|round neck/, { image: 'tee' });
  set(/shirt/, { fabric: 'Cotton Poplin', gsm: 120, hsn: '6205', price: [230, 420], image: 'shirt' });
  set(/t-shirt/, { fabric: '100% Combed Cotton Jersey', gsm: 180, hsn: '6109', price: [100, 220], image: 'tee' });
  set(/sweatshirt|hoodie/, { fabric: 'Cotton Fleece', gsm: 320, hsn: '6110', price: [290, 520], image: 'hoodie', season: 'Winter' });
  set(/denim shirt/, { fabric: '5 oz Cotton Denim', gsm: 150, hsn: '6205', image: 'shirt', price: [330, 560] });
  set(/jean/, { fabric: '98% Cotton 2% Elastane Denim', gsm: 340, hsn: '6203', price: [380, 680], image: 'denim', moq: 300 });
  set(/jeggings/, { fabric: 'Stretch Denim Knit', gsm: 260, hsn: '6104', price: [260, 430], image: 'denim' });
  set(/trouser|pants|chino|palazzo|cargo|formal pants/, { fabric: 'Cotton Elastane Twill', gsm: 240, hsn: '6203', price: [300, 520], image: 'trouser' });
  set(/shorts|bermuda/, { fabric: 'Cotton Twill', gsm: 200, hsn: '6203', price: [180, 340], image: 'trouser', season: 'Summer' });
  set(/jogger|track pants|sweat pants/, { fabric: 'Cotton Fleece', gsm: 260, hsn: '6103', price: [230, 400], image: 'trouser' });
  set(/denim skirt|skirts?$/, { fabric: 'Cotton Denim', gsm: 260, hsn: '6204', price: [260, 440], image: 'denim' });
  set(/dress|frock|gown|maxi|midi|mini|jumpsuit|romper|co-ord|tunic|kurti|blouse/, { fabric: 'Viscose Rayon', gsm: 110, hsn: '6204', price: [320, 650], image: 'dress', pattern: 'Printed' });
  set(/kurti|kurta|tunic/, { fabric: 'Cotton Cambric', gsm: 130, price: [220, 460], image: 'womenTop', pattern: 'Printed' });
  set(/blouse|camisole|crop|tank/, { image: 'womenTop' });
  set(/leggings/, { fabric: 'Nylon Spandex Blend', gsm: 220, hsn: '6104', price: [170, 330], fit: 'Skinny', image: 'leggings' });
  set(/jacket|windcheater|parka|bomber|puffer|overcoat|coat(s)?$|blazer|waistcoat|suit(s)?$|shrug/, { fabric: 'Polyester Taslan, Mesh Lined', gsm: 120, hsn: '6201', price: [520, 1250], image: 'jacket', season: 'Winter', moq: 200 });
  set(/puffer|parka/, { fabric: 'Nylon Shell + Poly Fill', gsm: 180, price: [780, 1500], image: 'jacket' });
  set(/leather/, { fabric: 'PU Leather, Quilted Lining', price: [900, 1800], image: 'jacket' });
  set(/denim jacket/, { fabric: '12 oz Cotton Denim', gsm: 400, image: 'hoodie', price: [650, 1150] });
  set(/overcoat|coat|blazer|waistcoat|suit/, { fabric: 'Wool-Blend Suiting', gsm: 280, hsn: '6203', price: [700, 2200], image: 'suit', season: 'Winter', moq: 150 });
  set(/overcoat|^coats$/, { image: 'coat' });
  set(/sweater|cardigan|woollen|knit/, { fabric: 'Wool-Acrylic Blend Knit', gsm: 320, hsn: '6110', price: [340, 760], image: 'knit', season: 'Winter' });
  set(/thermal|long johns/, { fabric: 'Cotton-Spandex Rib Thermal', gsm: 200, hsn: '6107', price: [160, 340], season: 'Winter', image: 'innerwear' });
  set(/vest|boxer|brief|panties|camisole|slip|shapewear/, { fabric: 'Combed Cotton Rib', gsm: 160, hsn: '6107', price: [70, 220], image: 'innerwear' });
  set(/bra\b|bras|lingerie/, { fabric: 'Cotton-Elastane Jersey', gsm: 180, hsn: '6212', price: [110, 330], sizes: '30B, 32B, 34B, 36B, 38B, 32C, 34C, 36C', image: 'innerwear' });
  set(/pyjama|night|sleep|lounge|bathrobe|nighties/, { fabric: 'Cotton Jersey', gsm: 170, hsn: '6208', price: [220, 520], image: 'innerwear' });
  set(/bathrobe/, { fabric: 'Cotton Terry', gsm: 380, price: [650, 1250], hsn: '6207' });
  set(/maternity|nursing/, { fabric: 'Stretch Cotton Jersey', gsm: 190, hsn: '6104', price: [260, 520], image: 'womenTop' });
  // ---- sportswear ----
  set(/jersey|yoga|gym|running|compression|rash|cycling|training|track suit|sports? (t-shirts|shorts|leggings|bras?)|swim/, { image: 'sport' });
  set(/yoga|leggings|compression|sports bra/, { image: 'leggings', fabric: 'Nylon Spandex Seamless', gsm: 230 });
  set(/swim|rash/, { fabric: 'Chlorine-Resistant Nylon Spandex', gsm: 210, hsn: '6112', price: [260, 560] });
  set(/jersey/, { fabric: 'Polyester Interlock', gsm: 150, price: [230, 450], pattern: 'Colour-block' });
  // ---- kids & baby ----
  if (/baby|newborn/.test(t)) Object.assign(o, { sizes: '0–3M, 3–6M, 6–12M, 12–18M', fabric: 'Organic Cotton Interlock', gsm: 180, price: [140, 340], image: 'baby', moq: 300, hsn: '6111' });
  if (/kids|boys|girls/.test(t) && cat === 'kids') o.image = /dress|frock|skirt|party|ethnic|kurta/.test(t) ? 'dress' : 'kids';
  set(/baby (mittens|caps|socks|booties)/, { sizes: '0–6M, 6–12M', price: [40, 120], moq: 500, hsn: '6111', gsm: 0, image: 'baby' });
  set(/school uniform|kids school/, { fabric: 'Poly-Cotton Twill', gsm: 190, sizes: '6Y–16Y', price: [210, 420], image: 'shirt', moq: 500, hsn: '6205' });
  set(/raincoat/, { fabric: 'PU-Coated Polyester', gsm: 110, price: [260, 480], season: 'Monsoon', hsn: '6210', image: 'jacket' });
  // ---- ethnic ----
  set(/saree/, { fabric: 'Silk Blend, Woven Zari Border', gsm: 0, fit: '6.3 m + blouse piece', sizes: 'Free size', price: [650, 2400], hsn: '5007', pattern: 'Woven Zari', image: 'saree', moq: 100 });
  set(/lehenga|ghagra|gown/, { fabric: 'Silk Blend, Embroidered', sizes: 'Free size (adjustable)', price: [1900, 5200], image: 'lehenga', moq: 50, pattern: 'Embroidered', fit: 'A-Line', lead: 45 });
  set(/anarkali|salwar|suit(s)? (set)?$|kameez|indo-western/, { fabric: 'Georgette Blend', price: [520, 1250], image: 'salwar', pattern: 'Embroidered' });
  set(/kurta|sherwani|nehru|dhoti|lungi|traditional wear|ethnic jacket/, { fabric: 'Cotton Linen Blend', price: [380, 1100], image: 'salwar' });
  set(/sherwani/, { fabric: 'Art Silk Brocade', price: [1800, 4500], moq: 50, image: 'suit', pattern: 'Brocade' });
  set(/dupatta|stole/, { fabric: 'Chiffon, Printed', gsm: 0, sizes: 'Free size', price: [140, 420], image: 'saree', hsn: '6214', moq: 250 });
  // ---- uniforms ----
  set(/school/, { fabric: 'Poly-Cotton Check', price: [190, 420], image: 'shirt', hsn: '6205' });
  set(/shirt/, { image: cat === 'uniforms' ? 'work' : 'shirt' });
  set(/coat|chef|lab|doctor/, { fabric: 'Poly-Cotton Twill, Stain-Resistant', price: [320, 780], image: 'work', hsn: '6210' });
  set(/coverall|industrial|safety|reflective|security|housekeeping|hotel|hospital|nursing|apron|chef pants|office trousers/, { image: 'work' });
  set(/coverall|industrial|safety|reflective/, { fabric: 'Cotton Drill, Reflective Tape', gsm: 240, price: [450, 980], hsn: '6211', moq: 200 });
  set(/apron/, { fabric: 'Cotton Canvas', gsm: 260, price: [150, 340], sizes: 'Free size', hsn: '6211' });
  // ---- footwear ----
  if (cat === 'footwear') {
    set(/sneaker|sports|running|walking|training|basketball|football|cricket/, { image: 'sneaker', fabric: 'Knit Upper, EVA Midsole, Rubber Outsole', price: [620, 1350] });
    set(/formal|oxford|derby|loafer|moccasin/, { image: 'formalShoe', fabric: 'PU Leather, TPR Sole', price: [720, 1600], fit: 'Regular' });
    set(/boot/, { image: 'boot', fabric: 'Synthetic Leather, Rubber Sole', price: [850, 1750] });
    set(/heel|pump|wedge|ballerina|flats/, { image: 'heel', fabric: 'Synthetic Suede, PU Sole', price: [420, 980], sizes: 'UK 3–8' });
    set(/sandal|flip|slipper|slides|espadrille/, { image: 'heel', fabric: 'EVA / PU Footbed', price: [180, 520], hsn: '6402', sizes: 'UK 6–11' });
    set(/school/, { sizes: 'UK 1–6', price: [380, 780], image: 'formalShoe' });
    set(/baby/, { sizes: '0–6M, 6–12M, 12–18M', price: [140, 340], image: 'baby' });
  }
  // ---- accessories ----
  if (cat === 'accessories') {
    set(/cap|hat/, { image: 'cap', fabric: 'Cotton Twill', price: [70, 180], hsn: '6505' });
    set(/beanie|winter cap/, { image: 'beanie', fabric: 'Acrylic-Wool Blend', price: [80, 200], season: 'Winter', hsn: '6505' });
    set(/sock/, { image: 'socks', fabric: 'Cotton-Poly Terry', price: [40, 120], hsn: '6115' });
    set(/belt/, { image: 'belt', fabric: 'Genuine Leather Look PU', price: [120, 320], sizes: 'S, M, L, XL', hsn: '4203' });
    set(/wallet|purse|clutch/, { image: 'bag', fabric: 'PU Leather', price: [150, 560], hsn: '4202' });
    set(/bag|backpack/, { image: /backpack/.test(t) ? 'backpack' : 'bag', fabric: 'Water-Repellent Polyester', price: [320, 880], hsn: '4202' });
    set(/handbag/, { image: 'bag', fabric: 'PU Leather', price: [480, 1100] });
    set(/scarf|muffler|stole/, { image: 'beanie', fabric: 'Acrylic Wool Blend', price: [110, 320], season: 'Winter', hsn: '6214' });
    set(/glove/, { image: 'beanie', fabric: 'Wool-Acrylic Knit', price: [90, 260], sizes: 'S, M, L', season: 'Winter', hsn: '6116' });
    set(/tie|bow tie|pocket square|suspender/, { image: 'tie', fabric: 'Polyester Jacquard', price: [90, 260], hsn: '6215' });
    set(/hair band|headband|bandana/, { image: 'womenTop', fabric: 'Cotton Jersey', price: [30, 110], hsn: '6217' });
  }
  if (/shorts|tank|crop|swim|sandal|flip|cap$|^caps$|hats?$/.test(t)) o.season = o.season === 'All Season' ? 'Summer' : o.season;
  if (/winter|thermal|sweater|cardigan|puffer|parka|muffler|glove|beanie|woollen|overcoat/.test(t)) o.season = 'Winter';
  return o;
}

const genderFor = (cat, type) => {
  const t = type.toLowerCase();
  if (cat === 'mens' || /^men's/.test(t)) return ['Men', 'Adult']; if (cat === 'womens' || /^women's/.test(t) || /bra|panties|lingerie|saree|lehenga|ghagra|anarkali|salwar|dupatta|blouse|maternity|nursing|heels|pumps|ballerina/.test(t)) return ['Women', 'Adult'];
  if (cat === 'kids') return [/baby|newborn/.test(t) ? 'Unisex' : /boys/.test(t) ? 'Boys' : /girls|frock|dress|skirt/.test(t) ? 'Girls' : 'Unisex', /baby|newborn/.test(t) ? 'Baby' : 'Kids'];
  if (/school/.test(t)) return ['Unisex', 'Kids']; if (/baby/.test(t)) return ['Unisex', 'Baby'];
  if (/sherwani|dhoti|lungi|nehru|kurtas$/.test(t)) return ['Men', 'Adult'];
  return ['Unisex', 'Adult'];
};

const SELLER_KEYS = { mens: 'tiruppur', womens: 'delhi', kids: 'tiruppur', sportswear: 'bengaluru', innerwear: 'tiruppur', winter: 'ludhiana', ethnic: 'jaipur', uniforms: 'mumbai', footwear: 'agra', accessories: 'agra' };
const sellerFor = (cat, type) => /denim|jean|jegging|shirt|trouser|pants|chino|cargo/i.test(type) && ['mens', 'womens'].includes(cat) ? 'delhi' : /saree|lehenga|ghagra|gown|anarkali|salwar|dupatta|stole|sherwani/i.test(type) ? 'surat' : /hoodie|sweat|fleece|jogger/i.test(type) ? 'ludhiana' : SELLER_KEYS[cat];
const DEMO_SELLERS = { tiruppur: ['Rajesh Kumar', 'seller@demo.com', 'Tiruppur Knit Exports'], ludhiana: ['Anita Sharma', 'seller2@demo.com', 'Ludhiana Fleece Mills'], surat: ['Meera Patel', 'seller4@demo.com', 'Surat Ethnic Looms'], agra: ['Rohit Verma', 'seller5@demo.com', 'Agra Footcraft & Leather'],
  delhi: ['Karan Malhotra', 'seller6@demo.com', 'Delhi Denim & Wovens'], jaipur: ['Pooja Rathore', 'seller7@demo.com', 'Jaipur Block Print Co.'], bengaluru: ['Sneha Rao', 'seller8@demo.com', 'Bengaluru Activewear Labs'], mumbai: ['Farhan Qureshi', 'seller9@demo.com', 'Mumbai Workwear Mills'] };

const sing = type => type.replace(/\bT-Shirts\b/, 'T-Shirts');
function describe(cat, type, o, name, colors, r) {
  const fit = o.fit && o.fit !== 'One size' ? `${o.fit.toLowerCase()} fit` : '', wt = o.gsm ? ` at ${o.gsm} GSM` : '';
  const open = { footwear: `Factory-made ${type.toLowerCase()} built on a cushioned sole with a durable finish`, accessories: `${type} made to a consistent bulk standard with clean stitching and finishing`, ethnic: `${type} finished with traditional detailing and a festive hand-feel`, uniforms: `${type} engineered for daily wear, repeated washing and easy care`, kids: `Skin-friendly ${type.toLowerCase()} with soft seams and safe dyes`, sportswear: `${type} with moisture-wicking comfort and a flexible fit`, winter: `${type} that layers warmly without bulk`, innerwear: `Breathable, soft-against-skin ${type.toLowerCase()}`, womens: `${type} cut for a flattering, comfortable line`, mens: `${type} cut for an easy, versatile fit` }[cat];
  return `${open}. Made from ${o.fabric.toLowerCase()}${wt}${fit ? `, ${fit}` : ''}. Available in ${colors.length} colours${o.sizes !== 'Free size' ? ` and sizes ${o.sizes}` : ''}. Private label, custom trims and packaging on request.`;
}

// Build one demo product for a taxonomy node. `subId` is the helper that builds the product-type id.
function build(cat, type, subId, index) {
  const r = rng(cat + ':' + type), o = spec(cat, type), [gender, age] = genderFor(cat, type);
  const pool = P[o.image] || P[CAT_FALLBACK[cat]], image = pick(pool, r);
  const lo = round5(o.price[0] * (0.92 + r() * .16)), hi = Math.max(lo + 10, round5(o.price[1] * (0.92 + r() * .16)));
  const palette = PAL[cat], n = 3 + Math.floor(r() * 3), colors = [...palette].sort(() => r() - .5).slice(0, n);
  const adj = pick(ADJ[cat], r), fabricShort = o.fabric.split(/[,+]/)[0].replace(/^\d+% /, '').split(' ').slice(0, 2).join(' ');
  const name = `${adj} ${cat === 'footwear' ? '' : fabricShort} ${sing(type)}`.replace(/\s+/g, ' ').replace(new RegExp(`(${type.split(' ')[0]}) ${type}`, 'i'), type);
  const moq = Math.max(50, Math.round(o.moq * (.8 + r() * .5) / 10) * 10), stock = index % 3 === 0 ? moq * 8 : 0, retail = Math.round(hi * 2.2 / 10) * 10 - 1;
  return { name, cat, type, sub: subId(cat, type), seller: sellerFor(cat, type), gender, age, fabric: o.fabric, gsm: o.gsm, fit: o.fit, sizes: o.sizes, pattern: o.pattern, season: o.season, hsn: o.hsn,
    price: [lo, hi], moq, lead: o.lead + Math.floor(r() * 8), colors, image, desc: describe(cat, type, o, name, colors, r), stock, gst: retail > 2500 ? 18 : 5, featured: index % 9 === 0 ? 1 : 0, views: 20 + Math.floor(r() * 420) };
}
module.exports = { build, DEMO_SELLERS };
