type Props = {
  value: number
  onChange?: (score: number) => void
  readOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function RatingStars({ value, onChange, readOnly, size = 'md' }: Props) {
  const interactive = Boolean(onChange) && !readOnly
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-3xl' : 'text-2xl'
  const displayValue = Math.round(value)

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((score) => {
        const filled = score <= displayValue
        if (!interactive) {
          return (
            <span
              key={score}
              aria-hidden
              className={`${textSize} leading-none ${
                filled ? 'text-[#FFD700]' : 'text-slate-300 dark:text-slate-600'
              }`}
            >
              ★
            </span>
          )
        }

        return (
          <button
            key={score}
            type="button"
            aria-label={`Rate ${score} star${score > 1 ? 's' : ''}`}
            className={`min-h-11 min-w-11 ${textSize} inline-flex items-center justify-center leading-none transition active:scale-95 ${
              score <= value
                ? 'text-[#FFD700] drop-shadow-[0_0_4px_rgba(255,215,0,0.45)]'
                : 'text-slate-300 dark:text-slate-600'
            }`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onChange?.(score)
            }}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}
