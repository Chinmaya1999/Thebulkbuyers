export const BRAND = {
  name: 'Bulk Buyers',
  phone: '+91 00000 00000',
  whatsapp: '910000000000', // country code + number, no "+"
  email: 'hello@thebulkbuyers.com',
  address: 'Your Office Address, City, State, India'
};
export const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
export const money2 = n => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const compact = n => { n = Number(n) || 0; return n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'K' : '$' + Math.round(n); };
export const num = n => Number(n || 0).toLocaleString('en-US');
export const dt = s => s ? new Date(s).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const mon = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short' });

// Unsplash photos are requested at the size we need (up to 4K) in modern formats.
export const img = (url, w = 800) => !url ? '' : url.includes('images.unsplash.com') ? `${url}?w=${w}&q=80&auto=format&fit=crop` : url;
export const srcSet = (url, sizes = [480, 800, 1200, 1800, 2400, 3200]) => url && url.includes('images.unsplash.com') ? sizes.map(w => `${img(url, w)} ${w}w`).join(', ') : undefined;
export const safeNext = n => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/dashboard');

// Illustrative price ladder for the hero studio (sample: classic crew tee). Real prices come from the catalogue.
export const LADDER = { retail: 399, p50: 299, p500: 165, p5000: 110, floor: 98 };
export const ladderPrice = q => {
  const L = LADDER, lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
  if (q < 50) return L.retail - (q - 1) * 0.4;
  if (q < 500) return lerp(L.p50, L.p500, (q - 50) / 450);
  if (q < 5000) return lerp(L.p500, L.p5000, (q - 500) / 4500);
  return lerp(L.p5000, L.floor, (q - 5000) / 15000);
};
export const tierOf = q => q < 50 ? ['RETAIL', ''] : q < 500 ? ['SMALL BATCH', ''] : q < 5000 ? ['WHOLESALE', 'w'] : ['FACTORY-DIRECT', 'f'];

// Parse a product's `sizes` text into selectable options: "S–3XL", "UK 6–11", "2Y–10Y", "0–3M, 3–6M" or "Free size".
export const sizeList = (sizes = '') => {
  const s = String(sizes).trim(), STD = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
  let m = s.match(/^(XS|S|M|L|XL|XXL|3XL)\s*[–-]\s*(XS|S|M|L|XL|XXL|3XL)$/i);
  if (m) { const a = STD.indexOf(m[1].toUpperCase()), b = STD.indexOf(m[2].toUpperCase()); if (a >= 0 && b >= a) return STD.slice(a, b + 1); }
  m = s.match(/^(UK\s*)?(\d+)\s*[–-]\s*(\d+)$/i);
  if (m && +m[3] - +m[2] <= 20) return Array.from({ length: +m[3] - +m[2] + 1 }, (_, i) => (m[1] ? 'UK ' : '') + (+m[2] + i));
  m = s.match(/^(\d+)\s*Y\s*[–-]\s*(\d+)\s*Y$/i);
  if (m) { const out = []; for (let y = +m[1]; y <= +m[2]; y += 2) out.push(y + 'Y'); return out; }
  if (s.includes(',')) return s.split(',').map(x => x.trim()).filter(Boolean);
  return [s || 'Free size'];
};

// Flat /categories list → [{group, categories:[{…, types:[…]}]}]
export function buildTree(nodes = []) {
  const kids = id => nodes.filter(n => n.parent_id === id);
  return nodes.filter(n => n.level === 0).map(g => ({ ...g, categories: kids(g.id).map(c => ({ ...c, types: kids(c.id) })) }));
}
export const GENDERS = ['Men', 'Women', 'Boys', 'Girls', 'Unisex'], AGES = ['Adult', 'Kids', 'Baby'], SEASONS = ['All Season', 'Summer', 'Winter', 'Autumn', 'Spring', 'Monsoon', 'Festive'];

// Nearest readable colour name for a hex swatch (labels only — the swatch itself is the data).
const NAMED = { Black: '#111111', White: '#ffffff', Ivory: '#f2ede2', Grey: '#808080', Charcoal: '#3b3a3e', Navy: '#1f3a5f', Blue: '#2f6fff', 'Sky blue': '#a9c4e8', Red: '#c9402f', Maroon: '#7a1f2b', Pink: '#e7a8b8', Purple: '#923595', Green: '#2f6b4f', Olive: '#6b6a4a', Mustard: '#e4a82e', Orange: '#e07a1e', Brown: '#7a5c3a', Beige: '#d8c9ac', Tan: '#c9a97a', Teal: '#2a6f7a', Cream: '#e8dcc8' };
export const colorName = hex => {
  const c = String(hex).replace('#', ''), f = c.length === 3 ? c.split('').map(x => x + x).join('') : c.padEnd(6, '0');
  const rgb = [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)); let best = hex, d = 1e9;
  for (const [n, h] of Object.entries(NAMED)) { const t = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const dist = rgb.reduce((s, v, k) => s + (v - t[k]) ** 2, 0); if (dist < d) { d = dist; best = n; } }
  return best;
};
export const unsplash = (id, w = 1600, h) => `https://images.unsplash.com/${id}?w=${w}${h ? `&h=${h}` : ''}&q=80&auto=format&fit=crop`;
export const catHref = (id, extra = '') => `/shop?cat=${id}${extra}`;

// Spread a pack of `total` pieces across sizes (remainder to the middle sizes) in one colour — used by "Quick add MOQ pack".
export const spreadPack = (total, sizes, color) => {
  const n = sizes.length || 1, base = Math.floor(total / n); let rem = total - base * n; const order = sizes.map((_, i) => i).sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2));
  const extra = {}; order.forEach(i => { if (rem > 0) { extra[i] = 1; rem--; } });
  return sizes.map((size, i) => ({ size, color, qty: base + (extra[i] || 0) }));
};
// Printable product spec sheet (opens in a new tab → Print / Save as PDF).
export function openSpecSheet(p) {
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rows = [['SKU', p.sku], ['Category', [p.group_name, p.category_name, p.sub_name].filter(Boolean).join(' › ')], ['Brand', p.brand], ['Fabric / material', p.fabric], ['Weight', p.gsm ? p.gsm + ' GSM' : ''], ['Pattern', p.pattern], ['Fit', p.fit], ['Season', p.season], ['Gender / age', [p.gender, p.age_group].filter(Boolean).join(' · ')], ['Sizes', (p.size_options || []).join(', ')], ['Colours', (p.colors || []).map(colorName).join(', ')], ['MOQ', p.moq + ' pcs'], ['Lead time', p.lead_days + ' days'], ['HSN / GST', [p.hsn_code && 'HSN ' + p.hsn_code, p.gst_rate + '% GST'].filter(Boolean).join(' · ')], ['Manufacturer', p.seller_company]];
  const w = window.open('', '_blank'); if (!w) return false;
  w.document.write(`<!doctype html><title>${esc(p.name)} — spec sheet</title><style>body{font:14px/1.5 Inter,Arial,sans-serif;color:#171717;max-width:760px;margin:40px auto;padding:0 24px}h1{font:600 34px Georgia,serif;margin:0 0 4px}.sub{color:#777;margin-bottom:22px}table{border-collapse:collapse;width:100%;margin:12px 0 26px}td,th{padding:9px 10px;border-bottom:1px solid #e5e0d6;text-align:left;vertical-align:top}th{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#777;width:34%}img{width:240px;float:right;margin:0 0 20px 24px;border:1px solid #e5e0d6}small{color:#777}</style>
  <img src="${esc(img(p.image, 700))}" alt=""><h1>${esc(p.name)}</h1><div class="sub">Bulk Buyers — product specification</div><p>${esc(p.description)}</p>
  <table>${rows.filter(r => r[1]).map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('')}</table>
  <h3>Wholesale price tiers (excl. GST)</h3><table>${(p.price_tiers || []).map(t => `<tr><th>${t.min_qty}+ pcs</th><td>$${t.price} / pc</td></tr>`).join('')}<tr><th>Below MOQ (retail)</th><td>$${p.retail_price} / pc</td></tr></table>
  <small>Prices indicative; final price and availability are confirmed at order acceptance. Generated ${new Date().toLocaleDateString('en-US')}.</small><script>onload=()=>setTimeout(print,300)<\/script>`);
  w.document.close(); return true;
}

export const invoiceNo = o => `INV-${new Date(o.created_at).getFullYear()}-${String(o.id).padStart(5, '0')}`;
// Printable order invoice (opens a new tab → Print / Save as PDF). A system-generated summary, not a statutory tax invoice.
export function openInvoice(o, user) {
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = n => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const b = o.shipping?.business || {}, bill = o.shipping?.billing || o.shipping || {}, rate = o.product_gst_rate ?? (o.total ? Math.round((o.gst_amount / o.total) * 1000) / 10 : 0);
  const w = window.open('', '_blank'); if (!w) return false;
  w.document.write(`<!doctype html><title>${invoiceNo(o)}</title><style>body{font:13.5px/1.55 Inter,Arial,sans-serif;color:#171717;max-width:820px;margin:36px auto;padding:0 26px}h1{font:600 34px Georgia,serif;margin:0}.row{display:flex;justify-content:space-between;gap:30px;margin:22px 0}.l{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#777}table{border-collapse:collapse;width:100%;margin:14px 0}th,td{padding:9px 10px;border-bottom:1px solid #e5e0d6;text-align:left}th{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#777}td.r,th.r{text-align:right}.tot td{border:0;padding:4px 10px}.grand td{font:600 18px Georgia,serif;border-top:1px solid #171717;padding-top:10px}small{color:#777}</style>
  <div class="row"><div><h1>Invoice</h1><div class="l">${invoiceNo(o)}</div></div><div style="text-align:right"><div class="l">Date</div>${new Date(o.created_at).toLocaleDateString('en-US')}<div class="l" style="margin-top:8px">Order</div>#${o.id} · ${esc(o.channel)}</div></div>
  <div class="row"><div><div class="l">Sold by</div><b>${esc(o.seller_company || o.seller_name)}</b><br>${o.seller_gst ? 'GSTIN ' + esc(o.seller_gst) : '<small>GSTIN not provided</small>'}</div>
  <div><div class="l">Billed to</div><b>${esc(b.company || user?.company || o.buyer_company || o.buyer_name)}</b><br>${b.gstin || o.buyer_gst ? 'GSTIN ' + esc(b.gstin || o.buyer_gst) + '<br>' : ''}${esc([bill.name, bill.line1 || bill.address, bill.city, bill.state, bill.pincode, bill.country].filter(Boolean).join(', '))}</div></div>
  <table><thead><tr><th>Item</th><th>HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Taxable</th><th class="r">GST</th></tr></thead><tbody>
  <tr><td><b>${esc(o.title)}</b><br><small>${esc(o.product_sku || '')} ${o.details ? '· ' + esc(o.details) : ''}</small></td><td>${esc(o.product_hsn || '—')}</td><td class="r">${o.quantity}</td><td class="r">${f(o.unit_price)}</td><td class="r">${f(o.total)}</td><td class="r">${rate}% · ${f(o.gst_amount)}</td></tr></tbody></table>
  <table class="tot" style="width:320px;margin-left:auto"><tr><td>Taxable value</td><td class="r">${f(o.total)}</td></tr><tr><td>GST</td><td class="r">${f(o.gst_amount)}</td></tr><tr class="grand"><td>Total</td><td class="r">${f(o.total + (o.gst_amount || 0))}</td></tr></table>
  <p><small>Payment: ${o.shipping?.payment === 'bank_transfer' ? 'Bank transfer' : 'Pay on delivery'} · Status: ${esc(String(o.status).replace('_', ' '))}. This document is a system-generated order invoice summary; the manufacturer issues the statutory GST tax invoice with the consignment.</small></p>
  <script>onload=()=>setTimeout(print,300)<\/script>`);
  w.document.close(); return true;
}
