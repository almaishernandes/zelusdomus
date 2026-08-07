import { StrictMode } from 'react'
window.__ZD_BUILD__ = '2026-07-25-01'; // força novo hash de arquivo para contornar cache de CDN antigo
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Faz os assets do build (JS/CSS) ficarem em cache no aparelho, para não
// precisar baixar tudo de novo a cada abertura do app — reduz bastante a
// demora antes da tela de login aparecer, principalmente no celular.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
