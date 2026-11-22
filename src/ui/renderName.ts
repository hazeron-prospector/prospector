/**
 * Name seam (censor, W9): every system/body name drawn by the orbit preview goes through a
 * `RenderName`. The default shows the real name; the censor feature supplies a scrambler.
 */
export type RenderName = (name: string) => string
export const identityName: RenderName = (name) => name
