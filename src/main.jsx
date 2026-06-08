import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register service worker for offline shell + cached Scout card
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    var base = import.meta.env.BASE_URL || '/'
    navigator.serviceWorker.register(base + 'sw.js').catch(function() {})
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
