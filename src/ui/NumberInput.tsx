import { useState } from 'react'
import { Input } from '@/ui/ui/input'

function parse(s: string): number | undefined {
  if (s.trim() === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

/** Optional numeric input; empty = undefined. Keeps the typed text while editing. */
export function NumberInput({
  label,
  value,
  onChange,
  className,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  className?: string
}) {
  const [draft, setDraft] = useState(value?.toString() ?? '')
  // Resync when the value is changed from outside (e.g. Reset).
  if (parse(draft) !== value) setDraft(value?.toString() ?? '')
  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      {label}
      <Input
        type="text"
        inputMode="decimal"
        value={draft}
        placeholder="any"
        onChange={(e) => {
          setDraft(e.target.value)
          onChange(parse(e.target.value))
        }}
        className={className ?? 'h-6 w-16 px-1.5 py-0 text-xs tabular-nums md:text-xs'}
      />
    </label>
  )
}
