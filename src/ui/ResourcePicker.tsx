import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/ui/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ui/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/ui/popover'
import { cn } from '@/lib/utils'
import type { ResourceRow } from '@/data/rows'
import { QualityCell } from './QualityCell'
import { ResourceIcon } from './ResourceIcon'
import { groupByCategory, resourceStats, toggleGroup } from './resourcePicker'

/** cmdk item values are `category|name` (unique per group); search matches the name only. */
const filter = (value: string, search: string) =>
  value.slice(value.indexOf('|') + 1).toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0

/**
 * Resource filter: searchable popover, resources grouped by harvester-bay category with icon,
 * deposit count and best quality over all loaded rows, and a select-whole-group toggle.
 */
export function ResourcePicker({
  rows,
  value,
  onChange,
}: {
  /** All rows of the loaded map (stats ignore the current filter). */
  rows: readonly ResourceRow[]
  value: readonly string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const groups = useMemo(() => groupByCategory(resourceStats(rows)), [rows])
  const toggle = (n: string) => onChange(value.includes(n) ? value.filter((v) => v !== n) : [...value, n])
  const summary = value.length === 0 ? 'any' : value.length === 1 ? value[0]! : `${value.length} selected`
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs" className="max-w-52 justify-between font-normal" aria-label="Resource">
          <span className="text-muted-foreground">Resource</span>
          <span className={cn('truncate', value.length > 0 && 'text-primary')}>{summary}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command filter={filter}>
          <CommandInput placeholder="Search resources..." />
          <CommandList className="max-h-[26rem]">
            <CommandEmpty>No match.</CommandEmpty>
            {groups.map((g) => {
              const names = g.resources.map((r) => r.name)
              const selected = names.filter((n) => value.includes(n)).length
              return (
                <CommandGroup
                  key={g.category}
                  heading={
                    <span className="flex items-center justify-between">
                      <span>
                        {g.category} <span className="tabular-nums opacity-70">({names.length})</span>
                      </span>
                      <button
                        type="button"
                        className="rounded px-1 text-primary hover:bg-accent"
                        onClick={() => onChange(toggleGroup(value, names))}
                      >
                        {selected === names.length ? 'Clear group' : 'Select group'}
                      </button>
                    </span>
                  }
                >
                  {g.resources.map((r) => (
                    <CommandItem
                      key={r.name}
                      value={`${g.category}|${r.name}`}
                      onSelect={() => toggle(r.name)}
                      className="gap-2 py-0.5"
                    >
                      <Check className={cn('size-3 shrink-0', value.includes(r.name) ? 'opacity-100' : 'opacity-0')} />
                      <ResourceIcon name={r.name} size={32} />
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{r.count.toLocaleString()}</span>
                      <QualityCell q={r.best} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
        {value.length > 0 && (
          <div className="border-t p-1">
            <Button variant="ghost" size="xs" className="w-full" onClick={() => onChange([])}>
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
