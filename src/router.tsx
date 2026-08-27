import { AnimatePresence } from 'framer-motion'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { AdminItemFormPage } from './pages/AdminItemFormPage'
import { AdminPage } from './pages/AdminPage'
import { HomePage } from './pages/HomePage'
import { ItemDetailPage } from './pages/ItemDetailPage'
import { StatsPage } from './pages/StatsPage'
import { WishlistPage } from './pages/WishlistPage'

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomePage />} />
        <Route path="/item/:id" element={<ItemDetailPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/new" element={<AdminItemFormPage />} />
        <Route path="/admin/edit/:id" element={<AdminItemFormPage />} />
      </Routes>
    </AnimatePresence>
  )
}

export function AppRouter() {
  return (
    <HashRouter>
      <AppShell>
        <AnimatedRoutes />
      </AppShell>
    </HashRouter>
  )
}
