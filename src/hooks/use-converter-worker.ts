import { useCallback, useEffect, useRef } from 'preact/hooks'
import type {
  WorkerConvertRequest,
  WorkerPreviewRequest,
  WorkerPreviewSuccessResponse,
  WorkerResponseMessage,
  WorkerSuccessResponse,
} from '../lib/worker-protocol'

type PendingRequestKind = 'convert' | 'preview'

interface PendingRequest {
  kind: PendingRequestKind
  resolve: (value: WorkerSuccessResponse | WorkerPreviewSuccessResponse) => void
  reject: (error: Error) => void
  timeout: number
}

interface UseConverterWorkerOptions {
  timeoutMs?: number
  onWorkerFailure?: (error: Error) => void
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

function createTimedError(message: string, code: string): Error {
  const error = new Error(message) as Error & { code?: string }
  error.code = code
  return error
}

export function getWorkerErrorCode(error: unknown): string | undefined {
  return (error as Error & { code?: string })?.code
}

export function getWorkerErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  if (!raw) return 'Unexpected worker error'
  return raw
}

export function useConverterWorker(options: UseConverterWorkerOptions = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS

  const workerRef = useRef<Worker | null>(null)
  const onWorkerFailureRef = useRef(options.onWorkerFailure)
  const nextRequestIdRef = useRef(1)
  const activeConvertRequestIdRef = useRef<number | null>(null)
  const activePreviewRequestIdRef = useRef<number | null>(null)
  const workerDecodeSupportRef = useRef<boolean | null>(null)
  const pendingRef = useRef(new Map<number, PendingRequest>())

  useEffect(() => {
    onWorkerFailureRef.current = options.onWorkerFailure
  }, [options.onWorkerFailure])

  const cancelPendingById = useCallback((id: number, reason: string) => {
    const pending = pendingRef.current.get(id)
    if (!pending) return
    window.clearTimeout(pending.timeout)
    pendingRef.current.delete(id)
    pending.reject(new Error(reason))
  }, [])

  const clearPendingById = useCallback((id: number) => {
    const pending = pendingRef.current.get(id)
    if (!pending) return undefined
    window.clearTimeout(pending.timeout)
    pendingRef.current.delete(id)
    return pending
  }, [])

  const teardownWorker = useCallback(() => {
    for (const [id, pending] of pendingRef.current.entries()) {
      window.clearTimeout(pending.timeout)
      pending.reject(createTimedError(`Worker terminated before request ${id} completed`, 'INTERNAL'))
    }
    pendingRef.current.clear()

    activeConvertRequestIdRef.current = null
    activePreviewRequestIdRef.current = null
    workerRef.current?.terminate()
    workerRef.current = null
  }, [])

  const getWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current

    const worker = new Worker(new URL('../lib/worker.ts', import.meta.url), { type: 'module' })

    worker.onmessage = (event: MessageEvent<WorkerResponseMessage>) => {
      const message = event.data
      if (!message) return

      const pending = clearPendingById(message.id)
      if (!pending) return

      if (pending.kind === 'convert' && activeConvertRequestIdRef.current === message.id) {
        activeConvertRequestIdRef.current = null
      }
      if (pending.kind === 'preview' && activePreviewRequestIdRef.current === message.id) {
        activePreviewRequestIdRef.current = null
      }

      if (pending.kind === 'convert' && message.type !== 'result') {
        pending.reject(new Error('Worker responded with mismatched message type for convert request'))
        return
      }
      if (pending.kind === 'preview' && message.type !== 'preview-result') {
        pending.reject(new Error('Worker responded with mismatched message type for preview request'))
        return
      }

      if (message.ok) {
        pending.resolve(message as WorkerSuccessResponse | WorkerPreviewSuccessResponse)
        return
      }

      const error = createTimedError(message.error || 'Worker request failed', message.code ?? 'INTERNAL')
      pending.reject(error)
    }

    worker.onerror = () => {
      const failure = new Error('Worker crashed during conversion')
      onWorkerFailureRef.current?.(failure)
      teardownWorker()
    }

    workerRef.current = worker
    return worker
  }, [clearPendingById, teardownWorker])

  const submitRequest = useCallback(
    <TResponse extends WorkerSuccessResponse | WorkerPreviewSuccessResponse>(
      kind: PendingRequestKind,
      payload: Omit<WorkerConvertRequest, 'type' | 'id'> | Omit<WorkerPreviewRequest, 'type' | 'id'>,
      transfer: Transferable[] = [],
    ): Promise<TResponse> => {
      const worker = getWorker()
      const id = nextRequestIdRef.current++

      const activeId = kind === 'convert' ? activeConvertRequestIdRef.current : activePreviewRequestIdRef.current
      if (activeId !== null) {
        worker.postMessage({ type: 'cancel', id: activeId })
        cancelPendingById(activeId, `Previous ${kind} request cancelled`)
      }

      if (kind === 'convert') activeConvertRequestIdRef.current = id
      else activePreviewRequestIdRef.current = id

      return new Promise<TResponse>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          worker.postMessage({ type: 'cancel', id })
          const pending = clearPendingById(id)
          if (!pending) return
          if (kind === 'convert' && activeConvertRequestIdRef.current === id) activeConvertRequestIdRef.current = null
          if (kind === 'preview' && activePreviewRequestIdRef.current === id) activePreviewRequestIdRef.current = null
          reject(createTimedError(`Worker ${kind} request timed out`, 'INTERNAL'))
        }, timeoutMs)

        pendingRef.current.set(id, {
          kind,
          resolve: resolve as (value: WorkerSuccessResponse | WorkerPreviewSuccessResponse) => void,
          reject,
          timeout,
        })

        const type = kind === 'convert' ? 'convert' : 'preview'
        worker.postMessage({ type, id, ...payload }, transfer)
      })
    },
    [cancelPendingById, clearPendingById, getWorker, timeoutMs],
  )

  const runWorkerConvert = useCallback(
    (payload: Omit<WorkerConvertRequest, 'type' | 'id'>, transfer: Transferable[] = []): Promise<WorkerSuccessResponse> =>
      submitRequest<WorkerSuccessResponse>('convert', payload, transfer),
    [submitRequest],
  )

  const runWorkerPreview = useCallback(
    (payload: Omit<WorkerPreviewRequest, 'type' | 'id'>, transfer: Transferable[] = []): Promise<WorkerPreviewSuccessResponse> =>
      submitRequest<WorkerPreviewSuccessResponse>('preview', payload, transfer),
    [submitRequest],
  )

  const cancelActivePreview = useCallback(() => {
    const activeId = activePreviewRequestIdRef.current
    const worker = workerRef.current
    if (activeId === null || !worker) return

    worker.postMessage({ type: 'cancel', id: activeId })
    cancelPendingById(activeId, 'Preview request cancelled')
    activePreviewRequestIdRef.current = null
  }, [cancelPendingById])

  const cancelActiveConvert = useCallback(() => {
    const activeId = activeConvertRequestIdRef.current
    const worker = workerRef.current
    if (activeId === null || !worker) return

    worker.postMessage({ type: 'cancel', id: activeId })
    cancelPendingById(activeId, 'Convert request cancelled')
    activeConvertRequestIdRef.current = null
  }, [cancelPendingById])

  const shouldTryWorkerDecode = useCallback((hasFile: boolean): boolean => {
    return hasFile && workerDecodeSupportRef.current !== false
  }, [])

  const markWorkerDecodeSupport = useCallback((isSupported: boolean) => {
    workerDecodeSupportRef.current = isSupported
  }, [])

  useEffect(() => {
    return () => teardownWorker()
  }, [teardownWorker])

  return {
    runWorkerConvert,
    runWorkerPreview,
    cancelActivePreview,
    cancelActiveConvert,
    shouldTryWorkerDecode,
    markWorkerDecodeSupport,
    teardownWorker,
  }
}
