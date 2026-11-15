// Cart (variant lines, priced by the server) + wishlist.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';
import { useToast } from './toast.jsx';

const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

export function CartProvider({ children }) {
  const { user } = useAuth(), toast = useToast();
  const [items, setItems] = useState(() => read('bb_cart', [])), [open, setOpen] = useState(false);
  const [priced, setPriced] = useState(null), [pricing, setPricing] = useState(false);
  const [wish, setWish] = useState(() => new Set());
  useEffect(() => { try { localStorage.setItem('bb_cart', JSON.stringify(items)); } catch { /* storage unavailable */ } }, [items]);

  // server-authoritative pricing (tiers, GST, stock) — debounced
  const seq = useRef(0);
  useEffect(() => {
    if (!items.length) { setPriced(null); setPricing(false); return; }
    const id = ++seq.current; setPricing(true);
    const t = setTimeout(() => api('/cart/price', { method: 'POST', body: { items } }).then(r => id === seq.current && setPriced(r)).catch(() => {}).finally(() => id === seq.current && setPricing(false)), 250);
    return () => clearTimeout(t);
  }, [items]);

  // wishlist ids for the signed-in user
  useEffect(() => { if (!user) { setWish(new Set()); return; } api('/wishlist').then(w => setWish(new Set(w.map(p => p.id)))).catch(() => {}); }, [user]);
  const toggleWish = useCallback(async (productId, onNeedLogin) => {
    if (!user) return onNeedLogin?.();
    try { const r = await api('/wishlist/' + productId, { method: 'POST' }); setWish(s => { const n = new Set(s); r.wished ? n.add(productId) : n.delete(productId); return n; }); toast(r.wished ? 'Saved to wishlist' : 'Removed from wishlist'); } catch (e) { toast(e.message); }
  }, [user, toast]);

  // lines: [{size,color,qty}] — qty 0 lines are ignored. Same product+size+colour merges.
  const addLines = useCallback((p, lines, { openDrawer = true } = {}) => {
    const add = lines.filter(l => l.qty > 0); if (!add.length) return false;
    setItems(cur => { let next = [...cur]; add.forEach(l => { const key = [p.id, l.size, l.color].join('|'), i = next.findIndex(x => x.key === key); if (i >= 0) next[i] = { ...next[i], qty: Math.min(100000, next[i].qty + l.qty) }; else next.push({ key, productId: p.id, slug: p.slug, name: p.name, image: p.image, size: l.size, color: l.color, qty: l.qty }); }); return next; });
    if (openDrawer) setOpen(true); return true;
  }, []);
  const setQty = useCallback((key, qty) => setItems(cur => qty <= 0 ? cur.filter(i => i.key !== key) : cur.map(i => i.key === key ? { ...i, qty: Math.min(100000, qty) } : i)), []);
  const remove = useCallback(key => setItems(cur => cur.filter(i => i.key !== key)), []);
  const removeProduct = useCallback(id => setItems(cur => cur.filter(i => i.productId !== id)), []);
  const clear = useCallback(() => setItems([]), []);
  const value = useMemo(() => ({ items, count: items.reduce((s, i) => s + i.qty, 0), priced, pricing, open, setOpen, addLines, setQty, remove, removeProduct, clear, wish, toggleWish }), [items, priced, pricing, open, addLines, setQty, remove, removeProduct, clear, wish, toggleWish]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
