/* The Bulk Buyers — shared front-end runtime */
(() => {
  // ───────── Brand config (edit these) ─────────
  const BRAND = {
    name: 'The Bulk Buyers',
    phone: '+91 00000 00000',
    whatsapp: '910000000000', // country code + number, no "+"
    email: 'hello@thebulkbuyers.com',
    address: 'Your Office Address, City, State, India'
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  const compact = n => { n = Number(n) || 0; return n >= 1e7 ? '₹' + (n / 1e7).toFixed(2) + ' Cr' : n >= 1e5 ? '₹' + (n / 1e5).toFixed(2) + ' L' : n >= 1e3 ? '₹' + (n / 1e3).toFixed(1) + 'K' : '₹' + Math.round(n); };

  async function api(path, opts = {}) {
    const o = { credentials: 'same-origin', headers: {}, ...opts };
    if (o.body && !(o.body instanceof FormData)) { o.headers['content-type'] = 'application/json'; o.body = JSON.stringify(o.body); }
    const res = await fetch('/api' + path, o);
    let data = null; try { data = await res.json(); } catch { /* empty */ }
    if (!res.ok) { const e = new Error((data && data.error) || 'Request failed'); e.status = res.status; throw e; }
    return data;
  }

  // Unsplash photos are requested at the size we need (up to 4K) in modern formats.
  const img = (url, w = 800) => !url ? '' : url.includes('images.unsplash.com') ? `${url}?w=${w}&q=80&auto=format&fit=crop` : url;
  const srcset = (url, sizes = [480, 800, 1200, 1800, 2400, 3200]) => url && url.includes('images.unsplash.com') ? sizes.map(w => `${img(url, w)} ${w}w`).join(', ') : '';
  const photo = (url, alt, sizes = '(max-width:700px) 90vw, 33vw', w = 800) =>
    `<img class="photo" loading="lazy" decoding="async" alt="${esc(alt)}" src="${img(url, w)}" ${srcset(url) ? `srcset="${srcset(url)}" sizes="${sizes}"` : ''}>`;

  let userP;
  const getUser = (force) => (userP = (!force && userP) || api('/auth/me').then(r => r.user).catch(() => null));

  function toast(msg) {
    let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3200);
  }

  // ───────── Layout ─────────
  const logoSvg = `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="14" fill="#ff5a2c"/><path d="M16 12l-8 6 4 6 4-2v16h16V22l4 2 4-6-8-6c-1 3-4 5-8 5s-7-2-8-5z" fill="#120600"/></svg>`;
  const arrow = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

  function buildLayout() {
    const path = location.pathname.replace(/\.html$/, '');
    const on = p => (path === p || (p !== '/' && path.startsWith(p))) ? 'on' : '';
    const nav = $('#nav');
    if (nav) nav.outerHTML = `
    <header class="nav" id="nav"><div class="wrap">
      <a href="/" class="logo" aria-label="${BRAND.name} home">${logoSvg}<span>${BRAND.name}</span></a>
      <nav class="menu" id="menu" aria-label="Main">
        <a href="/" class="${path === '/' || path === '/index' ? 'on' : ''}">Home</a>
        <a href="/shop" class="${on('/shop') || on('/product')}">Catalogue</a>
        <a href="/#how">How it works</a>
        <a href="/about" class="${on('/about')}">About</a>
        <a href="/contact" class="${on('/contact')}">Contact</a>
      </nav>
      <div class="nav-cta" id="nav-cta"><a href="/login" class="btn btn-ghost btn-sm">Sign in</a><a href="/register" class="btn btn-primary btn-sm">Join free</a></div>
      <button class="burger" id="burger" aria-label="Menu"><span><i></i><i></i></span></button>
    </div></header>`;
    const foot = $('#foot');
    if (foot) foot.outerHTML = `
    <footer class="footer"><div class="wrap">
      <div class="fgrid">
        <div><a href="/" class="logo">${logoSvg}<span>${BRAND.name}</span></a>
          <p class="muted" style="margin-top:18px;max-width:34ch">India's B2B marketplace for garments &amp; apparel. Post an RFQ, compare verified manufacturer quotes, and track every order to your door.</p></div>
        <div><h5>Marketplace</h5><ul><li><a href="/shop">Catalogue</a></li><li><a href="/register?role=buyer">Join as buyer</a></li><li><a href="/register?role=seller">Become a seller</a></li><li><a href="/register?role=agent">Sourcing agents</a></li></ul></div>
        <div><h5>Company</h5><ul><li><a href="/about">About us</a></li><li><a href="/contact">Contact</a></li><li><a href="/#faq">FAQ</a></li><li><a href="/login">Sign in</a></li></ul></div>
        <div><h5>Reach us</h5><ul><li><a href="tel:${BRAND.phone.replace(/\s/g, '')}">${BRAND.phone}</a></li><li><a href="mailto:${BRAND.email}">${BRAND.email}</a></li><li class="muted">${esc(BRAND.address)}</li></ul></div>
      </div>
      <div class="big" aria-hidden="true">BULK BUYERS</div>
      <div class="fbot"><span>© ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.</span><span>Garments &amp; Apparel · Wholesale · Private label</span></div>
    </div></footer>
    <a class="wa" href="https://wa.me/${BRAND.whatsapp}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1.1.1-3.6-.9-3-1.3-4.9-4.4-5.1-4.6-.1-.2-1.2-1.6-1.2-3s.8-2.1 1-2.4c.3-.3.6-.3.8-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.1.1.6-.1 1.1z"/></svg></a>`;

    if (!$('#progress')) document.body.insertAdjacentHTML('afterbegin', '<div id="progress"></div><div id="glow"></div>');
    $('#burger')?.addEventListener('click', () => $('#menu').classList.toggle('open'));
    $$('#menu a').forEach(a => a.addEventListener('click', () => $('#menu').classList.remove('open')));

    // Swap nav CTA once we know who is signed in.
    getUser().then(u => {
      const cta = $('#nav-cta'); if (!u || !cta) return;
      cta.innerHTML = `<a href="/dashboard" class="btn btn-primary btn-sm">${esc(u.name.split(' ')[0])}'s dashboard ${arrow}</a>`;
    });
  }

  // ───────── Motion ─────────
  function motion() {
    const prog = $('#progress'), nav = $('#nav'), glow = $('#glow');
    let lastY = 0;
    addEventListener('scroll', () => {
      const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
      if (prog) prog.style.width = (h > 0 ? y / h * 100 : 0) + '%';
      if (nav) { nav.classList.toggle('stuck', y > 40); nav.classList.toggle('hide', y > 500 && y > lastY + 4 && !$('#menu')?.classList.contains('open')); if (y < lastY - 4) nav.classList.remove('hide'); }
      lastY = y;
    }, { passive: true });
    if (glow && matchMedia('(pointer:fine)').matches) addEventListener('pointermove', e => { glow.style.left = e.clientX + 'px'; glow.style.top = e.clientY + 'px'; }, { passive: true });

    // split-line headings
    $$('.split').forEach(el => {
      if (el.dataset.done) return; el.dataset.done = 1;
      const lines = el.innerHTML.split(/<br\s*\/?>/i);
      el.innerHTML = lines.map(l => `<span class="ln"><span>${l}</span></span>`).join('');
      $$('.ln>span', el).forEach((s, i) => s.style.transitionDelay = i * .12 + 's');
    });
    observeReveals();

    // 3D tilt on cards
    if (matchMedia('(pointer:fine)').matches) document.addEventListener('pointermove', e => {
      const c = e.target.closest?.('.cat'); if (!c) return;
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      c.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(0)`;
    }, { passive: true });
    document.addEventListener('pointerout', e => { const c = e.target.closest?.('.cat'); if (c) c.style.transform = ''; });
    const pre = $('#pre'); if (pre) setTimeout(() => pre.classList.add('done'), 1100);
  }

  let io;
  function observeReveals(root = document) {
    io = io || new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in'); io.unobserve(e.target);
      if (e.target.dataset.count) countUp(e.target);
    }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    $$('[data-reveal],.split,.step,[data-count]', root).forEach(el => { if (!el.dataset.obs) { el.dataset.obs = 1; io.observe(el); } });
  }
  function countUp(el) {
    const to = Number(el.dataset.count) || 0, suf = el.dataset.suffix || '', t0 = performance.now(), dur = 1600;
    const tick = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4); el.textContent = Math.round(to * e).toLocaleString('en-IN') + suf; if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  // ───────── Reusable view bits ─────────
  function productCard(p) {
    const dots = (p.colors || []).slice(0, 5).map(c => `<i style="background:${esc(c)}"></i>`).join('');
    return `<a class="pcard" href="/product?p=${encodeURIComponent(p.slug)}" data-reveal>
      <div class="pimg" style="--bg:${esc(p.category_color || '#222')}">${photo(p.image, p.name)}<span class="badge">${esc(p.category_name || '')}</span><span class="dots">${dots}</span></div>
      <div class="pbody"><h3>${esc(p.name)}</h3>
        <div class="meta"><span class="chip">${esc(p.fabric.split(' ').slice(0, 3).join(' '))}</span>${p.gsm ? `<span class="chip">${p.gsm} GSM</span>` : ''}<span class="chip">${esc(p.fit)}</span></div>
        <div class="price"><div><b>${money(p.price_min)}–${money(p.price_max)}</b><small>per piece · FOB</small></div><div style="text-align:right"><b style="font-size:17px">${p.moq.toLocaleString('en-IN')}</b><small>MOQ pcs</small></div></div>
      </div></a>`;
  }

  // Flowing fabric-thread lines for hero strips / CTAs (cheap 2D canvas).
  function fabricField(canvas, { color = '255,90,44', lines = 14 } = {}) {
    if (!canvas || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    const ctx = canvas.getContext('2d'); let w, h, vis = true, t = 0;
    const size = () => { const r = canvas.getBoundingClientRect(), d = Math.min(2, devicePixelRatio); w = canvas.width = r.width * d; h = canvas.height = r.height * d; };
    size(); addEventListener('resize', size);
    new IntersectionObserver(e => vis = e[0].isIntersecting).observe(canvas);
    (function draw() {
      requestAnimationFrame(draw); if (!vis) return; t += .004; ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < lines; i++) {
        ctx.beginPath(); const yb = h * (i + 1) / (lines + 1);
        for (let x = 0; x <= w; x += 14) { const y = yb + Math.sin(x * .0035 + t * (1 + i * .05) + i) * h * .06 + Math.sin(x * .009 - t * 1.4 + i * 2) * h * .02; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = `rgba(${color},${.05 + (i % 4) * .045})`; ctx.lineWidth = 1.2 * Math.min(2, devicePixelRatio); ctx.stroke();
      }
    })();
  }

  async function wishToggle(id, btn) {
    const u = await getUser(); if (!u) return location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search);
    try { const r = await api('/wishlist/' + id, { method: 'POST' }); btn?.classList.toggle('added', r.wished); toast(r.wished ? 'Saved to wishlist' : 'Removed from wishlist'); } catch (e) { toast(e.message); }
  }

  window.TBB = { BRAND, $, $$, esc, money, compact, api, img, srcset, photo, getUser, toast, productCard, fabricField, observeReveals, arrow, wishToggle, countUp };
  document.addEventListener('DOMContentLoaded', () => { buildLayout(); motion(); document.dispatchEvent(new Event('tbb:ready')); });
})();
