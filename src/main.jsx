// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AppProvider } from './contexts/AppContext'; // Import AppProvider

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider> {/* Wrap App with AppProvider */}
      <App />
    </AppProvider>
  </React.StrictMode>,
)