import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { Globe, Grid3x3, MapPin, Orbit, Star } from 'lucide-react'
import { CENSOR_CLASS, scramble } from '@/data/censor'
import { search, type SearchHit, type SearchIndex } from '@/data/search'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ui/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/ui/dialog'
import { isSecondaryEnter } from './nav'
import { Censored } from './Censored'
import { ResourceIcon } from './ResourceIcon'
import { useNav } from './state/NavContext'
import { useCensor } from './state/useCensor'

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
      <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>Search systems, bodies, resources and sectors</DialogDescription>
        </DialogHeader>
        <PaletteBody close={() => onOpenChange(false)} {...rest} />
      </DialogContent>
    </Dialog>
  )
}

/** Mounted only while the dialog is open, so the query resets on every open. */
function PaletteBody({ close, index, onResource, onSector }: PaletteActions & { close: () => void; index: SearchIndex }) {
  const nav = useNav()
  const { on, text: censorText } = useCensor()
  const [query, setQuery] = useState('')
  const hideQuery = query !== '' && (on('system') || on('sector'))
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
      <div className="relative">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search systems, bodies, resources, sectors"
          className={hideQuery ? 'caret-foreground text-transparent selection:text-transparent' : undefined}
        />
        {hideQuery && (
          <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-9 right-3 flex items-center truncate text-sm ${CENSOR_CLASS}`}>
            {scramble(query)}
          </span>
        )}
      </div>
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
                        <Censored kind="system">{e.label}</Censored> <span className="text-muted-foreground">catalog </span>
                        {on('system') ? <Censored kind="system">{e.catalog}</Censored> : <Marked text={e.catalog} indices={h.indices} />}
                      </>
                    ) : e.kind === 'resource' ? (
                      <Marked text={e.label} indices={h.indices} />
                    ) : (
                      // Matching used the real name; the result shows only the scramble when censored.
                      (() => {
                        const kind = e.kind === 'sector' ? 'sector' : 'system'
                        return on(kind) ? <Censored kind={kind}>{e.label}</Censored> : <Marked text={e.label} indices={h.indices} />
                      })()
                    )}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {e.kind === 'system' && <Censored kind="sector">{e.sectorName}</Censored>}
                      {e.kind === 'body' && (
                        <>
                          {e.bodyType} in <Censored kind="system">{e.systemName}</Censored>
                        </>
                      )}
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
                      aria-label={`Show ${e.kind === 'resource' ? e.label : censorText(e.kind === 'sector' ? 'sector' : 'system', e.label)} on map`}
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
