import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { BAY_CATEGORIES } from './catalog'
import { GAME_RESOURCES, RESOURCE_ALIASES } from './gamedata.generated'

const root = path.resolve(import.meta.dirname, '../..')
const script = path.join(root, 'scripts/gen-gamedata.mjs')
const fakeSource = path.join(root, 'scripts/__fixtures__/fake-game-source')

describe('generated game data', () => {
  it('maps every name to an icon file that exists in public/icons', () => {
    for (const [name, r] of Object.entries(GAME_RESOURCES)) {
      expect(r.icon, name).toMatch(/^icons\/c_[A-Za-z0-9_]+\.png$/)
      expect(existsSync(path.join(root, 'public', r.icon)), `${name} -> ${r.icon}`).toBe(true)
    }
  })

  it('bay membership matches the game source (BLUEPRINT 13.2; CID_CrudeOil is Oil)', () => {
    const bays: Record<string, string[]> = {
      'Atmosphere Condenser': ['Air', 'Cryozine', 'Hydrogen', 'Ioplasma'],
      Prospector: ['Bolite', 'Coal', 'Crystals', 'Eludium', 'Gems', 'Gold Ore', 'Ice', 'Lumenite', 'Minerals', 'Ore', 'Radioactives', 'Stone', 'Vulcanite', 'Adamantite'],
      'Particle Collector': ['Antiflux Particles', 'Borexino Precipitate', 'Type O Preons', 'Type B Preons', 'Type A Preons', 'Type F Preons', 'Type G Preons', 'Type K Preons', 'Type M Preons'],
      Siphon: ['Magmex', 'Myrathane', 'Water', 'Flomentum'],
      Wildcatter: ['Natural Gas', 'Oil', 'Phlogiston', 'Polytaride', 'Water', 'Viathol'],
    }
    for (const [bay, names] of Object.entries(bays)) {
      const got = Object.entries(GAME_RESOURCES).filter(([, r]) => r.bays.includes(bay)).map(([n]) => n)
      expect(got.sort(), bay).toEqual([...names].sort())
    }
  })

  it('alias targets exist in the table', () => {
    expect(RESOURCE_ALIASES['Water in the Environment']).toBe('Water')
    for (const t of Object.values(RESOURCE_ALIASES)) expect(GAME_RESOURCES[t]).toBeDefined()
  })

  it('NOTICE is present and shipped with the site', () => {
    expect(existsSync(path.join(root, 'NOTICE'))).toBe(true)
    expect(existsSync(path.join(root, 'public/NOTICE.txt'))).toBe(true)
  })

  it('has no unreferenced icon files in public/icons', () => {
    const referenced = new Set(Object.values(GAME_RESOURCES).map((r) => path.basename(r.icon)))
    const files = readdirSync(path.join(root, 'public/icons')).filter((f) => f.endsWith('.png'))
    expect(files.filter((f) => !referenced.has(f))).toEqual([])
  })

  it('every bay member is a name in the table and bays are known categories', () => {
    for (const [name, r] of Object.entries(GAME_RESOURCES)) {
      expect(new Set(r.bays).size, name).toBe(r.bays.length)
      for (const bay of r.bays) expect(BAY_CATEGORIES as readonly string[], `${name} -> ${bay}`).toContain(bay)
    }
    for (const bay of BAY_CATEGORIES) {
      expect(Object.values(GAME_RESOURCES).some((r) => r.bays.includes(bay)), bay).toBe(true)
    }
  })

  it('aliases do not shadow real names', () => {
    for (const alias of Object.keys(RESOURCE_ALIASES)) expect(GAME_RESOURCES[alias], alias).toBeUndefined()
  })
})

// The generator itself runs against a small fake game source kept inside the repo.
// Checking against the real game source is a manual step: `npm run check:gamedata`.
describe('gen-gamedata script', () => {
  function run(source: string, extra: string[] = []) {
    const out = mkdtempSync(path.join(tmpdir(), 'gen-gamedata-out-'))
    mkdirSync(path.join(out, 'src/data'), { recursive: true })
    const r = spawnSync('node', [script, source, '--root', out, ...extra], { encoding: 'utf8' })
    return { r, out }
  }

  it('generates a table, copies icons, and passes --check on its own output', () => {
    const { r, out } = run(fakeSource)
    expect(r.status, r.stderr).toBe(0)
    const ts = readFileSync(path.join(out, 'src/data/gamedata.generated.ts'), 'utf8')
    expect(ts).toContain('"A": { icon: "icons/c_A.png", bays: ["Prospector"] }')
    expect(ts).toContain('"B": { icon: "icons/c_B.png"')
    expect(existsSync(path.join(out, 'public/icons/c_A.png'))).toBe(true)
    const check = spawnSync('node', [script, fakeSource, '--root', out, '--check'], { encoding: 'utf8' })
    expect(check.status, check.stderr).toBe(0)
  })

  it('fails loudly when a bay member does not resolve', () => {
    const src = mkdtempSync(path.join(tmpdir(), 'gen-gamedata-src-'))
    cpSync(fakeSource, src, { recursive: true })
    const header = path.join(src, 'auglobal/dbcommodity.h')
    writeFileSync(header, readFileSync(header, 'utf8').replace('CID_A,', 'CID_A,\n\t\tCID_Missing,'))
    const { r } = run(src)
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('CID_Missing')
  })
})
