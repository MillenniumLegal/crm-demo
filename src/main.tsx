import './lib/mockFetch' // DEMO: neutralise edge-function/api fetches (must be first)
import './lib/themeSwitcher' // DEMO: live theme switcher popup
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

