import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ClaimsProvider } from '@/lib/claimsStore'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ClaimsProvider>
        <App />
      </ClaimsProvider>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  </StrictMode>,
)
