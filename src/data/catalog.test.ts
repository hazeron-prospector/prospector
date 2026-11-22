import { describe, expect, it } from 'vitest'
import { CATEGORIES, resourceInfo } from './catalog'

describe('resourceInfo', () => {
  it('known resource: icon from the table, bay categories', () => {
    expect(resourceInfo('Lumenite')).toEqual({ icon: 'icons/c_Lumenite.png', categories: ['Prospector'] })
  })
  it('icon file follows b_Commodity.iconPath, not the name', () => {
    expect(resourceInfo('Oil').icon).toBe('icons/c_CrudeOil.png')
    expect(resourceInfo('Log').icon).toBe('icons/c_Wood.png')
  })
  it('alias: Water in the Environment is Water', () => {
    expect(resourceInfo('Water in the Environment')).toEqual(resourceInfo('Water'))
  })
  it('multi-bay: Water is Wildcatter and Siphon', () => {
    expect(resourceInfo('Water', 'hydrosphere').categories).toEqual(['Wildcatter', 'Siphon'])
  })
  it('unknown name: no icon, Unknown category', () => {
    expect(resourceInfo('Zerotrium')).toEqual({ categories: ['Unknown'] })
    expect(resourceInfo('Zerotrium', 'geosphere')).toEqual({ categories: ['Unknown'] })
  })
  it('names are keys only: prototype and path-like names are unknown', () => {
    for (const n of ['constructor', '__proto__', 'toString', '../../etc/passwd'])
      expect(resourceInfo(n)).toEqual({ categories: ['Unknown'] })
  })
  it('biosphere unknown name is Surface Only, without icon', () => {
    expect(resourceInfo('Made Up Moss', 'biosphere')).toEqual({ categories: ['Surface Only'] })
  })
  it('biosphere known name keeps its icon and is Surface Only', () => {
    expect(resourceInfo('Fruit', 'biosphere')).toEqual({ icon: 'icons/c_Fruit.png', categories: ['Surface Only'] })
  })
  it('sphere does not decide the bay: Antiflux Particles under atmosphere is Particle Collector', () => {
    expect(resourceInfo('Antiflux Particles', 'atmosphere').categories).toEqual(['Particle Collector'])
    expect(resourceInfo('Air', 'atmosphere').categories).toEqual(['Atmosphere Condenser'])
  })
  it('category list is in display order', () => {
    expect(CATEGORIES).toEqual([
      'Prospector',
      'Wildcatter',
      'Siphon',
      'Atmosphere Condenser',
      'Particle Collector',
      'Surface Only',
      'Unknown',
    ])
  })
})
