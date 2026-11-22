import { useEffect, useMemo, type ReactNode } from 'react'
import { ExternalLink, MapPin, X } from 'lucide-react'
import type { ResourceRow } from '@/data/rows'
import type { Planet, Star, System } from '@/data/types'
import { Button } from '@/ui/ui/button'
import { topResources, type PeekTarget, type TopResource } from './nav'
import { QualityCell } from './QualityCell'
import { ResourceIcon } from './ResourceIcon'
import { useNav } from './state/NavContext'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}

function Resources({ items, empty }: { items: TopResource[]; empty: string }) {
  if (items.length === 0) return <p className="text-xs text-muted-foreground">{empty}</p>
  return (
    <ul className="space-y-1">
      {items.map((r) => (
        <li key={r.name} className="flex items-center gap-2">
          <ResourceIcon name={r.name} sphere={r.sphere} size={32} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{r.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {r.sphere} · {r.bodyName}
              {r.count > 1 ? ` · ${r.count} deposits` : ''}
            </span>
          </span>
          <QualityCell q={r.bestQuality} />
        </li>
      ))}
    </ul>
  )
}

const yn = (b: boolean | undefined) => (b === undefined ? undefined : b ? 'yes' : 'no')

function planetFacts(p: Planet): [string, string | undefined][] {
  const g = p.geosphere
  const h = p.hydrosphere
  const a = p.atmosphere
  const atm = a?.atmosphereType
    ? `${a.atmosphereType}${a.densityPct !== undefined ? `, ${a.densityPct}% density` : ''}`
    : undefined
  return [
    ['Type', p.bodyType],
    ['Orbital zone', p.zone],
    ['Orbit', p.orbit.raw],
    ['Diameter', h?.diameterRaw ?? g?.diameterRaw],
    ['Gravity', h?.gravityRaw ?? g?.gravityRaw],
    ['Atmosphere', atm],
    ['Liquid', h?.surfaceLiquidRaw],
    ['Flora', yn(p.biosphere?.flora) ?? (p.biosphere ? undefined : 'none known')],
    ['Fauna', yn(p.biosphere?.fauna) ?? (p.biosphere ? undefined : 'none known')],
  ]
}

function starFacts(s: Star): [string, string | undefined][] {
  return [
    ['Type', s.type],
    ['Size', s.size || undefined],
    ['Temperature', s.surfaceTempRaw],
    ['Diameter', s.diameterRaw],
    ['Habitable zone', s.habRaw],
    ['Orbit', s.orbit.raw],
  ]
}

interface Props {
  target: PeekTarget
  systemById: ReadonlyMap<string, System>
  sectorNameOf: (sectorId: string) => string
  /** Resource rows of the loaded map grouped by systemId. */
  rowsBySystem: ReadonlyMap<string, readonly ResourceRow[]>
}

/** Right-hand, non-modal quick-peek panel for a system or a body. Escape or the X closes it. */
export function PeekPanel({ target, systemById, sectorNameOf, rowsBySystem }: Props) {
  const nav = useNav()
  const { closePeek } = nav
  const system = systemById.get(target.systemId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) closePeek()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closePeek])

  const view = useMemo(() => {
    if (!system) return undefined
    const sysRows = rowsBySystem.get(system.systemId) ?? []
    if (target.kind === 'system') {
      const empires = [...new Set(system.cities.map((c) => c.empire).filter((e): e is string => !!e))]
      return { title: system.name, subtitle: system.catalog ? `Catalog ${system.catalog}` : 'System', top: topResources(sysRows), empires, facts: [] as [string, string | undefined][] }
    }
    const planet = system.planets.find((p) => p.planetId === target.bodyId)
    const star = planet ? undefined : system.stars.find((s) => s.starId === target.bodyId)
    const body = planet ?? star
    if (!body) return undefined
    const rows = sysRows.filter((r) => r.bodyId === target.bodyId)
    return {
      title: body.name,
      subtitle: planet ? planet.bodyType : `Star · ${star!.type}`,
      top: topResources(rows),
      empires: [] as string[],
      facts: planet ? planetFacts(planet) : starFacts(star!),
    }
  }, [system, target, rowsBySystem])

  if (!system || !view) return null
  const mapOk = nav.canShowOnMap(system.systemId)
  const empires = view.empires

  return (
    <aside
      data-peek-panel
      aria-label="Quick peek"
      className="flex w-[22rem] max-w-[45vw] shrink-0 flex-col border-l bg-card animate-in slide-in-from-right duration-150"
    >
      <div className="flex items-start gap-2 border-b px-3 py-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-primary">{view.title}</h2>
          <p className="truncate text-xs text-muted-foreground">{view.subtitle}</p>
          {target.kind === 'body' && (
            <p className="truncate text-xs text-muted-foreground">in {system.name}</p>
          )}
        </div>
        <Button variant="ghost" size="icon-xs" onClick={closePeek} aria-label="Close peek panel" title="Close (Esc)">
          <X />
        </Button>
      </div>
      <div className="flex gap-2 border-b px-3 py-2">
        <Button size="xs" onClick={() => nav.openFullPage(system.systemId)}>
          <ExternalLink /> Open full page
        </Button>
        {nav.showOnMap && (
          <Button
            size="xs"
            variant="outline"
            disabled={!mapOk}
            title={mapOk ? 'Show on map' : 'Deep Space systems have no map position'}
            onClick={() => nav.showOnMap?.(system.systemId)}
          >
            <MapPin /> Show on map
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-3 py-3 text-sm">
        <dl className="grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1 text-xs">
          {target.kind === 'system' ? (
            <>
              <Row label="Status">{system.eodRaw ? `${system.eod} (reported as "${system.eodRaw}")` : system.eod}</Row>
              <Row label="Sector">{sectorNameOf(system.sectorId)}</Row>
              <Row label="Stars">
                {system.stars.length === 0 ? 'none' : system.stars.map((s) => `${s.name} (${s.type})`).join(', ')}
              </Row>
              <Row label="Bodies">{system.planets.length}</Row>
              <Row label="Wormholes">{system.wormholes.length}</Row>
              <Row label="Inhabited by">
                {empires.length ? empires.join(', ') : system.cities.length ? 'unknown empire' : 'nobody'}
              </Row>
            </>
          ) : (
            view.facts
              .filter(([, v]) => v !== undefined && v !== '')
              .map(([k, v]) => (
                <Row key={k} label={k}>
                  {v}
                </Row>
              ))
          )}
        </dl>
        <section>
          <h3 className="mb-1.5 text-xs font-medium tracking-widest text-primary uppercase">Top resources</h3>
          <Resources
            items={view.top}
            empty={system.eod === 'Unexplored' ? 'System not yet surveyed.' : 'No resources recorded.'}
          />
        </section>
      </div>
    </aside>
  )
}
