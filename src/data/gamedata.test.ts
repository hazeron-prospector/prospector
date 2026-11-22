import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { GAME_RESOURCES, RESOURCE_ALIASES } from './gamedata.generated'

const root = path.resolve(import.meta.dirname, '../..')
const script = path.join(root, 'scripts/gen-gamedata.mjs')
const gameSrc = path.resolve(root, '../shores-of-hazeron')

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

  it.skipIf(!existsSync(gameSrc))('committed output is in sync with the game source', () => {
    execFileSync('node', [script, gameSrc, '--check'], { stdio: 'pipe' })
  })

  it('fails loudly when a bay member does not resolve', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'gen-gamedata-'))
    mkdirSync(path.join(dir, 'auglobal'))
    mkdirSync(path.join(dir, 'shell.scripts'))
    mkdirSync(path.join(dir, 'auclientmailres/data'), { recursive: true })
    const fn = (name: string, cids: string[]) =>
      `inline COMMODITYID ${name}(int index)\n{\n\tCOMMODITYID res[] =\n\t{\n${cids.map((c) => `\t\t${c},\n`).join('')}\t};\n\treturn res[0];\n}\n`
    const header =
      'enum COMMODITYID\n{\n\tCID_A = 1,\n\tCID_B,\n};\n' +
      fn('HarvestProspectorCommodity', ['CID_A', 'CID_Missing']) +
      ['HarvestWildcatterCommodity', 'HarvestSiphonCommodity', 'HarvestAtmosphereCommodity', 'HarvestParticleCommodity']
        .map((n) => fn(n, ['CID_A']))
        .join('')
    writeFileSync(path.join(dir, 'auglobal/dbcommodity.h'), header)
    writeFileSync(
      path.join(dir, 'shell.scripts/initstatic.sql'),
      "INSERT INTO b_Commodity (id,name,iconPath) VALUES (1,'A',':data/c_A.png');\n",
    )
    writeFileSync(path.join(dir, 'auclientmailres/data/c_A.png'), '')
    const r = spawnSync('node', [script, dir, '--root', dir], { encoding: 'utf8' })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('CID_Missing')
  })
})
