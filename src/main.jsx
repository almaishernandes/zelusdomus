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
