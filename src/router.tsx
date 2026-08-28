import { AnimatePresence } from 'framer-motion'
import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { AdminItemFormPage } from './pages/AdminItemFormPage'
import { AdminPage } from './pages/AdminPage'
import { HomePage } from './pages/HomePage'
import { ItemDetailPage } from './pages/ItemDetailPage'
import { StatsPage } from './pages/StatsPage'
import { WishlistPage } from './pages/WishlistPage'

// Lazy-loaded so the three.js/r3f bundle only loads for visitors who
// actually open the shelf, not for every page load of the Phase 1 grid.
const ShelfPage = lazy(() => import('./pages/ShelfPage').then((module) => ({ default: module.ShelfPage })))
// The wall is plain DOM, so it stays in the main bundle and opens instantly;
// only stepping into a shelf pays for three.js.
const WallPage = lazy(() => import('./pages/WallPage').then((module) => ({ default: module.WallPage })))

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
        <Route
          path="/shelf"
          element={
            <Suspense fallback={<p className="text-bone-400">Opening the wall…</p>}>
              <WallPage />
            </Suspense>
          }
        />
        <Route
          path="/shelf/:shelfId"
          element={
            <Suspense fallback={<p className="text-bone-400">Lighting the candles…</p>}>
              <ShelfPage />
            </Suspense>
          }
        />
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
