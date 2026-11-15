import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { ToastProvider } from './toast.jsx';
import { CartProvider } from './cart.jsx';
import { Motion } from './components/motion.jsx';
import './styles/lux.css';
import './styles/dash.css';

createRoot(document.getElementById('root')).render(
  <StrictMode><BrowserRouter><Motion><ToastProvider><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></ToastProvider></Motion></BrowserRouter></StrictMode>
);
