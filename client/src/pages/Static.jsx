import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../toast.jsx';
import { unsplash } from '../lib.js';
import { useSite } from '../site.js';
import { Reveal } from '../components/motion.jsx';

const Head = ({ crumb, title, lead }) => <section className="lhead"><div className="container"><div className="crumbs"><Link to="/">Home</Link>/<span>{crumb}</span></div><h1>{title}</h1>{lead && <p className="lead" style={{ marginTop: 8 }}>{lead}</p>}</div></section>;

export function About() {
  const { about } = useSite();
  return <><Head crumb="About" title={about.title} lead={about.lead} />
    <section className="section"><div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 'clamp(30px,5vw,80px)', alignItems: 'center' }}>
      <Reveal><p className="eyebrow">Our vision</p><h2 className="display h-lg" style={{ margin: '12px 0 18px' }}>The world’s most trusted sourcing partner</h2><p className="lead">We aim to be a bridge that lets brands turn bold ideas into exceptional products — with transparent processes and responsible production at every stage.</p><p className="lead" style={{ marginTop: 14 }}>By fostering long-term partnerships and providing end-to-end manufacturing solutions, we help brands scale with confidence. This marketplace opens the same verified factory network to every business buyer.</p></Reveal>
      <Reveal delay={.1}><img src={unsplash('photo-1558769132-cb1aea458c5e', 1400)} alt="Garments on a rail" loading="lazy" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} /></Reveal></div></section>
    <section className="section dark"><div className="container"><div className="adv" style={{ background: '#2a2a2a', border: '1px solid #2a2a2a' }}>{[['Transparent', 'Price tiers, MOQs, GST and lead times shown before you order.'], ['Verified', 'Every manufacturer and every listing passes an admin review.'], ['Trackable', 'From quotation or checkout to delivery, each stage is recorded.']].map(([h, p]) => <div key={h} style={{ background: '#171717' }}><h3 className="display" style={{ color: '#fff' }}>{h}</h3><p style={{ color: '#b9b4a8' }}>{p}</p></div>)}</div></div></section></>;
}

export function Contact() {
  const BRAND = useSite().contact, toast = useToast(), [done, setDone] = useState(false), [busy, setBusy] = useState(false);
  const submit = async e => { e.preventDefault(); setBusy(true); try { await api('/inquiries', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); setDone(true); } catch (er) { toast(er.message); } setBusy(false); };
  return <><Head crumb="Contact" title="Request a quotation or make an inquiry" lead="We reply within one business day." />
    <section className="section"><div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 'clamp(30px,5vw,80px)' }}>
      <Reveal><h2 className="display h-md">Reach us directly</h2><ul style={{ display: 'grid', gap: 14, margin: '20px 0 26px' }}><li><span className="label">Phone</span><br /><a href={'tel:' + BRAND.phone.replace(/\s/g, '')}>{BRAND.phone}</a></li><li><span className="label">Email</span><br /><a href={'mailto:' + BRAND.email}>{BRAND.email}</a></li><li><span className="label">Office</span><br />{BRAND.address}</li></ul>
        <p className="mute">Already a buyer? <Link to="/dashboard/quotations" className="link">Request a quotation from your dashboard</Link></p></Reveal>
      <Reveal delay={.1}><form className="form card-box" onSubmit={submit}><div className="row2"><label>Name<input name="name" required maxLength={80} autoComplete="name" /></label><label>Email<input name="email" type="email" required autoComplete="email" /></label></div>
        <div className="row2"><label>Phone<input name="phone" autoComplete="tel" /></label><label>Company<input name="company" autoComplete="organization" /></label></div>
        <label>Message<textarea name="message" rows="5" required minLength={5} maxLength={2000} placeholder="Products, quantities, timeline…" /></label>
        <button className="btn" disabled={busy}>Send inquiry</button>{done && <div className="notice ok">Thank you — we’ve received your inquiry and will reply soon.</div>}</form></Reveal></div></section></>;
}

export const NotFound = () => <div className="container"><div className="empty" style={{ minHeight: '60vh', alignContent: 'center' }}><p className="eyebrow">Error 404</p><h1 className="display h-xl">Page not found</h1><p className="lead">The page you’re looking for has moved or no longer exists.</p><Link className="btn" to="/shop">Explore collections</Link></div></div>;
