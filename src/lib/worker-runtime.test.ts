import { describe, expect, it, vi } from 'vitest'

const { encodePNGMock } = vi.hoisted(() => ({
  encodePNGMock: vi.fn(async () => new Uint8Array([1, 2, 3, 4])),
}))

vi.mock('./encode-png', () => ({
  encodePNG: encodePNGMock,
}))

import { WorkerRuntime, validateWorkerRequest } from './worker-runtime'

describe('validateWorkerRequest', () => {
  it('rejects unknown request types', () => {
    expect(() => validateWorkerRequest({ type: 'wat', id: 1 } as never)).toThrow('Unknown request type')
  })

  it('rejects invalid cancel request ids', () => {
    expect(() => validateWorkerRequest({ type: 'cancel', id: 0 })).toThrow('Cancel request id must be a positive integer')
  })

  it('rejects malformed convert payloads', () => {
    expect(() =>
      validateWorkerRequest({
        type: 'convert',
        id: 1,
        boost: 1,
        pixels: new Uint8ClampedArray([255, 255, 255, 255]),
        width: 2,
        height: 1,
      }),
    ).toThrow('Pixel buffer length does not match width/height')
  })

  it('accepts valid preview payloads', () => {
    expect(() =>
      validateWorkerRequest({
        type: 'preview',
        id: 2,
        boost: 1,
        pixels: new Uint8ClampedArray([255, 255, 255, 255]),
        width: 1,
        height: 1,
        previewMaxLongEdge: 512,
      }),
    ).not.toThrow()
  })

  it('rejects convert requests with invalid gamma', () => {
    expect(() =>
      validateWorkerRequest({
        type: 'convert',
        id: 3,
        boost: 1,
        gamma: 0,
        pixels: new Uint8ClampedArray([255, 255, 255, 255]),
        width: 1,
        height: 1,
      }),
    ).toThrow('Gamma must be a finite positive number')
  })

  it('rejects convert requests with invalid compression level/backend', () => {
    expect(() =>
      validateWorkerRequest({
        type: 'convert',
        id: 4,
        boost: 1,
        idatCompressionLevel: 12,
        pixels: new Uint8ClampedArray([255, 255, 255, 255]),
        width: 1,
        height: 1,
      }),
    ).toThrow('idatCompressionLevel must be between 0 and 9')

    expect(() =>
      validateWorkerRequest({
        type: 'convert',
        id: 5,
        boost: 1,
        compressionBackend: 'zip' as never,
        pixels: new Uint8ClampedArray([255, 255, 255, 255]),
        width: 1,
        height: 1,
      }),
    ).toThrow('Unknown compression backend')
  })
})

describe('WorkerRuntime', () => {
  it('returns convert success for pixel payloads', async () => {
    const runtime = new WorkerRuntime()
    const response = await runtime.handle({
      type: 'convert',
      id: 1,
      boost: 1,
      pixels: new Uint8ClampedArray([255, 255, 255, 255]),
      width: 1,
      height: 1,
      collectStats: true,
    })

    expect(response).not.toBeNull()
    expect(response?.type).toBe('result')
    expect(response && response.ok).toBe(true)
    if (response?.type === 'result' && response.ok) {
      expect(response.pngData).toEqual(new Uint8Array([1, 2, 3, 4]))
      expect(response.stats).toBeDefined()
    }
  })

  it('returns preview success for pixel payloads', async () => {
    const runtime = new WorkerRuntime()
    const response = await runtime.handle({
      type: 'preview',
      id: 7,
      boost: 1,
      pixels: new Uint8ClampedArray([120, 80, 40, 255]),
      width: 1,
      height: 1,
      previewMaxLongEdge: 1024,
    })

    expect(response).not.toBeNull()
    expect(response?.type).toBe('preview-result')
    expect(response && response.ok).toBe(true)
    if (response?.type === 'preview-result' && response.ok) {
      expect(response.width).toBe(1)
      expect(response.height).toBe(1)
      expect(response.pixels.length).toBe(4)
    }
  })

  it('drops cancelled convert requests', async () => {
    const runtime = new WorkerRuntime()
    runtime.cancel(42)

    const response = await runtime.handle({
      type: 'convert',
      id: 42,
      boost: 1,
      pixels: new Uint8ClampedArray([20, 30, 40, 255]),
      width: 1,
      height: 1,
    })

    expect(response).toBeNull()
  })

  it('returns BAD_INPUT response on invalid payload', async () => {
    const runtime = new WorkerRuntime()
    const response = await runtime.handle({
      type: 'preview',
      id: 11,
      boost: 1,
      pixels: new Uint8ClampedArray([255, 255, 255, 255]),
      width: 0,
      height: 1,
    })

    expect(response).not.toBeNull()
    expect(response?.type).toBe('preview-result')
    expect(response && response.ok).toBe(false)
    if (response?.type === 'preview-result' && !response.ok) {
      expect(response.code).toBe('BAD_INPUT')
    }
  })

  it('returns null for valid cancel requests', async () => {
    const runtime = new WorkerRuntime()
    const response = await runtime.handle({ type: 'cancel', id: 2 })
    expect(response).toBeNull()
  })

  it('returns BAD_INPUT when convert request id is invalid', async () => {
    const runtime = new WorkerRuntime()
    const response = await runtime.handle({
      type: 'convert',
      id: 0,
      boost: 1,
      pixels: new Uint8ClampedArray([255, 255, 255, 255]),
      width: 1,
      height: 1,
    })

    expect(response).not.toBeNull()
    expect(response?.type).toBe('result')
    if (response?.type === 'result' && !response.ok) {
      expect(response.code).toBe('BAD_INPUT')
    }
  })
})
