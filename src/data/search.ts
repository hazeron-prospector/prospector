/** Search index and fuzzy matcher for the command palette (BLUEPRINT 14.4). Pure, no dependencies. */
import type { Planet, Star, StarMap } from './types'

export type SearchKind = 'system' | 'body' | 'resource' | 'sector'

interface EntryBase {
  /** Id in its own namespace (systemId, planetId/starId, resource name, first sectorId). */
  id: string
  label: string
  /** Lower-cased label, precomputed for matching. */
  lower: string
}

export interface SystemEntry extends EntryBase {
  kind: 'system'
  sectorName: string
  /** Original catalog name when the system was renamed. */
  catalog?: string
  /** Pre-lowercased catalog. */
  catalogLower?: string
}

export interface BodyEntry extends EntryBase {
  kind: 'body'
  bodyKind: 'planet' | 'star'
  /** Planet bodyType, or star type. */
  bodyType: string
  systemId: string
  systemName: string
}

export interface ResourceEntry extends EntryBase {
  kind: 'resource'
  /** Deposits (planet zones rows / star resources) of this resource in the whole map. */
  depositCount: number
  bestQuality: number
}

export interface SectorEntry extends EntryBase {
  kind: 'sector'
  /** Every sectorId with this name (the sample has many sectors named just "Sector"). */
  sectorIds: string[]
  systemCount: number
}

export type SearchEntry = SystemEntry | BodyEntry | ResourceEntry | SectorEntry

export interface SearchIndex {
  entries: SearchEntry[]
}

export interface FuzzyMatch {
  /** Higher is better; comparable across texts. */
  score: number
  /** Indices into the original text of the matched characters, ascending. */
  indices: number[]
}

const isWordChar = (c: string): boolean => /[\p{L}\p{N}]/u.test(c)

function atWordStart(text: string, i: number): boolean {
  return i === 0 || !isWordChar(text[i - 1]!)
}

function range(start: number, len: number): number[] {
  return Array.from({ length: len }, (_, k) => start + k)
}

/**
 * Case-insensitive match of `query` against `text`. Tiers (score bands):
 * exact 1000 > prefix 800 > word start 600 (contiguous, at a word boundary; spaces and
 * punctuation such as apostrophes are boundaries) > inner substring 400 > subsequence (<400).
 * Within a band shorter text scores slightly higher. Undefined when no match or empty query.
 */
export function fuzzyMatch(text: string, query: string): FuzzyMatch | undefined {
  const q = query.toLowerCase()
  if (!q) return undefined
  const t = text.toLowerCase()
  const lenPenalty = Math.min(t.length, 200) * 0.01
  if (t === q) return { score: 1000 - lenPenalty, indices: range(0, q.length) }
  if (t.startsWith(q)) return { score: 800 - lenPenalty, indices: range(0, q.length) }
  let inner = -1
  for (let from = t.indexOf(q); from >= 0; from = t.indexOf(q, from + 1)) {
    if (atWordStart(text, from)) return { score: 600 - lenPenalty - from * 0.001, indices: range(from, q.length) }
    if (inner < 0) inner = from
  }
  if (inner >= 0) return { score: 400 - lenPenalty - inner * 0.001, indices: range(inner, q.length) }

  // Subsequence: greedy left to right, preferring a word-start position for each character
  // when one exists before the next plain occurrence.
  const indices: number[] = []
  let pos = 0
  for (const ch of q) {
    let plain = -1
    let boundary = -1
    for (let i = pos; i < t.length; i++) {
      if (t[i] !== ch) continue
      if (plain < 0) plain = i
      if (atWordStart(text, i)) {
        boundary = i
        break
      }
    }
    if (plain < 0) return undefined
    const pick = boundary >= 0 && boundary - plain <= 3 ? boundary : plain
    indices.push(pick)
    pos = pick + 1
  }
  let score = 300 - lenPenalty
  for (let k = 0; k < indices.length; k++) {
    if (k > 0) score += indices[k] === indices[k - 1]! + 1 ? 6 : -Math.min(indices[k]! - indices[k - 1]! - 1, 10) * 0.8
    if (atWordStart(text, indices[k]!)) score += 8
  }
  score -= indices[0]! * 0.5
  return { score: Math.max(1, Math.min(score, 399)), indices }
}

/** Per-table quick filter helper: case-insensitive substring; returns `[start, end)` or undefined. */
export function substringMatch(text: string, q: string): [number, number] | undefined {
  if (!q) return undefined
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  return i < 0 ? undefined : [i, i + q.length]
}

export function buildSearchIndex(map: StarMap): SearchIndex {
  const entries: SearchEntry[] = []
  const sectorNames = new Map(map.sectors.map((s) => [s.sectorId, s.name]))
  const sectorSystems = new Map<string, number>()
  const resources = new Map<string, { n: number; best: number }>()
  const note = (name: string, quality: number): void => {
    const r = resources.get(name)
    if (r) {
      r.n++
      if (quality > r.best) r.best = quality
    } else resources.set(name, { n: 1, best: quality })
  }
  const body = (b: Planet | Star, bodyKind: 'planet' | 'star', id: string, type: string, sysId: string, sysName: string): void => {
    entries.push({ kind: 'body', bodyKind, id, label: b.name, lower: b.name.toLowerCase(), bodyType: type, systemId: sysId, systemName: sysName })
  }

  for (const sys of map.systems) {
    sectorSystems.set(sys.sectorId, (sectorSystems.get(sys.sectorId) ?? 0) + 1)
    // Unnamed Deep Space systems are indistinguishable; leave them out unless they carry a catalog name.
    if (sys.name !== 'Deep Space' || sys.catalog) {
      const e: SystemEntry = {
        kind: 'system',
        id: sys.systemId,
        label: sys.name,
        lower: sys.name.toLowerCase(),
        sectorName: sectorNames.get(sys.sectorId) ?? '',
      }
      if (sys.catalog) {
        e.catalog = sys.catalog
        e.catalogLower = sys.catalog.toLowerCase()
      }
      entries.push(e)
    }
    for (const s of sys.stars) {
      body(s, 'star', s.starId, s.type, sys.systemId, sys.name)
      for (const r of s.resources) note(r.name, r.quality)
    }
    for (const p of sys.planets) {
      body(p, 'planet', p.planetId, p.bodyType, sys.systemId, sys.name)
      for (const sphere of [p.geosphere, p.hydrosphere, p.atmosphere, p.biosphere]) {
        for (const r of sphere?.resources ?? []) note(r.name, Math.max(...r.zones.map((z) => z.quality)))
      }
    }
  }

  for (const [name, r] of resources) {
    entries.push({ kind: 'resource', id: name, label: name, lower: name.toLowerCase(), depositCount: r.n, bestQuality: r.best })
  }

  const bySectorName = new Map<string, SectorEntry>()
  for (const s of map.sectors) {
    const count = sectorSystems.get(s.sectorId) ?? 0
    const e = bySectorName.get(s.name)
    if (e) {
      e.sectorIds.push(s.sectorId)
      e.systemCount += count
    } else {
      bySectorName.set(s.name, { kind: 'sector', id: s.sectorId, label: s.name, lower: s.name.toLowerCase(), sectorIds: [s.sectorId], systemCount: count })
    }
  }
  entries.push(...bySectorName.values())
  return { entries }
}

export interface SearchHit {
  entry: SearchEntry
  score: number
  /** Indices into `entry.label` (matchedVia 'name') or `entry.catalog` ('catalog'). */
  indices: number[]
  matchedVia: 'name' | 'catalog'
}

export interface SearchGroup {
  kind: SearchKind
  /** Best-first, at most `perGroupCap`. */
  hits: SearchHit[]
  /** Matches before capping. */
  total: number
}

export interface SearchOptions {
  /** Default 8. */
  perGroupCap?: number
}

const GROUP_ORDER: SearchKind[] = ['system', 'body', 'resource', 'sector']
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

/**
 * Fuzzy search grouped by kind (order: system, body, resource, sector; empty groups omitted).
 * Hits ranked by score, then label, then id. A system whose catalog name matches better than its
 * display name is returned with `matchedVia: 'catalog'` and indices into the catalog name.
 * An empty or whitespace-only query returns no groups.
 */
export function search(index: SearchIndex, query: string, opts: SearchOptions = {}): SearchGroup[] {
  const q = query.trim()
  if (!q) return []
  const cap = opts.perGroupCap ?? 8
  const buckets = new Map<SearchKind, SearchHit[]>()
  for (const entry of index.entries) {
    let hit: SearchHit | undefined
    const m = fuzzyMatch(entry.label, q)
    if (m) hit = { entry, score: m.score, indices: m.indices, matchedVia: 'name' }
    if (entry.kind === 'system' && entry.catalog) {
      const c = fuzzyMatch(entry.catalog, q)
      if (c && (!hit || c.score > hit.score)) hit = { entry, score: c.score, indices: c.indices, matchedVia: 'catalog' }
    }
    if (!hit) continue
    const list = buckets.get(entry.kind)
    if (list) list.push(hit)
    else buckets.set(entry.kind, [hit])
  }
  const groups: SearchGroup[] = []
  for (const kind of GROUP_ORDER) {
    const hits = buckets.get(kind)
    if (!hits) continue
    hits.sort((a, b) => b.score - a.score || collator.compare(a.entry.label, b.entry.label) || (a.entry.id < b.entry.id ? -1 : 1))
    groups.push({ kind, hits: hits.slice(0, cap), total: hits.length })
  }
  return groups
}
