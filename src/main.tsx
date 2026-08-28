import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Latin subsets only — the full imports pull Cyrillic/Greek/Vietnamese too,
// which is ~40 extra font files we never render.
import '@fontsource/cinzel/latin-400.css'
import '@fontsource/cinzel/latin-600.css'
import '@fontsource/eb-garamond/latin-400.css'
import '@fontsource/eb-garamond/latin-500.css'
import '@fontsource/eb-garamond/latin-400-italic.css'
import '@fontsource/unifrakturmaguntia/latin-400.css'
import './styles/index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
