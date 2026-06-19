import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css' // ← この1行が必要です！

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)