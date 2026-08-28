import type { ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { Header } from './Header'
import { NavBar } from './NavBar'
import { SourcesFooter } from './SourcesFooter'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-void-950 text-bone-200">
      <Header />
      <NavBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <SourcesFooter />
    </div>
  )
}
