import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { useToast } from '../toast.jsx';
import { compact, dt, money, num } from '../lib.js';
import { Banner, Empty, Fail, Greet, Kpi, Loading, Pill, Table } from './ui.jsx';

const View = ({ r, children }) => r.loading && !r.data ? <Loading /> : r.error ? <Fail error={r.error} /> : children(r.data);
const first = u => u.name.split(' ')[0];
const linkFor = code => `${location.origin}/register?ref=${code}`;

export function AgentOverview({ user }) {
  const r = useAsync(() => api('/agent/summary')), toast = useToast();
  const copy = async text => { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast(text); } };
  return <View r={r}>{d => <>
    <Greet name={first(user)} sub="Your referrals and commission at a glance." />
    <Banner><span>Your referral code: <b>{d.code}</b></span>
      <button className="b p" style={{ marginLeft: 'auto' }} onClick={() => copy(linkFor(d.code))}>Copy referral link</button></Banner>
    <div className="kpis">
      <Kpi label="Referred buyers" value={d.totals.buyers} sub="signed up with your code" />
      <Kpi label="Orders" value={d.totals.orders} sub="from your buyers" />
      <Kpi label="Delivered value" value={compact(d.totals.delivered_value)} sub="taxable, delivered orders" />
      <Kpi label="Commission earned" value={money(d.totals.earned)} sub={`${d.rate_pct}% of delivered orders`} />
      <Kpi label="Commission pending" value={money(d.totals.pending)} sub="on orders not yet delivered" /></div>
    <div className="dcard"><h3>How it works</h3><p className="mute" style={{ marginTop: 8 }}>Share your link or code. Buyers who register with it are linked to you, and you earn {d.rate_pct}% commission on each of their orders once it is delivered.</p></div></>}</View>;
}

export function AgentBuyers({ user }) {
  const r = useAsync(() => api('/agent/summary'));
  return <View r={r}>{d => <>
    <Greet name={first(user)} sub="Buyers who joined with your referral code." />
    <div className="dcard"><Table cols={['Buyer', 'Joined', 'Orders', 'Delivered value', 'In progress', 'Last order']} count={d.buyers.length} empty="No referred buyers yet — share your referral link.">
      {d.buyers.map(b => <tr key={b.id}><td><b>{b.name}</b><br /><span className="mute">{b.company || '—'}</span></td><td>{dt(b.created_at)}</td><td>{num(b.orders)}</td><td className="num">{money(b.delivered)}</td><td className="num">{money(b.in_progress)}</td><td>{b.last_order ? dt(b.last_order) : '—'}</td></tr>)}</Table></div></>}</View>;
}

export function AgentCommissions({ user }) {
  const r = useAsync(() => api('/agent/summary'));
  return <View r={r}>{d => <>
    <Greet name={first(user)} sub={`Commission is ${d.rate_pct}% of the order value, earned when an order is delivered.`} />
    <div className="kpis"><Kpi label="Earned" value={money(d.totals.earned)} sub="delivered orders" /><Kpi label="Pending" value={money(d.totals.pending)} sub="awaiting delivery" /></div>
    <div className="dcard"><Table cols={['Order', 'Buyer', 'Value', 'Status', 'Commission']} count={d.orders.length} empty="No orders from your buyers yet.">
      {d.orders.map(o => <tr key={o.id}><td><b>#{o.id}</b> · {o.title}<br /><span className="mute">{dt(o.created_at)}</span></td><td>{o.buyer_name}<br /><span className="mute">{o.buyer_company || ''}</span></td><td className="num">{money(o.total)}</td><td><Pill s={o.status} /></td><td className="num">{o.status === 'delivered' ? <b>{money(o.earned)}</b> : <span className="mute">{money(o.expected)} expected</span>}</td></tr>)}</Table></div></>}</View>;
}
