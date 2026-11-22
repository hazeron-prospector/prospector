import { MapPin } from 'lucide-react'
import { useNav } from './state/NavContext'
import type { Column } from './VirtualTable'

/** Small pin button for table rows; never triggers the row click. Disabled for Deep Space. */
export function ShowOnMapButton({ systemId }: { systemId: string }) {
  const nav = useNav()
  if (!nav.showOnMap) return null
  const ok = nav.canShowOnMap(systemId)
  return (
    // The wrapper swallows clicks that a disabled button would let through to the row.
    <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        tabIndex={-1}
        disabled={!ok}
        aria-label="Show on map"
        title={ok ? 'Show on map' : 'Deep Space systems have no map position'}
        onClick={() => nav.showOnMap?.(systemId)}
        // Enter/Space on the button must not also open the row.
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
        }}
        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-primary disabled:pointer-events-none disabled:opacity-25"
      >
        <MapPin className="size-3.5" />
      </button>
    </span>
  )
}

/** Narrow first column holding the show-on-map pin. */
export function mapColumn<T>(systemIdOf: (row: T) => string): Column<T> {
  return { id: 'map', header: '', width: 36, cell: (r) => <ShowOnMapButton systemId={systemIdOf(r)} /> }
}
