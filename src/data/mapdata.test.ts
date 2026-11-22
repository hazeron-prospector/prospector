import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { qualityRgb } from './color'
import {
  buildMapData,
  SECTOR_SIZE,
  SIZE_DIM,
  SIZE_HIGHLIGHT_MAX,
  SIZE_HIGHLIGHT_MIN,
  SIZE_EXPLORED,
  STUB_MAX_LENGTH,
  starColor,
  WORMHOLE_COLORS,
} from './mapdata'
import { parseStarMap } from './parse'
import type { Eod, StarMap, System, Wormhole } from './types'

function sys(id: string, o: Partial<System> & { type?: string } = {}): System {
  const { type, ...rest } = o
  return {
    systemId: id,
    sectorId: 'SEC',
    name: id,
    eod: 'Explored' as Eod,
    stars: [
      {
        starId: `${id}-star`, name: id, type: type ?? 'G Yellow', orbit: { raw: 'Primary' }, size: '', habRaw: '',
        shell: '', diameterRaw: '', resources: [],
      },
    ],
    planets: [],
    wormholes: [],
    cities: [],
    ...rest,
  }
}

function mapOf(systems: System[]): StarMap {
  return {
    schemaVersion: 1, empireId: '1', empire: 'E', createDate: '', galaxyName: 'G',
    sectors: [{ sectorId: 'SEC', name: 'Alpha', galaxy: 'G', x: 75, y: 1, z: -2 }],
    systems,
  }
}

const wh = (o: Partial<Wormhole> = {}): Wormhole => ({ destX: 0, destY: 0, destZ: 0, explored: true, ...o })
const close = (a: ArrayLike<number>, b: number[]) => b.forEach((v, i) => expect(a[i]).toBeCloseTo(v, 4))

describe('buildMapData points', () => {
  const map = mapOf([
    sys('A', { x: 10, y: 20, z: 30 }),
    sys('B', { x: 12, y: 20, z: 30, eod: 'Unexplored' }),
    sys('C', { x: 14, y: 20, z: 30, eod: 'Surveyed' }),
    sys('D', {}), // Deep Space, no coordinates
  ])

  it('skips systems without coordinates and maps index to id', () => {
    const d = buildMapData(map)
    expect(d.count).toBe(3)
    expect(d.systemIds).toEqual(['A', 'B', 'C'])
    expect(d.indexOfSystem.get('C')).toBe(2)
    expect(d.positions).toHaveLength(9)
    close(d.positions, [10, 20, 30, 12, 20, 30, 14, 20, 30])
    expect(d.colors).toHaveLength(9)
    expect(d.sizes).toHaveLength(3)
    expect(d.rings).toHaveLength(3)
  })

  it('no highlight: star color, Unexplored dimmed, Surveyed ringed', () => {
    const d = buildMapData(map)
    const g = starColor('G Yellow')
    close(d.colors.subarray(0, 3), g)
    const dim = Array.from(d.colors.subarray(3, 6))
    expect(dim[0]).toBeLessThan(g[0]!)
    expect(dim[1]).toBeLessThan(g[1]!)
    expect(d.sizes[1]).toBeLessThan(d.sizes[0]!)
    expect(d.sizes[0]).toBeCloseTo(SIZE_EXPLORED)
    expect(Array.from(d.rings)).toEqual([0, 0, 1])
  })

  it('highlight: matching systems use the quality scale and are larger; others dim grey and small', () => {
    const d = buildMapData(map, new Map([['A', 250], ['C', 20]]))
    close(d.colors.subarray(0, 3), qualityRgb(250))
    close(d.colors.subarray(6, 9), qualityRgb(20))
    expect(d.sizes[0]).toBeCloseTo(SIZE_HIGHLIGHT_MAX, 0)
    expect(d.sizes[2]).toBeGreaterThanOrEqual(SIZE_HIGHLIGHT_MIN)
    expect(d.sizes[0]).toBeGreaterThan(d.sizes[2]!)
    expect(d.sizes[1]).toBe(SIZE_DIM)
    const grey = Array.from(d.colors.subarray(3, 6))
    expect(grey[0]).toBeCloseTo(grey[1]!, 1)
    expect(grey[0]).toBeLessThan(0.4)
    expect(Array.from(d.rings)).toEqual([0, 0, 0])
  })

  it('an empty highlight map dims everything (resource selected, nothing matches)', () => {
    const d = buildMapData(map, new Map())
    expect(Array.from(d.sizes)).toEqual([SIZE_DIM, SIZE_DIM, SIZE_DIM])
  })
})

describe('starColor', () => {
  it('maps spectral classes and special types', () => {
    const keys = ['O Blue', 'B Blue White', 'A White', 'F Yellow White', 'G Yellow', 'K Orange', 'M Red']
    const colors = keys.map((k) => starColor(k).join())
    expect(new Set(colors).size).toBe(keys.length)
    expect(starColor('K T Tauri').join()).toBe(starColor('K Orange').join())
    expect(starColor('L Brown Dwarf').join()).toBe(starColor('T Brown Dwarf').join())
    expect(starColor('Neutron Star').join()).not.toBe(starColor('Stellar Black Hole').join())
  })
  it('falls back for unknown types', () => {
    expect(starColor('Mystery Thing')).toHaveLength(3)
    expect(starColor('')).toHaveLength(3)
  })
})

describe('wormholes', () => {
  it('dedupes A->B / B->A and blends polarity per end', () => {
    const map = mapOf([
      sys('A', { x: 0, y: 0, z: 0, wormholes: [wh({ destSystemId: 'B', polarity: 'positive' })] }),
      sys('B', { x: 10, y: 0, z: 0, wormholes: [wh({ destSystemId: 'A', polarity: 'negative' })] }),
    ])
    const d = buildMapData(map)
    expect(d.wormholes.linkCount).toBe(1)
    expect(d.wormholes.stubCount).toBe(0)
    expect(d.wormholes.positions).toHaveLength(6)
    close(d.wormholes.positions, [0, 0, 0, 10, 0, 0])
    close(d.wormholes.colors.subarray(0, 3), WORMHOLE_COLORS.positive)
    close(d.wormholes.colors.subarray(3, 6), WORMHOLE_COLORS.negative)
  })

  it('one-sided link uses its polarity at both ends; missing polarity is unknown', () => {
    const map = mapOf([
      sys('A', { x: 0, y: 0, z: 0, wormholes: [wh({ destSystemId: 'B' })] }),
      sys('B', { x: 5, y: 0, z: 0 }),
    ])
    const d = buildMapData(map)
    expect(d.wormholes.linkCount).toBe(1)
    close(d.wormholes.colors.subarray(0, 3), WORMHOLE_COLORS.unknown)
    close(d.wormholes.colors.subarray(3, 6), WORMHOLE_COLORS.unknown)
  })

  it('builds a capped stub toward dest for unresolved links', () => {
    const map = mapOf([
      sys('A', { x: 0, y: 0, z: 0, wormholes: [wh({ destX: 100, destY: 0, destZ: 0, polarity: 'negative' })] }),
    ])
    const d = buildMapData(map)
    expect(d.wormholes.linkCount).toBe(0)
    expect(d.wormholes.stubCount).toBe(1)
    close(d.wormholes.positions, [0, 0, 0, STUB_MAX_LENGTH, 0, 0])
    close(d.wormholes.colors.subarray(0, 3), WORMHOLE_COLORS.negative)
  })

  it('stub is a fraction of a short distance and skipped for zero distance', () => {
    const map = mapOf([
      sys('A', { x: 0, y: 0, z: 0, wormholes: [wh({ destX: 0, destY: 4, destZ: 0 }), wh({ destX: 0, destY: 0, destZ: 0 })] }),
    ])
    const d = buildMapData(map)
    expect(d.wormholes.stubCount).toBe(1)
    close(d.wormholes.positions, [0, 0, 0, 0, 1, 0])
  })

  it('treats a destSystemId missing from the map or without coords as a stub; ignores self links', () => {
    const map = mapOf([
      sys('A', {
        x: 0, y: 0, z: 0,
        wormholes: [wh({ destSystemId: 'ZZZ', destX: 50, destY: 0, destZ: 0 }), wh({ destSystemId: 'A' }), wh({ destSystemId: 'D', destX: 0, destY: 50, destZ: 0 })],
      }),
      sys('D', {}),
    ])
    const d = buildMapData(map)
    expect(d.wormholes.linkCount).toBe(0)
    expect(d.wormholes.stubCount).toBe(2)
  })
})

describe('sectors and bounds', () => {
  it('uses cube centers at sector coordinate times 10 with size 10', () => {
    const d = buildMapData(mapOf([sys('A', { x: 750, y: 10, z: -20 })]))
    expect(d.sectors).toHaveLength(1)
    const s = d.sectors[0]!
    expect(s.size).toBe(SECTOR_SIZE)
    expect(s.center).toEqual([750, 10, -20])
    expect(s.min).toEqual([745, 5, -25])
    expect(s.max).toEqual([755, 15, -15])
    expect(s.name).toBe('Alpha')
    expect(s.systemCount).toBe(1)
  })

  it('computes bounds over points; sane defaults when empty', () => {
    const d = buildMapData(mapOf([sys('A', { x: 0, y: 0, z: 0 }), sys('B', { x: 10, y: 0, z: 0 })]))
    expect(d.bounds.center).toEqual([5, 0, 0])
    expect(d.bounds.radius).toBeCloseTo(5)
    const e = buildMapData(mapOf([]))
    expect(e.count).toBe(0)
    expect(e.bounds.radius).toBeGreaterThan(0)
  })
})

const samplePath = path.resolve(import.meta.dirname, '../../../sample/starmap.xml')
describe.skipIf(!existsSync(samplePath))('full sample map data', () => {
  const map = parseStarMap(readFileSync(samplePath, 'utf8'))

  it('prepares all systems, sectors and wormholes consistently', () => {
    const d = buildMapData(map)
    expect(d.count).toBe(map.systems.filter((s) => s.x !== undefined).length)
    expect(d.positions.length).toBe(d.count * 3)
    expect(d.sectors).toHaveLength(map.sectors.length)
    expect(d.wormholes.stubCount).toBe(
      map.systems.flatMap((s) => s.wormholes).filter((w) => w.destSystemId === undefined).length,
    )
    expect(d.wormholes.positions.length).toBe((d.wormholes.linkCount + d.wormholes.stubCount) * 6)
    expect(d.wormholes.linkCount).toBeGreaterThan(0)
    expect(Number.isFinite(d.bounds.radius)).toBe(true)
    // every system lies inside its sector cube (sector coordinate is the cube center / 10)
    const cube = new Map(d.sectors.map((s) => [s.sectorId, s]))
    for (const s of map.systems) {
      if (s.x === undefined || s.y === undefined || s.z === undefined) continue
      const c = cube.get(s.sectorId)!
      expect(s.x).toBeGreaterThanOrEqual(c.min[0])
      expect(s.x).toBeLessThan(c.max[0])
      expect(s.z).toBeGreaterThanOrEqual(c.min[2])
      expect(s.z).toBeLessThan(c.max[2])
    }
  })
})
