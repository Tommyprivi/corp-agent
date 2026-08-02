import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyThemeEarly } from './lib/theme'

// Prima di disegnare qualunque cosa: se il tema salvato è scuro va messo
// adesso, non al primo render. Altrimenti per un istante si vede il bianco e
// poi lo schermo diventa nero — il lampo che dà fastidio a chi lavora al buio.
applyThemeEarly()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
