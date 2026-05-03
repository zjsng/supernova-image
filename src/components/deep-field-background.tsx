import { useEffect, useRef } from 'preact/hooks'

const STAR_VERTEX_SHADER = `
attribute vec2 a_position;
attribute float a_size;
attribute float a_depth;
attribute float a_brightness;
attribute float a_temperature;
attribute float a_phase;

uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform float u_time;
uniform float u_motion;

varying float v_brightness;
varying float v_temperature;

void main() {
  vec2 drift = (u_pointer - 0.5) * (0.012 + a_depth * 0.036);
  vec2 crawl = vec2(0.0008, -0.00035) * u_time * u_motion * (0.45 + a_depth);
  vec2 position = fract(a_position + drift + crawl);
  vec2 clip = position * 2.0 - 1.0;
  float twinkle = 0.82 + 0.18 * sin(u_time * (0.48 + a_depth * 0.72) + a_phase);

  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = max(1.0, a_size * (0.76 + a_depth * 1.35) * u_resolution.y / 900.0);
  v_brightness = a_brightness * twinkle;
  v_temperature = a_temperature;
}
`

const STAR_FRAGMENT_SHADER = `
precision mediump float;

varying float v_brightness;
varying float v_temperature;

void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q);
  float core = smoothstep(0.28, 0.0, d);
  float halo = smoothstep(0.5, 0.02, d) * 0.22;
  float alpha = (core + halo) * v_brightness;
  vec3 cool = vec3(0.32, 0.74, 0.78);
  vec3 bone = vec3(0.95, 0.88, 0.76);
  vec3 warm = vec3(0.98, 0.56, 0.18);
  vec3 color = mix(cool, bone, smoothstep(0.2, 0.72, v_temperature));
  color = mix(color, warm, smoothstep(0.74, 1.0, v_temperature) * 0.62);

  gl_FragColor = vec4(color * alpha, alpha);
}
`

const METEOR_VERTEX_SHADER = `
attribute vec2 a_origin;
attribute vec2 a_direction;
attribute vec2 a_local;
attribute float a_width;
attribute float a_phase;
attribute float a_period;
attribute float a_temperature;
attribute float a_brightness;

uniform vec2 u_pointer;
uniform float u_time;
uniform float u_motion;

varying vec2 v_local;
varying float v_visibility;
varying float v_temperature;
varying float v_brightness;

void main() {
  float phase = fract((u_time * u_motion) / a_period + a_phase);
  vec2 direction = normalize(a_direction);
  vec2 normal = vec2(-direction.y, direction.x);
  vec2 head = a_origin + direction * mix(-0.32, 1.32, phase);
  vec2 drift = (u_pointer - 0.5) * 0.035;
  vec2 position = head + drift + direction * a_local.x + normal * a_local.y * a_width;

  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
  v_local = a_local;
  v_visibility = smoothstep(0.04, 0.16, phase) * (1.0 - smoothstep(0.72, 0.94, phase));
  v_temperature = a_temperature;
  v_brightness = a_brightness;
}
`

const METEOR_FRAGMENT_SHADER = `
precision mediump float;

varying vec2 v_local;
varying float v_visibility;
varying float v_temperature;
varying float v_brightness;

void main() {
  float side = 1.0 - smoothstep(0.12, 1.0, abs(v_local.y));
  float trail = smoothstep(-0.42, 0.02, v_local.x);
  float head = smoothstep(0.045, -0.025, abs(v_local.x));
  float tailCut = 1.0 - smoothstep(0.02, 0.08, v_local.x);
  float alpha = (trail * side * tailCut * 0.56 + head * side * 0.86) * v_visibility * v_brightness;

  vec3 ember = vec3(1.0, 0.55, 0.16);
  vec3 ice = vec3(0.22, 0.76, 0.82);
  vec3 whitehot = vec3(0.96, 0.88, 0.72);
  vec3 color = mix(ice, ember, v_temperature);
  color = mix(color, whitehot, head * 0.64);

  gl_FragColor = vec4(color * alpha, alpha);
}
`

const CENTER = { x: 0.58, y: 0.45 }
const POINTER_EASE = 0.08
const RENDER_SCALE = 0.35
const STAR_COUNT = 180
const STAR_STRIDE = 7
const METEOR_COUNT = 5
const METEOR_VERTEX_COUNT = METEOR_COUNT * 6
const METEOR_STRIDE = 11
const WEBGL_OPTIONS: WebGLContextAttributes = {
  alpha: true,
  antialias: false,
  depth: false,
  powerPreference: 'high-performance',
  stencil: false,
}
const WEBGL_FALLBACK_OPTIONS: WebGLContextAttributes = {
  alpha: true,
  antialias: false,
  depth: false,
  stencil: false,
}

function getWebGlContext(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  return (
    canvas.getContext('webgl', WEBGL_OPTIONS) ??
    (canvas.getContext('experimental-webgl', WEBGL_OPTIONS) as WebGLRenderingContext | null) ??
    canvas.getContext('webgl', WEBGL_FALLBACK_OPTIONS) ??
    (canvas.getContext('experimental-webgl', WEBGL_FALLBACK_OPTIONS) as WebGLRenderingContext | null)
  )
}

function createStarData() {
  const data = new Float32Array(STAR_COUNT * STAR_STRIDE)
  let seed = 0x7c3a21f1

  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  for (let i = 0; i < STAR_COUNT; i += 1) {
    const offset = i * STAR_STRIDE
    const depth = Math.pow(random(), 0.7)
    const brightRoll = Math.pow(random(), 2.8)

    data[offset] = random()
    data[offset + 1] = random()
    data[offset + 2] = 1.15 + Math.pow(random(), 3.2) * 3.6
    data[offset + 3] = depth
    data[offset + 4] = 0.18 + brightRoll * 1.45
    data[offset + 5] = random()
    data[offset + 6] = random() * Math.PI * 2
  }

  return data
}

const STAR_DATA = createStarData()

interface Meteor {
  origin: readonly [number, number]
  direction: readonly [number, number]
  width: number
  phase: number
  period: number
  temperature: number
  brightness: number
}

function createMeteorData() {
  const data = new Float32Array(METEOR_VERTEX_COUNT * METEOR_STRIDE)
  const localVertices = [
    [-0.42, -1],
    [0.07, -1],
    [0.07, 1],
    [-0.42, -1],
    [0.07, 1],
    [-0.42, 1],
  ] as const
  const meteors: Meteor[] = [
    { origin: [-0.14, 0.88], direction: [1, -0.27], width: 0.011, phase: 0.02, period: 8.8, temperature: 0.92, brightness: 1.1 },
    { origin: [-0.22, 0.48], direction: [1, -0.18], width: 0.008, phase: 0.38, period: 12.5, temperature: 0.18, brightness: 0.76 },
    { origin: [0.1, 1.08], direction: [0.84, -0.5], width: 0.0065, phase: 0.68, period: 15.2, temperature: 0.72, brightness: 0.62 },
    { origin: [-0.35, 0.23], direction: [1, -0.34], width: 0.006, phase: 0.84, period: 19.5, temperature: 0.32, brightness: 0.5 },
    { origin: [0.18, 0.72], direction: [1, -0.22], width: 0.0055, phase: 0.56, period: 24.0, temperature: 0.96, brightness: 0.45 },
  ]

  meteors.forEach((meteor, meteorIndex) => {
    localVertices.forEach(([localX, localY], vertexIndex) => {
      const offset = (meteorIndex * localVertices.length + vertexIndex) * METEOR_STRIDE

      data[offset] = meteor.origin[0]
      data[offset + 1] = meteor.origin[1]
      data[offset + 2] = meteor.direction[0]
      data[offset + 3] = meteor.direction[1]
      data[offset + 4] = localX
      data[offset + 5] = localY
      data[offset + 6] = meteor.width
      data[offset + 7] = meteor.phase
      data[offset + 8] = meteor.period
      data[offset + 9] = meteor.temperature
      data[offset + 10] = meteor.brightness
    })
  })

  return data
}

const METEOR_DATA = createMeteorData()

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }

  return shader
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  if (!vertex || !fragment) return null

  const program = gl.createProgram()
  if (!program) return null

  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)

  gl.deleteShader(vertex)
  gl.deleteShader(fragment)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return null
  }

  return program
}

export function DeepFieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = getWebGlContext(canvas)

    if (!gl) {
      canvas.classList.add('deep-field-background__canvas--fallback')
      return
    }

    const starProgram = createProgram(gl, STAR_VERTEX_SHADER, STAR_FRAGMENT_SHADER)
    const meteorProgram = createProgram(gl, METEOR_VERTEX_SHADER, METEOR_FRAGMENT_SHADER)
    if (!starProgram || !meteorProgram) {
      canvas.classList.add('deep-field-background__canvas--fallback')
      return
    }

    const starPositionLocation = gl.getAttribLocation(starProgram, 'a_position')
    const starSizeLocation = gl.getAttribLocation(starProgram, 'a_size')
    const starDepthLocation = gl.getAttribLocation(starProgram, 'a_depth')
    const starBrightnessLocation = gl.getAttribLocation(starProgram, 'a_brightness')
    const starTemperatureLocation = gl.getAttribLocation(starProgram, 'a_temperature')
    const starPhaseLocation = gl.getAttribLocation(starProgram, 'a_phase')
    const starResolutionLocation = gl.getUniformLocation(starProgram, 'u_resolution')
    const starPointerLocation = gl.getUniformLocation(starProgram, 'u_pointer')
    const starTimeLocation = gl.getUniformLocation(starProgram, 'u_time')
    const starMotionLocation = gl.getUniformLocation(starProgram, 'u_motion')
    const meteorOriginLocation = gl.getAttribLocation(meteorProgram, 'a_origin')
    const meteorDirectionLocation = gl.getAttribLocation(meteorProgram, 'a_direction')
    const meteorLocalLocation = gl.getAttribLocation(meteorProgram, 'a_local')
    const meteorWidthLocation = gl.getAttribLocation(meteorProgram, 'a_width')
    const meteorPhaseLocation = gl.getAttribLocation(meteorProgram, 'a_phase')
    const meteorPeriodLocation = gl.getAttribLocation(meteorProgram, 'a_period')
    const meteorTemperatureLocation = gl.getAttribLocation(meteorProgram, 'a_temperature')
    const meteorBrightnessLocation = gl.getAttribLocation(meteorProgram, 'a_brightness')
    const meteorPointerLocation = gl.getUniformLocation(meteorProgram, 'u_pointer')
    const meteorTimeLocation = gl.getUniformLocation(meteorProgram, 'u_time')
    const meteorMotionLocation = gl.getUniformLocation(meteorProgram, 'u_motion')
    const starBuffer = gl.createBuffer()
    const meteorBuffer = gl.createBuffer()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (
      starPositionLocation < 0 ||
      starSizeLocation < 0 ||
      starDepthLocation < 0 ||
      starBrightnessLocation < 0 ||
      starTemperatureLocation < 0 ||
      starPhaseLocation < 0 ||
      meteorOriginLocation < 0 ||
      meteorDirectionLocation < 0 ||
      meteorLocalLocation < 0 ||
      meteorWidthLocation < 0 ||
      meteorPhaseLocation < 0 ||
      meteorPeriodLocation < 0 ||
      meteorTemperatureLocation < 0 ||
      meteorBrightnessLocation < 0 ||
      !starBuffer ||
      !meteorBuffer ||
      !starResolutionLocation ||
      !starPointerLocation ||
      !starTimeLocation ||
      !starMotionLocation ||
      !meteorPointerLocation ||
      !meteorTimeLocation ||
      !meteorMotionLocation
    ) {
      canvas.classList.add('deep-field-background__canvas--fallback')
      return
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, STAR_DATA, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, meteorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, METEOR_DATA, gl.STATIC_DRAW)
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)

    const bindStarAttributes = () => {
      const stride = STAR_STRIDE * Float32Array.BYTES_PER_ELEMENT

      gl.useProgram(starProgram)
      gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer)
      gl.enableVertexAttribArray(starPositionLocation)
      gl.enableVertexAttribArray(starSizeLocation)
      gl.enableVertexAttribArray(starDepthLocation)
      gl.enableVertexAttribArray(starBrightnessLocation)
      gl.enableVertexAttribArray(starTemperatureLocation)
      gl.enableVertexAttribArray(starPhaseLocation)
      gl.vertexAttribPointer(starPositionLocation, 2, gl.FLOAT, false, stride, 0)
      gl.vertexAttribPointer(starSizeLocation, 1, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT)
      gl.vertexAttribPointer(starDepthLocation, 1, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT)
      gl.vertexAttribPointer(starBrightnessLocation, 1, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT)
      gl.vertexAttribPointer(starTemperatureLocation, 1, gl.FLOAT, false, stride, 5 * Float32Array.BYTES_PER_ELEMENT)
      gl.vertexAttribPointer(starPhaseLocation, 1, gl.FLOAT, false, stride, 6 * Float32Array.BYTES_PER_ELEMENT)
    }

    const bindMeteorAttributes = () => {
      const stride = METEOR_STRIDE * Float32Array.BYTES_PER_ELEMENT

      gl.useProgram(meteorProgram)
      gl.bindBuffer(gl.ARRAY_BUFFER, meteorBuffer)
      gl.enableVertexAttribArray(meteorOriginLocation)
      gl.enableVertexAttribArray(meteorDirectionLocation)
      gl.enableVertexAttribArray(meteorLocalLocation)
      gl.enableVertexAttribArray(meteorWidthLocation)
      gl.enableVertexAttribArray(meteorPhaseLocation)
      gl.enableVertexAttribArray(meteorPeriodLocation)
      gl.enableVertexAttribArray(meteorTemperatureLocation)
      gl.enableVertexAttribArray(meteorBrightnessLocation)
      gl.vertexAttribPointer(meteorOriginLocation, 2, gl.FLOAT, false, stride, 0)
      gl.vertexAttribPointer(meteorDirectionLocation, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT)
      gl.vertexAttribPointer(meteorLocalLocation, 2, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT)
      gl.vertexAttribPointer(meteorWidthLocation, 1, gl.FLOAT, false, stride, 6 * Float32Array.BYTES_PER_ELEMENT)
      gl.vertexAttribPointer(meteorPhaseLocation, 1, gl.FLOAT, false, stride, 7 * Float32Array.BYTES_PER_ELEMENT)
      gl.vertexAttribPointer(meteorPeriodLocation, 1, gl.FLOAT, false, stride, 8 * Float32Array.BYTES_PER_ELEMENT)
      gl.vertexAttribPointer(meteorTemperatureLocation, 1, gl.FLOAT, false, stride, 9 * Float32Array.BYTES_PER_ELEMENT)
      gl.vertexAttribPointer(meteorBrightnessLocation, 1, gl.FLOAT, false, stride, 10 * Float32Array.BYTES_PER_ELEMENT)
    }

    let raf = 0
    let stopped = false
    let width = 1
    let height = 1
    let targetX = CENTER.x
    let targetY = CENTER.y
    let currentX = CENTER.x
    let currentY = CENTER.y

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const scale = Math.min(window.devicePixelRatio || 1, RENDER_SCALE)

      width = Math.max(1, Math.floor(rect.width * scale))
      height = Math.max(1, Math.floor(rect.height * scale))

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
    }

    const draw = (time: number) => {
      currentX += (targetX - currentX) * POINTER_EASE
      currentY += (targetY - currentY) * POINTER_EASE

      const seconds = time * 0.001
      const motion = reduceMotion ? 0 : 1
      const pointerY = 1 - currentY

      gl.clear(gl.COLOR_BUFFER_BIT)
      bindStarAttributes()
      gl.uniform2f(starResolutionLocation, width, height)
      gl.uniform2f(starPointerLocation, currentX, pointerY)
      gl.uniform1f(starTimeLocation, seconds)
      gl.uniform1f(starMotionLocation, motion)
      gl.drawArrays(gl.POINTS, 0, STAR_COUNT)

      bindMeteorAttributes()
      gl.uniform2f(meteorPointerLocation, currentX, pointerY)
      gl.uniform1f(meteorTimeLocation, seconds)
      gl.uniform1f(meteorMotionLocation, motion)
      gl.drawArrays(gl.TRIANGLES, 0, METEOR_VERTEX_COUNT)

      if (!stopped && !reduceMotion && document.visibilityState !== 'hidden') {
        raf = requestAnimationFrame(draw)
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      targetX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
      targetY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    }

    const onPointerLeave = () => {
      targetX = CENTER.x
      targetY = CENTER.y
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !reduceMotion) raf = requestAnimationFrame(draw)
    }

    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerleave', onPointerLeave)
    document.addEventListener('visibilitychange', onVisibility)

    raf = requestAnimationFrame(draw)

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      gl.deleteBuffer(starBuffer)
      gl.deleteBuffer(meteorBuffer)
      gl.deleteProgram(starProgram)
      gl.deleteProgram(meteorProgram)
    }
  }, [])

  return (
    <div class="deep-field-background deep-field-observatory" aria-hidden="true">
      <canvas ref={canvasRef} class="deep-field-background__canvas" />
    </div>
  )
}
