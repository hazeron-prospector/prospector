import { substringMatch } from '@/data/search'
import type { CensorKind } from '@/data/censor'
import { Censored } from './Censored'
import { useCensor } from './state/useCensor'

/**
 * Text with the first case-insensitive match of `q` marked. React-rendered; no raw HTML.
 * With a `kind` whose censor toggle is on, highlighting is skipped and only the scramble renders.
 */
export function Highlight({ text, q, kind }: { text: string; q: string; kind?: CensorKind }) {
  const { on } = useCensor()
  if (kind && on(kind)) return <Censored kind={kind}>{text}</Censored>
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
