// Product master validation + persistence (used by the admin console).
const { q } = require('./db');
const { str, num, int, slugify, parseColors, parseSizes } = require('./util');

const IMG = /^(https:\/\/images\.unsplash\.com\/|\/uploads\/[a-f0-9]+$)/;

async function fields(b, selfId = 0) {
  const f = {
    name: str(b.name, 120), category: str(b.category, 60), subcategory: str(b.subcategory, 80), brand: str(b.brand, 60), gender: str(b.gender, 20), age_group: str(b.age_group, 20), pattern: str(b.pattern, 40), season: str(b.season, 20),
    hsn_code: str(b.hsn_code, 12).replace(/[^0-9]/g, ''), gst_rate: Math.min(28, Math.max(0, num(b.gst_rate, 5))), purchase_price: Math.max(0, num(b.purchase_price)), stock_qty: Math.max(0, int(b.stock_qty)), barcode: str(b.barcode, 20).replace(/[^0-9A-Za-z-]/g, ''), sku: str(b.sku, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, ''), fabric: str(b.fabric, 120), gsm: int(b.gsm), fit: str(b.fit, 40),
    sizes: str(b.sizes, 40) || 'S–3XL', moq: int(b.moq, 100), price_min: num(b.price_min), price_max: num(b.price_max), retail_price: num(b.retail_price),
    lead_days: int(b.lead_days, 30), colors: JSON.stringify(parseColors(b.colors)), description: str(b.description, 2000),
    gallery: JSON.stringify((Array.isArray(b.gallery) ? b.gallery : []).filter(u => IMG.test(u)).slice(0, 5)), size_options: JSON.stringify(parseSizes(str(b.sizes, 80) || 'S–3XL')),
    image: IMG.test(b.image || '') ? b.image : ''
  };
  let err = null;
  if (f.name.length < 3) err = 'Product name is required';
  else if (!(await q.get('SELECT id FROM categories WHERE id=? AND level=1', f.category))) err = 'Choose a category';
  else if (f.subcategory && !(await q.get('SELECT id FROM categories WHERE id=? AND level=2 AND parent_id=?', f.subcategory, f.category))) err = 'That product type does not belong to the chosen category';
  else if (f.moq < 1) err = 'MOQ must be at least 1';
  else if (f.price_min <= 0 || f.price_max < f.price_min) err = 'Enter a valid price range (min ≤ max)';
  if (!err && f.sku && await q.get('SELECT id FROM products WHERE sku=? AND id<>?', f.sku, selfId)) err = 'That SKU is already used by another product';
  if (!err && f.retail_price <= 0) f.retail_price = Math.round(f.price_max * 2.2 / 10) * 10 - 1;
  return { f, err };
}

async function createProduct(f, sellerId, status = 'approved') {
  let slug = slugify(f.name), n = 1;
  while (await q.get('SELECT id FROM products WHERE slug=?', slug)) slug = `${slugify(f.name)}-${++n}`;
  const id = await q.insert(`INSERT INTO products(slug,seller_id,category,subcategory,name,fabric,gsm,fit,sizes,moq,price_min,price_max,retail_price,lead_days,colors,description,image,status,
      brand,gender,age_group,pattern,season,hsn_code,gst_rate,purchase_price,stock_qty,barcode,gallery,size_options)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?::jsonb)`, slug, sellerId, f.category, f.subcategory || null, f.name, f.fabric, f.gsm, f.fit, f.sizes, f.moq, f.price_min, f.price_max, f.retail_price, f.lead_days, f.colors, f.description, f.image, status,
    f.brand, f.gender, f.age_group, f.pattern, f.season, f.hsn_code, f.gst_rate, f.purchase_price, f.stock_qty, f.barcode, f.gallery, f.size_options);
  await q.run('UPDATE products SET sku=? WHERE id=?', f.sku || `TBB-${f.category.slice(0, 3).toUpperCase()}-${String(id).padStart(5, '0')}`, id);
  return id;
}

async function updateProduct(id, f, extra = {}) {
  await q.run(`UPDATE products SET category=?,subcategory=?,brand=?,gender=?,age_group=?,pattern=?,season=?,hsn_code=?,gst_rate=?,purchase_price=?,stock_qty=?,barcode=?,gallery=?::jsonb,size_options=?::jsonb,sku=COALESCE(NULLIF(?,''),sku),name=?,fabric=?,gsm=?,fit=?,sizes=?,moq=?,price_min=?,price_max=?,retail_price=?,lead_days=?,colors=?::jsonb,description=?,image=?,
      status=COALESCE(?,status),seller_id=COALESCE(?,seller_id),featured=COALESCE(?,featured) WHERE id=?`,
    f.category, f.subcategory || null, f.brand, f.gender, f.age_group, f.pattern, f.season, f.hsn_code, f.gst_rate, f.purchase_price, f.stock_qty, f.barcode, f.gallery, f.size_options, f.sku, f.name, f.fabric, f.gsm, f.fit, f.sizes, f.moq, f.price_min, f.price_max, f.retail_price, f.lead_days, f.colors, f.description, f.image,
    extra.status ?? null, extra.seller_id ?? null, extra.featured ?? null, id);
}

module.exports = { fields, createProduct, updateProduct };
