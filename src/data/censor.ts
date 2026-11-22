/** Deterministic text scrambler for censor mode (BLUEPRINT W9). Pure; no real text survives. */

const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = LOWER.toUpperCase()
const DIGITS = '0123456789'

/** FNV-1a 32-bit. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 PRNG. */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick(set: string, not: string, r: () => number): string {
  // Draw from the set minus `not`, so every letter/digit changes.
  const i = Math.floor(r() * (set.length - 1))
  const c = set[i]!
  return c === not ? set[set.length - 1]! : c
}

/**
 * Same length as `text` in code points; letters become other letters (case kept), digits other digits, every
 * other character (spaces, punctuation, signs) stays in place. Deterministic per (text, salt).
 * Any text with a letter or digit differs from its input at every such position.
 */
export function scramble(text: string, salt = ''): string {
  const r = rng(hash(`${salt}\u0000${text}`))
  let out = ''
  for (const ch of text) {
    if (/\p{N}/u.test(ch)) out += pick(DIGITS, ch, r)
    else if (/\p{L}/u.test(ch)) {
      // Unicode letters draw from the ASCII pool; case kept where the letter has one.
      const upper = ch !== ch.toLowerCase() && ch === ch.toUpperCase()
      out += pick(upper ? UPPER : LOWER, ch, r)
    } else out += ch
  }
  return out
}

export type CensorKind = 'system' | 'coords' | 'sector'

export interface CensorFlags {
  systemNames: boolean
  systemCoords: boolean
  sectors: boolean
}

export function isCensored(flags: CensorFlags, kind: CensorKind): boolean {
  return kind === 'system' ? flags.systemNames : kind === 'coords' ? flags.systemCoords : flags.sectors
}

/** Plain-string sink helper (titles, SVG, canvas labels): the scramble when `kind` is on, else the text. */
export function censorText(flags: CensorFlags, kind: CensorKind, text: string): string {
  return isCensored(flags, kind) ? scramble(text) : text
}

/** Blur classes used for every censored element. */
export const CENSOR_CLASS = 'blur-[4px] select-none'

/** Map label kinds. City and spacecraft names follow the system-name toggle (W9, W16). */
export type LabelKind = 'system' | 'sector' | 'city' | 'spacecraft'

function censorKindOf(kind: LabelKind): CensorKind {
  return kind === 'sector' ? 'sector' : 'system'
}

/**
 * Label seam for the map (structurally a MapView `LabelFormat`): systems follow the system-name
 * toggle, sectors the sector toggle. Build once per flag change so the map re-applies labels
 * only when something changed.
 */
export function makeLabelFormat(flags: CensorFlags): (name: string, kind: LabelKind) => { text: string; className?: string } {
  return (name, kind) =>
    isCensored(flags, censorKindOf(kind)) ? { text: scramble(name), className: CENSOR_CLASS } : { text: name }
}

/**
 * Split an orbit description ("Orbiting Foo Alpha at 2au 129°") around the embedded body name.
 * Returns undefined when there is no name to hide.
 */
export function splitOrbit(raw: string, orbitingName: string | undefined): [string, string, string] | undefined {
  if (!orbitingName) return undefined
  const i = raw.indexOf(orbitingName)
  if (i < 0) return undefined
  return [raw.slice(0, i), orbitingName, raw.slice(i + orbitingName.length)]
}
