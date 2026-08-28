/**
 * Runs tasks one at a time with a floor on the gap between them.
 *
 * MusicBrainz asks for no more than one request per second per client and
 * returns 503 to callers who ignore that. Typing in the lookup box would
 * otherwise fire a request per keystroke.
 */
export function createThrottle(minIntervalMs: number) {
  let chain: Promise<unknown> = Promise.resolve()
  let lastRunAt = 0

  return function throttled<T>(task: () => Promise<T>): Promise<T> {
    const result = chain.then(async () => {
      const wait = Math.max(0, lastRunAt + minIntervalMs - Date.now())
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      lastRunAt = Date.now()
      return task()
    })

    // The chain must survive a rejected task, or one failed lookup wedges
    // every request queued behind it.
    chain = result.catch(() => undefined)
    return result
  }
}
