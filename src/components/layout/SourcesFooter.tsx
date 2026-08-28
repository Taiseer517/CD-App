import { isTmdbConfigured, TMDB_ATTRIBUTION } from '../../services/tmdb'

/**
 * Credits the services every fact in the archive comes from.
 *
 * TMDB require their logo and wording as a condition of using the API, so this
 * is an obligation rather than a courtesy — `scripts/verify.mjs` checks it is
 * still here. MusicBrainz and the Cover Art Archive ask for nothing, but an
 * archive that claims every fact is sourced ought to name its sources.
 *
 * The logo is inline SVG: fetching it from TMDB would leak a request on every
 * page load, and would break the moment the app is opened offline.
 */
function TmdbLogo() {
  return (
    <svg
      viewBox="0 0 273 35"
      role="img"
      aria-label="TMDB"
      className="h-3 w-auto shrink-0"
      fill="none"
    >
      <defs>
        <linearGradient id="tmdb-gradient" x1="0" y1="17" x2="273" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#90cea1" />
          <stop offset="56%" stopColor="#3cbec9" />
          <stop offset="100%" stopColor="#00b3e5" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="271" height="33" rx="9" stroke="url(#tmdb-gradient)" strokeWidth="2" />
      <text
        x="136"
        y="24"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="19"
        fontWeight="700"
        letterSpacing="1"
        fill="url(#tmdb-gradient)"
      >
        TMDB
      </text>
    </svg>
  )
}

export function SourcesFooter() {
  return (
    <footer className="mt-16 border-t border-void-800 px-6 py-8">
      <div className="mx-auto max-w-4xl space-y-3 text-center">
        <p className="font-display text-[0.6rem] uppercase tracking-[0.28em] text-bone-400/70">
          Every fact in this archive comes from
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-bone-400">
          <a
            href="https://musicbrainz.org"
            target="_blank"
            rel="noreferrer noopener"
            className="transition-colors hover:text-velvet-300"
          >
            MusicBrainz
          </a>
          <a
            href="https://coverartarchive.org"
            target="_blank"
            rel="noreferrer noopener"
            className="transition-colors hover:text-velvet-300"
          >
            Cover Art Archive
          </a>
          {isTmdbConfigured() && (
            <a
              href="https://www.themoviedb.org"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <TmdbLogo />
            </a>
          )}
        </div>

        {isTmdbConfigured() && (
          <p className="text-[0.68rem] leading-relaxed text-bone-400/70">{TMDB_ATTRIBUTION}</p>
        )}
      </div>
    </footer>
  )
}
