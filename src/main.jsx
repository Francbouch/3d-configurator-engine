import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import AppErrorBoundary from './app/AppErrorBoundary'
import './styles/global.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
)
