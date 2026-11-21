/** Sorted distinct values of a field, undefined skipped. */
export function distinct<T, V extends string | number>(rows: readonly T[], pick: (r: T) => V | undefined): V[] {
  const set = new Set<V>()
  for (const r of rows) {
    const v = pick(r)
    if (v !== undefined) set.add(v)
  }
  return [...set].sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))))
}
