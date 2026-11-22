/**
 * Pure merge of two parsed starmap exports (BLUEPRINT section 23, M3-M8).
 * Never mutates its inputs; results share unmodified sub-objects with them.
 */
import { SCHEMA_VERSION, type Eod, type Sector, type StarMap, type System, type Wormhole } from './types'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
// "Sat Nov 21 17:25:58 2026 GMT"; weekday and zone are optional.
const EXPORT_DATE = /^(?:[A-Za-z]{3,9},?\s+)?([A-Za-z]{3,9})\s+(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(\d{4})(?:\s+(?:GMT|UTC|Z))?$/

/** Exporter `createDate` (or ISO text) to epoch ms in UTC; undefined when unparseable. */
export function parseExportDate(s: string | undefined): number | undefined {
  const t = s?.trim()
  if (!t) return undefined
  const m = EXPORT_DATE.exec(t)
  if (m) {
    const month = MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase())
    if (month < 0) return undefined
    const [day, h, min, sec, year] = [m[2], m[3], m[4], m[5], m[6]].map(Number) as [number, number, number, number, number]
    if (day < 1 || day > 31 || h > 23 || min > 59 || sec > 59) return undefined
    return Date.UTC(year, month, day, h, min, sec)
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(t)) return undefined
  const n = Date.parse(t)
  return Number.isFinite(n) ? n : undefined
}

const RANK: Record<Eod, number> = { Unexplored: 0, Explored: 1, Surveyed: 2 }

/** True when `incoming` (date text) is not older than `existing`; unparseable or equal -> true. */
function incomingNotOlder(existing: string, incoming: string): boolean {
  const a = parseExportDate(existing)
  const b = parseExportDate(incoming)
  return a === undefined || b === undefined || b >= a
}

/**
 * Winner's list stays intact (including its own repeats); loser items are added only when the winner
 * has nothing with the same key. `upgrade` lets a loser item replace the winner's first match.
 */
function unionBy<T>(
  win: readonly T[],
  lose: readonly T[],
  key: (t: T) => string,
  upgrade?: (matches: T[], next: T) => boolean,
): T[] {
  const out = [...win]
  const keys = new Map<string, number[]>()
  out.forEach((t, i) => keys.set(key(t), [...(keys.get(key(t)) ?? []), i]))
  for (const item of lose) {
    const k = key(item)
    const at = keys.get(k)
    if (!at) {
      keys.set(k, [out.length])
      out.push(item)
    } else if (upgrade?.(at.map((i) => out[i]!), item)) {
      out[at[0]!] = item
    }
  }
  return out
}

const r1 = (n: number) => Math.round(n * 10)
const wormholeKey = (w: Wormhole) =>
  w.destSystemId ? `id:${w.destSystemId}` : `xyz:${r1(w.destX)},${r1(w.destY)},${r1(w.destZ)}`

function unionLists(win: System, lose: System): Pick<System, 'cities' | 'spacecraft' | 'wormholes'> {
  return {
    cities: unionBy(win.cities, lose.cities, (c) => c.cityId),
    spacecraft: unionBy(win.spacecraft, lose.spacecraft, (c) => c.spacecraftId),
    // Explored wins over unexplored for the same destination.
    wormholes: unionBy(win.wormholes, lose.wormholes, wormholeKey, (matches, next) => next.explored && matches.every((w) => !w.explored)),
  }
}

export interface MergeStats {
  /** Incoming systems not present before. */
  added: number
  /** Systems where the incoming copy won. */
  updated: number
  /** Systems where the stored copy won (incoming lost precedence). */
  kept: number
}

export function mergeStarMaps(
  existing: StarMap,
  incoming: StarMap,
  opts: { mergeLists: boolean },
): { map: StarMap; stats: MergeStats } {
  const stats: MergeStats = { added: 0, updated: 0, kept: 0 }
  const dateOf = (s: System, m: StarMap) => s.sourceDate ?? m.createDate
  const stamp = (s: System, m: StarMap): System => ({ ...s, sourceDate: dateOf(s, m) })

  const incomingById = new Map(incoming.systems.map((s) => [s.systemId, s]))
  const seen = new Set<string>()
  const systems: System[] = []

  for (const ex of existing.systems) {
    const inc = incomingById.get(ex.systemId)
    seen.add(ex.systemId)
    if (!inc) {
      systems.push(stamp(ex, existing))
      continue
    }
    const exRank = RANK[ex.eod]
    const incRank = RANK[inc.eod]
    const incWins =
      incRank !== exRank ? incRank > exRank : incomingNotOlder(dateOf(ex, existing), dateOf(inc, incoming))
    const win = incWins ? stamp(inc, incoming) : stamp(ex, existing)
    const lose = incWins ? ex : inc
    if (incWins) stats.updated++
    else stats.kept++
    systems.push(opts.mergeLists ? { ...win, ...unionLists(win, lose) } : win)
  }
  for (const inc of incoming.systems) {
    if (seen.has(inc.systemId)) continue
    seen.add(inc.systemId)
    stats.added++
    systems.push(stamp(inc, incoming))
  }

  const incSectorsWin = incomingNotOlder(existing.createDate, incoming.createDate)
  const sectorById = new Map<string, Sector>(existing.sectors.map((s) => [s.sectorId, s]))
  for (const s of incoming.sectors) if (incSectorsWin || !sectorById.has(s.sectorId)) sectorById.set(s.sectorId, s)

  return {
    map: {
      schemaVersion: SCHEMA_VERSION,
      empireId: incoming.empireId,
      empire: incoming.empire,
      createDate: incoming.createDate,
      galaxyName: incoming.galaxyName,
      sectors: [...sectorById.values()],
      systems,
    },
    stats,
  }
}
