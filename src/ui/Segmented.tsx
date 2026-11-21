import { cn } from '@/lib/utils'

interface Props<T extends string> {
  label: string
  options: readonly { value: T; text: string }[]
  value: T
  onChange: (v: T) => void
}

/** Small segmented control for 2-3 exclusive choices. */
export function Segmented<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground" role="group" aria-label={label}>
      {label}
      <div className="flex overflow-hidden rounded-md border">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-6 px-2 text-xs',
              value === o.value ? 'bg-primary text-primary-foreground' : 'hover:bg-accent/50',
            )}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  )
}
