import { describe, expect, it } from 'vitest'
import { createThrottle } from '../throttle'

describe('createThrottle', () => {
  it('spaces calls out by at least the interval', async () => {
    const throttle = createThrottle(40)
    const at: number[] = []

    await Promise.all([1, 2, 3].map(() => throttle(async () => at.push(Date.now()))))

    expect(at[1] - at[0]).toBeGreaterThanOrEqual(35)
    expect(at[2] - at[1]).toBeGreaterThanOrEqual(35)
  })

  it('keeps running after a task rejects, rather than wedging the queue', async () => {
    const throttle = createThrottle(5)

    await expect(throttle(() => Promise.reject(new Error('rate limited')))).rejects.toThrow(
      'rate limited',
    )
    await expect(throttle(async () => 'still working')).resolves.toBe('still working')
  })

  it('runs tasks in the order they were queued', async () => {
    const throttle = createThrottle(5)
    const order: number[] = []

    await Promise.all([1, 2, 3].map((n) => throttle(async () => { order.push(n) })))

    expect(order).toEqual([1, 2, 3])
  })
})
