import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, MapPin, X } from 'lucide-react'
import type { Planet, Star, StarMap, System, Wormhole } from '@/data/types'
import { Button } from '@/ui/ui/button'
import { Censored, OrbitText } from './Censored'
import { QualityCell } from './QualityCell'
import { ResourceIcon } from './ResourceIcon'
import { useNav } from './state/NavContext'
import { useResourceFilter } from './state/ResourceFilterContext'
import {
  defaultDir,
  filterBodyResources,
  highQualitySummary,
  planetResourceRows,
  sortBodyResources,
  type BodyResourceRow,
  type BodySortDir,
  type BodySortKey,
} from './bodyResources'
import { qualityStyle } from './quality'
import { SystemPreview } from './SystemPreview'
import { useBodyHighlights } from './useBodyHighlights'
import { cn } from '@/lib/utils'

interface Props {
  map: StarMap
  system: System
  systemById: ReadonlyMap<string, System>
  canGoBack: boolean
  onBack: () => void
  onClose: () => void
  onOpenSystem: (systemId: string) => void
}

const bodyAnchor = (id: string) => `body-${id}`
const FLASH = 'ring-2 ring-primary'
const EMPTY_IDS: ReadonlySet<string> = new Set()

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b px-4 py-3">
      <h2 className="mb-2 text-xs font-medium tracking-widest text-primary uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="mr-4 inline-block">
      <span className="text-muted-foreground">{label} </span>
      {children}
    </span>
  )
}

function StarBlock({ star, flash }: { star: Star; flash: boolean }) {
  return (
    <div id={bodyAnchor(star.starId)} className={cn('mb-3 scroll-mt-14 rounded-md border bg-card/40 p-2 transition-shadow', flash && FLASH)}>
      <div className="mb-1">
        <span className="font-medium">
          <Censored kind="system">{star.name}</Censored>
        </span> <span className="text-muted-foreground">{star.type}</span>
      </div>
      <div className="mb-1 text-xs text-muted-foreground">
        {[star.size, star.spectralClass && `class ${star.spectralClass}`, star.surfaceTempRaw, star.diameterRaw, star.habRaw, star.shell]
          .filter(Boolean)
          .join(' · ')}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        {star.resources.length === 0 && <span className="text-muted-foreground">No resources</span>}
        {star.resources.map((r) => (
          <span key={r.name}>
            <ResourceIcon name={r.name} sphere="star" className="mr-1" />
            {r.name} <QualityCell q={r.quality} a={r.abundance} />
          </span>
        ))}
      </div>
    </div>
  )
}

function ResourceTable({ rows }: { rows: BodyResourceRow[] }) {
  const [sort, setSort] = useState<{ key: BodySortKey; dir: BodySortDir }>({ key: 'best', dir: 'desc' })
  const [query, setQuery] = useState('')
  const shown = useMemo(() => sortBodyResources(filterBodyResources(rows, query), sort.key, sort.dir), [rows, query, sort])
  if (rows.length === 0) return <div className="text-xs text-muted-foreground">No resources</div>
  const header = (key: BodySortKey, label: string) => {
    const active = sort.key === key
    return (
      <th key={key} className="pr-3 font-medium" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={() => setSort(active ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: defaultDir(key) })}
          className={cn('inline-flex items-center gap-0.5 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring', active && 'text-foreground')}
        >
          {label}
          {active && (sort.dir === 'asc' ? <ArrowUp aria-hidden className="size-3" /> : <ArrowDown aria-hidden className="size-3" />)}
        </button>
      </th>
    )
  }
  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter resources"
        aria-label="Filter resources by name"
        className="mb-1 h-6 w-40 rounded-md border bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      <table className="w-full max-w-3xl text-xs">
        <thead className="text-left text-muted-foreground">
          <tr>
            {header('sphere', 'Sphere')}
            {header('name', 'Resource')}
            {header('best', 'Best Q')}
            {[1, 2, 3, 4].map((n) => header(`z${n}` as BodySortKey, `Z${n} q/ab`))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={`${row.sphere}|${row.name}`} className="border-t border-border/40">
              <td className="py-0.5 pr-3 text-muted-foreground">{row.sphere}</td>
              <td className="pr-3 text-sm">
                <ResourceIcon name={row.name} sphere={row.sphere} className="mr-1.5" />
                {row.name}
              </td>
              <td className="pr-3 tabular-nums">
                <QualityCell q={row.best} />
              </td>
              {[0, 1, 2, 3].map((i) => (
                <td key={i} className="pr-3 tabular-nums">
                  {row.zones[i] && <QualityCell q={row.zones[i].quality} a={row.zones[i].abundance} />}
                </td>
              ))}
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={7} className="py-1 text-muted-foreground">
                No resources match
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function BodyBlock({ planet, flash, open, onToggle }: { planet: Planet; flash: boolean; open: boolean; onToggle: () => void }) {
  const { filter } = useResourceFilter()
  const rows = useMemo(() => planetResourceRows(planet), [planet])
  const summary = useMemo(() => highQualitySummary(rows, filter.minBestQuality), [rows, filter.minBestQuality])
  const g = planet.geosphere
  const h = planet.hydrosphere
  const a = planet.atmosphere
  const b = planet.biosphere
  const lines: [string, string | undefined][] = [
    ['Geosphere', [g?.diameterRaw, g?.gravityRaw, g && `${g.resourceZones} resource zone${g.resourceZones === 1 ? '' : 's'}`].filter(Boolean).join(' · ')],
    ['Hydrosphere', [h?.surfaceLiquidRaw, h?.diameterRaw, h?.gravityRaw].filter(Boolean).join(' · ')],
    ['Atmosphere', a?.compositionRaw],
    ['Biosphere', !b ? 'No known life' : [b.flora !== undefined && `Flora: ${b.flora ? 'yes' : 'no'}`, b.fauna !== undefined && `Fauna: ${b.fauna ? 'yes' : 'no'}`].filter(Boolean).join(' · ')],
  ]
  return (
    <div id={bodyAnchor(planet.planetId)} className={cn('mb-3 scroll-mt-14 rounded-md border bg-card/40 p-2 transition-shadow', flash && FLASH)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${bodyAnchor(planet.planetId)}-detail`}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-x-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight aria-hidden className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
        <span className="font-medium">
          <Censored kind="system">{planet.name}</Censored>
        </span>
        <span className="text-muted-foreground">
          {open ? (
            <>
              {planet.bodyType} · {planet.zone} zone · <OrbitText orbit={planet.orbit} />
            </>
          ) : (
            <>
              {planet.bodyType} · {planet.zone} zone
            </>
          )}
        </span>
        {!open && summary.items.length > 0 && (
          <span className={cn('ml-2 inline-flex flex-wrap items-center gap-x-2 text-xs', summary.dimmed && 'opacity-50')}>
            {summary.items.map((r) => (
              <span key={`${r.sphere}|${r.name}`} className="inline-flex items-center gap-1">
                <ResourceIcon name={r.name} sphere={r.sphere} size={16} />
                <span className="rounded-sm px-1 tabular-nums" style={qualityStyle(r.best)}>
                  {r.best}
                </span>
              </span>
            ))}
          </span>
        )}
      </button>
      {open && (
      <div id={`${bodyAnchor(planet.planetId)}-detail`} className="mt-1">
      <div className="mb-2 grid gap-y-0.5 text-xs md:grid-cols-[6.5rem_1fr]">
        {lines
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <span className="text-muted-foreground">{k}</span>
              <span>{v}</span>
            </div>
          ))}
      </div>
      <ResourceTable rows={rows} />
      </div>
      )}
    </div>
  )
}

function WormholeRow({ w, systemById, onOpenSystem }: { w: Wormhole; systemById: ReadonlyMap<string, System>; onOpenSystem: (id: string) => void }) {
  const dest = w.destSystemId ? systemById.get(w.destSystemId) : undefined
  const coords = <Censored kind="coords">{`${w.destX}, ${w.destY}, ${w.destZ}`}</Censored>
  return (
    <li className="flex items-baseline gap-3 py-0.5">
      {dest ? (
        <Button variant="link" size="xs" className="h-auto p-0 text-sm" onClick={() => onOpenSystem(dest.systemId)}>
          <Censored kind="system">{dest.name}</Censored>
        </Button>
      ) : (
        <span className="text-muted-foreground">{coords}</span>
      )}
      {dest && <span className="text-xs text-muted-foreground">{coords}</span>}
      <span className="text-xs text-muted-foreground">
        {w.polarity ?? ''} {w.explored ? '' : '(unexplored)'}
      </span>
    </li>
  )
}

export function SystemDetail({ map, system, systemById, canGoBack, onBack, onClose, onOpenSystem }: Props) {
  const nav = useNav()
  const mapOk = nav.canShowOnMap(system.systemId)
  const sectorName = map.sectors.find((s) => s.sectorId === system.sectorId)?.name ?? system.sectorId
  const empires = useMemo(() => [...new Set(system.cities.map((c) => c.empire).filter((e): e is string => !!e))], [system])
  const groups = useMemo(() => {
    const m = new Map<string, Planet[]>()
    for (const p of system.planets) {
      const k = p.orbit.orbitingName ?? 'Primary'
      m.set(k, [...(m.get(k) ?? []), p])
    }
    return [...m]
  }, [system])
  const quality = useBodyHighlights(system.systemId)
  const highlighted = useMemo(() => new Set(quality.keys()), [quality])
  const [flashId, setFlashId] = useState<string>()
  const flashTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(flashTimer.current), [])
  const [expandedState, setExpanded] = useState<{ systemId: string; ids: ReadonlySet<string> }>({ systemId: system.systemId, ids: new Set() })
  const expanded = expandedState.systemId === system.systemId ? expandedState.ids : EMPTY_IDS
  const update = (fn: (ids: Set<string>) => void) =>
    setExpanded((cur) => {
      const ids = new Set(cur.systemId === system.systemId ? cur.ids : [])
      fn(ids)
      return { systemId: system.systemId, ids }
    })
  const goToBody = (id: string) => {
    flushSync(() => update((ids) => ids.add(id)))
    document.getElementById(bodyAnchor(id))?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setFlashId(id)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlashId(undefined), 1600)
  }
  const coords =
    system.x === undefined ? 'Deep Space' : <Censored kind="coords">{`${system.x}, ${system.y}, ${system.z}`}</Censored>

  return (
    <div className="absolute inset-0 z-20 overflow-auto bg-background">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card px-3 py-1.5">
        <Button variant="outline" size="xs" onClick={onBack}>
          <ArrowLeft /> {canGoBack ? 'Back' : 'Back to list'}
        </Button>
        {nav.showOnMap && (
          <Button
            variant="outline"
            size="xs"
            disabled={!mapOk}
            title={mapOk ? 'Show on map' : 'Deep Space systems have no map position'}
            onClick={() => nav.showOnMap?.(system.systemId)}
          >
            <MapPin /> Show on map
          </Button>
        )}
        <span className="ml-auto" />
        <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close detail">
          <X />
        </Button>
      </div>
      <header className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold text-primary">
          <Censored kind="system">{system.name}</Censored>
        </h1>
        <div className="mt-1 text-sm">
          {system.catalog && <Field label="Catalog">
              <Censored kind="system">{system.catalog}</Censored>
            </Field>}
          <Field label="Sector">
            <Censored kind="sector">{sectorName}</Censored>
          </Field>
          <Field label="Coordinates">
            <span className="tabular-nums">{coords}</span>
          </Field>
          <Field label="Status">{system.eodRaw ? `${system.eod} (reported as "${system.eodRaw}")` : system.eod}</Field>
          <Field label="Inhabited by">{empires.length ? empires.join(', ') : system.cities.length ? 'unknown empire' : 'nobody'}</Field>
        </div>
      </header>
      {(system.stars.length > 0 || system.planets.length > 0) && (
        <section className="border-b px-4 py-3">
          <SystemPreview
            key={system.systemId}
            system={system}
            size="large"
            highlightedBodyIds={highlighted}
            bodyQuality={quality}
            onBodyClick={goToBody}
          />
        </section>
      )}
      <Section title={`Stars (${system.stars.length})`}>
        {system.stars.length === 0 && <div className="text-muted-foreground">None</div>}
        {system.stars.map((s) => (
          <StarBlock key={s.starId} star={s} flash={flashId === s.starId} />
        ))}
      </Section>
      <Section title={`Bodies (${system.planets.length})`}>
        {system.planets.length > 1 && (
          <div className="mb-2 flex gap-2">
            <Button variant="outline" size="xs" onClick={() => update((ids) => system.planets.forEach((p) => ids.add(p.planetId)))}>
              Expand all
            </Button>
            <Button variant="outline" size="xs" onClick={() => update((ids) => ids.clear())}>
              Collapse all
            </Button>
          </div>
        )}
        {system.planets.length === 0 && (
          <div className="text-muted-foreground">
            {system.eod === 'Unexplored' ? 'System not yet surveyed.' : 'None'}
          </div>
        )}
        {groups.map(([orbiting, planets]) => (
          <div key={orbiting} className="mb-2">
            <h3 className="mb-1 text-xs text-muted-foreground">
              Orbiting {orbiting === 'Primary' ? orbiting : <Censored kind="system">{orbiting}</Censored>}
            </h3>
            <div className="ml-2 border-l pl-3">
              {planets.map((p) => (
                <BodyBlock
                  key={p.planetId}
                  planet={p}
                  flash={flashId === p.planetId}
                  open={expanded.has(p.planetId)}
                  onToggle={() => update((ids) => (ids.delete(p.planetId) ? undefined : ids.add(p.planetId)))}
                />
              ))}
            </div>
          </div>
        ))}
      </Section>
      <Section title={`Wormholes (${system.wormholes.length})`}>
        {system.wormholes.length === 0 && <div className="text-muted-foreground">None</div>}
        <ul>
          {system.wormholes.map((w, i) => (
            <WormholeRow key={i} w={w} systemById={systemById} onOpenSystem={onOpenSystem} />
          ))}
        </ul>
      </Section>
    </div>
  )
}
