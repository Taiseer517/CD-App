interface EmptyStateProps {
  title: string
  message?: string
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-void-700 bg-void-900/60 px-8 py-16 text-center">
      <p className="font-display text-xl text-bone-200">{title}</p>
      {message && <p className="max-w-md text-sm text-bone-400">{message}</p>}
    </div>
  )
}
