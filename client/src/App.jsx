import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Listing from './pages/Listing.jsx';
import Product from './pages/Product.jsx';
import CartPage from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Directory from './pages/Directory.jsx';
import { About, Contact, NotFound } from './pages/Static.jsx';
import { Login, Register } from './pages/Auth.jsx';
import { useAuth } from './auth.jsx';

const Dashboard = lazy(() => import('./dashboard/Dashboard.jsx'));
const Boot = () => <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--mute)', font: '500 11px var(--sans)', letterSpacing: '.2em', textTransform: 'uppercase' }}>Loading your workspace…</div>;

export default function App() {
  const { user } = useAuth();
  return <Routes>
    <Route element={<Layout />}>
      <Route path="/" element={<Home />} /><Route path="/shop" element={<Listing />} /><Route path="/product" element={<Product />} />
      <Route path="/cart" element={<CartPage />} /><Route path="/checkout" element={<Checkout />} /><Route path="/categories" element={<Directory />} />
      <Route path="/about" element={<About />} /><Route path="/contact" element={<Contact />} /><Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} />
      <Route path="*" element={<NotFound />} />
    </Route>
    <Route path="/dashboard/*" element={user === undefined ? <Boot /> : user ? <Suspense fallback={<Boot />}><Dashboard /></Suspense> : <Navigate to="/login?next=/dashboard" replace />} />
  </Routes>;
}
