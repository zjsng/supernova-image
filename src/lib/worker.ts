import { processPixels } from './pq'
import { encodePNG } from './encode-png'

interface PixelData {
  data: Uint8ClampedArray
  width: number
  height: number
}

self.onmessage = async (e: MessageEvent) => {
  const { pixels, width, height, boost, gamma } = e.data
  const pixelData: PixelData = { data: pixels, width, height }
  const pqPixels = processPixels(pixelData as ImageData, boost, gamma)
  const pngData = await encodePNG(width, height, pqPixels)
  self.postMessage(pngData, { transfer: [pngData.buffer] })
}
