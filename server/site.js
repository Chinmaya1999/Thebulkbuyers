// Editable website content, stored as JSON in the settings table. Admin edits it; the storefront reads GET /api/site.
const { q, getSetting } = require('./db');
const { str } = require('./util');

const SITE_DEFAULTS = {
  announcements: [
    { title: 'Wholesale fashion marketplace', text: 'Verified factory partners' },
    { title: 'Bulk order benefits', text: 'Tiered pricing from MOQ' },
    { title: 'Business support', text: 'Quotations · GST invoices · order tracking' }
  ],
  announceLinkLabel: 'Shop deals', announceLinkUrl: '/shop?sort=deal',
  hero: {
    eyebrow: 'Wholesale fashion marketplace',
    line1: 'THE FUTURE OF', line2: 'WHOLESALE', accent: 'FASHION',
    lead: 'Discover premium apparel collections. Source smarter. Buy in bulk. Grow your business.',
    cta1Label: 'Explore collections', cta1Url: '/categories', cta2Label: 'Shop wholesale deals', cta2Url: '/shop?sort=deal',
    caption: 'Autumn · Winter wholesale edit'
  },
  contact: { phone: '+91 00000 00000', whatsapp: '910000000000', email: 'hello@thebulkbuyers.com', address: 'Your Office Address, City, State, India' },
  about: { title: 'A bridge for bold ideas', lead: 'From concept and design to sourcing and large-scale manufacturing — fast, reliable, scalable solutions for global brands.' },
  footer: { legal: 'A proud venture of The Bulk Buyers FZC LLC\nUUO Innovation Pvt Ltd\nOfficial platform of BBS International', newsletterTitle: 'Wholesale intelligence, monthly', newsletterText: 'New collections, bulk deals and sourcing notes. No spam.' }
};

const clean = (src, def, len = 300) => {
  if (Array.isArray(def)) return (Array.isArray(src) ? src : def).slice(0, 8).map(x => clean(x, def[0] || {}, len)).filter(x => Object.values(x).some(Boolean));
  if (def && typeof def === 'object') return Object.fromEntries(Object.keys(def).map(k => [k, clean(src && src[k], def[k], len)]));
  return typeof src === 'string' ? str(src, len) : def;
};
const merge = saved => {
  const out = clean(saved || {}, SITE_DEFAULTS, 400);
  // blank text falls back to the default, except the lists the admin may deliberately empty
  const fill = (o, d) => { for (const k of Object.keys(d)) { if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) fill(o[k], d[k]); else if (!Array.isArray(d[k]) && !o[k]) o[k] = d[k]; } };
  fill(out, SITE_DEFAULTS);
  if (!(saved && Array.isArray(saved.announcements))) out.announcements = SITE_DEFAULTS.announcements;
  return out;
};
async function getSite() { try { return merge(JSON.parse(await getSetting('site_content', 'null'))); } catch { return merge(null); } }
async function saveSite(content) {
  const c = merge(content);
  await q.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value', 'site_content', JSON.stringify(c));
  return c;
}
module.exports = { SITE_DEFAULTS, getSite, saveSite };
