#!/usr/bin/env node
/**
 * Generates fixtures/mock-starmap.xml: a fully synthetic starmap export.
 *
 * Nothing here is derived from a real export. Names, ids, coordinates, dates and values are
 * invented by a seeded PRNG, so the output is byte-identical on every run. Resource names are
 * real game commodity names (public game data) plus one made-up name ("Mockium") that exercises
 * the Unknown path. See BLUEPRINT section 22.
 *
 * Usage: node scripts/gen-mock-starmap.mjs [outPath]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const outPath = path.resolve(process.argv[2] ?? path.join(root, 'fixtures/mock-starmap.xml'))

// ---- seeded PRNG (mulberry32) -------------------------------------------------------------

let state = 0x5eed1234
function rnd() {
  state = (state + 0x6d2b79f5) >>> 0
  let t = state
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))
const pick = (a) => a[Math.floor(rnd() * a.length)]
const chance = (p) => rnd() < p
/** Weighted pick: entries are [value, weight]. */
function weighted(entries) {
  const total = entries.reduce((s, e) => s + e[1], 0)
  let r = rnd() * total
  for (const [v, w] of entries) {
    r -= w
    if (r < 0) return v
  }
  return entries[entries.length - 1][0]
}

// ---- formatting helpers -------------------------------------------------------------------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const attrs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join('')
const commas = (n) => Math.round(n).toLocaleString('en-US')
const trim = (n, d = 2) => String(Number(n.toFixed(d)))
const fixed1 = (n) => n.toFixed(1)

// ---- name generators ----------------------------------------------------------------------

const ONSET = ['b', 'd', 'f', 'g', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z', 'br', 'dr', 'gl', 'kr', 'pl', 'st', 'th']
const VOWEL = ['a', 'e', 'i', 'o', 'u', 'ae', 'io']
const CODA = ['', '', 'n', 'r', 's', 'x', 'th', 'l']
const usedNames = new Set()
function syllableName() {
  for (;;) {
    let n = ''
    for (let i = int(2, 3); i > 0; i--) n += pick(ONSET) + pick(VOWEL)
    n += pick(CODA)
    n = n[0].toUpperCase() + n.slice(1)
    if (!usedNames.has(n)) {
      usedNames.add(n)
      return n
    }
  }
}
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const usedCatalogs = new Set()
function catalogName() {
  const up = (n) => Array.from({ length: n }, () => LETTERS[int(0, LETTERS.length - 1)]).join('')
  for (;;) {
    const c = `${up(3)}'${up(2)}'${up(2)}'${LETTERS[int(0, LETTERS.length - 1)].toLowerCase()}`
    if (!usedCatalogs.has(c)) {
      usedCatalogs.add(c)
      return c
    }
  }
}
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

// ---- id counters --------------------------------------------------------------------------

const counters = {}
function id(prefix) {
  counters[prefix] = (counters[prefix] ?? 0) + 1
  return `${prefix}${String(counters[prefix]).padStart(5, '0')}`
}

// ---- resources ----------------------------------------------------------------------------

const GEO = ['Adamantite', 'Bolite', 'Coal', 'Crystals', 'Eludium', 'Gems', 'Gold Ore', 'Ice', 'Lumenite', 'Minerals', 'Ore', 'Radioactives', 'Stone', 'Vulcanite', 'Oil', 'Natural Gas', 'Phlogiston', 'Polytaride', 'Viathol']
const HYDRO = ['Flomentum', 'Myrathane', 'Magmex', 'Water in the Environment', 'Water in the Environment', 'Oil']
const ATMO = ['Air', 'Cryozine', 'Hydrogen', 'Ioplasma', 'Antiflux Particles', 'Atmosphere Density']
const BIO = ['Animal Carcass', 'Beans', 'Cheese', 'Eggs', 'Fish', 'Fruit', 'Grain', 'Grapes', 'Hay', 'Herbs', 'Hops', 'Log', 'Milk', 'Nuts', 'Plant Fiber', 'Spices', 'Vegetable', 'Vegetation Density']
const STAR_RES = ['Type O Preons', 'Type B Preons', 'Type A Preons', 'Type F Preons', 'Type G Preons', 'Type K Preons', 'Type M Preons', 'Antiflux Particles', 'Borexino Precipitate']
const MADE_UP = 'Mockium'

const q = () => int(1, 255)
const ab = () => int(1, 100)

/** `names` -> n distinct resources, each with `zones` zone pairs (1 when zones omitted). */
function resourceXml(names, n, zones, indent) {
  const chosen = new Set()
  while (chosen.size < Math.min(n, names.length)) chosen.add(pick(names))
  return [...chosen]
    .sort()
    .map((name) => {
      const a = { name }
      for (let z = 1; z <= zones; z++) {
        a[`qualityZone${z}`] = q()
        a[`abundanceZone${z}`] = ab()
      }
      return `${indent}<resource${attrs(a)}/>`
    })
}

// ---- stars --------------------------------------------------------------------------------

const STAR_TYPES = [
  // type, size, temp range, diameter range (au), habitable range (au) or null, shell
  ['O Blue', 'V Main Sequence', [30000, 45000], [0.6, 1.2], [8, 14], 'Photosphere'],
  ['B Blue White', 'V Main Sequence', [12000, 29000], [0.4, 0.8], [4, 7], 'Photosphere'],
  ['A White', 'V Main Sequence', [8000, 11000], [0.3, 0.5], [2.5, 4], 'Photosphere'],
  ['F Yellow White', 'V Main Sequence', [6200, 7900], [0.2, 0.3], [1.5, 2.5], 'Photosphere'],
  ['G Yellow', 'V Main Sequence', [5100, 6100], [0.15, 0.25], [0.8, 1.6], 'Photosphere'],
  ['K Orange', 'V Main Sequence', [3700, 5000], [0.12, 0.2], [0.4, 0.9], 'Photosphere'],
  ['M Red', 'D Dwarf', [2500, 3600], [0.05, 0.15], null, 'Photosphere'],
  ['M Red', 'III Giant', [2800, 3600], [0.8, 1.6], null, 'Photosphere'],
  ['White Dwarf', '', [8000, 20000], [0.01, 0.03], null, 'Degenerate Sphere'],
  ['Neutron Star', '', [100000, 600000], [0.15, 0.3], null, 'Neutron Sphere'],
]
const PRIMARY_WEIGHTS = [4, 4, 6, 9, 14, 12, 14, 3, 2, 2]

function makeStar(sysName, label, orbit, forceType) {
  const idx = forceType ?? weighted(STAR_TYPES.map((_, i) => [i, PRIMARY_WEIGHTS[i]]))
  const [type, size, [t0, t1], [d0, d1], hab, shell] = STAR_TYPES[idx]
  const temp = int(t0, t1)
  const star = {
    starId: id('STR'),
    name: label ? `${sysName} ${label}` : sysName,
    type,
    orbit,
    size,
    spectralClass: size ? String(int(0, 9)) : undefined,
    surfaceTempK: `${commas(temp)}°K`,
    hab: hab ? `Habitable Zone at ${trim(hab[0] + rnd() * (hab[1] - hab[0]), 2)}au` : 'No Habitable Zone - Too Cool',
    shell,
    diameter: `${trim(d0 + rnd() * (d1 - d0), 3)}au Diameter`,
  }
  star.habAu = hab ? Number(star.hab.match(/at ([\d.]+)au/)[1]) : undefined
  return star
}

function starXml(star, indent) {
  const { habAu: _habAu, ...a } = star
  const lines = []
  const names = []
  const n = int(0, 2)
  while (names.length < n) {
    const r = pick(STAR_RES)
    if (!names.includes(r)) names.push(r)
  }
  names.sort()
  if (!names.length) return [`${indent}<star${attrs(a)}/>`]
  lines.push(`${indent}<star${attrs(a)}>`)
  for (const name of names) lines.push(`${indent}  <resource${attrs({ name, quality: q(), abundance: int(1, 12) })}/>`)
  lines.push(`${indent}</star>`)
  return lines
}

// ---- planets ------------------------------------------------------------------------------

const ZONES = ['Inferno', 'Inner', 'Habitable', 'Outer', 'Frigid', 'Penumbral']
function zoneFor(au, habAu) {
  if (!habAu) return au < 0.6 ? 'Inferno' : au < 1.5 ? 'Inner' : au < 4 ? 'Outer' : au < 9 ? 'Frigid' : 'Penumbral'
  const r = au / habAu
  return r < 0.35 ? 'Inferno' : r < 0.75 ? 'Inner' : r < 1.5 ? 'Habitable' : r < 3 ? 'Outer' : r < 6 ? 'Frigid' : 'Penumbral'
}
const ATMOS_TYPES = ['Exotic', 'Corrosive', 'Inert', 'Toxic', 'Infernal', 'Thin']
const LIQUIDS = ['Water', 'Water', 'Lava', 'Liquid']

function zoneCount() {
  return weighted([[1, 55], [2, 12], [3, 22], [4, 11]])
}

/** Returns planet record: attributes plus pre-rendered child lines. */
function makePlanet(o) {
  const { name, bodyType, orbit, zone, kind, habitable } = o
  const zones = o.zones ?? zoneCount()
  const lines = []
  const a = { planetId: id('PLN'), name, bodyType, orbit, zone: `${zone} Zone` }
  lines.push(`        <planet${attrs(a)}>`)

  // geosphere
  let diameter, gravity
  if (kind === 'ring') {
    const radius = int(30, 120) * 1000
    diameter = `${commas(radius)}m Radius<br>${commas(int(5, 25) * 1000)}m Width`
  } else if (kind === 'giant') {
    diameter = `${commas(int(2, 8) * 1000)}m Diameter`
    gravity = `${trim(int(2000, 9000) + rnd(), 2)}m/s² Core Gravity`
  } else if (kind === 'planetoid') {
    diameter = `${commas(int(5, 40) * 100)}m Diameter`
    gravity = `${trim(0.2 + rnd() * 2, 2)}m/s² Sea Level Gravity`
  } else if (kind === 'moon') {
    diameter = `${commas(int(8, 60) * 100)}m Diameter`
    gravity = `${trim(0.5 + rnd() * 4, 2)}m/s² Sea Level Gravity`
  } else if (kind === 'titan') {
    diameter = `${commas(int(60, 110) * 100)}m Diameter`
    gravity = `${trim(3 + rnd() * 6, 2)}m/s² Sea Level Gravity`
  } else {
    diameter = `${commas(int(60, 300) * 100)}m Diameter`
    gravity = `${trim(4 + rnd() * 14, 2)}m/s² Sea Level Gravity`
  }
  const nGeo = kind === 'ring' ? int(1, 2) : int(1, 4)
  lines.push(`          <geosphere${attrs({ diameter, gravity, resourceZones: zones })}>`)
  const geoNames = [...GEO]
  if (o.mockium) geoNames.push(MADE_UP)
  const geo = resourceXml(geoNames, nGeo, zones, '            ')
  if (o.mockium && !geo.some((l) => l.includes(`"${MADE_UP}"`))) geo.push(...resourceXml([MADE_UP], 1, zones, '            '))
  lines.push(...geo)
  lines.push('          </geosphere>')

  if (kind !== 'ring') {
    // hydrosphere
    const hasLiquid = habitable || kind === 'giant' || chance(0.4)
    const liquid = habitable ? 'Water' : pick(LIQUIDS)
    const surface = hasLiquid ? `${habitable ? int(30, 85) : int(5, 100)}% Surface ${liquid}` : 'No Surface Liquid'
    const hAttrs = { surfaceLiquid: surface }
    if (kind === 'giant') {
      hAttrs.diameter = `${commas(int(40, 120) * 1000)}m Diameter`
      hAttrs.gravity = `${trim(20 + rnd() * 40, 2)}m/s² Sea Level Gravity`
    }
    if (hasLiquid && chance(0.8)) {
      lines.push(`          <hydrosphere${attrs(hAttrs)}>`)
      lines.push(...resourceXml(HYDRO, int(1, 2), 1, '            '))
      lines.push('          </hydrosphere>')
    } else lines.push(`          <hydrosphere${attrs(hAttrs)}/>`)

    // atmosphere
    const hasAtmo = habitable || kind === 'giant' || chance(0.55)
    const atype = habitable ? 'Standard' : pick(ATMOS_TYPES)
    const comp = hasAtmo ? `${atype}, ${int(5, 100)}% Density` : 'No Atmosphere'
    if (hasAtmo && chance(0.8)) {
      lines.push(`          <atmosphere${attrs({ composition: comp })}>`)
      const names = o.antiflux ? ['Antiflux Particles'] : ATMO
      lines.push(...resourceXml(names, int(1, 2), 1, '            '))
      lines.push('          </atmosphere>')
    } else lines.push(`          <atmosphere${attrs({ composition: comp })}/>`)

    // biosphere
    if (habitable || (kind === 'planet' && chance(0.1))) {
      lines.push(`          <biosphere${attrs({ fauna: chance(0.6) ? 'yes' : 'no', flora: habitable || chance(0.5) ? 'yes' : 'no' })}>`)
      lines.push(...resourceXml(o.vegetation ? ['Vegetation Density', 'Fruit', 'Grain'] : BIO, int(2, 5), zones, '            '))
      lines.push('          </biosphere>')
    }
  }
  lines.push('        </planet>')
  return { name, lines }
}

// ---- systems ------------------------------------------------------------------------------

/**
 * Builds the body lists for one system. `spec` can force features so coverage is guaranteed:
 * giants (with rings and titans), habitable, mockium, antiflux, vegetation.
 */
function makeBodies(sysName, stars, spec) {
  const primary = stars[0]
  const bodies = []
  const habAu = primary.habAu
  let au = 0.2 + rnd() * 0.4
  const count = spec.planets ?? int(2, 5)
  let roman = 0
  for (let i = 0; i < count; i++) {
    au *= 1.5 + rnd() * 1.2
    const auStr = trim(au, 2)
    const deg = int(0, 359)
    const zone = zoneFor(au, habAu)
    const giant = spec.giants > i || (au > (habAu ?? 1.5) * 2 && chance(0.5))
    const habitable = spec.habitable && i === spec.habitableAt && !!habAu
    const hz = habitable ? 'Habitable' : zone
    const pname = `${sysName} ${ROMAN[roman++]}`
    const orbitStr = `Orbiting ${primary.name} at ${auStr}au ${deg}°`
    const kind = giant ? 'giant' : habitable ? 'planet' : chance(0.2) ? 'planetoid' : 'planet'
    const bodyType = giant ? 'Gas Giant' : kind === 'planetoid' ? 'Planetoid' : 'Planet'
    const extras = { mockium: spec.mockium === i, antiflux: spec.antiflux === i, vegetation: habitable }
    const parent = makePlanet({
      name: pname,
      bodyType,
      orbit: orbitStr,
      zone: hz,
      kind,
      habitable,
      zones: habitable ? Math.max(zoneCount(), 3) : undefined,
      ...extras,
    })
    bodies.push(parent)
    // satellites: moons for planets, moons/titans/rings for giants
    let letter = 0
    const sat = (bodyType, kind2, label, dist) => {
      const nm = `${pname}${label}`
      bodies.push(
        makePlanet({
          name: nm,
          bodyType,
          orbit: `Orbiting ${pname} at ${commas(dist)}m ${int(0, 359)}°`,
          zone: hz,
          kind: kind2,
          habitable: false,
        }),
      )
    }
    if (giant) {
      for (let m = int(0, 2); m > 0; m--) sat('Moon', 'moon', `-${String.fromCharCode(97 + letter++)}`, int(80, 400) * 1000)
      if (spec.titans || chance(0.2)) sat('Titan', 'titan', `-${String.fromCharCode(97 + letter++)}`, int(500, 900) * 1000)
      if (spec.rings || chance(0.4)) sat('Ring', 'ring', 'r', int(30, 120) * 1000)
    } else if (kind === 'planet') {
      for (let m = int(0, 2); m > 0; m--) sat('Moon', 'moon', `-${String.fromCharCode(97 + letter++)}`, int(30, 300) * 1000)
    }
  }
  return bodies
}

function makeWormholes(sys, all, polarityHint) {
  const out = []
  const n = polarityHint ? polarityHint.length : chance(0.5) ? int(1, 3) : 0
  for (let i = 0; i < n; i++) {
    const polarity = polarityHint?.[i] ?? pick(['positive', 'negative', 'neutral'])
    const explored = chance(0.6) ? 'Yes' : 'No'
    const linked = chance(0.8)
    if (linked) {
      const dest = pick(all.filter((s) => s !== sys && s.x !== undefined && s.cluster === sys.cluster))
      if (dest) {
        out.push({ destX: dest.x, destY: dest.y, destZ: dest.z, destSystemId: dest.systemId, explored, polarity })
        continue
      }
    }
    out.push({
      destX: Number((sys.x + (rnd() - 0.5) * 12).toFixed(1)),
      destY: Number((sys.y + (rnd() - 0.5) * 12).toFixed(1)),
      destZ: Number((sys.z + (rnd() - 0.5) * 12).toFixed(1)),
      explored,
      polarity,
    })
  }
  return out
}

// ---- world layout -------------------------------------------------------------------------

const EMPIRES = [
  { name: 'Mock Empire', id: '7' },
  { name: 'Test Dominion', id: '12' },
  { name: 'Placeholder Union', id: '31' },
]
const SECTOR_PLANS = [
  // [sx, sy, sz, systems]
  [41, 10, -3, 19],
  [42, 10, -3, 21],
  [41, 11, -3, 18],
  [42, 11, -3, 20],
  [41, 10, -2, 17],
  [42, 10, -2, 22],
  [41, 11, -2, 19],
  [42, 11, -2, 18],
]
const OUTLIER_PLAN = [420, -150, 90, 10]

const sectors = []
const allSystems = []
let first = true

function buildSector([sx, sy, sz, nSys], cluster) {
  const sector = { sectorId: id('SEC'), name: `${syllableName()} Sector`, x: sx, y: sy, z: sz, systems: [] }
  for (let i = 0; i < nSys; i++) {
    const deep = !cluster && i % 11 === 10
    const sys = {
      cluster: cluster ?? 'core',
      systemId: id('SYS'),
      sectorId: sector.sectorId,
      deep,
      eod: weighted([['Surveyed', 40], ['Explored', 35], ['Unexplored', 25]]),
    }
    if (!deep) {
      sys.x = Number((10 * sx - 5 + rnd() * 9.9).toFixed(1))
      sys.y = Number((10 * sy - 5 + rnd() * 9.9).toFixed(1))
      sys.z = Number((10 * sz - 5 + rnd() * 9.9).toFixed(1))
      sys.catalogName = catalogName()
      // roughly one in three is renamed (keeps its catalog name)
      sys.renamed = chance(0.35)
      sys.name = sys.renamed ? syllableName() : sys.catalogName
    } else sys.eod = 'Unexplored'
    sector.systems.push(sys)
    allSystems.push(sys)
  }
  sectors.push(sector)
}

for (const plan of SECTOR_PLANS) buildSector(plan, undefined)
buildSector(OUTLIER_PLAN, 'outlier')

// Force specific features onto fixed systems so coverage never depends on dice rolls.
const real = allSystems.filter((s) => !s.deep && s.cluster === 'core')
const surveyed = real.filter((s) => s.eod !== 'Unexplored')
const forced = new Map()
const force = (list, i, spec) => forced.set(list[i], { ...(forced.get(list[i]) ?? {}), ...spec })
force(surveyed, 0, { habitable: true, habitableAt: 1, planets: 4, giants: 1, titans: true, rings: true, vegetation: true })
force(surveyed, 1, { habitable: true, habitableAt: 0, planets: 3 })
force(surveyed, 2, { habitable: true, habitableAt: 2, planets: 4, mockium: 1 })
force(surveyed, 3, { giants: 2, planets: 4, titans: true, rings: true, antiflux: 0 })
force(surveyed, 4, { habitable: true, habitableAt: 1, planets: 3, antiflux: 2 })
force(surveyed, 5, { planets: 6, giants: 1, rings: true })
const multiStar = new Set([surveyed[0], surveyed[3], surveyed[6], surveyed[9], surveyed[12], real[1], real[4]])
const triple = surveyed[0]
const polarityForced = new Map([
  [real[0], ['positive', 'negative', 'neutral']],
  [real[7], ['negative']],
])
const cityPlan = new Map([
  [surveyed[0], [[0, true], [1, false]]],
  [surveyed[1], [[1, true]]],
  [surveyed[2], [[0, false], [0, false], [2, false]]],
  [surveyed[5], [[1, false]]],
  [real[2], [[0, false]]],
  [real[9], [[2, true]]],
  [real[14], [[null, false]]],
])

// ---- render -------------------------------------------------------------------------------

const out = []
out.push('<?xml version="1.0" encoding="UTF-8"?>')
out.push(`<starmap${attrs({ empireId: EMPIRES[0].id, empire: EMPIRES[0].name, createDate: 'Sat Jan 02 03:04:05 2100 GMT' })}>`)
out.push(`  <galaxy${attrs({ name: 'Mockverse' })}>`)

const STANCE = { 0: 'Empire', 1: 'Friend', 2: 'Neutral' }
const CAPITAL = ['Empire, Galaxy, Sector', 'Galaxy, Sector', 'Sector']

for (const sector of sectors) {
  out.push(`    <sector${attrs({ sectorId: sector.sectorId, name: sector.name, x: sector.x, y: sector.y, z: sector.z })}>`)
  for (const sys of sector.systems) {
    if (sys.deep) {
      out.push(`      <system${attrs({ systemId: sys.systemId, name: 'Deep Space', eod: 'Unexplored' })}/>`)
      continue
    }
    const sa = { systemId: sys.systemId, name: sys.name, catalog: sys.renamed ? sys.catalogName : undefined, x: fixed1(sys.x), y: fixed1(sys.y), z: fixed1(sys.z), eod: sys.eod }
    const lines = []
    // stars
    const primary = makeStar(sys.name, multiStar.has(sys) ? 'Alpha' : '', 'Primary', forced.get(sys)?.habitable ? 4 : undefined)
    const stars = [primary]
    if (multiStar.has(sys)) {
      stars.push(makeStar(sys.name, 'Beta', `Orbiting ${primary.name} at ${trim(1 + rnd() * 6, 2)}au ${int(0, 359)}°`, weighted([[2, 3], [6, 4], [8, 2], [9, 2]])))
    }
    if (sys === triple) {
      stars.push(makeStar(sys.name, 'Gamma', `Orbiting ${primary.name} at ${trim(9 + rnd() * 6, 2)}au ${int(0, 359)}°`, 6))
    }
    if (sys.eod === 'Unexplored' && sys.cluster !== 'outlier' && chance(0.15)) stars.length = 0
    for (const wh of makeWormholes(sys, allSystems, polarityForced.get(sys))) {
      lines.push(`        <wormhole${attrs({ destX: fixed1(wh.destX), destY: fixed1(wh.destY), destZ: fixed1(wh.destZ), destSystemId: wh.destSystemId, explored: wh.explored, polarity: wh.polarity })}/>`)
    }
    if (chance(0.15)) {
      lines.push(`        <spacecraft${attrs({ spacecraftId: id('SCR'), name: 'Mock Hauler', ownership: 'Fleet', structure: 'Spaceship', condition: 'Green', health: 255, moving: 'no', space: 'deep', sensors: 'yes', warpDrive: 'none', wormholeDrive: 'none', captain: 'no', officer: 'no', new: 'no' })}/>`)
    }
    for (const [emp, cap] of cityPlan.get(sys) ?? []) {
      const e = emp === null ? undefined : EMPIRES[emp]
      lines.push(
        `        <city${attrs({
          cityId: id('CTY'),
          name: `${syllableName()} Hold`,
          empire: e?.name,
          empireId: e?.id,
          stance: e ? STANCE[emp] : undefined,
          capital: cap ? CAPITAL[0] : undefined,
          admin: cap ? 'Capitol' : undefined,
          airport: cap ? 'Airport Terminal' : undefined,
        })}/>`,
      )
    }
    for (const st of stars) lines.push(...starXml(st, '        '))
    if (sys.eod !== 'Unexplored' && stars.length) {
      const spec = forced.get(sys) ?? { planets: chance(0.12) ? 0 : undefined, giants: chance(0.3) ? 1 : 0 }
      for (const b of makeBodies(sys.name, stars, spec)) lines.push(...b.lines)
    }
    if (lines.length) {
      out.push(`      <system${attrs(sa)}>`, ...lines, '      </system>')
    } else out.push(`      <system${attrs(sa)}/>`)
  }
  out.push('    </sector>')
}
out.push('  </galaxy>', '</starmap>', '')

mkdirSync(path.dirname(outPath), { recursive: true })
writeFileSync(outPath, out.join('\n'))
console.log(`wrote ${path.relative(process.cwd(), outPath)} (${out.join('\n').length} bytes)`)
