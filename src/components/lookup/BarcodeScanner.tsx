import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Reads the barcode off a jewel case through the webcam.
 *
 * Uses the browser's own BarcodeDetector where it exists — Chromium on
 * Windows does, which is where this will be used — so there is no library and
 * no WebAssembly to download. Where it does not, the panel says so plainly and
 * the text search remains the way in.
 *
 * The camera opens only on request and is released the moment it is done or
 * the panel closes. Frames are examined in the page and never leave the
 * machine; nothing is recorded and nothing is uploaded.
 */

interface BarcodeScannerProps {
  onDetect: (barcode: string) => void
  onClose: () => void
}

type DetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
}

function detectorSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

export function BarcodeScanner({ onDetect, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<'starting' | 'scanning' | 'denied' | 'unsupported' | 'error'>(
    detectorSupported() ? 'starting' : 'unsupported',
  )
  const [message, setMessage] = useState('')
  const [lastSeen, setLastSeen] = useState('')

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (status === 'unsupported') return
    let cancelled = false
    let frame = 0

    async function run() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus('scanning')

        const Detector = (window as unknown as { BarcodeDetector: new (options?: unknown) => DetectorLike })
          .BarcodeDetector
        const detector = new Detector({ formats: ['ean_13', 'upc_a', 'ean_8', 'upc_e'] })

        const tick = async () => {
          if (cancelled || !videoRef.current) return
          try {
            const found = await detector.detect(videoRef.current)
            const code = found[0]?.rawValue
            if (code && code !== lastSeen) {
              setLastSeen(code)
              onDetect(code)
            }
          } catch {
            // A frame that cannot be read is normal while focusing.
          }
          frame = window.setTimeout(tick, 350)
        }
        void tick()
      } catch (err) {
        if (cancelled) return
        const denied = err instanceof DOMException && err.name === 'NotAllowedError'
        setStatus(denied ? 'denied' : 'error')
        setMessage(err instanceof Error ? err.message : String(err))
      }
    }

    void run()
    return () => {
      cancelled = true
      window.clearTimeout(frame)
      stop()
    }
  }, [status, onDetect, stop, lastSeen])

  return (
    <div className="rounded-lg border border-velvet-700/50 bg-void-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-sm uppercase tracking-wide text-velvet-300">
            Scan a barcode
          </h4>
          <p className="mt-1 text-xs text-bone-400">
            Hold the back of the case up to the camera. Nothing is recorded or sent anywhere.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            stop()
            onClose()
          }}
          className="rounded-md border border-void-700 px-2 py-1 text-xs text-bone-400 transition-colors hover:border-blood-500 hover:text-bone-100"
        >
          Stop
        </button>
      </div>

      {status === 'unsupported' ? (
        <p className="mt-3 text-sm text-bone-300">
          This browser cannot read barcodes. In Edge or Chrome it can — otherwise, type the
          title into the search above.
        </p>
      ) : status === 'denied' ? (
        <p className="mt-3 text-sm text-bone-300">
          The camera was not allowed. Grant it in the address bar and try again, or type the
          title into the search above.
        </p>
      ) : status === 'error' ? (
        <p className="mt-3 text-sm text-blood-300">{message}</p>
      ) : (
        <div className="relative mt-3 overflow-hidden rounded-md border border-void-700 bg-black">
          <video ref={videoRef} muted playsInline className="h-56 w-full object-cover" />
          {/* A window to aim through, so she knows where to hold the case. */}
          <div className="pointer-events-none absolute inset-x-[14%] top-1/2 h-16 -translate-y-1/2 rounded border-2 border-velvet-400/70" />
          <p className="absolute inset-x-0 bottom-2 text-center text-[0.65rem] uppercase tracking-[0.2em] text-bone-200/80">
            {status === 'starting' ? 'Waking the camera…' : 'Looking for a barcode'}
          </p>
        </div>
      )}
    </div>
  )
}

export { detectorSupported }
