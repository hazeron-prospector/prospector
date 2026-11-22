import { substringMatch } from '@/data/search'

/** Text with the first case-insensitive match of `q` marked. React-rendered; no raw HTML. */
export function Highlight({ text, q }: { text: string; q: string }) {
  const t = q.trim()
  const m = t ? substringMatch(text, t) : undefined
  if (!m) return <>{text}</>
  return (
    <>
      {text.slice(0, m[0])}
      <mark className="rounded-sm bg-primary/30 text-inherit">{text.slice(m[0], m[1])}</mark>
      {text.slice(m[1])}
    </>
  )
}
