import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

/**
 * Entry module summary:
 * - Boots React in strict mode.
 * - Mounts the RFC App root component.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
