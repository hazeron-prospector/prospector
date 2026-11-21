/** Empire names inhabiting a system (truncated by the cell, full text in the tooltip). */
export function InhabitedCell({ inhabited, empires }: { inhabited: boolean; empires: readonly string[] }) {
  if (!inhabited) return null
  const text = empires.length ? empires.join(', ') : 'unknown empire'
  return (
    <span className="block truncate text-accent-foreground" title={text}>
      {text}
    </span>
  )
}
