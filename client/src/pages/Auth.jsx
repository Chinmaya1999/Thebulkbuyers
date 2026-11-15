import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { safeNext, unsplash } from '../lib.js';

const Side = ({ title, text }) => <aside className="authimg"><img src={unsplash('photo-1539533018447-63fcce2678e3', 1600)} alt="" /><div className="cap"><h2 className="display h-lg" style={{ color: '#fff' }}>{title}</h2><p style={{ marginTop: 10, maxWidth: '38ch', opacity: .9 }}>{text}</p></div></aside>;

export function Login() {
  const [sp] = useSearchParams(), nav = useNavigate(), { user, refresh } = useAuth(), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  if (user) return <Navigate to={safeNext(sp.get('next'))} replace />;
  const submit = async e => { e.preventDefault(); setBusy(true); setErr(''); try { await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); await refresh(); nav(safeNext(sp.get('next')), { replace: true }); } catch (er) { setErr(er.message); setBusy(false); } };
  return <div className="authwrap"><Side title="Welcome back" text="Reorder, track shipments and download GST invoices." />
    <div className="authmain"><div className="authbox"><p className="eyebrow">Business account</p><h1 className="display h-lg" style={{ margin: '10px 0 28px' }}>Sign in</h1>
      <form className="form" onSubmit={submit}><label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
        <div className="form-err" role="alert">{err}</div><button className="btn block" disabled={busy}>Sign in</button></form>
      <p className="mute" style={{ marginTop: 22 }}>New to Bulk Buyers? <Link to={'/register' + (sp.get('next') ? '?next=' + encodeURIComponent(sp.get('next')) : '')} className="link">Create a business account</Link></p></div></div></div>;
}

const NOTES = { buyer: 'Order in bulk, request quotations, track orders and download GST invoices.', seller: 'Manufacturer accounts are reviewed by our team before you can quote on RFQs. Add your GSTIN for faster verification.', agent: 'Get a personal referral code and earn commission on delivered orders of buyers you refer.' };
const ROLES = [['buyer', 'Buyer', 'Source in bulk']]; // manufacturer and agent accounts are created by the admin team
export function Register() {
  const [sp] = useSearchParams(), nav = useNavigate(), { user, refresh } = useAuth(), [role, setRole] = useState(ROLES.some(r => r[0] === sp.get('role')) ? sp.get('role') : 'buyer'), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { const r = sp.get('role'); if (ROLES.some(x => x[0] === r)) setRole(r); }, [sp]);
  const next = safeNext(sp.get('next'));
  if (user) return <Navigate to={next} replace />;
  const submit = async e => { e.preventDefault(); setBusy(true); setErr(''); try { await api('/auth/register', { method: 'POST', body: { ...Object.fromEntries(new FormData(e.target)), role } }); await refresh(); nav(next, { replace: true }); } catch (er) { setErr(er.message); setBusy(false); } };
  return <div className="authwrap"><Side title="Source smarter" text="Compare wholesale prices, order by size and colour, and simplify bulk purchasing." />
    <div className="authmain"><div className="authbox"><p className="eyebrow">Join free</p><h1 className="display h-lg" style={{ margin: '10px 0 22px' }}>Create a business account</h1>
            <form className="form" style={{ marginTop: 20 }} onSubmit={submit}>
        <div className="row2"><label>Full name<input name="name" required maxLength={80} autoComplete="name" /></label><label>Email<input name="email" type="email" required autoComplete="email" /></label></div>
        <div className="row2"><label>Company<input name="company" maxLength={120} autoComplete="organization" /></label><label>Phone<input name="phone" autoComplete="tel" /></label></div>
        <div className="row2"><label>Country<input name="country" defaultValue="India" /></label><label>GSTIN (optional)<input name="gst" maxLength={20} /></label></div>
        <div className="row2"><label>Password<input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="8+ characters, letters & numbers" /></label><label>Referral code<input name="ref" maxLength={20} defaultValue={sp.get('ref') || ''} /></label></div>
        <p className="mute" style={{ fontSize: 12.5 }}>{NOTES[role]}</p><div className="form-err" role="alert">{err}</div><button className="btn block" disabled={busy}>Create account</button></form>
      <p className="mute" style={{ marginTop: 22 }}>Already registered? <Link to="/login" className="link">Sign in</Link></p></div></div></div>;
}
