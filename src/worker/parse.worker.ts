/// <reference lib="webworker" />
import { handleParse } from './handler'
import type { WorkerRequest, WorkerResponse } from './protocol'

const post = (msg: WorkerResponse) => self.postMessage(msg)

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  if (e.data?.type === 'parse') void handleParse(e.data.file, post)
}
