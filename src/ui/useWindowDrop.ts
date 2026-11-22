import { useEffect, useRef } from 'react'
import type { MapLoader } from './useMapLoader'

/**
 * Window-level file drop: always cancels the browser default (which would open the
 * XML in the tab and discard the app); a dropped file replaces the map when none is loaded
 * (first load), otherwise it is offered to the load modal for confirmation; ignored while parsing.
 */
export function useWindowDrop(loader: MapLoader): void {
  const ref = useRef(loader)
  useEffect(() => {
    ref.current = loader
  })
  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault()
    const drop = (e: DragEvent) => {
      e.preventDefault()
      const f = e.dataTransfer?.files[0]
      if (!f || ref.current.parsing) return
      if (ref.current.map) ref.current.offerFile(f)
      else ref.current.loadFile(f)
    }
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [])
}
