import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { MINI_XML } from './__fixtures__/mini'
import { parseStarMap } from './parse'
import { clearMap, DB_NAME, loadMap, saveMap } from './store'
import { SCHEMA_VERSION } from './types'

const map = parseStarMap(MINI_XML)

beforeEach(async () => {
  await clearMap()
})

describe('store', () => {
  it('loads undefined when empty', async () => {
    expect(await loadMap()).toBeUndefined()
  })
  it('round-trips the model', async () => {
    await saveMap(map)
    expect(await loadMap()).toEqual(map)
  })
  it('replaces the previous map', async () => {
    await saveMap(map)
    await saveMap({ ...map, empire: 'Other' })
    expect((await loadMap())?.empire).toBe('Other')
  })
  it('clears', async () => {
    await saveMap(map)
    await clearMap()
    expect(await loadMap()).toBeUndefined()
  })
  it('discards incompatible schema versions', async () => {
    await saveMap({ ...map, schemaVersion: SCHEMA_VERSION + 1 })
    expect(await loadMap()).toBeUndefined()
    // and the stale entry is removed
    await saveMap(map)
    expect(await loadMap()).toEqual(map)
  })
  it('discards malformed cache entries', async () => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, 1)
      open.onsuccess = () => {
        const tx = open.result.transaction('maps', 'readwrite')
        tx.objectStore('maps').put({ nonsense: true }, 'last')
        tx.oncomplete = () => {
          open.result.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
    })
    expect(await loadMap()).toBeUndefined()
  })
})
