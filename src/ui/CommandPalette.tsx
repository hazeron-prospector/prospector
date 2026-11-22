import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { Globe, Grid3x3, MapPin, Orbit, Star } from 'lucide-react'
import { search, type SearchHit, type SearchIndex } from '@/data/search'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ui/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/ui/dialog'
import { isSecondaryEnter } from './nav'
import { ResourceIcon } from './ResourceIcon'
import { useNav } from './state/NavContext'

const GROUP_TITLE = { system: 'Systems', body: 'Bodies', resource: 'Resources', sector: 'Sectors' } as const
const PER_GROUP = 6

/** Text with the characters at `indices` marked. React-rendered; no raw HTML. */
function Marked({ text, indices }: { text: string; indices: readonly number[] }) {
  const set = new Set(indices)
  const parts: ReactNode[] = []
  let i = 0
  while (i < text.length) {
    const on = set.has(i)
    let j = i
    while (j < text.length && set.has(j) === on) j++
    const chunk = text.slice(i, j)
    parts.push(on ? <mark key={i} className="rounded-sm bg-primary/30 text-inherit">{chunk}</mark> : <span key={i}>{chunk}</span>)
    i = j
  }
  return <>{parts}</>
}

const hitValue = (h: SearchHit) => `${h.entry.kind}:${h.entry.id}`

export interface PaletteActions {
  onResource: (name: string) => void
  onSector: (name: string) => void
}

interface Props extends PaletteActions {
  open: boolean
  onOpenChange: (open: boolean) => void
  index: SearchIndex
}

export function CommandPalette({ open, onOpenChange, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Search</DialogTitle>
        <DialogDescription>Search systems, bodies, resources and sectors</DialogDescription>
      </DialogHeader>
      <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
        <PaletteBody close={() => onOpenChange(false)} {...rest} />
      </DialogContent>
    </Dialog>
  )
}

/** Mounted only while the dialog is open, so the query resets on every open. */
function PaletteBody({ close, index, onResource, onSector }: PaletteActions & { close: () => void; index: SearchIndex }) {
  const nav = useNav()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const deferred = useDeferredValue(query)
  const groups = useMemo(() => search(index, deferred, { perGroupCap: PER_GROUP }), [index, deferred])
  const byValue = useMemo(() => new Map(groups.flatMap((g) => g.hits.map((h) => [hitValue(h), h] as const))), [groups])
  const firstValue = groups[0]?.hits[0] ? hitValue(groups[0].hits[0]) : ''
  const active = byValue.has(selected) ? selected : firstValue

  const systemOf = (h: SearchHit): string | undefined =>
    h.entry.kind === 'system' ? h.entry.id : h.entry.kind === 'body' ? h.entry.systemId : undefined

  const showOnMap = (h: SearchHit) => {
    const sid = systemOf(h)
    if (!sid || !nav.showOnMap || !nav.canShowOnMap(sid)) return
    close()
    nav.showOnMap(sid)
  }

  const choose = (h: SearchHit) => {
    close()
    const e = h.entry
    if (e.kind === 'system') nav.peekSystem(e.id, e.id)
    else if (e.kind === 'body') nav.peekBody(e.systemId, e.id, e.id)
    else if (e.kind === 'resource') onResource(e.label)
    else onSector(e.label)
  }

  return (
    <Command
      shouldFilter={false}
      value={active}
      onValueChange={setSelected}
      className="rounded-lg"
      onKeyDown={(e) => {
        if (!isSecondaryEnter(e)) return
        e.preventDefault()
        const h = byValue.get(active)
        if (h) showOnMap(h)
      }}
    >
      <CommandInput value={query} onValueChange={setQuery} placeholder="Search systems, bodies, resources, sectors" />
      <CommandList className="max-h-[360px]">
        {deferred.trim() === '' ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Type a system, catalog name, body, resource or sector.
          </p>
        ) : (
          <CommandEmpty>No matches.</CommandEmpty>
        )}
        {groups.map((g) => (
          <CommandGroup key={g.kind} heading={g.total > g.hits.length ? `${GROUP_TITLE[g.kind]} (${g.hits.length} of ${g.total})` : GROUP_TITLE[g.kind]}>
            {g.hits.map((h) => {
              const e = h.entry
              const sid = systemOf(h)
              return (
                <CommandItem key={hitValue(h)} value={hitValue(h)} onSelect={() => choose(h)}>
                  {e.kind === 'system' && <Orbit />}
                  {e.kind === 'body' && (e.bodyKind === 'star' ? <Star /> : <Globe />)}
                  {e.kind === 'sector' && <Grid3x3 />}
                  {e.kind === 'resource' && <ResourceIcon name={e.label} />}
                  <span className="min-w-0 flex-1 truncate">
                    {e.kind === 'system' && h.matchedVia === 'catalog' && e.catalog ? (
                      <>
                        {e.label} <span className="text-muted-foreground">catalog </span>
                        <Marked text={e.catalog} indices={h.indices} />
                      </>
                    ) : (
                      <Marked text={e.label} indices={h.indices} />
                    )}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {e.kind === 'system' && e.sectorName}
                      {e.kind === 'body' && `${e.bodyType} in ${e.systemName}`}
                      {e.kind === 'resource' && `${e.depositCount.toLocaleString()} deposits · best ${e.bestQuality}`}
                      {e.kind === 'sector' && `${e.systemCount.toLocaleString()} systems`}
                    </span>
                  </span>
                  {sid && nav.showOnMap && (
                    <button
                      type="button"
                      tabIndex={-1}
                      disabled={!nav.canShowOnMap(sid)}
                      title={nav.canShowOnMap(sid) ? 'Show on map (Ctrl+Enter)' : 'Deep Space systems have no map position'}
                      aria-label={`Show ${e.label} on map`}
                      onClick={(ev) => {
                        ev.stopPropagation()
                        showOnMap(h)
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
                    >
                      <MapPin className="size-3.5" />
                    </button>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
      <div className="flex gap-4 border-t px-3 py-1.5 text-xs text-muted-foreground">
        <span>↑↓ move</span>
        <span>Enter open</span>
        <span>Ctrl/Shift+Enter show on map</span>
        <span className="ml-auto">Esc close</span>
      </div>
    </Command>
  )
}
