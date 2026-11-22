/** Persisted user settings (BLUEPRINT W10). Pure load/save/validate; storage may be missing or throw. */

export const SETTINGS_KEY = 'prospector.settings.v1'

export interface Settings {
  censor: { systemNames: boolean; systemCoords: boolean; sectors: boolean }
  /** Ordered priority resource names (W5). */
  priorityResources: string[]
}

export const DEFAULT_PRIORITY = ['Ore', 'Oil', 'Minerals', 'Crystals', 'Lumenite', 'Eludium']

export function defaultSettings(): Settings {
  return {
    censor: { systemNames: false, systemCoords: false, sectors: false },
    priorityResources: [...DEFAULT_PRIORITY],
  }
}

/** Minimal storage surface (localStorage satisfies it). */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Coerce arbitrary parsed JSON into valid settings; bad or missing fields fall back to defaults. */
export function validateSettings(raw: unknown): Settings {
  const d = defaultSettings()
  if (typeof raw !== 'object' || raw === null) return d
  const r = raw as Record<string, unknown>
  const c = typeof r.censor === 'object' && r.censor !== null ? (r.censor as Record<string, unknown>) : {}
  const flag = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
  let priority = d.priorityResources
  if (Array.isArray(r.priorityResources) && r.priorityResources.every((x) => typeof x === 'string')) {
    priority = [...new Set((r.priorityResources as string[]).map((s) => s.trim()).filter(Boolean))]
  }
  return {
    censor: {
      systemNames: flag(c.systemNames, d.censor.systemNames),
      systemCoords: flag(c.systemCoords, d.censor.systemCoords),
      sectors: flag(c.sectors, d.censor.sectors),
    },
    priorityResources: priority,
  }
}

function defaultStorage(): KeyValueStorage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function loadSettings(storage: KeyValueStorage | undefined = defaultStorage()): Settings {
  try {
    const text = storage?.getItem(SETTINGS_KEY)
    if (!text) return defaultSettings()
    return validateSettings(JSON.parse(text))
  } catch {
    return defaultSettings()
  }
}

/** Returns false when the write failed (settings still apply for this session). */
export function saveSettings(s: Settings, storage: KeyValueStorage | undefined = defaultStorage()): boolean {
  try {
    if (!storage) return false
    storage.setItem(SETTINGS_KEY, JSON.stringify(s))
    return true
  } catch {
    return false
  }
}
