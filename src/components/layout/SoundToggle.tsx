import { useEffect } from 'react'
import { archiveAudio } from '../../audio/archiveAudio'
import { useUiStore } from '../../store/useUiStore'

/**
 * Starts and stops the room.
 *
 * Off by default and started only by this click, because browsers block audio
 * without a gesture and because sound that arrives uninvited is an intrusion.
 * The choice is remembered, but it is re-armed by a click on the next visit
 * rather than resuming on its own — a page that starts making noise on load
 * is the thing everyone hates.
 */
export function SoundToggle() {
  const soundOn = useUiStore((state) => state.soundOn)
  const setSoundOn = useUiStore((state) => state.setSoundOn)

  useEffect(() => {
    return () => {
      void archiveAudio.setAmbience('off')
    }
  }, [])

  async function toggle() {
    const next = !soundOn
    setSoundOn(next)
    await archiveAudio.setAmbience(next ? 'on' : 'off')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={soundOn}
      title={soundOn ? 'Silence the room' : 'Let the room breathe'}
      className={`rounded-md border px-2.5 py-1 text-sm transition-colors ${
        soundOn
          ? 'border-velvet-700 text-velvet-300'
          : 'border-void-700 text-bone-400 hover:border-velvet-700 hover:text-bone-200'
      }`}
    >
      <span aria-hidden="true">{soundOn ? '♪' : '♪'}</span>
      <span className="sr-only">{soundOn ? 'Turn sound off' : 'Turn sound on'}</span>
      <span className="ml-1.5 text-[0.62rem] uppercase tracking-[0.16em]">
        {soundOn ? 'Sound on' : 'Sound off'}
      </span>
    </button>
  )
}
