import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { api } from './api.js';
import { buildTree } from './lib.js';

// Loads async data; `reload()` re-runs it. Ignores stale responses.
export function useAsync(fn, deps = []) {
  const [state, set] = useState({ data: null, error: null, loading: true });
  const tick = useRef(0), [n, setN] = useState(0);
  useEffect(() => {
    const id = ++tick.current;
    set(s => ({ ...s, loading: true }));
    fn().then(data => id === tick.current && set({ data, error: null, loading: false }))
        .catch(error => id === tick.current && set({ data: null, error, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  const reload = useCallback(() => setN(x => x + 1), []);
  return { ...state, reload };
}

// Adds .in to [data-reveal] / .split / .step as they scroll into view (also picks up nodes React adds later).
export function useReveals() {
  useEffect(() => {
    const sel = '[data-reveal],.split,.step';
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    const seen = new WeakSet();
    const scan = root => root.querySelectorAll && [root, ...root.querySelectorAll(sel)].forEach(el => { if (el.matches?.(sel) && !seen.has(el)) { seen.add(el); io.observe(el); } });
    scan(document.body);
    const mo = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && scan(n))));
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
}

// Whole catalogue hierarchy, fetched once per page load and shared.
let catCache;
export const loadCategories = (fresh) => (!fresh && catCache) || (catCache = api('/categories').catch(e => { catCache = null; throw e; }));
export function useCategories() {
  const r = useAsync(() => loadCategories(), []);
  const tree = useMemo(() => buildTree(r.data || []), [r.data]);
  const cats = useMemo(() => (r.data || []).filter(n => n.level === 1), [r.data]);
  return { ...r, tree, cats };
}
