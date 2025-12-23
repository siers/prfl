import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import App from './App.jsx'
import { isDev } from './debug.js'

import './experiments/exp_20251223_vibe_shuffle.jsx'

setTimeout(() => {
  if (!isDev && document.getElementById('root').children.length == 0) {
    localStorage.clear()
    console.log('cleared local storage')
  }
}, 5000)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
