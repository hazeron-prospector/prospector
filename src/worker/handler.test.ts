import { describe, expect, it } from 'vitest'
import { MINI_XML } from '@/data/__fixtures__/mini'
import { handleParse } from './handler'
import type { WorkerResponse } from './protocol'

const run = async (text: () => Promise<string>) => {
  const msgs: WorkerResponse[] = []
  await handleParse({ text }, (m) => msgs.push(m))
  return msgs
}

describe('handleParse', () => {
  it('posts progress then done with the map', async () => {
    const msgs = await run(async () => MINI_XML)
    expect(msgs.at(-1)?.type).toBe('done')
    expect(msgs.slice(0, -1).every((m) => m.type === 'progress')).toBe(true)
    const done = msgs.at(-1)
    if (done?.type !== 'done') throw new Error('expected done')
    expect(done.map.systems).toHaveLength(4)
  })
  it('posts a single error for a non-starmap file', async () => {
    const msgs = await run(async () => '<html/>')
    expect(msgs.filter((m) => m.type === 'error')).toHaveLength(1)
    expect(msgs.at(-1)).toMatchObject({ type: 'error', message: expect.stringContaining('starmap') })
  })
  it('posts error when reading fails', async () => {
    const msgs = await run(() => Promise.reject(new Error('disk gone')))
    expect(msgs).toEqual([{ type: 'error', message: 'disk gone' }])
  })
  it('stringifies non-Error rejections', async () => {
    const msgs = await run(() => Promise.reject('boom'))
    expect(msgs).toEqual([{ type: 'error', message: 'boom' }])
  })
})
