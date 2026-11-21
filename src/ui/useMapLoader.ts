import { useCallback, useEffect, useState } from 'react'
import { loadMap, saveMap } from '@/data/store'
import type { StarMap } from '@/data/types'
import { parseInWorker } from '@/worker/client'

export interface MapLoader {
  map: StarMap | undefined
  /** Increments on every successfully loaded map; use as a React key. */
  generation: number
  /** True until the IndexedDB lookup has finished. */
  booting: boolean
  parsing: boolean
  progress: number
  error: string | undefined
  clearError: () => void
  loadFile: (file: File) => void
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

  const loadFile = useCallback((file: File) => {
    setError(undefined)
    setParsing(true)
    setProgress(0)
    parseInWorker(file, setProgress)
      .then(async (m) => {
        setMap(m)
        setGeneration((g) => g + 1)
        try {
          await saveMap(m)
        } catch {
          setError('Loaded, but the map could not be cached for next time.')
        }
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Could not read that file as a starmap export.')
      })
      .finally(() => setParsing(false))
  }, [])

  const discardMap = useCallback((message: string) => {
    setMap(undefined)
    setError(message)
  }, [])

  return { map, generation, booting, parsing, progress, error, clearError: () => setError(undefined), loadFile, discardMap }
}
