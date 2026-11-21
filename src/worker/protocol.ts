import type { StarMap } from '@/data/types'

/** Main thread -> worker. */
export type WorkerRequest = { type: 'parse'; file: File }

/** Worker -> main thread. */
export type WorkerResponse =
  | { type: 'progress'; fraction: number }
  | { type: 'done'; map: StarMap }
  | { type: 'error'; message: string }
