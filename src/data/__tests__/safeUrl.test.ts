import { describe, expect, it } from 'vitest'
import { cssUrl, safeImageUrl } from '../safeUrl'

describe('safeImageUrl', () => {
  it('passes the artwork URLs the app actually uses', () => {
    const real = 'https://coverartarchive.org/release/abc/front-500'
    expect(safeImageUrl(real)).toBe(real)
  })

  it('rejects anything that could close the CSS url() and add rules', () => {
    expect(safeImageUrl('a.jpg"); background: red; --x: url("')).toBe('')
    expect(safeImageUrl("a.jpg'); }")).toBe('')
    expect(safeImageUrl('a.jpg\\") url(evil')).toBe('')
    expect(safeImageUrl('a.jpg\n background: red')).toBe('')
  })

  it('rejects script and other non-image protocols', () => {
    expect(safeImageUrl('javascript:alert(1)')).toBe('')
    expect(safeImageUrl('data:text/html,<script>alert(1)</script>')).toBe('')
    expect(safeImageUrl('file:///etc/passwd')).toBe('')
  })

  it('allows an inline image, which a pasted screenshot produces', () => {
    const inline = 'data:image/png;base64,iVBORw0KGgo='
    expect(safeImageUrl(inline)).toBe(inline)
  })

  it('treats an empty value as absent rather than throwing', () => {
    expect(safeImageUrl('')).toBe('')
    expect(cssUrl('')).toBeUndefined()
  })

  it('quotes the value it hands to CSS', () => {
    expect(cssUrl('https://example.com/a.jpg')).toBe('url("https://example.com/a.jpg")')
  })
})
