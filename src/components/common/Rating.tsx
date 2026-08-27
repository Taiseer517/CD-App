interface RatingProps {
  value: number
  max?: number
  onChange?: (value: number) => void
}

export function Rating({ value, max = 5, onChange }: RatingProps) {
  const stars = Array.from({ length: max }, (_, index) => index + 1)

  return (
    <div className="flex gap-1" role="img" aria-label={`Rating: ${value} out of ${max}`}>
      {stars.map((star) => {
        const filled = star <= value
        const className = filled ? 'text-blood-400' : 'text-void-700'
        if (!onChange) {
          return (
            <span key={star} className={className} aria-hidden="true">
              ★
            </span>
          )
        }
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star === value ? 0 : star)}
            className={`${className} transition-colors hover:text-blood-300`}
            aria-label={`Set rating to ${star}`}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}
