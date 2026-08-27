interface TagListProps {
  tags: string[]
  onTagClick?: (tag: string) => void
}

export function TagList({ tags, onTagClick }: TagListProps) {
  if (tags.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag}>
          {onTagClick ? (
            <button
              type="button"
              onClick={() => onTagClick(tag)}
              className="rounded-full border border-velvet-700 bg-velvet-900/40 px-3 py-1 text-xs uppercase tracking-wide text-bone-200 transition-colors hover:border-velvet-400 hover:text-bone-100"
            >
              {tag}
            </button>
          ) : (
            <span className="rounded-full border border-velvet-700 bg-velvet-900/40 px-3 py-1 text-xs uppercase tracking-wide text-bone-200">
              {tag}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
