import { useCallback, useMemo } from 'react'
import { censorText, isCensored, makeLabelFormat, type CensorKind } from '@/data/censor'
import { useSettings } from './SettingsContext'

/** Censor lookups for plain-string sinks. `text` is stable while the flags are unchanged. */
export function useCensor(): { on: (kind: CensorKind) => boolean; text: (kind: CensorKind, s: string) => string } {
  const { settings } = useSettings()
  const flags = settings.censor
  const on = useCallback((kind: CensorKind) => isCensored(flags, kind), [flags])
  const text = useCallback((kind: CensorKind, s: string) => censorText(flags, kind, s), [flags])
  return { on, text }
}

/** Memoized map label formatter (new identity only when a toggle changes). */
export function useLabelFormat() {
  const { settings } = useSettings()
  return useMemo(() => makeLabelFormat(settings.censor), [settings.censor])
}

/** Memoized name renderer for SVG titles (SystemPreview). */
export function useRenderName(): (name: string) => string {
  const { settings } = useSettings()
  return useCallback((name: string) => censorText(settings.censor, 'system', name), [settings.censor])
}
