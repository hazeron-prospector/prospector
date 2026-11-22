import { readFileSync } from 'node:fs'
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
  HABITABLE_COLOR,
  NEUTRAL_COLOR,
  UNEXPLORED_DIM,
  starColor,
  WORMHOLE_EXPLORED,
  WORMHOLE_OPACITY,
  WORMHOLE_UNEXPLORED,
} from './mapdata'
import { parseStarMap } from './parse'
import type { Eod, Planet, StarMap, System, Wormhole } from './types'

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
    spacecraft: [],
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

  it('default styling: neutral color, Unexplored dimmed, Surveyed ringed, no star color', () => {
    const d = buildMapData(map)
    close(d.colors.subarray(0, 3), NEUTRAL_COLOR) // Explored
    close(d.colors.subarray(3, 6), NEUTRAL_COLOR.map((c) => c * UNEXPLORED_DIM)) // Unexplored
    close(d.colors.subarray(6, 9), NEUTRAL_COLOR) // Surveyed
    expect(d.sizes[1]).toBeLessThan(d.sizes[0]!)
    expect(d.sizes[0]).toBeCloseTo(SIZE_EXPLORED)
    expect(Array.from(d.rings)).toEqual([0, 0, 1])
  })

  it('default styling ignores star type', () => {
    const m = mapOf([sys('A', { x: 0, y: 0, z: 0, type: 'M Red' }), sys('B', { x: 1, y: 0, z: 0, type: 'O Blue' })])
    const d = buildMapData(m)
    close(d.colors.subarray(0, 3), NEUTRAL_COLOR)
    close(d.colors.subarray(3, 6), NEUTRAL_COLOR)
  })

  it('systems with a habitable world are green; Unexplored ones stay dim', () => {
    const habitable = { zone: 'Habitable', atmosphere: { atmosphereType: 'Standard', resources: [] } } as unknown as Planet
    const barren = { zone: 'Inner', atmosphere: { atmosphereType: 'Standard', resources: [] } } as unknown as Planet
    const m = mapOf([
      sys('A', { x: 0, y: 0, z: 0, planets: [barren, habitable] }),
      sys('B', { x: 1, y: 0, z: 0, planets: [barren] }),
      sys('C', { x: 2, y: 0, z: 0, eod: 'Surveyed', planets: [habitable] }),
    ])
    const d = buildMapData(m)
    close(d.colors.subarray(0, 3), HABITABLE_COLOR)
    close(d.colors.subarray(3, 6), NEUTRAL_COLOR)
    close(d.colors.subarray(6, 9), HABITABLE_COLOR)
    expect(d.rings[2]).toBe(1)
    // star color mode ignores habitability
    close(buildMapData(m, undefined, { starColor: true }).colors.subarray(0, 3), starColor('G Yellow'))
  })

  it('starColor option restores star-color styling with dim Unexplored and ringed Surveyed', () => {
    const d = buildMapData(map, undefined, { starColor: true })
    const g = starColor('G Yellow')
    close(d.colors.subarray(0, 3), g)
    close(d.colors.subarray(3, 6), g.map((c) => c * UNEXPLORED_DIM))
    expect(Array.from(d.rings)).toEqual([0, 0, 1])
  })

  it('status off: no dim, no ring, uniform size', () => {
    const d = buildMapData(map, undefined, { status: false })
    close(d.colors.subarray(3, 6), NEUTRAL_COLOR)
    expect(Array.from(d.rings)).toEqual([0, 0, 0])
    expect(Array.from(d.sizes)).toEqual([SIZE_EXPLORED, SIZE_EXPLORED, SIZE_EXPLORED])
  })

  it('resource highlight overrides habitable and star color', () => {
    const habitable = { zone: 'Habitable', atmosphere: { atmosphereType: 'Standard', resources: [] } } as unknown as Planet
    const m = mapOf([sys('A', { x: 0, y: 0, z: 0, planets: [habitable] })])
    close(buildMapData(m, new Map([['A', 255]]), { starColor: true }).colors.subarray(0, 3), qualityRgb(255))
    expect(buildMapData(m, new Map()).sizes[0]).toBe(SIZE_DIM)
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

describe('wormholes (in-game style, W14)', () => {
  it('uses the in-game flat colors and opacity', () => {
    close(WORMHOLE_EXPLORED, [192 / 255, 64 / 255, 32 / 255])
    close(WORMHOLE_UNEXPLORED, [32 / 255, 64 / 255, 192 / 255])
    expect(WORMHOLE_OPACITY).toBeCloseTo(200 / 255)
  })

  it('draws a flat-colored line per wormhole to destX/Y/Z, colored by explored, ignoring polarity', () => {
    const map = mapOf([
      sys('A', {
        x: 0, y: 0, z: 0,
        wormholes: [
          wh({ destX: 100, destY: 0, destZ: 0, explored: true, polarity: 'negative' }),
          wh({ destX: 0, destY: 50, destZ: 0, explored: false, polarity: 'positive' }),
        ],
      }),
    ])
    const w = buildMapData(map).wormholes
    expect(w.exploredCount).toBe(1)
    expect(w.unexploredCount).toBe(1)
    close(w.positions, [0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 50, 0]) // full length, no stubs
    close(w.colors.subarray(0, 3), WORMHOLE_EXPLORED)
    close(w.colors.subarray(3, 6), WORMHOLE_EXPLORED) // no gradient
    close(w.colors.subarray(6, 9), WORMHOLE_UNEXPLORED)
    close(w.colors.subarray(9, 12), WORMHOLE_UNEXPLORED)
  })

  it('dedupes A->B / B->A into one line; explored wins', () => {
    const map = mapOf([
      sys('A', { x: 0, y: 0, z: 0, wormholes: [wh({ destSystemId: 'B', destX: 10, explored: false })] }),
      sys('B', { x: 10, y: 0, z: 0, wormholes: [wh({ destSystemId: 'A', destX: 0, explored: true })] }),
    ])
    const w = buildMapData(map).wormholes
    expect(w.exploredCount).toBe(1)
    expect(w.unexploredCount).toBe(0)
    expect(w.positions).toHaveLength(6)
    close(w.colors.subarray(0, 3), WORMHOLE_EXPLORED)
  })

  it('dedupes a reverse link whose destination is only known by coordinates', () => {
    const map = mapOf([
      sys('A', { x: 0, y: 0, z: 0, wormholes: [wh({ destX: 10, destY: 0, destZ: 0 })] }),
      sys('B', { x: 10, y: 0, z: 0, wormholes: [wh({ destSystemId: 'A', destX: 0, destY: 0, destZ: 0 })] }),
    ])
    expect(buildMapData(map).wormholes.exploredCount).toBe(1)
  })

  it('per system, keeps only the explored wormhole when both go to the same destination', () => {
    const map = mapOf([
      sys('A', {
        x: 0, y: 0, z: 0,
        wormholes: [
          wh({ destX: 50, destY: 0, destZ: 0, explored: false }),
          wh({ destX: 50, destY: 0, destZ: 0, explored: true }),
          wh({ destX: 50, destY: 0, destZ: 0, explored: false }),
          wh({ destX: 0, destY: 50, destZ: 0, explored: false }),
        ],
      }),
    ])
    const w = buildMapData(map).wormholes
    expect(w.exploredCount).toBe(1)
    expect(w.unexploredCount).toBe(1)
  })

  it('keeps unexplored when there is no explored wormhole to that destination', () => {
    const map = mapOf([
      sys('A', { x: 0, y: 0, z: 0, wormholes: [wh({ destX: 5, destY: 0, destZ: 0, explored: false }), wh({ destX: 5, destY: 0, destZ: 0, explored: false })] }),
    ])
    expect(buildMapData(map).wormholes.unexploredCount).toBe(1)
  })

  it('draws lines to destinations outside the map and skips self links', () => {
    const map = mapOf([
      sys('A', { x: 0, y: 0, z: 0, wormholes: [wh({ destSystemId: 'ZZZ', destX: 500, destY: 0, destZ: 0 }), wh({ destSystemId: 'A' }), wh({ destX: 0, destY: 0, destZ: 0 })] }),
      sys('D', {}), // Deep Space: no point to draw from
    ])
    const w = buildMapData(map).wormholes
    expect(w.exploredCount).toBe(1)
    close(w.positions, [0, 0, 0, 500, 0, 0])
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

  it('frames the dense core, ignoring far outliers (bounds still cover everything)', () => {
    const pts = [[0, 0, 0], [10, 0, 0], [0, 10, 0], [10, 10, 0], [5, 5, 5], [5, 5, -5], [4, 6, 0], [6, 4, 0], [5, 5, 0], [3, 3, 0], [1000, 0, 0]]
    const d = buildMapData(mapOf(pts.map((p, i) => sys(`S${i}`, { x: p[0]!, y: p[1]!, z: p[2]! }))))
    expect(d.frame.center[0]).toBeCloseTo(5)
    expect(d.frame.radius).toBeLessThan(15)
    expect(d.bounds.radius).toBeGreaterThan(400)
  })
  it('frame equals bounds without outliers', () => {
    const d = buildMapData(mapOf([sys('A', { x: 0, y: 0, z: 0 }), sys('B', { x: 10, y: 0, z: 0 }), sys('C', { x: 5, y: 5, z: 0 })]))
    expect(d.frame).toEqual(d.bounds)
    expect(buildMapData(mapOf([])).frame.radius).toBeGreaterThan(0)
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

const mockPath = path.resolve(import.meta.dirname, '../../fixtures/mock-starmap.xml')
describe('mock starmap map data', () => {
  const map = parseStarMap(readFileSync(mockPath, 'utf8'))

  it('prepares all systems, sectors and wormholes consistently', () => {
    const d = buildMapData(map)
    expect(d.count).toBe(map.systems.filter((s) => s.x !== undefined).length)
    expect(d.positions.length).toBe(d.count * 3)
    expect(d.sectors).toHaveLength(map.sectors.length)
    const total = d.wormholes.exploredCount + d.wormholes.unexploredCount
    expect(d.wormholes.positions.length).toBe(total * 6)
    expect(d.wormholes.colors.length).toBe(total * 6)
    expect(d.wormholes.exploredCount).toBeGreaterThan(0)
    expect(d.wormholes.unexploredCount).toBeGreaterThan(0)
    expect(total).toBeLessThanOrEqual(map.systems.flatMap((s) => s.wormholes).length)
    expect(Number.isFinite(d.bounds.radius)).toBe(true)
    // bounds match the system position extents exactly (not wormhole lines or sector cubes)
    const ext = [0, 1, 2].map((k) => {
      const v = map.systems.filter((s) => s.x !== undefined).map((s) => [s.x!, s.y!, s.z!][k]!)
      return [Math.min(...v), Math.max(...v)] as const
    })
    ext.forEach(([lo, hi], k) => expect(d.bounds.center[k]).toBeCloseTo((lo + hi) / 2, 3))
    const half = Math.max(...ext.map(([lo, hi]) => (hi - lo) / 2))
    expect(d.bounds.radius).toBeGreaterThanOrEqual(half)
    expect(d.bounds.radius).toBeLessThanOrEqual(Math.hypot(...ext.map(([lo, hi]) => (hi - lo) / 2)) + 1e-3)
    // the frame hugs the dense core: far outliers do not shrink the main cluster to a blob
    expect(d.frame.radius).toBeLessThan(d.bounds.radius / 4)
    const outlierSector = map.sectors.find((s) => s.x === 420)!
    const outliers = map.systems.filter((s) => s.sectorId === outlierSector.sectorId).length
    const inside = [...Array(d.count).keys()].filter(
      (i) => Math.hypot(...[0, 1, 2].map((k) => d.positions[i * 3 + k]! - d.frame.center[k]!)) <= d.frame.radius * 1.001,
    ).length
    expect(inside).toBe(d.count - outliers) // exactly the distant 10-system cluster is cut
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
