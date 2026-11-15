import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../toast.jsx';
import { Greet } from './ui.jsx';

export default function Profile({ user }) {
  const toast = useToast(), { refresh } = useAuth(), [err, setErr] = useState('');
  const save = async e => { e.preventDefault(); try { await api('/auth/me', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); await refresh(); toast('Profile saved'); } catch (er) { toast(er.message); } };
  const pw = async e => { e.preventDefault(); const f = e.target; try { await api('/auth/password', { method: 'PUT', body: Object.fromEntries(new FormData(f)) }); f.reset(); setErr(''); toast('Password updated'); } catch (er) { setErr(er.message); } };
  return <><Greet name={user.name.split(' ')[0]} sub="Keep your details up to date." />
    <div className="g2e"><div className="dcard"><h3>Account details</h3><form className="form" style={{ marginTop: 14 }} onSubmit={save}>
      <label>Full name<input name="name" defaultValue={user.name} required /></label><label>Email<input value={user.email} disabled readOnly /></label>
      <div className="row2"><label>Company<input name="company" defaultValue={user.company} /></label><label>Phone<input name="phone" defaultValue={user.phone} /></label></div>
      <div className="row2"><label>Country<input name="country" defaultValue={user.country} /></label><label>GST / Tax ID<input name="gst" defaultValue={user.gst} /></label></div>
      <button className="btn btn-primary" type="submit">Save changes</button></form></div>
    <div className="dcard"><h3>Change password</h3><form className="form" style={{ marginTop: 14 }} onSubmit={pw}>
      <label>Current password<input name="current" type="password" required autoComplete="current-password" /></label><label>New password<input name="next" type="password" required minLength={8} autoComplete="new-password" /></label>
      <div className="form-err" role="alert">{err}</div><button className="btn btn-primary" type="submit">Update password</button></form></div></div></>;
}
