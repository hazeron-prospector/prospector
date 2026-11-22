import { ArrowDown, ArrowUp, Settings as Gear, X } from 'lucide-react'
import { Button } from '@/ui/ui/button'
import { Checkbox } from '@/ui/ui/checkbox'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ui/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/ui/dialog'
import { moveItem, type Settings } from '@/data/settings'
import { ResourceIcon } from './ResourceIcon'
import { useSettings } from './state/SettingsContext'

const CENSOR_ROWS: { key: keyof Settings['censor']; label: string; text: string }[] = [
  { key: 'systemNames', label: 'System names', text: 'Hides system, catalog and body names (they embed the system name).' },
  { key: 'systemCoords', label: 'System coordinates', text: 'Hides system X, Y and Z positions.' },
  { key: 'sectors', label: 'Sectors', text: 'Hides sector names and sector coordinates.' },
]

/** Header gear: censor toggles and the priority resource list (W8). */
export function SettingsDialog({ resourceNames }: { resourceNames: readonly string[] }) {
  const { settings, update, reset } = useSettings()
  const list = settings.priorityResources
  const setList = (priorityResources: string[]) => update((s) => ({ ...s, priorityResources }))
  const available = resourceNames.filter((n) => !list.includes(n))
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon-xs" aria-label="Settings" title="Settings">
          <Gear />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Saved in this browser.</DialogDescription>
        </DialogHeader>
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Censor</h3>
          {CENSOR_ROWS.map((r) => (
            <label key={r.key} className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={settings.censor[r.key]}
                onCheckedChange={(v) => update((s) => ({ ...s, censor: { ...s.censor, [r.key]: v === true } }))}
              />
              <span>
                {r.label}
                <span className="block text-xs text-muted-foreground">{r.text}</span>
              </span>
            </label>
          ))}
        </section>
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Priority resources</h3>
            <Button variant="ghost" size="xs" onClick={reset} title="Resets censor toggles and the priority list">
              Reset to defaults
            </Button>
          </div>
          {list.length === 0 && <p className="text-xs text-muted-foreground">No priority resources.</p>}
          <ol className="space-y-0.5">
            {list.map((name, i) => (
              <li key={name} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent/50">
                <ResourceIcon name={name} />
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <Button variant="ghost" size="icon-xs" aria-label={`Move ${name} up`} disabled={i === 0} onClick={() => setList(moveItem(list, i, -1))}>
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon-xs" aria-label={`Move ${name} down`} disabled={i === list.length - 1} onClick={() => setList(moveItem(list, i, 1))}>
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="icon-xs" aria-label={`Remove ${name}`} onClick={() => setList(list.filter((n) => n !== name))}>
                  <X />
                </Button>
              </li>
            ))}
          </ol>
          <Command className="rounded-md border">
            <CommandInput placeholder="Add a resource..." />
            <CommandList className="max-h-40">
              <CommandEmpty>No match.</CommandEmpty>
              <CommandGroup>
                {available.map((n) => (
                  <CommandItem key={n} value={n} onSelect={() => setList([...list, n])} className="gap-2 py-0.5">
                    <ResourceIcon name={n} />
                    {n}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </section>
      </DialogContent>
    </Dialog>
  )
}
