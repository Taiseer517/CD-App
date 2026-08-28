import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches anything that would otherwise leave a white screen.
 *
 * A record saved before a field existed once crashed the whole app on render,
 * and what the archive showed was nothing at all — no message, no way back.
 * A collection is not worth much if one bad row can make it disappear, so
 * this says what happened and offers the two ways out: reload, or clear the
 * local copy and re-seed. Clearing is offered last and named plainly,
 * because it discards what is on this machine.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The archive hit an error it could not render through', error, info)
  }

  private async clearLocalCopy() {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('the-archive')
      request.onsuccess = request.onerror = request.onblocked = () => resolve()
    })
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="font-display text-2xl text-bone-100">Something in here broke</h1>
        <p className="mt-3 text-sm leading-relaxed text-bone-400">
          The archive could not draw this page. Your collection is still saved — this is a
          fault in the app, not in your records.
        </p>

        <pre className="mt-5 overflow-x-auto rounded-md border border-void-700 bg-void-900 p-3 text-left text-xs text-bone-400">
          {this.state.error.message}
        </pre>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border border-velvet-700 px-4 py-2 text-sm text-bone-100 transition-colors hover:border-velvet-400"
          >
            Reload
          </button>
          <a
            href="#/admin"
            onClick={() => this.setState({ error: null })}
            className="rounded-md border border-void-700 px-4 py-2 text-sm text-bone-200 transition-colors hover:border-velvet-400"
          >
            Go to Admin and export a backup
          </a>
        </div>

        <details className="mt-8 text-left">
          <summary className="cursor-pointer text-xs uppercase tracking-wide text-bone-400">
            Still broken after reloading?
          </summary>
          <p className="mt-3 text-sm text-bone-400">
            Clearing the copy stored in this browser will start the archive fresh from its
            seed data. Anything you added and did not export or save to a file will be lost.
          </p>
          <button
            type="button"
            onClick={() => this.clearLocalCopy()}
            className="mt-3 rounded-md border border-blood-700 px-4 py-2 text-sm text-bone-200 transition-colors hover:border-blood-400"
          >
            Clear this browser&rsquo;s copy and start again
          </button>
        </details>
      </div>
    )
  }
}
