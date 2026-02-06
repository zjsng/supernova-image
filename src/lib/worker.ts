import { processPixels } from './pq'
import { encodePNG } from './encode-png'

self.onmessage = async (e: MessageEvent) => {
  const { pixels, width, height, boost, gamma } = e.data
  const imageData = { data: pixels, width, height } as ImageData
  const pqPixels = processPixels(imageData, boost, gamma)
  const pngData = await encodePNG(width, height, pqPixels)
  self.postMessage(pngData, [pngData.buffer] as any)
}
