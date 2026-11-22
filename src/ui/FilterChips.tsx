import { X } from 'lucide-react'
import { Button } from '@/ui/ui/button'
import { activeChips, type ChipState } from './filterChips'
import { CENSOR_CLASS, scramble } from '@/data/censor'
import { ResourceIcon } from './ResourceIcon'
import { useCensor } from './state/useCensor'

/** Active resource filters as removable chips plus a one-click "Reset all". Renders nothing when none. */
export function FilterChips({
  state,
  onChange,
  onReset,
}: {
  state: ChipState
  onChange: (s: ChipState) => void
  onReset: () => void
}) {
  const chips = activeChips(state)
  const { on } = useCensor()
  // The quick-search chip echoes typed text, which may be a real system or sector name.
  const hideQuick = on('system') || on('sector')
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b bg-card/30 px-3 py-1" aria-label="Active filters">
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.remove(state))}
          aria-label={`Remove filter ${c.id === 'quick' && hideQuick ? scramble(c.label) : c.label}`}
          className="inline-flex h-5 items-center gap-1 rounded-full border bg-secondary px-2 text-xs hover:bg-accent"
        >
          {c.resource && <ResourceIcon name={c.resource} />}
          {c.id === 'quick' && hideQuick ? <span className={CENSOR_CLASS}>{scramble(c.label)}</span> : c.label}
          <X className="size-3 opacity-60" />
        </button>
      ))}
      <Button variant="ghost" size="xs" onClick={onReset}>
        Reset all
      </Button>
    </div>
  )
}
