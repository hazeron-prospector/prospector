import type { StarMap } from '@/data/types'
import type { WorkerRequest, WorkerResponse } from './protocol'

/**
 * Parses a starmap file in a dedicated worker. Resolves with the model,
 * rejects with an Error whose message is suitable for display.
 */
export function parseInWorker(file: File, onProgress?: (fraction: number) => void): Promise<StarMap> {
  return new Promise<StarMap>((resolve, reject) => {
    const worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' })
    const finish = () => worker.terminate()
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data
      if (msg.type === 'progress') {
        onProgress?.(msg.fraction)
      } else if (msg.type === 'done') {
        finish()
        resolve(msg.map)
      } else {
        finish()
        reject(new Error(msg.message))
      }
    }
    worker.onerror = (e) => {
      finish()
      reject(new Error(e.message || 'The parse worker crashed'))
    }
    const req: WorkerRequest = { type: 'parse', file }
    worker.postMessage(req)
  })
}
