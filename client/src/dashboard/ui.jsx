import { useEffect } from 'react';
import { compact, dt } from '../lib.js';
import { useToast } from '../toast.jsx';

export const Pill = ({ s }) => <span className="pill" data-s={s}>{String(s).replace('_', ' ')}</span>;
export const Empty = ({ title, children }) => <div className="empty2"><b>{title}</b>{children}</div>;
export const Kpi = ({ label, value, sub }) => <div className="kpi"><small>{label}</small><b>{value}</b><span>{sub}</span></div>;
export const Greet = ({ name, sub, action }) => <div className="hello"><div><h2>Hello, <em>{name}</em></h2><p>{sub}</p></div>{action}</div>;
export const Loading = () => <div className="dcard"><Empty title="Loading…" /></div>;
export const Fail = ({ error }) => <div className="dcard"><Empty title="Could not load this page">{error?.message}</Empty></div>;
export const Banner = ({ children }) => <div className="banner">{children}</div>;

export function Table({ cols, children, empty = 'Nothing here yet', count }) {
  return <div className="tblwrap">{count === 0 ? <Empty title={empty} /> :
    <table className="tbl"><thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{children}</tbody></table>}</div>;
}

export function Bars({ data, fmt = compact }) {
  if (!data.length) return <Empty title="No data yet">Orders will appear here.</Empty>;
  const max = Math.max(...data.map(d => d.v), 1), W = 600, H = 210, bw = Math.min(54, W / data.length - 14);
  return <svg viewBox={`0 0 ${W} ${H + 28}`} role="img"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" /><stop offset="1" stopColor="var(--accent)" stopOpacity=".35" /></linearGradient></defs>
    {[0, .5, 1].map(f => <line key={f} x1="0" x2={W} y1={H - f * H + 4} y2={H - f * H + 4} stroke="rgba(37,35,42,.12)" />)}
    {data.map((d, i) => { const x = (i + .5) * (W / data.length) - bw / 2, h = Math.max(3, d.v / max * (H - 24));
      return <g key={d.l + i}><rect className="bar" x={x} y={H - h + 4} width={bw} height={h} stroke="#25232a" strokeWidth="2"><title>{d.l}: {fmt(d.v)}</title></rect>
        <text x={x + bw / 2} y={H - h - 2} textAnchor="middle">{fmt(d.v)}</text><text x={x + bw / 2} y={H + 22} textAnchor="middle">{d.l}</text></g>; })}</svg>;
}

const COLORS = ['var(--accent)', '#3a63c9', '#2c8f69', '#e0553a', '#ffd23f', '#923595', '#474647'];
export function Donut({ segs }) {
  const tot = segs.reduce((s, x) => s + x.v, 0);
  if (!tot) return <Empty title="No orders yet" />;
  const R = 70, C = 2 * Math.PI * R; let off = 0;
  return <><svg viewBox="0 0 200 200" style={{ maxWidth: 220, margin: 'auto' }}><circle cx="100" cy="100" r={R} fill="none" stroke="rgba(37,35,42,.08)" strokeWidth="26" />
    {segs.map((s, i) => { const l = s.v / tot * C, el = <circle key={s.l} cx="100" cy="100" r={R} fill="none" stroke={COLORS[i % 7]} strokeWidth="26" strokeDasharray={`${l} ${C - l}`} strokeDashoffset={-off} transform="rotate(-90 100 100)"><title>{s.l}: {s.v}</title></circle>; off += l; return el; })}
    <text x="100" y="98" textAnchor="middle" style={{ fill: '#25232a', fontSize: 34, fontFamily: 'var(--display)', fontWeight: 800 }}>{tot}</text><text x="100" y="118" textAnchor="middle">orders</text></svg>
    <div className="legend">{segs.map((s, i) => <div key={s.l}><i style={{ background: COLORS[i % 7] }} />{s.l}<span>{s.v}</span></div>)}</div></>;
}

export function HBars({ rows, fmt = compact }) {
  if (!rows.length) return <Empty title="Nothing here yet" />;
  const m = Math.max(...rows.map(r => r.v), 1);
  return <div className="hb">{rows.map(r => <div key={r.l}><small><span>{r.l}</span><b>{fmt(r.v)}</b></small><div className="tr"><i style={{ width: Math.max(2, r.v / m * 100) + '%' }} /></div></div>)}</div>;
}

export function Track({ status }) {
  const flow = ['confirmed', 'in_production', 'quality_check', 'shipped', 'delivered'];
  if (status === 'cancelled') return <p><Pill s="cancelled" /></p>;
  const i = flow.indexOf(status);
  return <div className="track">{flow.map((s, k) => <div key={s} className={'s' + (k <= i ? ' done' : '') + (k === i ? ' now' : '')}>{s.replace('_', ' ')}</div>)}</div>;
}

export function Modal({ title, onClose, children }) {
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="modal" role="dialog" aria-modal="true"><h3>{title}<button className="x" aria-label="Close" onClick={onClose}>×</button></h3>{children}</div></div>;
}

// Wraps an async action: disables, toasts, and reloads the view on success.
export function useAct(reload) {
  const toast = useToast();
  return async (fn, ok) => { try { await fn(); ok && toast(ok); reload && reload(); return true; } catch (e) { toast(e.message); return false; } };
}
export const Notice = ({ n }) => <li className={n.read ? '' : 'unread'}><a href={n.link}>{n.text}</a><small>{dt(n.created_at)}</small></li>;
