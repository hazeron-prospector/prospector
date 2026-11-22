import { useCallback, useEffect, useRef, useState } from 'react'
import { mergeStarMaps } from '@/data/merge'
import { loadMap, saveMap } from '@/data/store'
import type { StarMap } from '@/data/types'
import { parseInWorker } from '@/worker/client'

export interface LoadOptions {
  /** 'add' merges into the current map (falls back to replace when none is loaded). Default 'replace'. */
  mode?: 'add' | 'replace'
  /** Union cities, spacecraft and wormholes of both copies (add mode). Default true. */
  mergeLists?: boolean
}

export interface MapLoader {
  map: StarMap | undefined
  /** Increments on boot restore and on every replace (not on merges); use as a React key. */
  generation: number
  /** True until the IndexedDB lookup has finished. */
  booting: boolean
  parsing: boolean
  progress: number
  error: string | undefined
  clearError: () => void
  loadFile: (file: File, options?: LoadOptions) => void
  /** Dismissible message after a merge, e.g. "Merged a.xml: 3 added, 2 updated, 1 kept". */
  notice: string | undefined
  clearNotice: () => void
  /** A file dropped on the window while a map is loaded; the load modal picks it up. */
  offered: { file: File; id: number } | undefined
  offerFile: (file: File) => void
  clearOffered: () => void
  /** Drops the current map (e.g. it failed to render) and shows a message. */
  discardMap: (message: string) => void
}

/** Owns the current map: cached restore on start, parse via worker, cache write. */
export function useMapLoader(): MapLoader {
  const [map, setMap] = useState<StarMap>()
  const [generation, setGeneration] = useState(0)
  const [booting, setBooting] = useState(true)
  const [parsing, setParsing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [offered, setOffered] = useState<{ file: File; id: number }>()
  const offerId = useRef(0)
  const mapRef = useRef<StarMap | undefined>(undefined)
  useEffect(() => {
    mapRef.current = map
  }, [map])

  useEffect(() => {
    let live = true
    loadMap()
      .then((m) => {
        if (live) {
          setMap(m)
          setGeneration((g) => g + 1)
        }
      })
      .catch(() => {
        /* cache unavailable: fall through to the load screen */
      })
      .finally(() => live && setBooting(false))
    return () => {
      live = false
    }
  }, [])

  const loadFile = useCallback((file: File, options: LoadOptions = {}) => {
    setError(undefined)
    setNotice(undefined)
    setParsing(true)
    setProgress(0)
    parseInWorker(file, setProgress)
      .then(async (parsed) => {
        const current = mapRef.current
        let next = parsed
        if (options.mode === 'add' && current) {
          const { map: merged, stats } = mergeStarMaps(current, parsed, { mergeLists: options.mergeLists ?? true })
          next = merged
          setNotice(`Merged ${file.name}: ${stats.added} added, ${stats.updated} updated, ${stats.kept} kept`)
        } else {
          // Replace: a fresh view, as for the first load.
          setGeneration((g) => g + 1)
        }
        mapRef.current = next
        setMap(next)
        try {
          await saveMap(next)
        } catch {
          setError('Loaded, but the map could not be cached for next time.')
        }
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Could not read that file as a starmap export.')
      })
      .finally(() => setParsing(false))
  }, [])

  const offerFile = useCallback((file: File) => setOffered({ file, id: ++offerId.current }), [])
  const clearOffered = useCallback(() => setOffered(undefined), [])

  const discardMap = useCallback((message: string) => {
    setMap(undefined)
    setError(message)
  }, [])

  return {
    map, generation, booting, parsing, progress, error, clearError: () => setError(undefined), loadFile, discardMap,
    notice, clearNotice: () => setNotice(undefined), offered, offerFile, clearOffered,
  }
}
