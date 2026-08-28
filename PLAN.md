# The Archive — Build Plan

A 3D gothic catalogue for a physical CD, vinyl and DVD collection.
Static-hosted on GitHub Pages, installable as a Windows app.

## Who this is for

The end user is **not technical** and should never see a token, a config
screen, or a setup step. Every credential is configured by the maintainer,
in the maintainer's own browser. Her copy of the app has no setup at all:
open it, and it works.

The collection is **primarily music CDs**, with vinyl and DVDs alongside.
Design decisions break toward CDs when they conflict.

## Aesthetic direction

Gothic architecture and doom metal, not Halloween. The existing palette in
`src/styles/index.css` is correct and stays: `void` (near-black, never pure
black), `blood` (dried wine), `velvet` (candlelit purple), `bone` (warm
parchment, never stark white). Cinzel for headings, EB Garamond for body,
UnifrakturMaguntia for the masthead only.

Reference points: cathedral verticality, candlelight falloff, aged paper,
tarnished metal. Restraint over spectacle — the artwork should be the
brightest thing on screen.

---

## Architecture decisions

### Persistence — three tiers

The original `localRepository` wrote through a Vite dev-server middleware
and was a no-op in production, so on GitHub Pages an added item vanished
on refresh. Replaced by:

| Tier | Mechanism | Whose | Purpose |
|---|---|---|---|
| 1 | IndexedDB | hers | Live working copy. Automatic, instant, invisible. |
| 2 | File System Access API | hers | One-time "keep my archive here" → auto-writes a real `collection.json` on her PC. Survives browser data clearing. Copyable to a USB stick. |
| 3 | GitHub Contents API | **maintainer only** | Hidden route. Token in the maintainer's `localStorage` only. Seeds and backs up the canonical collection. |

Tier 2 is what makes this feel like a Windows app: her data is a real file
in `Documents`, not trapped in browser storage. Chromium-only API, which is
fine — the PWA installs under Edge on Windows. IndexedDB remains the
fallback where it is unavailable.

**No credential is ever committed or bundled.** See "Connector setup".

### Metadata connectors

| Source | Auth | CORS | Used for |
|---|---|---|---|
| MusicBrainz | none | `*` verified | CD/vinyl releases, exact pressing, label, barcode, catalogue no., country, tracklist |
| Cover Art Archive | none | `*` verified | Front cover, **back cover**, disc face |
| TMDB | read key | yes | DVD posters, backdrops, synopsis, cast |

MusicBrainz resolves the *specific pressing*, not just the album — the US
1993 and German 1993 presses of `Bloody Kisses` are distinct entries with
distinct barcodes. That matters to a collector holding one of them.

Two gotchas, both handled at the client:
- CAA returns `http://` image URLs. Rewrite to `https://` or they are
  blocked as mixed content on the Pages origin.
- MusicBrainz requires a descriptive `User-Agent` and rate-limits to
  ~1 req/sec. Requests go through a small throttled queue.

Prefer the stable `https://coverartarchive.org/release/{mbid}/front-500`
pattern over parsing the images JSON where only the front is needed.

### Shelf model — freeform

She arranges the shelf herself; the arrangement is hers and it persists.
This requires a new `Shelf` entity and two new fields on `CollectionItem`.

```ts
Shelf   { id, name, order, accent }
Item   += { shelfId, position }
```

`name` is free text — "Doom", "Peaceville years", "Not yet ripped".

### Packaging

PWA: web app manifest, service worker, offline shell, gothic icon set.
Installs from Edge/Chrome into its own window with a taskbar entry. No
separate build, no Rust toolchain, no installer to distribute.

---

## Schema changes

Additions to `CollectionItem` in `src/data/schema.ts`:

```
shelfId            string | null   which shelf it sits on
position           int             left-to-right order within that shelf
backCoverImageUrl  string          CAA back cover  -> drives the case flip
discImageUrl       string          CAA disc face   -> drives the disc reveal
dominantColor      string          sampled from cover -> drives per-item light
musicbrainzId      string          re-fetch without re-searching
tmdbId             string
barcode            string
catalogNumber      string
country            string          pressing origin
trackList          Track[]         { position, title, lengthMs }
```

All new fields default to empty, so existing items stay valid and no
migration is needed on first load.

---

## Roadmap

Ordered so the app became *trustworthy* before it became *impressive*.
There is no point polishing a shelf that forgets what she put on it.

### Phase 1 — Foundation · done
Catalogue, detail, wishlist, stats, admin CRUD. Zod validation, Zustand,
hash routing. The palette and type system everything else inherits.

### Phase 2 — Persistence that survives · done
IndexedDB behind the existing repository interface, File System Access
auto-save with permission recovery, and Export / Import. Seeds a starting
arrangement by medium on first run, guarded by a marker so emptying the
collection is not undone on reload.

### Phase 3 — Artwork and metadata · done
MusicBrainz release search resolving the specific pressing, and Cover Art
Archive for front, back and disc scans. Dominant colour sampled per sleeve.
All eight music records backfilled with real catalogue numbers, barcodes,
tracklists and artwork by `scripts/enrich-collection.mjs`.

### Phase 4 — The shelf, properly · done
Named shelves with drag-to-rearrange, persisted. Per-medium behaviour: the
CD's disc slides out and turns, the record drops spinning, every case flips
to its real back cover. Rows size to their contents, the case sizes to the
rows, and genre drives the ambience.

### Phase 5 — Ship it · done
Installable PWA with a generated pointed-arch icon set and offline art
caching. Pages workflow deriving `BASE_PATH` from the repository name.

### Phase 6 — Still outstanding

- **TMDB for the two films.** Needs the key; until then Nosferatu and
  Dracula carry drawn labels rather than posters. Everything else is wired,
  so this is a small connector plus the key.
- **The maintainer-only GitHub sync route.** Designed above and unbuilt.
  Nothing depends on it: her copy already saves to her own machine.
- **Shelf reordering.** Shelves can be created, renamed and deleted, and
  items move freely between them, but the rows themselves cannot yet be
  dragged into a different vertical order.
- Optional 30s previews, loan tracking, barcode scanning by webcam.

## Performance budget

The 3D must stay smooth or the whole conceit fails.

- three.js already sits in its own rollup chunk and loads lazily. Keep it
  that way; nothing on the grid routes may import from `src/scenes/`.
- Cap `dpr` at 1.5 (already set). Cover textures resize to 512px before
  upload to the GPU.
- Only shelves near the viewport mount their cases; the rest render as
  flat instanced spines.
- `prefers-reduced-motion` disables idle drift and spin, and the existing
  "simple mode" toggle stays as the non-3D route.
- Postprocessing (bloom, DoF) stays opt-in — it is the first thing to cost
  frames on integrated graphics.

---

## Connector setup  *(maintainer, one time)*

**MusicBrainz + Cover Art Archive** — nothing to do. No key, no account.
The required `User-Agent` is set in code.

**TMDB** — themoviedb.org → sign up → Settings → API → request an API key
(choose Developer, personal use). Takes about two minutes. The read key is
read-only and TMDB permits client-side use; it is rate-limited, not
dangerous, and rotatable if abused. Needed only for DVDs.

**GitHub sync token** — github.com → Settings → Developer settings →
Personal access tokens → Fine-grained tokens. Scope it to **this repository
only**, with **Contents: Read and write** and nothing else. Paste it into
the hidden maintainer route *in your own browser*. It is stored in your
`localStorage` and never enters the bundle, the repo, or her copy.

> Never commit any of these, and never put the GitHub token in a `.env`
> that Vite inlines — `VITE_`-prefixed variables are baked into the public
> bundle at build time. A repo-scoped write token in a public bundle lets
> any visitor rewrite the collection.
