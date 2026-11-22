/** Navigation actions shared by tables, the peek panel, the palette and the map (BLUEPRINT V8-V10). */
import { createContext, useContext } from 'react'
import type { Peek } from '../nav'

export interface Nav {
  peek?: Peek
  /** Row key to highlight in tables (the peek's originating row). */
  selectedKey?: string
  peekSystem: (systemId: string, rowKey?: string) => void
  peekBody: (systemId: string, bodyId: string, rowKey?: string) => void
  closePeek: () => void
  /** Opens the full system page (closes the peek). */
  openFullPage: (systemId: string) => void
  /** Switch to the Map tab, fly to the system and select it. Absent while no map tab exists. */
  showOnMap?: (systemId: string) => void
  /** False for Deep Space systems (no coordinates) or unknown ids. */
  canShowOnMap: (systemId: string) => boolean
}

const Ctx = createContext<Nav | null>(null)
export const NavProvider = Ctx.Provider

export function useNav(): Nav {
  const v = useContext(Ctx)
  if (!v) throw new Error('useNav must be used inside NavProvider')
  return v
}
