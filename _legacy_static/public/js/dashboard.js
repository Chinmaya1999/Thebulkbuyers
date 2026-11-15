/* Role-based dashboards: admin · seller · buyer · agent */
document.addEventListener('tbb:ready', async () => {
  const { $, $$, esc, money, compact, api, img, toast, getUser } = TBB;
  const user = await getUser();
  if (!user) return location.replace('/login?next=/dashboard');
  const role = user.role;
  document.body.dataset.role = role;
  $('#boot').hidden = true; $('#shell').hidden = false;

  /* ───────── helpers ───────── */
  const I = { // icon paths
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z', users: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0',
    box: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8', file: 'M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6zM14 3v6h6M8 13h8M8 17h5',
    cart: 'M6 6h15l-2 9H8L6 6zm0 0L5 3H2M9 20a1 1 0 100-2 1 1 0 000 2zm9 0a1 1 0 100-2 1 1 0 000 2z', tag: 'M3 12V3h9l9 9-9 9-9-9zM7.5 7.5h.01',
    mail: 'M3 5h18v14H3zM3 7l9 7 9-7', cog: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z',
    heart: 'M12 21s-8-5.3-8-11a5 5 0 019-3 5 5 0 019 3c0 5.7-8 11-8 11z', plus: 'M12 5v14M5 12h14', user: 'M20 21a8 8 0 10-16 0M12 11a4 4 0 100-8 4 4 0 000 8z', link: 'M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1'
  };
  const ico = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${I[n]}"/></svg>`;
  const dt = s => s ? new Date(String(s).replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const mon = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short' });
  const pill = s => `<span class="pill" data-s="${esc(s)}">${esc(String(s).replace('_', ' '))}</span>`;
  const empty = (t, s = '') => `<div class="empty2"><b>${t}</b>${s}</div>`;
  const kpi = (label, val, sub = '') => `<div class="kpi"><small>${label}</small><b>${val}</b><span>${sub}</span></div>`;

  function bars(data, fmt = compact) {
    if (!data.length) return empty('No data yet', 'Orders will appear here.');
    const max = Math.max(...data.map(d => d.v), 1), W = 600, H = 210, bw = Math.min(54, W / data.length - 14);
    return `<svg viewBox="0 0 ${W} ${H + 28}" role="img"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent)" stop-opacity=".25"/></linearGradient></defs>
      ${[0, .5, 1].map(f => `<line x1="0" x2="${W}" y1="${H - f * H + 4}" y2="${H - f * H + 4}" stroke="rgba(255,255,255,.07)"/>`).join('')}
      ${data.map((d, i) => { const x = (i + .5) * (W / data.length) - bw / 2, h = Math.max(3, d.v / max * (H - 24)); return `<g><rect class="bar" x="${x}" y="${H - h + 4}" width="${bw}" height="${h}" rx="8"><title>${esc(d.l)}: ${fmt(d.v)}</title></rect><text x="${x + bw / 2}" y="${H - h - 2}" text-anchor="middle">${fmt(d.v)}</text><text x="${x + bw / 2}" y="${H + 22}" text-anchor="middle">${esc(d.l)}</text></g>`; }).join('')}</svg>`;
  }
  const COLORS = ['var(--accent)', '#8db4ff', '#2fd4a8', '#ff8a7a', '#c9a8ff', '#ffd166', '#6b6b70'];
  function donut(segs) {
    const tot = segs.reduce((s, x) => s + x.v, 0); if (!tot) return empty('No orders yet');
    let off = 0; const R = 70, C = 2 * Math.PI * R;
    return `<svg viewBox="0 0 200 200" style="max-width:220px;margin:auto"><circle cx="100" cy="100" r="${R}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="26"/>
      ${segs.map((s, i) => { const l = s.v / tot * C, el = `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${COLORS[i % 7]}" stroke-width="26" stroke-dasharray="${l} ${C - l}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)"><title>${esc(s.l)}: ${s.v}</title></circle>`; off += l; return el; }).join('')}
      <text x="100" y="98" text-anchor="middle" style="fill:#fff;font-size:30px;font-family:var(--display)">${tot}</text><text x="100" y="118" text-anchor="middle">orders</text></svg>
      <div class="legend">${segs.map((s, i) => `<div><i style="background:${COLORS[i % 7]}"></i>${esc(s.l)}<span>${s.v}</span></div>`).join('')}</div>`;
  }
  const hbars = (rows, fmt = compact) => { const m = Math.max(...rows.map(r => r.v), 1); return rows.length ? `<div class="hb">${rows.map(r => `<div><small><span>${esc(r.l)}</span><b>${fmt(r.v)}</b></small><div class="tr"><i style="width:${Math.max(2, r.v / m * 100)}%"></i></div></div>`).join('')}</div>` : empty('Nothing here yet'); };

  function modal(title, body, onMount) {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h3>${title}<button class="x" aria-label="Close">×</button></h3>${body}</div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
    $('.x', bg).onclick = close;
    onMount && onMount(bg, close);
    return close;
  }
  const trackHtml = status => {
    const flow = ['confirmed', 'in_production', 'quality_check', 'shipped', 'delivered'];
    if (status === 'cancelled') return `<p>${pill('cancelled')}</p>`;
    const i = flow.indexOf(status);
    return `<div class="track">${flow.map((s, k) => `<div class="s ${k <= i ? 'done' : ''} ${k === i ? 'now' : ''}">${s.replace('_', ' ')}</div>`).join('')}</div>`;
  };
  const optCats = (cats, sel = '') => cats.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const table = (cols, rows, emptyMsg = 'Nothing here yet') => rows.length
    ? `<div class="tblwrap"><table class="tbl"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
    : `<div class="tblwrap">${empty(emptyMsg)}</div>`;
  async function act(btn, fn, okMsg) {
    btn && (btn.disabled = true);
    try { await fn(); okMsg && toast(okMsg); await render(); refreshBell(); } catch (e) { toast(e.message); btn && (btn.disabled = false); }
  }
  let cache = {};
  const cats = async () => cache.cats || (cache.cats = await api('/categories'));

  /* ───────── navigation per role ───────── */
  const NAV = {
    admin: [['overview', 'Overview', 'grid'], ['users', 'Users', 'users'], ['products', 'Products', 'box'], ['rfqs', 'RFQs', 'file'], ['orders', 'Orders', 'cart'], ['categories', 'Categories', 'tag'], ['inquiries', 'Inquiries', 'mail'], ['settings', 'Settings', 'cog']],
    seller: [['overview', 'Overview', 'grid'], ['products', 'My products', 'box'], ['rfqs', 'RFQ board', 'file'], ['orders', 'Orders', 'cart'], ['profile', 'Profile', 'user']],
    buyer: [['overview', 'Overview', 'grid'], ['newrfq', 'New RFQ', 'plus'], ['rfqs', 'My RFQs', 'file'], ['orders', 'Orders', 'cart'], ['wishlist', 'Wishlist', 'heart'], ['profile', 'Profile', 'user']],
    agent: [['overview', 'Overview', 'grid'], ['referrals', 'Referrals', 'users'], ['profile', 'Profile', 'user']]
  }[role];
  const ROLE_LABEL = { admin: 'Administrator', seller: 'Manufacturer', buyer: 'Buyer', agent: 'Sourcing agent' };
  $('#rolebadge').textContent = ROLE_LABEL[role];
  $('#av').textContent = user.name.trim()[0].toUpperCase();
  $('#me-name').textContent = user.name; $('#me-mail').textContent = user.email;
  $('#snav').innerHTML = NAV.map(([k, l, i]) => `<a href="#${k}" data-k="${k}">${ico(i)}<span>${l}</span></a>`).join('');
  $('#logout').onclick = async () => { await api('/auth/logout', { method: 'POST' }); location.href = '/'; };
  $('#menu-btn').onclick = () => document.body.classList.toggle('nav-open');
  document.addEventListener('click', e => { if (e.target.closest('.snav a')) document.body.classList.remove('nav-open'); });

  /* ───────── notifications ───────── */
  async function refreshBell() {
    try {
      const n = await api('/notifications'); const dot = $('#bell-n'); dot.hidden = !n.unread; dot.textContent = n.unread;
      $('#notif').innerHTML = `<header>Notifications <button id="mark">Mark all read</button></header><ul>${n.items.length ? n.items.map(x => `<li class="${x.read ? '' : 'unread'}"><a href="${esc(x.link || '#overview')}">${esc(x.text)}</a><small>${dt(x.created_at)}</small></li>`).join('') : '<li>You\'re all caught up</li>'}</ul>`;
      $('#mark').onclick = async () => { await api('/notifications/read', { method: 'POST' }); refreshBell(); };
    } catch { /* ignore */ }
  }
  $('#bell').onclick = e => { e.stopPropagation(); $('#notif').hidden = !$('#notif').hidden; };
  document.addEventListener('click', e => { if (!e.target.closest('#notif')) $('#notif').hidden = true; });
  setInterval(refreshBell, 45000);

  /* ───────── views ───────── */
  const V = {};
  const greet = (sub, action = '') => `<div class="hello"><div><h2>Hello, <em>${esc(user.name.split(' ')[0])}</em></h2><p>${sub}</p></div>${action}</div>`;

  /* ======= ADMIN ======= */
  V.admin_overview = async () => {
    const s = await api('/admin/stats');
    return `${greet('Platform health at a glance.')}
    ${s.users.pending ? `<div class="banner"><b>${s.users.pending}</b> account(s) waiting for verification <a class="b p" href="#users" style="margin-left:auto">Review</a></div>` : ''}
    ${s.products.pending ? `<div class="banner"><b>${s.products.pending}</b> product(s) waiting for approval <a class="b p" href="#products" style="margin-left:auto">Review</a></div>` : ''}
    <div class="kpis">${kpi('GMV (gross)', compact(s.orders.gmv), `${s.orders.n} orders`)}${kpi('Platform revenue', compact(s.orders.revenue), 'commission earned')}${kpi('Active orders', s.orders.active || 0, 'in progress')}${kpi('Users', s.users.n, `${s.users.buyers} buyers · ${s.users.sellers} sellers · ${s.users.agents} agents`)}${kpi('Open RFQs', s.rfqs.open || 0, `of ${s.rfqs.n} total`)}${kpi('Live products', s.products.live || 0, `${s.products.pending || 0} pending`)}</div>
    <div class="g2 charts"><div class="dcard"><h3>Gross merchandise value</h3><div class="sub">Last 8 months</div>${bars(s.monthly.map(m => ({ l: mon(m.m), v: m.gmv })))}</div>
      <div class="dcard"><h3>Orders by status</h3><div class="sub">All time</div>${donut(s.byStatus.map(x => ({ l: x.status.replace('_', ' '), v: x.n })))}</div></div>
    <div class="g2e charts"><div class="dcard"><h3>Revenue by category</h3><div class="sub">Order value</div>${hbars(s.byCategory.filter(c => c.v > 0).map(c => ({ l: c.name, v: c.v })))}</div>
      <div class="dcard"><h3>Top sellers</h3><div class="sub">By order value</div>${hbars(s.topSellers.map(t => ({ l: t.company || t.name, v: t.v })))}</div></div>
    <div class="dcard charts"><h3>New sign-ups</h3><div class="sub">Per month</div>${bars(s.signups.map(m => ({ l: mon(m.m), v: m.n })), v => v)}</div>`;
  };
  V.admin_users = async () => {
    const us = await api('/admin/users');
    const row = u => `<tr data-q="${esc((u.name + u.email + u.company + u.role).toLowerCase())}" data-role="${u.role}"><td><div class="who"><div class="avatar" style="width:36px;height:36px">${esc(u.name[0])}</div><div>${esc(u.name)}<small>${esc(u.email)}</small></div></div></td><td>${pill(u.role)}</td><td>${esc(u.company || '—')}<small>${esc(u.country)}${u.gst ? ' · GST ' + esc(u.gst) : ''}</small></td><td>${pill(u.status)}</td><td>${u.orders}</td><td>${dt(u.created_at)}</td><td><div class="act">${u.role === 'admin' ? '' : u.status !== 'active' ? `<button class="b p" data-act="user" data-id="${u.id}" data-s="active">${u.status === 'pending' ? 'Verify' : 'Reactivate'}</button>` : ''}${u.role !== 'admin' && u.status !== 'suspended' ? `<button class="b d" data-act="user" data-id="${u.id}" data-s="suspended">Suspend</button>` : ''}</div></td></tr>`;
    return `${greet('Verify sellers and manage every account.')}
    <div class="tools"><input id="uq" type="search" placeholder="Search name, email, company…"><select id="ur"><option value="">All roles</option><option>buyer</option><option>seller</option><option>agent</option><option>admin</option></select></div>
    ${table(['User', 'Role', 'Company', 'Status', 'Orders', 'Joined', ''], us.map(row))}`;
  };
  V.admin_products = async () => {
    const ps = await api('/admin/products');
    return `${greet('Moderate listings before they go live.')}${table(['Product', 'Seller', 'MOQ', 'Price', 'Views', 'Status', ''], ps.map(p => `<tr><td><div class="who"><img class="thumb" src="${img(p.image, 120)}" alt=""><div><a href="/product?p=${esc(p.slug)}" target="_blank">${esc(p.name)}</a><small>${esc(p.category)}</small></div></div></td><td>${esc(p.seller_company || '—')}</td><td>${p.moq}</td><td>${money(p.price_min)}–${money(p.price_max)}</td><td>${p.views}</td><td>${pill(p.status)}${p.featured ? ' ★' : ''}</td><td><div class="act">${p.status !== 'approved' ? `<button class="b p" data-act="prod" data-id="${p.id}" data-s="approved">Approve</button>` : ''}${p.status !== 'rejected' ? `<button class="b d" data-act="prod" data-id="${p.id}" data-s="rejected">Reject</button>` : ''}<button class="b" data-act="feature" data-id="${p.id}" data-f="${p.featured ? 0 : 1}">${p.featured ? 'Unfeature' : 'Feature'}</button><button class="b d" data-act="delprod" data-id="${p.id}">Delete</button></div></td></tr>`))}`;
  };
  V.admin_rfqs = async () => {
    const rs = await api('/rfqs');
    return `${greet('Every buyer request on the platform.')}${table(['#', 'Request', 'Buyer', 'Qty', 'Target', 'Quotes', 'Status', 'Posted', ''], rs.map(r => `<tr><td>${r.id}</td><td>${esc(r.title)}<small>${esc(r.destination || '')}</small></td><td>${esc(r.buyer_company || r.buyer_name)}<small>${esc(r.buyer_country)}</small></td><td>${r.quantity.toLocaleString('en-IN')}</td><td>${r.target_price ? money(r.target_price) : '—'}</td><td>${r.quote_count}</td><td>${pill(r.status)}</td><td>${dt(r.created_at)}</td><td><button class="b" data-act="rfq" data-id="${r.id}">View</button></td></tr>`))}`;
  };
  V.admin_orders = async () => {
    const os = await api('/orders');
    return `${greet('Oversee fulfilment across all orders.')}${table(['#', 'Order', 'Buyer', 'Seller', 'Value', 'Commission', 'Status', 'Updated'], os.map(o => `<tr><td>${o.id}</td><td>${esc(o.title)}<small>${o.quantity.toLocaleString('en-IN')} pcs × ${money(o.unit_price)}</small></td><td>${esc(o.buyer_company || o.buyer_name)}</td><td>${esc(o.seller_company || o.seller_name)}</td><td>${money(o.total)}</td><td>${money(o.commission)}</td><td><select data-act="ostatus" data-id="${o.id}" style="padding:7px 10px;border-radius:10px;font-size:12.5px;width:auto">${['confirmed', 'in_production', 'quality_check', 'shipped', 'delivered', 'cancelled'].map(s => `<option ${s === o.status ? 'selected' : ''} value="${s}">${s.replace('_', ' ')}</option>`).join('')}</select></td><td>${dt(o.updated_at)}</td></tr>`))}`;
  };
  V.admin_categories = async () => {
    cache.cats = null; const cs = await cats();
    return `${greet('Organise the catalogue.', '<button class="btn btn-primary btn-sm" data-act="newcat">+ New category</button>')}${table(['Category', 'Description', 'Products', ''], cs.map(c => `<tr><td><div class="who"><span style="width:14px;height:14px;border-radius:50%;background:${esc(c.color)}"></span>${esc(c.name)}</div></td><td>${esc(c.blurb)}</td><td>${c.count}</td><td><div class="act"><button class="b" data-act="editcat" data-id="${c.id}">Edit</button><button class="b d" data-act="delcat" data-id="${c.id}">Delete</button></div></td></tr>`))}`;
  };
  V.admin_inquiries = async () => {
    const is = await api('/admin/inquiries');
    return `${greet('Messages from the contact form.')}<div class="cards-list">${is.length ? is.map(i => `<div class="ocard"><div class="hd"><div><h4>${esc(i.name)} <span class="muted">· ${esc(i.company || 'no company')}</span></h4><div class="muted"><a href="mailto:${esc(i.email)}">${esc(i.email)}</a> ${esc(i.phone || '')} · ${dt(i.created_at)}</div></div>${pill(i.status)}</div><p>${esc(i.message)}</p>${i.status === 'new' ? `<div class="foot"><button class="b p" data-act="inq" data-id="${i.id}">Mark handled</button></div>` : ''}</div>`).join('') : empty('No inquiries yet')}</div>`;
  };
  V.admin_settings = async () => {
    const s = await api('/admin/settings');
    return `${greet('Platform economics.')}<div class="dcard" style="max-width:560px"><form class="form" id="set-form"><label>Seller commission on confirmed orders (%)<input name="commission_pct" type="number" step="0.1" min="0" max="30" value="${s.commission_pct}"></label><label>Agent commission on referred buyers' delivered orders (%)<input name="agent_commission_pct" type="number" step="0.1" min="0" max="30" value="${s.agent_commission_pct}"></label><button class="btn btn-primary" type="submit">Save settings</button></form></div>`;
  };

  /* ======= SELLER ======= */
  V.seller_overview = async () => {
    const s = await api('/seller/summary');
    const pend = user.status !== 'active';
    return `${greet('Your storefront performance.', '<a class="btn btn-primary btn-sm" href="#products">Manage products</a>')}
    ${pend ? '<div class="banner"><b>Verification pending</b> — our team is reviewing your account. You can add products now; quoting on RFQs unlocks once verified.</div>' : ''}
    <div class="kpis">${kpi('Revenue', compact(s.orders.revenue), `${s.orders.n} orders`)}${kpi('Payout (delivered)', compact(s.orders.payout), 'after commission')}${kpi('Active orders', s.orders.active || 0, 'in progress')}${kpi('Open RFQs', s.openRfqs, 'awaiting your quote')}${kpi('Live products', s.products.live || 0, `${s.products.pending || 0} pending review`)}${kpi('Quote win rate', s.quotes.n ? Math.round((s.quotes.won || 0) / s.quotes.n * 100) + '%' : '—', `${s.quotes.won || 0} of ${s.quotes.n} quotes`)}</div>
    <div class="g2 charts"><div class="dcard"><h3>Monthly sales</h3><div class="sub">Order value</div>${bars(s.monthly.map(m => ({ l: mon(m.m), v: m.v })))}</div><div class="dcard"><h3>Catalogue views</h3><div class="sub">Total product views</div><div class="codebig" style="margin-top:20px">${s.products.views.toLocaleString('en-IN')}</div><p class="muted" style="margin-top:10px">Better photos and complete specs help buyers find and trust your styles.</p></div></div>`;
  };
  V.seller_products = async () => {
    const ps = await api('/seller/products');
    return `${greet('Every new or edited listing is reviewed before going live.', '<button class="btn btn-primary btn-sm" data-act="newprod">+ Add product</button>')}${table(['Product', 'MOQ', 'Price / pc', 'Lead', 'Views', 'Status', ''], ps.map(p => `<tr><td><div class="who"><img class="thumb" src="${img(p.image, 120)}" alt=""><div>${esc(p.name)}<small>${esc(p.category_name || '')}</small></div></div></td><td>${p.moq}</td><td>${money(p.price_min)}–${money(p.price_max)}</td><td>${p.lead_days}d</td><td>${p.views}</td><td>${pill(p.status)}</td><td><div class="act"><button class="b" data-act="editprod" data-id="${p.id}">Edit</button><button class="b d" data-act="mydel" data-id="${p.id}">Delete</button></div></td></tr>`), 'Add your first product to start receiving enquiries.')}`;
  };
  V.seller_rfqs = async () => {
    const rs = await api('/rfqs');
    return `${greet('Open buyer requests matching your catalogue. Quote to win orders.')}<div class="cards-list">${rs.length ? rs.map(r => `<div class="ocard"><div class="hd"><div><h4>${esc(r.title)}</h4><div class="muted">${esc(r.buyer_country)} · posted ${dt(r.created_at)}</div></div>${r.my_quote_id ? pill(r.my_quote_status) : pill(r.status)}</div><div class="meta"><span><b>${r.quantity.toLocaleString('en-IN')}</b> pcs</span><span>Target <b>${r.target_price ? money(r.target_price) : 'open'}</b></span><span>To <b>${esc(r.destination || '—')}</b></span>${r.needed_by ? `<span>Needed by <b>${esc(r.needed_by)}</b></span>` : ''}${r.my_quote_price ? `<span>Your quote <b>${money(r.my_quote_price)}</b></span>` : ''}</div>${r.notes ? `<p class="muted">“${esc(r.notes)}”</p>` : ''}${r.status === 'open' && (!r.my_quote_id || r.my_quote_status === 'pending') ? `<div class="foot"><button class="b p" data-act="quote" data-id="${r.id}">${r.my_quote_id ? 'Update quote' : 'Send quote'}</button></div>` : ''}</div>`).join('') : empty('No matching RFQs right now', 'New requests will notify you.')}</div>`;
  };
  const orderCards = (os, who) => `<div class="cards-list">${os.length ? os.map(o => `<div class="ocard"><div class="hd"><div><h4>#${o.id} · ${esc(o.title)}</h4><div class="muted">${who === 'seller' ? 'Buyer: ' + esc(o.buyer_company || o.buyer_name) : 'Seller: ' + esc(o.seller_company || o.seller_name)} · ${dt(o.created_at)}</div></div>${pill(o.status)}</div>${trackHtml(o.status)}<div class="meta"><span><b>${o.quantity.toLocaleString('en-IN')}</b> pcs</span><span>@ <b>${money(o.unit_price)}</b></span><span>Total <b>${money(o.total)}</b></span><span>To <b>${esc(o.destination || '—')}</b></span></div><div class="foot">${orderActions(o, who)}</div></div>`).join('') : empty('No orders yet')}</div>`;
  const NEXT = { confirmed: 'in_production', in_production: 'quality_check', quality_check: 'shipped' };
  function orderActions(o, who) {
    if (who === 'seller') return [NEXT[o.status] ? `<button class="b p" data-act="ostatus2" data-id="${o.id}" data-s="${NEXT[o.status]}">Mark ${NEXT[o.status].replace('_', ' ')}</button>` : '', o.status === 'confirmed' ? `<button class="b d" data-act="ostatus2" data-id="${o.id}" data-s="cancelled">Cancel</button>` : ''].join('');
    return [o.status === 'shipped' ? `<button class="b p" data-act="ostatus2" data-id="${o.id}" data-s="delivered">Confirm delivery</button>` : '', o.status === 'confirmed' ? `<button class="b d" data-act="ostatus2" data-id="${o.id}" data-s="cancelled">Cancel order</button>` : ''].join('');
  }
  V.seller_orders = async () => `${greet('Update progress so buyers can follow along.')}${orderCards(await api('/orders'), 'seller')}`;

  /* ======= BUYER ======= */
  V.buyer_overview = async () => {
    const [rfqs, orders] = await Promise.all([api('/rfqs'), api('/orders')]);
    const spend = orders.filter(o => o.status !== 'cancelled'), by = {};
    spend.forEach(o => { const m = o.created_at.slice(0, 7); by[m] = (by[m] || 0) + o.total; });
    const months = Object.keys(by).sort().slice(-8).map(m => ({ l: mon(m), v: by[m] }));
    const quotesWaiting = rfqs.filter(r => r.status === 'open' && r.quote_count).length;
    return `${greet('Your sourcing pipeline.', '<a class="btn btn-primary btn-sm" href="#newrfq">+ New RFQ</a>')}
    ${quotesWaiting ? `<div class="banner"><b>${quotesWaiting}</b> RFQ(s) have quotes to compare <a class="b p" href="#rfqs" style="margin-left:auto">Review quotes</a></div>` : ''}
    <div class="kpis">${kpi('Total spend', compact(spend.reduce((s, o) => s + o.total, 0)), `${spend.length} orders`)}${kpi('Open RFQs', rfqs.filter(r => r.status === 'open').length, 'awaiting quotes')}${kpi('In progress', orders.filter(o => ['confirmed', 'in_production', 'quality_check', 'shipped'].includes(o.status)).length, 'orders on the way')}${kpi('Delivered', orders.filter(o => o.status === 'delivered').length, 'completed orders')}</div>
    <div class="g2 charts"><div class="dcard"><h3>Spend by month</h3><div class="sub">Confirmed orders</div>${bars(months)}</div><div class="dcard"><h3>Order status</h3><div class="sub">All orders</div>${donut(Object.entries(orders.reduce((a, o) => (a[o.status] = (a[o.status] || 0) + 1, a), {})).map(([l, v]) => ({ l: l.replace('_', ' '), v })))}</div></div>`;
  };
  V.buyer_newrfq = async () => {
    const cs = await cats();
    return `${greet('Describe what you need — sellers will bid.')}<div class="dcard" style="max-width:780px"><form class="form" id="rfq-new"><label>What do you need?<input name="title" required maxlength="160" placeholder="e.g. 1,000 oversized black hoodies with embroidered logo"></label>
    <div class="row2"><label>Category<select name="category"><option value="">Select…</option>${optCats(cs)}</select></label><label>Quantity (pcs)<input name="quantity" type="number" min="1" required></label></div>
    <div class="row2"><label>Target price / pc (₹)<input name="targetPrice" type="number" min="0"></label><label>Needed by<input name="neededBy" type="date"></label></div>
    <label>Destination<input name="destination" placeholder="City, Country" maxlength="120"></label><label>Specs &amp; notes<textarea name="notes" rows="4" maxlength="2000" placeholder="Fabric, GSM, colours, size split, labels, packaging, samples…"></textarea></label>
    <div class="form-err" id="err"></div><button class="btn btn-primary" type="submit">Post RFQ</button></form></div>`;
  };
  V.buyer_rfqs = async () => {
    const rs = await api('/rfqs');
    return `${greet('Compare quotes and pick your supplier.', '<a class="btn btn-primary btn-sm" href="#newrfq">+ New RFQ</a>')}<div class="cards-list">${rs.length ? rs.map(r => `<div class="ocard"><div class="hd"><div><h4>#${r.id} · ${esc(r.title)}</h4><div class="muted">Posted ${dt(r.created_at)}</div></div>${pill(r.status)}</div><div class="meta"><span><b>${r.quantity.toLocaleString('en-IN')}</b> pcs</span><span>Target <b>${r.target_price ? money(r.target_price) : 'open'}</b></span><span>To <b>${esc(r.destination || '—')}</b></span><span><b>${r.quote_count}</b> quote(s)</span></div><div class="foot"><button class="b ${r.quote_count && r.status === 'open' ? 'p' : ''}" data-act="rfq" data-id="${r.id}">${r.quote_count ? 'View quotes' : 'Details'}</button>${r.status === 'open' ? `<button class="b d" data-act="closerfq" data-id="${r.id}">Close</button>` : ''}</div></div>`).join('') : empty('No RFQs yet', 'Post your first request and sellers will quote.')}</div>`;
  };
  V.buyer_orders = async () => `${greet('Track every order from factory to doorstep.')}${orderCards(await api('/orders'), 'buyer')}`;
  V.buyer_wishlist = async () => {
    const w = await api('/wishlist');
    return `${greet('Styles you saved for later.')}${w.length ? `<div class="wish">${w.map(p => `<a href="/product?p=${esc(p.slug)}"><img src="${img(p.image, 500)}" alt="${esc(p.name)}"><div><b>${esc(p.name)}</b><small>${money(p.price_min)}–${money(p.price_max)} · MOQ ${p.moq}</small></div></a>`).join('')}</div>` : `<div class="dcard">${empty('Nothing saved yet', '<a class="b p" href="/shop" style="margin-top:14px">Browse catalogue</a>')}</div>`}`;
  };

  /* ======= AGENT ======= */
  V.agent_overview = async () => {
    const a = await api('/agent/summary'), link = `${location.origin}/register?role=buyer&ref=${a.code}`;
    return `${greet('Refer buyers, earn on every delivered order.')}
    <div class="kpis">${kpi('Earned', compact(a.earned), `${a.rate}% of delivered value`)}${kpi('Pending commission', compact(a.pending), 'orders in progress')}${kpi('Referred users', a.referrals.length, 'signed up with your code')}${kpi('Trade value', compact(a.tradeValue), 'generated by referrals')}</div>
    <div class="g2"><div class="dcard"><h3>Your referral code</h3><div class="codebig">${esc(a.code)}</div><div class="share" style="margin-top:14px"><span style="flex:1">${esc(link)}</span><button class="b p" data-act="copy" data-t="${esc(link)}">Copy link</button></div></div>
    <div class="dcard charts"><h3>Referred trade value</h3><div class="sub">Per month</div>${bars(a.monthly.map(m => ({ l: mon(m.m), v: m.v })))}</div></div>`;
  };
  V.agent_referrals = async () => {
    const a = await api('/agent/summary');
    return `${greet('Everyone who joined using your code.')}${table(['User', 'Role', 'Company', 'Status', 'Orders', 'Delivered value', 'Joined'], a.referrals.map(r => `<tr><td>${esc(r.name)}</td><td>${pill(r.role)}</td><td>${esc(r.company || '—')}</td><td>${pill(r.status)}</td><td>${r.orders}</td><td>${money(r.delivered_value)}</td><td>${dt(r.created_at)}</td></tr>`), 'Share your code to get your first referral.')}`;
  };

  /* ======= SHARED ======= */
  const profile = async () => `${greet('Keep your details up to date.')}<div class="g2e"><div class="dcard"><h3>Account details</h3><form class="form" id="prof-form" style="margin-top:14px"><label>Full name<input name="name" value="${esc(user.name)}" required></label><label>Email<input value="${esc(user.email)}" disabled></label><div class="row2"><label>Company<input name="company" value="${esc(user.company)}"></label><label>Phone<input name="phone" value="${esc(user.phone)}"></label></div><div class="row2"><label>Country<input name="country" value="${esc(user.country)}"></label><label>GST / Tax ID<input name="gst" value="${esc(user.gst)}"></label></div><button class="btn btn-primary" type="submit">Save changes</button></form></div>
    <div class="dcard"><h3>Change password</h3><form class="form" id="pw-form" style="margin-top:14px"><label>Current password<input name="current" type="password" required autocomplete="current-password"></label><label>New password<input name="next" type="password" required minlength="8" autocomplete="new-password"></label><div class="form-err" id="pwerr"></div><button class="btn btn-primary" type="submit">Update password</button></form></div></div>`;
  V.seller_profile = V.buyer_profile = V.agent_profile = profile;

  /* ───────── router ───────── */
  const TITLES = Object.fromEntries(NAV.map(([k, l]) => [k, l]));
  async function render() {
    const k = NAV.some(n => n[0] === location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
    $$('#snav a').forEach(a => a.classList.toggle('on', a.dataset.k === k));
    $('#title').textContent = TITLES[k];
    const view = $('#view');
    try { view.innerHTML = await V[role + '_' + k](); } catch (e) { view.innerHTML = `<div class="dcard">${empty('Could not load this page', esc(e.message))}</div>`; }
    view.style.animation = 'none'; void view.offsetWidth; view.style.animation = '';
    bindView(k);
  }
  addEventListener('hashchange', () => { render(); scrollTo(0, 0); });

  /* ───────── interactions ───────── */
  const ACT = {
    user: (d, b) => act(b, () => api('/admin/users/' + d.id, { method: 'PUT', body: { status: d.s } }), 'User updated'),
    prod: (d, b) => act(b, () => api('/admin/products/' + d.id, { method: 'PUT', body: { status: d.s } }), 'Product ' + d.s),
    feature: (d, b) => act(b, () => api('/admin/products/' + d.id, { method: 'PUT', body: { featured: d.f === '1' } }), 'Updated'),
    delprod: (d, b) => confirm('Delete this product permanently?') && act(b, () => api('/admin/products/' + d.id, { method: 'DELETE' }), 'Deleted'),
    mydel: (d, b) => confirm('Delete this product?') && act(b, () => api('/seller/products/' + d.id, { method: 'DELETE' }), 'Deleted'),
    inq: (d, b) => act(b, () => api('/admin/inquiries/' + d.id, { method: 'PUT', body: { status: 'handled' } }), 'Marked handled'),
    ostatus2: (d, b) => (d.s !== 'cancelled' || confirm('Cancel this order?')) && act(b, () => api('/orders/' + d.id + '/status', { method: 'PUT', body: { status: d.s } }), 'Order updated'),
    closerfq: (d, b) => confirm('Close this RFQ? Sellers will no longer be able to quote.') && act(b, () => api('/rfqs/' + d.id + '/close', { method: 'PUT' }), 'RFQ closed'),
    copy: async d => { try { await navigator.clipboard.writeText(d.t); toast('Link copied'); } catch { toast(d.t); } },
    newcat: () => catModal(), editcat: async d => catModal((await cats()).find(c => c.id === d.id)),
    delcat: (d, b) => confirm('Delete this category?') && act(b, () => api('/admin/categories/' + d.id, { method: 'DELETE' }), 'Category deleted'),
    newprod: () => prodModal(), editprod: async d => prodModal((await api('/seller/products')).find(p => String(p.id) === d.id)),
    quote: d => quoteModal(d.id), rfq: d => rfqModal(d.id)
  };
  document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && b.tagName !== 'SELECT') { const f = ACT[b.dataset.act]; f && f(b.dataset, b); } });
  document.addEventListener('change', e => { const s = e.target; if (s.dataset?.act === 'ostatus') act(s, () => api('/orders/' + s.dataset.id + '/status', { method: 'PUT', body: { status: s.value } }), 'Order updated'); });

  function bindView(k) {
    const on = (sel, fn) => { const el = $(sel); el && el.addEventListener('submit', fn); };
    if (k === 'users') { const f = () => { const q = $('#uq').value.toLowerCase(), r = $('#ur').value; $$('.tbl tbody tr').forEach(tr => tr.hidden = (q && !tr.dataset.q.includes(q)) || (r && tr.dataset.role !== r)); }; $('#uq').oninput = f; $('#ur').onchange = f; }
    on('#set-form', async e => { e.preventDefault(); await act(null, () => api('/admin/settings', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }), 'Settings saved'); });
    on('#prof-form', async e => { e.preventDefault(); try { await api('/auth/me', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); toast('Profile saved'); Object.assign(user, Object.fromEntries(new FormData(e.target))); $('#me-name').textContent = user.name; } catch (er) { toast(er.message); } });
    on('#pw-form', async e => { e.preventDefault(); try { await api('/auth/password', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); $('#pwerr').textContent = ''; toast('Password updated'); } catch (er) { $('#pwerr').textContent = er.message; } });
    on('#rfq-new', async e => {
      e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
      try { await api('/rfqs', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('RFQ posted — sellers are being notified'); location.hash = '#rfqs'; }
      catch (er) { $('#err').textContent = er.message; btn.disabled = false; }
    });
  }

  async function catModal(c) {
    modal(c ? 'Edit category' : 'New category', `<form class="form" id="cat-f"><label>Name<input name="name" required value="${esc(c?.name || '')}"></label><label>Description<input name="blurb" value="${esc(c?.blurb || '')}"></label><label>Accent colour<input name="color" type="color" value="${esc(c?.color || '#ff5a2c')}" style="height:48px;padding:4px"></label><button class="btn btn-primary" type="submit">Save</button></form>`, (bg, close) => {
      $('#cat-f', bg).onsubmit = async e => { e.preventDefault(); const body = Object.fromEntries(new FormData(e.target)); await act(null, () => api(c ? '/admin/categories/' + c.id : '/admin/categories', { method: c ? 'PUT' : 'POST', body }), 'Saved'); close(); };
    });
  }

  async function prodModal(p) {
    const cs = await cats(); p = p || {};
    modal(p.id ? 'Edit product' : 'Add product', `<form class="form" id="prod-f">
      <label>Product name<input name="name" required maxlength="120" value="${esc(p.name || '')}"></label>
      <div class="row2"><label>Category<select name="category" required>${optCats(cs, p.category)}</select></label><label>Fabric<input name="fabric" value="${esc(p.fabric || '')}" placeholder="100% Combed Cotton"></label></div>
      <div class="row2"><label>GSM<input name="gsm" type="number" min="0" value="${p.gsm || ''}"></label><label>Fit<input name="fit" value="${esc(p.fit || '')}" placeholder="Regular"></label></div>
      <div class="row2"><label>Min. order qty<input name="moq" type="number" min="1" required value="${p.moq || 300}"></label><label>Lead time (days)<input name="lead_days" type="number" min="1" value="${p.lead_days || 30}"></label></div>
      <div class="row2"><label>Price min (₹/pc)<input name="price_min" type="number" min="1" step="any" required value="${p.price_min || ''}"></label><label>Price max (₹/pc)<input name="price_max" type="number" min="1" step="any" required value="${p.price_max || ''}"></label></div>
      <div class="row2"><label>Sizes<input name="sizes" value="${esc(p.sizes || 'S–3XL')}"></label><label>Colours (hex, comma separated)<input name="colors" value="${esc((p.colors || []).join(', '))}" placeholder="#111111, #1f3a5f"></label></div>
      <label>Description<textarea name="description" rows="3" maxlength="2000">${esc(p.description || '')}</textarea></label>
      <label>Photo<div class="upl"><img id="prev" src="${p.image ? img(p.image, 200) : 'data:image/gif;base64,R0lGODlhAQABAAAAACw='}" alt=""><input type="file" id="file" accept="image/jpeg,image/png,image/webp"></div></label><input type="hidden" name="image" value="${esc(p.image || '')}">
      <div class="form-err" id="perr"></div><button class="btn btn-primary" type="submit">${p.id ? 'Save & resubmit' : 'Submit for approval'}</button></form>`, (bg, close) => {
      const f = $('#prod-f', bg);
      $('#file', bg).onchange = async e => {
        const file = e.target.files[0]; if (!file) return; const fd = new FormData(); fd.append('image', file);
        try { const r = await api('/seller/upload', { method: 'POST', body: fd }); f.image.value = r.url; $('#prev', bg).src = r.url; } catch (er) { $('#perr', bg).textContent = er.message; }
      };
      f.onsubmit = async e => {
        e.preventDefault(); const body = Object.fromEntries(new FormData(f));
        try { await api(p.id ? '/seller/products/' + p.id : '/seller/products', { method: p.id ? 'PUT' : 'POST', body }); close(); toast('Submitted for admin approval'); render(); }
        catch (er) { $('#perr', bg).textContent = er.message; }
      };
    });
  }

  async function quoteModal(id) {
    const { rfq, quotes } = await api('/rfqs/' + id), mine = quotes[0];
    modal('Quote: ' + esc(rfq.title), `<p class="muted" style="margin-bottom:16px">${rfq.quantity.toLocaleString('en-IN')} pcs → ${esc(rfq.destination || 'destination open')} · target ${rfq.target_price ? money(rfq.target_price) : 'open'}</p>${rfq.notes ? `<p style="margin-bottom:16px">“${esc(rfq.notes)}”</p>` : ''}
      <form class="form" id="q-f"><div class="row2"><label>Your price / pc (₹)<input name="price" type="number" min="1" step="any" required value="${mine?.price || ''}"></label><label>Lead time (days)<input name="leadDays" type="number" min="1" max="365" required value="${mine?.lead_days || 30}"></label></div><label>Terms &amp; notes<textarea name="notes" rows="3" maxlength="1000" placeholder="Incoterm, payment terms, sample availability…">${esc(mine?.notes || '')}</textarea></label><div class="form-err" id="qerr"></div><button class="btn btn-primary" type="submit">${mine ? 'Update quote' : 'Send quote'}</button></form>`, (bg, close) => {
      $('#q-f', bg).onsubmit = async e => { e.preventDefault(); try { await api('/rfqs/' + id + '/quotes', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); close(); toast('Quote sent'); render(); } catch (er) { $('#qerr', bg).textContent = er.message; } };
    });
  }

  async function rfqModal(id) {
    const { rfq, quotes } = await api('/rfqs/' + id);
    const canAccept = role === 'buyer' && rfq.status === 'open';
    modal(esc(rfq.title), `<div class="meta" style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:16px;font-size:14px"><span><b>${rfq.quantity.toLocaleString('en-IN')}</b> pcs</span><span>Target <b>${rfq.target_price ? money(rfq.target_price) : 'open'}</b></span><span>To <b>${esc(rfq.destination || '—')}</b></span>${pill(rfq.status)}</div>${rfq.notes ? `<p class="muted" style="margin-bottom:18px">“${esc(rfq.notes)}”</p>` : ''}<h4 style="margin-bottom:10px">Quotes (${quotes.length})</h4>
      ${quotes.length ? `<div class="cards-list">${quotes.map((q, i) => `<div class="ocard"><div class="hd"><div><h4>${esc(q.seller_company || q.seller_name)} ${i === 0 && quotes.length > 1 ? '<span class="pill ok">Lowest</span>' : ''}</h4><div class="muted">${esc(q.notes || 'No notes')}</div></div>${pill(q.status)}</div><div class="meta"><span><b>${money(q.price)}</b> / pc</span><span>Total <b>${money(q.price * rfq.quantity)}</b></span><span>Lead <b>${q.lead_days} days</b></span></div>${canAccept && q.status === 'pending' ? `<div class="foot"><button class="b p" data-accept="${q.id}">Accept &amp; create order</button></div>` : ''}</div>`).join('')}</div>` : '<p class="muted">No quotes yet — sellers have been notified.</p>'}`, (bg, close) => {
      bg.addEventListener('click', async e => { const b = e.target.closest('[data-accept]'); if (!b || !confirm('Accept this quote and create the order?')) return; b.disabled = true; try { await api('/quotes/' + b.dataset.accept + '/accept', { method: 'POST' }); close(); toast('Order created 🎉'); location.hash = '#orders'; render(); } catch (er) { toast(er.message); b.disabled = false; } });
    });
  }

  refreshBell();
  render();
});
