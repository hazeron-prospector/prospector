/** Settings store: React context over `data/settings` (W10). Mounted above AppShell so it survives loading a new file. */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { defaultSettings, loadSettings, saveSettings, type Settings } from '@/data/settings'

export interface SettingsStore {
  settings: Settings
  update: (p: (s: Settings) => Settings) => void
  reset: () => void
}

const Ctx = createContext<SettingsStore | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const update = useCallback((p: (s: Settings) => Settings) => {
    setSettings((s) => {
      const next = p(s)
      saveSettings(next)
      return next
    })
  }, [])
  const reset = useCallback(() => update(() => defaultSettings()), [update])
  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSettings(): SettingsStore {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSettings must be used inside SettingsProvider')
  return v
}
