import type { ReactNode } from 'react'
import { Header } from './Header'
import { NavBar } from './NavBar'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-void-950 text-bone-200">
      <Header />
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  )
}
