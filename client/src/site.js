import { useEffect, useState } from 'react';
import { api } from './api.js';
import { BRAND } from './lib.js';

// Admin-editable website content (GET /api/site), with built-in fallbacks so the storefront never renders blank.
export const SITE_FALLBACK = {
  announcements: [{ title: 'Wholesale fashion marketplace', text: 'Verified factory partners' }],
  announceLinkLabel: 'Shop deals', announceLinkUrl: '/shop?sort=deal',
  hero: { eyebrow: 'Wholesale fashion marketplace', line1: 'THE FUTURE OF', line2: 'WHOLESALE', accent: 'FASHION', lead: 'Discover premium apparel collections. Source smarter. Buy in bulk. Grow your business.', cta1Label: 'Explore collections', cta1Url: '/categories', cta2Label: 'Shop wholesale deals', cta2Url: '/shop?sort=deal', caption: 'Autumn · Winter wholesale edit' },
  contact: { phone: BRAND.phone, whatsapp: BRAND.whatsapp, email: BRAND.email, address: BRAND.address },
  about: { title: 'A bridge for bold ideas', lead: 'From concept and design to sourcing and large-scale manufacturing — fast, reliable, scalable solutions for global brands.' },
  footer: { legal: 'A proud venture of The Bulk Buyers FZC LLC\nUUO Innovation Pvt Ltd\nOfficial platform of BBS International', newsletterTitle: 'Wholesale intelligence, monthly', newsletterText: 'New collections, bulk deals and sourcing notes. No spam.' }
};

let cache, subs = new Set();
const load = () => api('/site').then(d => { cache = d; subs.forEach(f => f(d)); return d; }).catch(() => {});
export const refreshSite = () => load();

export function useSite() {
  const [s, set] = useState(cache || SITE_FALLBACK);
  useEffect(() => { subs.add(set); if (!cache) load(); return () => subs.delete(set); }, []);
  return s;
}
// Internal links stay in the SPA; anything else is rendered as a normal anchor by the caller.
export const isInternal = u => typeof u === 'string' && u.startsWith('/') && !u.startsWith('//');
