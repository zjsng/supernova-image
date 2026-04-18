import { useEffect, useRef } from 'preact/hooks'

interface Blob {
  hue: number
  chroma: number
  baseR: number
  ax: number
  ay: number
  fx: number
  fy: number
  phx: number
  phy: number
  cx: number
  cy: number
}

const BLOBS: Blob[] = [
  { hue: 55, chroma: 0.2, baseR: 360, ax: 0.32, ay: 0.22, fx: 0.00021, fy: 0.00029, phx: 0.0, phy: 1.2, cx: 0.5, cy: 0.4 },
  { hue: 25, chroma: 0.22, baseR: 320, ax: 0.28, ay: 0.18, fx: 0.00017, fy: 0.00031, phx: 1.7, phy: 0.4, cx: 0.3, cy: 0.55 },
  { hue: 280, chroma: 0.2, baseR: 340, ax: 0.3, ay: 0.2, fx: 0.00023, fy: 0.00019, phx: 2.4, phy: 2.1, cx: 0.7, cy: 0.5 },
  { hue: 200, chroma: 0.18, baseR: 300, ax: 0.26, ay: 0.24, fx: 0.00019, fy: 0.00025, phx: 3.1, phy: 0.7, cx: 0.45, cy: 0.65 },
  { hue: 90, chroma: 0.16, baseR: 280, ax: 0.22, ay: 0.16, fx: 0.00027, fy: 0.00021, phx: 0.5, phy: 2.8, cx: 0.6, cy: 0.3 },
]

export function PlasmaField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !wrapper) return

    const context = canvas.getContext('2d')
    if (!context) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let raf = 0
    let stopped = false

    const resize = () => {
      const rect = wrapper.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(wrapper)

    const mouse = { x: null as number | null, y: null as number | null, active: 0 }
    const onMove = (event: MouseEvent) => {
      const rect = wrapper.getBoundingClientRect()
      mouse.x = event.clientX - rect.left
      mouse.y = event.clientY - rect.top
      mouse.active = 1
    }
    const onLeave = () => {
      mouse.active = 0
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        cancelAnimationFrame(raf)
      } else if (!stopped && !reduceMotion) {
        raf = requestAnimationFrame(draw)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    document.addEventListener('visibilitychange', onVisibility)

    let influence = 0

    const draw = (time: number) => {
      context.globalCompositeOperation = 'source-over'
      context.fillStyle = 'oklch(0.10 0.012 60)'
      context.fillRect(0, 0, width, height)

      influence += ((mouse.active ? 1 : 0) - influence) * 0.04

      context.globalCompositeOperation = 'screen'

      for (const blob of BLOBS) {
        const ox = blob.cx * width + Math.sin(time * blob.fx + blob.phx) * blob.ax * width
        const oy = blob.cy * height + Math.cos(time * blob.fy + blob.phy) * blob.ay * height

        let x = ox
        let y = oy
        if (mouse.x != null && mouse.y != null && influence > 0.01) {
          const dx = mouse.x - ox
          const dy = mouse.y - oy
          const distance = Math.sqrt(dx * dx + dy * dy)
          const reach = 380
          const k = Math.max(0, 1 - distance / reach)
          const pull = (blob.hue % 100 < 50 ? 0.55 : -0.35) * k * influence
          x += dx * pull
          y += dy * pull
        }

        const radius = blob.baseR + Math.sin(time * 0.0008 + blob.phx) * 40
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, `oklch(0.55 ${blob.chroma} ${blob.hue} / 0.55)`)
        gradient.addColorStop(0.35, `oklch(0.45 ${blob.chroma * 0.8} ${blob.hue} / 0.22)`)
        gradient.addColorStop(1, `oklch(0.20 ${blob.chroma * 0.4} ${blob.hue} / 0)`)
        context.fillStyle = gradient
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fill()
      }

      context.globalCompositeOperation = 'source-over'
      const vignette = context.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.4,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.75,
      )
      vignette.addColorStop(0, 'rgba(0,0,0,0)')
      vignette.addColorStop(1, 'rgba(0,0,0,0.55)')
      context.fillStyle = vignette
      context.fillRect(0, 0, width, height)

      if (!reduceMotion && !stopped) {
        raf = requestAnimationFrame(draw)
      }
    }

    raf = requestAnimationFrame(draw)

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div ref={wrapperRef} class="plasma-field" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
