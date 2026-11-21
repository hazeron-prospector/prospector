import { qualityStyle } from './quality'

/** Quality number, color scaled; optional abundance shown dim beside it. */
export function QualityCell({ q, a }: { q?: number; a?: number }) {
  if (q === undefined) return <span className="text-muted-foreground/40">-</span>
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="rounded-sm px-1 tabular-nums" style={qualityStyle(q)}>
        {q}
      </span>
      {a !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{a}</span>}
    </span>
  )
}
