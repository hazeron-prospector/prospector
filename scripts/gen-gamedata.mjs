#!/usr/bin/env node
// Generates src/data/gamedata.generated.ts and public/icons/* from the Shores of Hazeron source.
// Usage: node scripts/gen-gamedata.mjs <game-source-dir> [--check] [--root <prospector-dir>]
//   --check  regenerate in memory and fail if the committed output differs (writes nothing)
// BLUEPRINT 13 and 14.1. Fails loudly on any unresolved bay member or missing icon.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Bay display order; also the function that lists each bay in dbcommodity.h. */
export const BAYS = [
  ['Prospector', 'HarvestProspectorCommodity'],
  ['Wildcatter', 'HarvestWildcatterCommodity'],
  ['Siphon', 'HarvestSiphonCommodity'],
  ['Atmosphere Condenser', 'HarvestAtmosphereCommodity'],
  ['Particle Collector', 'HarvestParticleCommodity'],
]

/**
 * Names used by the export that differ from the b_Commodity name. Applied by the app
 * (catalog.ts); the generator only checks the targets exist.
 */
export const EXPORT_ALIASES = { 'Water in the Environment': 'Water' }

/**
 * Explicit CID_* to b_Commodity name overrides. Normally ids are matched numerically
 * (enum value == b_Commodity.id), which already maps CID_CrudeOil (23) to "Oil" and
 * CID_Water (83) to "Water". An entry here is checked against the numeric result, so a
 * drift in the source is caught instead of silently re-mapped.
 */
/**
 * Biosphere products seen in exports that IsNaturalResource() omits. Matched by
 * b_Commodity name; the generator fails if one disappears from the source.
 */
export const EXTRA_RESOURCE_NAMES = ['Cheese', 'Eggs', 'Fertilizer', 'Milk']

export const CID_EXPECTED_NAMES = { CID_CrudeOil: 'Oil', CID_Water: 'Water', CID_GoldOre: 'Gold Ore' }

function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

/** CID_* name -> numeric id, following C enum rules (explicit value or previous + 1). */
export function parseCommodityEnum(header) {
  const m = /enum\s+COMMODITYID\s*\{([\s\S]*?)\};/.exec(stripComments(header))
  if (!m) throw new Error('enum COMMODITYID not found in dbcommodity.h')
  const ids = new Map()
  let next = 0
  for (const part of m[1].split(',')) {
    const t = part.trim()
    if (!t) continue
    const em = /^(\w+)\s*(?:=\s*(.+))?$/.exec(t)
    if (!em) throw new Error(`cannot parse enum entry: ${t}`)
    let value = next
    if (em[2] !== undefined) {
      const expr = em[2].trim()
      if (/^-?\d+$/.test(expr)) value = Number(expr)
      else {
        const rm = /^(\w+)\s*(?:([+-])\s*(\d+))?$/.exec(expr)
        if (!rm || !ids.has(rm[1])) throw new Error(`unsupported enum expression: ${t}`)
        value = ids.get(rm[1]) + (rm[2] ? (rm[2] === '+' ? 1 : -1) * Number(rm[3]) : 0)
      }
    }
    ids.set(em[1], value)
    next = value + 1
  }
  return ids
}

function splitTopLevel(s) {
  const out = []
  let cur = ''
  let inStr = false
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      cur += c
      if (c === "'") {
        if (s[i + 1] === "'") cur += s[++i]
        else inStr = false
      }
    } else if (c === "'") {
      inStr = true
      cur += c
    } else if (c === '(') {
      depth++
      cur += c
    } else if (c === ')') {
      depth--
      cur += c
    } else if (c === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += c
  }
  out.push(cur.trim())
  return out
}

const unquote = (v) => (v && v.startsWith("'") ? v.slice(1, -1).replace(/''/g, "'") : undefined)

/** b_Commodity rows: id -> { name, iconPath? }. */
export function parseCommodityRows(sql) {
  const rows = new Map()
  const re = /^INSERT INTO b_Commodity \(([^)]*)\) VALUES \((.*)\);\s*$/gm
  for (const m of sql.matchAll(re)) {
    const cols = m[1].split(',').map((c) => c.trim())
    const vals = splitTopLevel(m[2])
    if (cols.length !== vals.length) throw new Error(`column/value mismatch: ${m[0].slice(0, 80)}`)
    const get = (c) => vals[cols.indexOf(c)]
    const id = Number(get('id'))
    const name = unquote(get('name'))
    if (!Number.isInteger(id) || !name) throw new Error(`bad b_Commodity row: ${m[0].slice(0, 80)}`)
    const iconPath = cols.includes('iconPath') ? unquote(get('iconPath')) : undefined
    rows.set(id, { name, ...(iconPath ? { iconPath } : {}) })
  }
  if (rows.size === 0) throw new Error('no b_Commodity rows found')
  return rows
}

function bodyOf(header, fn) {
  const m = new RegExp(`${fn}\\s*\\(\\s*int\\s+index\\s*\\)\\s*\\{([\\s\\S]*?)\\n\\}`).exec(stripComments(header))
  if (!m) throw new Error(`function ${fn} not found`)
  const arr = /\{([^{}]*)\}\s*;/.exec(m[1])
  if (!arr) throw new Error(`no array in ${fn}`)
  return [...arr[1].matchAll(/\bCID_\w+/g)].map((x) => x[0])
}

/** CIDs that IsNaturalResource() returns true for (commented-out cases excluded). */
function naturalResourceCids(header) {
  const m = /IsNaturalResource\s*\(\s*COMMODITYID\s+cid\s*\)\s*\{([\s\S]*?)return true;/.exec(stripComments(header))
  if (!m) throw new Error('IsNaturalResource not found')
  return [...m[1].matchAll(/case\s+(CID_\w+)\s*:/g)].map((x) => x[1])
}

export function build(src) {
  const header = readFileSync(path.join(src, 'auglobal/dbcommodity.h'), 'utf8')
  const sql = readFileSync(path.join(src, 'shell.scripts/initstatic.sql'), 'utf8')
  const iconDir = path.join(src, 'auclientmailres/data')
  const enumIds = parseCommodityEnum(header)
  const rows = parseCommodityRows(sql)

  const resolve = (cid) => {
    const id = enumIds.get(cid)
    const row = id === undefined ? undefined : rows.get(id)
    if (!row) throw new Error(`${cid} does not resolve to a b_Commodity row`)
    const expected = CID_EXPECTED_NAMES[cid]
    if (expected !== undefined && expected !== row.name) {
      throw new Error(`${cid} resolved to "${row.name}", expected "${expected}"`)
    }
    return row
  }

  const table = new Map() // name -> { iconPath?, bays: Set }
  const touch = (row) => {
    if (!table.has(row.name)) table.set(row.name, { iconPath: row.iconPath, bays: new Set() })
    return table.get(row.name)
  }
  for (const [bay, fn] of BAYS) {
    const cids = bodyOf(header, fn)
    if (cids.length === 0) throw new Error(`${fn} lists no commodities`)
    for (const cid of cids) touch(resolve(cid)).bays.add(bay)
  }
  for (const cid of naturalResourceCids(header)) {
    const id = enumIds.get(cid)
    const row = id === undefined ? undefined : rows.get(id)
    if (row) touch(row) // pseudo CIDs without a row are not resources the app can show
  }
  for (const name of EXTRA_RESOURCE_NAMES) {
    const row = [...rows.values()].find((r) => r.name === name)
    if (!row) throw new Error(`extra resource "${name}" has no b_Commodity row`)
    touch(row)
  }
  for (const [alias, target] of Object.entries(EXPORT_ALIASES)) {
    if (!table.has(target)) throw new Error(`alias target "${target}" for "${alias}" is not in the table`)
  }

  const entries = []
  const icons = new Map() // file name -> source path
  for (const name of [...table.keys()].sort()) {
    const { iconPath, bays } = table.get(name)
    const bayList = BAYS.map(([b]) => b).filter((b) => bays.has(b))
    if (!iconPath) {
      if (bayList.length) throw new Error(`bay member "${name}" has no iconPath`)
      continue
    }
    const file = /^:data\/(c_[A-Za-z0-9_]+\.png)$/.exec(iconPath)?.[1]
    if (!file) throw new Error(`unexpected iconPath for "${name}": ${iconPath}`)
    const from = path.join(iconDir, file)
    if (!existsSync(from)) {
      if (bayList.length) throw new Error(`icon file missing for bay member "${name}": ${from}`)
      continue
    }
    icons.set(file, from)
    entries.push({ name, icon: `icons/${file}`, bays: bayList })
  }

  const lines = [
    '// GENERATED by scripts/gen-gamedata.mjs from the Shores of Hazeron source. Do not edit.',
    '// Icons (c) Hazeron Freehold LLC, see NOTICE. Regenerate with `npm run gen:gamedata`.',
    '',
    'export interface GameResource {',
    '  /** URL relative to the site base, e.g. icons/c_Gems.png */',
    '  icon: string',
    '  /** Harvester bays that can collect this resource, in display order. */',
    '  bays: readonly string[]',
    '}',
    '',
    '/** Resource name (as exported) to icon and bays. Lookup keys only, never file paths. */',
    'export const GAME_RESOURCES: Readonly<Record<string, GameResource>> = {',
    ...entries.map(
      (e) => `  ${JSON.stringify(e.name)}: { icon: ${JSON.stringify(e.icon)}, bays: ${JSON.stringify(e.bays)} },`,
    ),
    '}',
    '',
    '/** Export names that stand for another resource. */',
    'export const RESOURCE_ALIASES: Readonly<Record<string, string>> = {',
    ...Object.entries(EXPORT_ALIASES)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([a, t]) => `  ${JSON.stringify(a)}: ${JSON.stringify(t)},`),
    '}',
    '',
  ]
  return { ts: lines.join('\n'), icons }
}

function main() {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const ri = args.indexOf('--root')
  const root = ri >= 0 ? path.resolve(args[ri + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--root')
  if (positional.length !== 1) {
    console.error('usage: node scripts/gen-gamedata.mjs <game-source-dir> [--check] [--root <dir>]')
    process.exit(2)
  }
  const { ts, icons } = build(path.resolve(positional[0]))
  const tsPath = path.join(root, 'src/data/gamedata.generated.ts')
  const iconOut = path.join(root, 'public/icons')
  if (check) {
    const same = existsSync(tsPath) && readFileSync(tsPath, 'utf8') === ts
    const have = existsSync(iconOut) ? readdirSync(iconOut).sort() : []
    const want = [...icons.keys()].sort()
    if (!same || have.join() !== want.join()) {
      console.error('generated game data is out of date; run npm run gen:gamedata')
      process.exit(1)
    }
    console.log('gamedata up to date')
    return
  }
  writeFileSync(tsPath, ts)
  rmSync(iconOut, { recursive: true, force: true })
  mkdirSync(iconOut, { recursive: true })
  for (const [file, from] of icons) copyFileSync(from, path.join(iconOut, file))
  // The license notice must travel with the icons and be reachable from the built site.
  const notice = path.join(root, 'NOTICE')
  if (existsSync(notice)) copyFileSync(notice, path.join(root, 'public/NOTICE.txt'))
  console.log(`wrote ${tsPath} and ${icons.size} icons`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (e) {
    console.error(`gen-gamedata: ${e.message}`)
    process.exit(1)
  }
}
