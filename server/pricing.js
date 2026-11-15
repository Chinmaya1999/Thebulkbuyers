// Single source of truth for wholesale tier pricing, GST and cart totals (used by /cart/price and checkout).
const { q } = require('./db');

const r2 = n => Math.round(n * 100) / 100;
// Tier ladder derived from the seller's wholesale range: MOQ → max, 2×MOQ → midpoint, 5×MOQ → min.
function tiersOf(p) {
  const moq = Math.max(1, p.moq), max = p.price_max, min = Math.min(p.price_min, p.price_max), mid = r2((max + min) / 2);
  const t = [{ min_qty: moq, price: r2(max) }];
  if (mid < max) t.push({ min_qty: moq * 2, price: mid });
  if (min < (t[t.length - 1].price)) t.push({ min_qty: moq * 5, price: r2(min) });
  return t;
}
const unitPrice = (p, qty) => qty >= p.moq ? tiersOf(p).filter(t => qty >= t.min_qty).pop().price : p.retail_price;

// `discountPct` = the buyer's negotiated customer-specific discount, applied to wholesale (≥ MOQ) prices only.
async function priceCart(items, db = q, discountPct = 0) {
  const disc = Math.min(30, Math.max(0, Number(discountPct) || 0)) / 100;
  const groups = new Map(), issues = [];
  for (const it of (Array.isArray(items) ? items : []).slice(0, 200)) {
    const id = Math.trunc(Number(it.productId)), qty = Math.trunc(Number(it.qty));
    if (!id || !(qty >= 1) || qty > 100000) continue;
    const g = groups.get(id) || { productId: id, qty: 0, lines: [] };
    g.qty += qty; g.lines.push({ size: String(it.size || '').slice(0, 20), color: String(it.color || '').slice(0, 9), qty }); groups.set(id, g);
  }
  const products = [];
  for (const g of groups.values()) {
    const p = await db.get(`SELECT p.id,p.slug,p.name,p.image,p.sku,p.seller_id,p.moq,p.price_min,p.price_max,p.retail_price,p.gst_rate,p.stock_qty,u.company seller_company
      FROM products p LEFT JOIN users u ON u.id=p.seller_id WHERE p.id=? AND p.status='approved'`, g.productId);
    if (!p || !p.seller_id) { issues.push({ productId: g.productId, message: 'An item in your cart is no longer available' }); continue; }
    const errors = [];
    if (p.stock_qty > 0 && g.qty > p.stock_qty) errors.push(`Only ${p.stock_qty} pcs in stock`);
    const wholesale = g.qty >= p.moq, tierUnit = unitPrice(p, g.qty), unit = wholesale ? r2(tierUnit * (1 - disc)) : tierUnit, taxable = r2(unit * g.qty), gst = r2(taxable * (p.gst_rate || 0) / 100);
    const base = wholesale ? tiersOf(p)[0].price : unit, customerSavings = wholesale ? r2((tierUnit - unit) * g.qty) : 0;
    products.push({ productId: p.id, slug: p.slug, name: p.name, image: p.image, sku: p.sku, seller_id: p.seller_id, seller_company: p.seller_company, qty: g.qty, lines: g.lines,
      moq: p.moq, channel: wholesale ? 'wholesale' : 'retail', unit, mrp: p.retail_price, taxable, gst_rate: p.gst_rate || 0, gst, grand: r2(taxable + gst),
      bulkSavings: wholesale ? r2((base - tierUnit) * g.qty) : 0, customerSavings, customerDiscountPct: wholesale ? r2(disc * 100) : 0, mrpSavings: r2(Math.max(0, p.retail_price - unit) * g.qty), tiers: tiersOf(p), stock_qty: p.stock_qty,
      toWholesale: wholesale ? 0 : p.moq - g.qty, errors });
    errors.forEach(m => issues.push({ productId: p.id, message: `${p.name}: ${m}` }));
  }
  const sum = k => r2(products.reduce((s, x) => s + x[k], 0));
  return { products, issues, totals: { qty: products.reduce((s, x) => s + x.qty, 0), items: products.reduce((s, x) => s + x.lines.length, 0), subtotal: sum('taxable'), bulkSavings: sum('bulkSavings'), customerSavings: sum('customerSavings'), mrpSavings: sum('mrpSavings'), gst: sum('gst'), shipping: 0, grand: sum('grand') } };
}
module.exports = { tiersOf, unitPrice, priceCart, r2 };
