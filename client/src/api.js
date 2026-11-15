export async function api(path, opts = {}) {
  const o = { credentials: 'same-origin', headers: {}, ...opts };
  if (o.body && !(o.body instanceof FormData)) { o.headers['content-type'] = 'application/json'; o.body = JSON.stringify(o.body); }
  const res = await fetch('/api' + path, o);
  let data = null; try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) { const e = new Error((data && data.error) || 'Request failed'); e.status = res.status; throw e; }
  return data;
}
