/* Page controllers for the public site. */
document.addEventListener('tbb:ready', () => {
  const { $, $$, esc, money, api, photo, img, toast, productCard, fabricField, observeReveals, getUser, BRAND } = TBB;
  const page = document.body.dataset.page;
  fabricField($('#phero-canvas'));
  fabricField($('#cta-canvas'));
  fabricField($('#auth-canvas'), { lines: 18 });

  const pages = {
    /* ───────────── Home ───────────── */
    async home() {
      api('/stats').then(s => ['products', 'sellers', 'orders'].forEach(k => { const el = $('#s-' + k); el.dataset.count = s[k]; el.dataset.obs = ''; TBB.countUp(el); })).catch(() => {});
      const cats = await api('/categories');
      $('#marquee').innerHTML = [...cats, ...cats].map(c => `<span>${esc(c.name)}</span>`).join('');
      $('#cats').innerHTML = cats.map((c, i) => `<a class="cat" href="/shop?cat=${c.id}" style="--c:${esc(c.color)};--d:${i * .06}s" data-reveal>${photo(c.image, c.name, '(max-width:700px) 50vw, 25vw', 900)}<span class="arrow"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span><h3>${esc(c.name)}</h3><p>${esc(c.blurb)} · ${c.count} styles</p></a>`).join('');
      const f = await api('/products?featured=1&limit=8');
      $('#featured').innerHTML = f.items.map(productCard).join('');
      observeReveals();
      const v = $('#reel'); if (v) { v.addEventListener('canplay', () => v.classList.add('ok')); new IntersectionObserver(e => e[0].isIntersecting ? v.play().catch(() => {}) : v.pause()).observe(v); }
    },

    /* ───────────── Catalogue ───────────── */
    async shop() {
      const st = { cat: new URLSearchParams(location.search).get('cat') || '', q: '', maxMoq: '', maxPrice: 0, sort: '', page: 1 };
      const cats = await api('/categories');
      const drawCats = () => $('#f-cats').innerHTML = `<button data-c="" class="${st.cat ? '' : 'on'}">All</button>` + cats.map(c => `<button data-c="${c.id}" class="${st.cat === c.id ? 'on' : ''}">${esc(c.name)}</button>`).join('');
      drawCats();
      let grid = $('#grid');
      const load = async (append = false) => {
        const qs = new URLSearchParams({ page: st.page, limit: 12 });
        if (st.cat) qs.set('cat', st.cat); if (st.q) qs.set('q', st.q); if (st.maxMoq) qs.set('maxMoq', st.maxMoq); if (st.maxPrice) qs.set('maxPrice', st.maxPrice); if (st.sort) qs.set('sort', st.sort);
        const r = await api('/products?' + qs);
        const html = r.items.map(productCard).join('');
        grid.innerHTML = append ? grid.innerHTML + html : (html || '<div class="empty">No products match your filters.</div>');
        $('#count').textContent = `${r.total} product${r.total === 1 ? '' : 's'}`;
        $('#more').hidden = r.page >= r.pages; observeReveals();
      };
      const reset = () => { st.page = 1; load(); };
      $('#f-cats').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; st.cat = b.dataset.c; drawCats(); reset(); });
      let t; $('#f-q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value.trim(); reset(); }, 300); });
      $('#f-moq').addEventListener('change', e => { st.maxMoq = e.target.value; reset(); });
      $('#f-price').addEventListener('input', e => { st.maxPrice = +e.target.value; $('#f-pv').textContent = st.maxPrice ? '₹' + st.maxPrice : 'Any'; clearTimeout(t); t = setTimeout(reset, 250); });
      $('#f-sort').addEventListener('change', e => { st.sort = e.target.value; reset(); });
      $('#more').addEventListener('click', () => { st.page++; load(true); });
      load();
    },

    /* ───────────── Product detail ───────────── */
    async product() {
      const slug = new URLSearchParams(location.search).get('p');
      let data;
      try { data = await api('/products/' + encodeURIComponent(slug || '')); } catch { $('#pinfo').innerHTML = '<h2 class="h3">Product not found</h2><p class="muted" style="margin:14px 0 24px">It may have been removed.</p><a class="btn btn-primary" href="/shop">Back to catalogue</a>'; return; }
      const p = data.product; document.title = `${p.name} — Wholesale | The Bulk Buyers`; $('#crumb').textContent = p.name;
      const stage = $('#stage'); stage.style.background = p.category_color || '#222';
      stage.innerHTML = photo(p.image, p.name, '(max-width:900px) 100vw, 50vw', 1600) + '<div class="hint">Move your cursor to tilt</div>';
      if (matchMedia('(pointer:fine)').matches) { const im = $('img', stage); stage.addEventListener('pointermove', e => { const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; im.style.transform = `scale(1.12) translate(${-x * 24}px,${-y * 24}px)`; }); stage.addEventListener('pointerleave', () => $('img', stage).style.transform = ''); $('img', stage).style.transition = 'transform .25s ease-out'; }
      const mid = Math.round((p.price_min + p.price_max) / 2);
      const tiers = [[p.moq, p.price_max], [p.moq * 2, mid], [p.moq * 5, p.price_min]];
      $('#pinfo').innerHTML = `
        <span class="eyebrow">${esc(p.category_name)}</span>
        <h1 class="h2" style="margin:14px 0 14px;font-size:clamp(32px,4vw,56px)">${esc(p.name)}</h1>
        <p class="lead muted">${esc(p.description)}</p>
        <div class="tiers">${tiers.map((t, i) => `<div class="tier ${i === 2 ? 'best' : ''}"><small>${t[0].toLocaleString('en-IN')}+ pcs</small><b>${money(t[1])}</b></div>`).join('')}<div class="tier"><small>Lead time</small><b>${p.lead_days} days</b></div></div>
        <p class="muted" style="font-size:12.5px;margin:-6px 0 8px">Indicative FOB prices per piece — the final price is set by seller quotes on your RFQ.</p>
        <table class="spec"><tr><td>Fabric</td><td>${esc(p.fabric)}</td></tr>${p.gsm ? `<tr><td>Weight</td><td>${p.gsm} ${p.gsm < 30 ? 'oz' : 'GSM'}</td></tr>` : ''}<tr><td>Fit</td><td>${esc(p.fit)}</td></tr><tr><td>Sizes</td><td>${esc(p.sizes)}</td></tr><tr><td>Colours</td><td>${p.colors.map(c => `<span class="sw" style="background:${esc(c)};display:inline-block;width:20px;height:20px;margin-right:6px;vertical-align:middle;cursor:default"></span>`).join('')}</td></tr><tr><td>Minimum order</td><td>${p.moq.toLocaleString('en-IN')} pcs</td></tr><tr><td>Supplier</td><td>${esc(p.seller_company || 'Verified seller')}</td></tr></table>
        <div class="panel" id="rfq-panel" style="padding:26px"><h3 class="h3" style="margin-bottom:16px">Request a quote</h3>
          <form class="form" id="rfq-form"><div class="row2"><label>Quantity (pcs)<input name="quantity" type="number" min="${p.moq}" value="${p.moq}" required></label><label>Target price / pc (₹)<input name="targetPrice" type="number" min="0" placeholder="${p.price_min}"></label></div>
          <label>Delivery destination<input name="destination" placeholder="City, Country" maxlength="120"></label><label>Notes<textarea name="notes" rows="2" maxlength="2000" placeholder="Colours, sizes split, labels, packaging…"></textarea></label>
          <div class="form-err" id="err" role="alert"></div><div style="display:flex;gap:10px"><button class="btn btn-primary" type="submit" style="flex:1;justify-content:center">Send RFQ</button><button type="button" class="icon-btn ${data.wished ? 'added' : ''}" id="wish" aria-label="Save to wishlist"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-8-5.3-8-11a5 5 0 019-3 5 5 0 019 3c0 5.7-8 11-8 11z"/></svg></button></div></form></div>`;
      $('#wish').addEventListener('click', e => TBB.wishToggle(p.id, e.currentTarget));
      $('#rfq-form').addEventListener('submit', async e => {
        e.preventDefault(); const u = await getUser();
        if (!u) return location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search);
        if (u.role !== 'buyer') return $('#err').textContent = 'Only buyer accounts can request quotes. Sign in with a buyer account.';
        const f = Object.fromEntries(new FormData(e.target)); const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
        try { await api('/rfqs', { method: 'POST', body: { ...f, productId: p.id } }); toast('RFQ sent — sellers will quote shortly'); setTimeout(() => location.href = '/dashboard#rfqs', 900); }
        catch (er) { $('#err').textContent = er.message; btn.disabled = false; }
      });
      if (data.related.length) { $('#rel-sec').hidden = false; $('#related').innerHTML = data.related.map(productCard).join(''); observeReveals(); }
    },

    /* ───────────── Contact ───────────── */
    contact() {
      $('#c-phone').innerHTML = `<b>Phone</b> — <a href="tel:${BRAND.phone.replace(/\s/g, '')}">${esc(BRAND.phone)}</a>`;
      $('#c-mail').innerHTML = `<b>Email</b> — <a href="mailto:${BRAND.email}">${esc(BRAND.email)}</a>`;
      $('#c-addr').innerHTML = `<b>Office</b> — ${esc(BRAND.address)}`;
      $('#contact-form').addEventListener('submit', async e => {
        e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
        try { await api('/inquiries', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); $('#c-ok').classList.add('show'); }
        catch (er) { toast(er.message); } btn.disabled = false;
      });
    },

    /* ───────────── Auth ───────────── */
    login() {
      const next = new URLSearchParams(location.search).get('next');
      getUser().then(u => { if (u) location.replace('/dashboard'); });
      $('#login-form').addEventListener('submit', async e => {
        e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; $('#err').textContent = '';
        try { await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'; }
        catch (er) { $('#err').textContent = er.message; btn.disabled = false; }
      });
    },
    register() {
      const qp = new URLSearchParams(location.search); let role = ['buyer', 'seller', 'agent'].includes(qp.get('role')) ? qp.get('role') : 'buyer';
      const notes = { buyer: 'Buyers can post RFQs, compare quotes and track orders instantly.', seller: 'Seller accounts are reviewed by our team before you can quote on RFQs. Add your GST for faster verification.', agent: 'You get a personal referral code and earn commission on delivered orders of buyers you refer.' };
      const setRole = r => { role = r; $$('#roles button').forEach(b => b.classList.toggle('on', b.dataset.role === r)); $('#role-note').textContent = notes[r]; };
      setRole(role); if (qp.get('ref')) $('[name=ref]').value = qp.get('ref');
      $('#roles').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setRole(b.dataset.role); });
      $('#reg-form').addEventListener('submit', async e => {
        e.preventDefault(); const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true; $('#err').textContent = '';
        try { await api('/auth/register', { method: 'POST', body: { ...Object.fromEntries(new FormData(e.target)), role } }); location.href = '/dashboard'; }
        catch (er) { $('#err').textContent = er.message; btn.disabled = false; }
      });
    }
  };
  if (pages[page]) pages[page]();
});
