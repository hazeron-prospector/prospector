import { useMemo, type ReactNode } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import type { Planet, Resource, Sphere, Star, StarMap, System, Wormhole } from '@/data/types'
import { Button } from '@/ui/ui/button'
import { QualityCell } from './QualityCell'
import { ResourceIcon } from './ResourceIcon'

interface Props {
  map: StarMap
  system: System
  systemById: ReadonlyMap<string, System>
  canGoBack: boolean
  onBack: () => void
  onClose: () => void
  onOpenSystem: (systemId: string) => void
}

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

function StarBlock({ star }: { star: Star }) {
  return (
    <div className="mb-3 rounded-md border bg-card/40 p-2">
      <div className="mb-1">
        <span className="font-medium">{star.name}</span> <span className="text-muted-foreground">{star.type}</span>
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

function ResourceTable({ planet }: { planet: Planet }) {
  const spheres: [Sphere, Resource[] | undefined][] = [
    ['geosphere', planet.geosphere?.resources],
    ['hydrosphere', planet.hydrosphere?.resources],
    ['atmosphere', planet.atmosphere?.resources],
    ['biosphere', planet.biosphere?.resources],
  ]
  const rows = spheres.flatMap(([sphere, rs]) => (rs ?? []).map((r) => ({ sphere, r })))
  if (rows.length === 0) return <div className="text-xs text-muted-foreground">No resources</div>
  return (
    <table className="w-full max-w-3xl text-xs">
      <thead className="text-left text-muted-foreground">
        <tr>
          <th className="py-0.5 pr-3 font-medium">Sphere</th>
          <th className="pr-3 font-medium">Resource</th>
          {[1, 2, 3, 4].map((n) => (
            <th key={n} className="pr-3 font-medium">{`Z${n} q/ab`}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ sphere, r }) => (
          <tr key={`${sphere}|${r.name}`} className="border-t border-border/40">
            <td className="py-0.5 pr-3 text-muted-foreground">{sphere}</td>
            <td className="pr-3 text-sm">
              <ResourceIcon name={r.name} sphere={sphere} className="mr-1.5" />
              {r.name}
            </td>
            {[0, 1, 2, 3].map((i) => (
              <td key={i} className="pr-3 tabular-nums">
                {r.zones[i] && <QualityCell q={r.zones[i].quality} a={r.zones[i].abundance} />}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BodyBlock({ planet }: { planet: Planet }) {
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
    <div className="mb-3 rounded-md border bg-card/40 p-2">
      <div className="mb-1">
        <span className="font-medium">{planet.name}</span>{' '}
        <span className="text-muted-foreground">
          {planet.bodyType} · {planet.zone} zone · {planet.orbit.raw}
        </span>
      </div>
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
      <ResourceTable planet={planet} />
    </div>
  )
}

function WormholeRow({ w, systemById, onOpenSystem }: { w: Wormhole; systemById: ReadonlyMap<string, System>; onOpenSystem: (id: string) => void }) {
  const dest = w.destSystemId ? systemById.get(w.destSystemId) : undefined
  const coords = `${w.destX}, ${w.destY}, ${w.destZ}`
  return (
    <li className="flex items-baseline gap-3 py-0.5">
      {dest ? (
        <Button variant="link" size="xs" className="h-auto p-0 text-sm" onClick={() => onOpenSystem(dest.systemId)}>
          {dest.name}
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
  const coords = system.x === undefined ? 'Deep Space' : `${system.x}, ${system.y}, ${system.z}`

  return (
    <div className="absolute inset-0 z-20 overflow-auto bg-background">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card px-3 py-1.5">
        <Button variant="outline" size="xs" onClick={onBack}>
          <ArrowLeft /> {canGoBack ? 'Back' : 'Back to list'}
        </Button>
        <span className="ml-auto" />
        <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close detail">
          <X />
        </Button>
      </div>
      <header className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold text-primary">{system.name}</h1>
        <div className="mt-1 text-sm">
          {system.catalog && <Field label="Catalog">{system.catalog}</Field>}
          <Field label="Sector">{sectorName}</Field>
          <Field label="Coordinates">
            <span className="tabular-nums">{coords}</span>
          </Field>
          <Field label="Status">{system.eodRaw ? `${system.eod} (reported as "${system.eodRaw}")` : system.eod}</Field>
          <Field label="Inhabited by">{empires.length ? empires.join(', ') : system.cities.length ? 'unknown empire' : 'nobody'}</Field>
        </div>
      </header>
      <Section title={`Stars (${system.stars.length})`}>
        {system.stars.length === 0 && <div className="text-muted-foreground">None</div>}
        {system.stars.map((s) => (
          <StarBlock key={s.starId} star={s} />
        ))}
      </Section>
      <Section title={`Bodies (${system.planets.length})`}>
        {system.planets.length === 0 && (
          <div className="text-muted-foreground">
            {system.eod === 'Unexplored' ? 'System not yet surveyed.' : 'None'}
          </div>
        )}
        {groups.map(([orbiting, planets]) => (
          <div key={orbiting} className="mb-2">
            <h3 className="mb-1 text-xs text-muted-foreground">Orbiting {orbiting}</h3>
            <div className="ml-2 border-l pl-3">
              {planets.map((p) => (
                <BodyBlock key={p.planetId} planet={p} />
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
