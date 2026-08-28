/**
 * Guards the one place untrusted text reaches a stylesheet.
 *
 * Artwork URLs come from the metadata services, from an imported backup, or
 * from being typed into the form by hand, and one of them is interpolated
 * into a CSS `url(...)`. A string containing a quote and a bracket can close
 * that function early and append rules of its own, so anything that is not a
 * plain http(s) or data image URL is dropped rather than escaped.
 */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'data:'])

export function safeImageUrl(raw: string): string {
  if (!raw) return ''

  // The value is emitted inside a double-quoted url("..."), so the only ways
  // out are a quote, a backslash escape, or a line break. Semicolons and
  // parentheses are harmless there and are needed by data: URLs.
  if (/["'\\]/.test(raw) || /[\s\u0000-\u001f]/.test(raw)) return ''

  try {
    const parsed = new URL(raw, window.location.href)
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return ''
    if (parsed.protocol === 'data:' && !raw.startsWith('data:image/')) return ''
    return raw
  } catch {
    return ''
  }
}

/** CSS `url(...)` value, or an empty string when the URL is not usable. */
export function cssUrl(raw: string): string | undefined {
  const safe = safeImageUrl(raw)
  return safe ? `url("${safe}")` : undefined
}
