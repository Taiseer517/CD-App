interface StatTileProps {
  label: string
  value: string | number
  detail?: string
}

export function StatTile({ label, value, detail }: StatTileProps) {
  return (
    <div className="rounded-lg border border-void-700 bg-void-900/60 p-6 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-bone-400">{label}</p>
      <p className="mt-2 font-display text-4xl text-bone-100">{value}</p>
      {detail && <p className="mt-1 text-sm text-bone-400">{detail}</p>}
    </div>
  )
}
