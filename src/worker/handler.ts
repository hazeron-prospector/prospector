import { parseStarMap } from '@/data/parse'
import type { WorkerResponse } from './protocol'

/** Anything with a text() method: a File/Blob in the worker, a stub in tests. */
export interface TextSource {
  text(): Promise<string>
}

/**
 * Reads the source, parses it and reports through `post`. Never throws:
 * every failure becomes an `error` message. Pure apart from `post`, so it is
 * unit-tested without a Worker.
 */
export async function handleParse(source: TextSource, post: (msg: WorkerResponse) => void): Promise<void> {
  try {
    const xml = await source.text()
    const map = parseStarMap(xml, (fraction) => post({ type: 'progress', fraction }))
    post({ type: 'done', map })
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) })
  }
}
