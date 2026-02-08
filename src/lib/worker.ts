import type { WorkerRequestMessage, WorkerResponseMessage } from './worker-protocol'
import { WorkerRuntime } from './worker-runtime'

const runtime = new WorkerRuntime()

function postResult(message: WorkerResponseMessage): void {
  if (message.type === 'result' && message.ok) {
    self.postMessage(message, { transfer: [message.pngData.buffer] })
    return
  }
  if (message.type === 'preview-result' && message.ok) {
    self.postMessage(message, { transfer: [message.pixels.buffer] })
    return
  }
  self.postMessage(message)
}

if (typeof self !== 'undefined') {
  self.onmessage = (event: MessageEvent<WorkerRequestMessage>) => {
    void (async () => {
      const response = await runtime.handle(event.data)
      if (!response) return
      postResult(response)
    })()
  }
}
