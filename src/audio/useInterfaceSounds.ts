import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { archiveAudio } from './archiveAudio'

/**
 * Gives every control a voice without threading a handler through every
 * component.
 *
 * A single delegated listener on the document covers buttons and links
 * wherever they are, including ones added later. Anything that opts out with
 * data-silent stays quiet — the sound toggle itself, for instance, which
 * would otherwise click at you on the way to being switched off.
 *
 * Every sound is a no-op until sound is armed, so one switch governs the lot
 * rather than leaving stray noises behind.
 */
export function useInterfaceSounds() {
  const location = useLocation()

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = (event.target as HTMLElement | null)?.closest(
        'button, a, [role="button"], select',
      )
      if (!target || target.hasAttribute('data-silent')) return
      if (target.getAttribute('aria-disabled') === 'true') return
      if (target instanceof HTMLButtonElement && target.disabled) return

      const pressed = target.getAttribute('aria-pressed')
      if (pressed !== null) archiveAudio.toggle(pressed === 'false')
      else archiveAudio.click()
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // The page turning. Skipped on first mount, which is a load rather than a
  // move, and would otherwise chime the moment sound is switched on.
  useEffect(() => {
    archiveAudio.navigate()
  }, [location.pathname])
}
