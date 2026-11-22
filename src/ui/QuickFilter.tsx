import { Search, X } from 'lucide-react'
import { Input } from '@/ui/ui/input'
import { cn } from '@/lib/utils'
import { CENSOR_CLASS, scramble } from '@/data/censor'
import { useCensor } from './state/useCensor'

/** Per-table text box; the table hides rows whose system or body name does not contain it. */
export function QuickFilter({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  // The typed text may be a real system or sector name (the palette also fills it in), so mask it: the input's own glyphs are transparent and a scramble is overlaid.
  const { on } = useCensor()
  const hide = value !== '' && (on('system') || on('sector'))
  return (
    <label className="relative flex items-center">
      <Search className="pointer-events-none absolute left-1.5 size-3 text-muted-foreground" />
      <Input
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation()
            onChange('')
          }
        }}
        className={cn('h-6 w-56 px-6 py-0 text-xs md:text-xs', hide && 'caret-foreground text-transparent selection:text-transparent')}
      />
      {hide && (
        <span
          aria-hidden="true"
          className={cn('pointer-events-none absolute left-[calc(1.5rem+1px)] right-6 truncate text-xs', CENSOR_CLASS)}
        >
          {scramble(value)}
        </span>
      )}
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      )}
    </label>
  )
}
