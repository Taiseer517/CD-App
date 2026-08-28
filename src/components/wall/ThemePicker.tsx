import { THEME_LIST, type ThemeId } from '../../scenes/themes'

interface ThemePickerProps {
  value: ThemeId
  onChange: (theme: ThemeId) => void
}

/**
 * Painted swatches rather than a dropdown of names: "Ossuary" means nothing
 * until you have seen it, and the two colours in each swatch are the wood and
 * the light that actually change.
 */
export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <fieldset className="mx-auto max-w-2xl">
      <legend className="mb-3 w-full text-center font-display text-[0.6rem] uppercase tracking-[0.28em] text-bone-400/70">
        How the shelves are dressed
      </legend>

      <div className="flex flex-wrap items-stretch justify-center gap-3">
        {THEME_LIST.map((theme) => {
          const active = theme.id === value
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onChange(theme.id)}
              aria-pressed={active}
              title={theme.description}
              className={`group flex w-36 flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
                active
                  ? 'border-velvet-400 bg-velvet-900/25'
                  : 'border-void-700 hover:border-velvet-700'
              }`}
            >
              <span
                className="h-10 w-full rounded-sm border border-black/50 transition-transform duration-500 group-hover:scale-[1.03]"
                style={{
                  background: `linear-gradient(135deg, ${theme.swatch[0]} 0%, ${theme.swatch[0]} 52%, ${theme.swatch[1]} 100%)`,
                  boxShadow: `inset 0 -8px 14px -8px ${theme.swatch[1]}`,
                }}
                aria-hidden="true"
              />
              <span
                className={`font-display text-xs uppercase tracking-[0.14em] ${
                  active ? 'text-bone-100' : 'text-bone-400'
                }`}
              >
                {theme.name}
              </span>
              <span className="text-[0.65rem] leading-snug text-bone-400/80">
                {theme.description}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
