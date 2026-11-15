import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header, { BottomNav, MobileMenu, SearchOverlay } from './Header.jsx';
import Footer from './Footer.jsx';
import CartDrawer from './CartDrawer.jsx';
import { useCategories } from '../hooks.js';
import { AnimatePresence, m } from './motion.jsx';

export default function Layout() {
  const { pathname, hash, search } = useLocation(), [menu, setMenu] = useState(false), [srch, setSrch] = useState(false), { data: nodes, cats } = useCategories();
  useEffect(() => { setMenu(false); setSrch(false); }, [pathname, search]);
  useEffect(() => { if (hash) setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120); else if (!search) scrollTo(0, 0); }, [pathname, hash]); // eslint-disable-line
  return <><a className="skip" href="#main">Skip to content</a>
    <Header onMenu={() => setMenu(true)} onSearch={() => setSrch(true)} />
    <AnimatePresence mode="wait" initial={false}><m.main id="main" key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .3 }}><Outlet /></m.main></AnimatePresence>
    <Footer /><CartDrawer /><BottomNav onMenu={() => setMenu(true)} onSearch={() => setSrch(true)} />
    <MobileMenu open={menu} onClose={() => setMenu(false)} nodes={nodes || []} cats={cats || []} /><SearchOverlay open={srch} onClose={() => setSrch(false)} /></>;
}
