/**
 * Imperative three.js wrapper for the starmap. Owns the renderer, camera, controls, geometry
 * and the HTML label layer. React (MapView) only creates it, calls the setters and disposes it.
 * Render on demand: nothing is drawn unless the camera, data, hover or an animation changed.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { LabelKind } from '@/data/censor'
import { buildMarkers, buildRingworldMarkers, type MarkerSet } from '@/data/markers'
import { buildMapData, WORMHOLE_OPACITY, type MapData, type StyleOptions, type Vec3 } from '@/data/mapdata'
import type { StarMap } from '@/data/types'
import { cubeEdges } from './cube'
import { centerPose, CENTER_DURATION_MS, FLY_DURATION_MS, flyDestination, flyPose, frameDistance, type CameraPose } from './fly'
import {
  ATTENUATION_MAX,
  ATTENUATION_MIN,
  ATTENUATION_POWER,
  POINT_PX_MAX,
  POINT_PX_MIN,
  pickNearest,
  projectPoint,
  projectPoints,
  type ProjectedPoints,
} from './picking'

export interface Layers {
  wormholes: boolean
  sectors: boolean
  /** Explored-status styling (V6): dim Unexplored, ring Surveyed. Only applies without a highlight. */
  status: boolean
  /** Color systems by star type instead of neutral / habitable green (W13). Off by default. */
  starColor: boolean
  /** City glyph beside systems that have cities (W16). */
  cities: boolean
  /** Spacecraft glyph beside systems that have spacecraft (W16). */
  spacecraft: boolean
  /** Animated ring marker around ringworld systems (R4). Drives the continuous render loop. */
  ringworlds: boolean
}

export interface SceneOptions {
  map: StarMap
  highlight?: ReadonlyMap<string, number>
  layers: Layers
  selectedSystemId?: string
  onSelect: (systemId: string) => void
  /**
   * Pointer is over a system (`systemId` set, x/y in container pixels, called on every move) or
   * left it (`systemId` undefined). The hover card itself is rendered by React in MapView.
   */
  onHover?: (systemId: string | undefined, x: number, y: number) => void
  labelFormat?: LabelFormat
}

/** How a system, sector, city or spacecraft name is shown in the canvas label overlay. See MapView `labelFormat`. */
export type LabelFormat = (name: string, kind: LabelKind) => { text: string; className?: string }
const PLAIN_LABEL: LabelFormat = (name) => ({ text: name })

const BG = 0x0d0e11
const PICK_RADIUS_PX = 9
const CLICK_SLOP_PX = 5
const FOV = 50

const glsl = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : String(n))

// The size formula is shared with hit testing (pointPixelSize in picking.ts).
const VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aRing;
uniform float uPixelRatio;
uniform float uRefDist;
varying vec3 vColor;
varying float vRing;
void main() {
  vColor = aColor;
  vRing = aRing;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float att = clamp(pow(uRefDist / max(-mv.z, 0.001), ${glsl(ATTENUATION_POWER)}), ${glsl(ATTENUATION_MIN)}, ${glsl(ATTENUATION_MAX)});
  gl_PointSize = clamp(aSize * uPixelRatio * att, ${glsl(POINT_PX_MIN)}, ${glsl(POINT_PX_MAX)});
}
`

// aRing: 0 = soft disc, 1 = disc with surveyed ring, 2 = ring only (hover/selection markers).
const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vRing;
uniform float uOpacity;
void main() {
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (d > 1.0) discard;
  float a;
  if (vRing > 1.5) {
    a = smoothstep(0.62, 0.74, d) * (1.0 - smoothstep(0.9, 1.0, d));
  } else if (vRing > 0.5) {
    float core = 1.0 - smoothstep(0.28, 0.4, d);
    float ring = smoothstep(0.66, 0.74, d) * (1.0 - smoothstep(0.9, 1.0, d));
    a = max(core, ring);
  } else {
    a = 1.0 - smoothstep(0.55, 1.0, d);
  }
  if (a < 0.02) discard;
  gl_FragColor = vec4(vColor, a * uOpacity);
}
`

// City / spacecraft glyphs: sprite points nudged sideways in screen space (uOffset, CSS px, y up).
const MARKER_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
uniform float uPixelRatio;
uniform float uRefDist;
uniform vec2 uViewport;
uniform vec2 uOffset;
varying vec3 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec4 clip = projectionMatrix * mv;
  float att = clamp(pow(uRefDist / max(-mv.z, 0.001), ${glsl(ATTENUATION_POWER)}), 0.7, 1.3);
  clip.xy += uOffset * uPixelRatio * att / (uViewport * 0.5) * clip.w;
  gl_Position = clip;
  gl_PointSize = aSize * uPixelRatio * att;
}
`

// uShape: 0 = city (house), 1 = spacecraft (chevron). gl_PointCoord has its origin top-left.
const MARKER_FRAG = /* glsl */ `
varying vec3 vColor;
uniform float uShape;
void main() {
  vec2 p = gl_PointCoord;
  float dx = abs(p.x - 0.5);
  bool inside;
  if (uShape < 0.5) {
    bool roof = p.y >= 0.06 && p.y <= 0.48 && dx <= (p.y - 0.06) * 0.95;
    bool body = p.y > 0.48 && p.y <= 0.94 && dx <= 0.32;
    inside = roof || body;
  } else {
    bool tri = p.y >= 0.06 && p.y <= 0.94 && dx <= (p.y - 0.06) * 0.5;
    bool notch = p.y > 0.6 && dx <= (p.y - 0.6) * 0.6;
    inside = tri && !notch;
  }
  if (!inside) discard;
  gl_FragColor = vec4(vColor, 1.0);
}
`

// Ringworld marker (R4): three bright arcs spinning on a ring, plus a twinkling glint, in screen
// space around the system point. uTime stays 0 for reduced motion, which leaves a still ring.
const RING_VERT = /* glsl */ `
uniform float uPixelRatio;
uniform float uRefDist;
uniform float uSize;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float att = clamp(pow(uRefDist / max(-mv.z, 0.001), ${glsl(ATTENUATION_POWER)}), 0.7, 1.3);
  gl_PointSize = uSize * uPixelRatio * att;
}
`

const RING_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = length(p);
  if (d > 1.0) discard;
  float ang = atan(p.y, p.x);
  float band = smoothstep(0.56, 0.64, d) * (1.0 - smoothstep(0.74, 0.84, d));
  float arcs = 0.35 + 0.65 * smoothstep(-0.25, 0.45, sin(ang * 3.0 - uTime * 0.9));
  float da = abs(mod(ang - (uTime * 0.9 + 0.8) + 3.14159265, 6.2831853) - 3.14159265);
  float tw = 0.6 + 0.4 * sin(uTime * 3.7);
  float glint = exp(-da * da * 40.0) * tw * (1.0 - smoothstep(0.5, 0.98, abs(d - 0.7) * 3.0));
  float halo = exp(-da * da * 6.0) * 0.25 * band;
  float a = band * arcs + glint + halo;
  vec3 col = mix(uColor, vec3(1.0), clamp(glint * 1.2, 0.0, 1.0));
  if (a < 0.02) discard;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}
`

const RING_COLOR = [1, 0.82, 0.38] as const
const RING_SIZE_PX = 30
const RING_PAUSE_QUERY = '(prefers-reduced-motion: reduce)'

interface MarkerStyle {
  shape: 0 | 1
  /** CSS px right and up from the system point. */
  offset: [number, number]
}
const CITY_STYLE: MarkerStyle = { shape: 0, offset: [9, 8] }
const SPACECRAFT_STYLE: MarkerStyle = { shape: 1, offset: [9, -8] }

function markerMaterial(style: MarkerStyle, refDist: number, pixelRatio: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: MARKER_VERT,
    fragmentShader: MARKER_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uPixelRatio: { value: pixelRatio },
      uRefDist: { value: refDist },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uOffset: { value: new THREE.Vector2(...style.offset) },
      uShape: { value: style.shape },
    },
  })
}

function markerPoints(set: MarkerSet, style: MarkerStyle, refDist: number, pixelRatio: number): THREE.Points {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(set.positions, 3))
  g.setAttribute('aColor', new THREE.BufferAttribute(set.colors, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(set.sizes, 1))
  const pts = new THREE.Points(g, markerMaterial(style, refDist, pixelRatio))
  pts.frustumCulled = false
  pts.renderOrder = 2
  return pts
}

function pointsMaterial(refDist: number, pixelRatio: number, depthTest: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest,
    uniforms: {
      uPixelRatio: { value: pixelRatio },
      uRefDist: { value: refDist },
      uOpacity: { value: 1 },
    },
  })
}

function pointsGeometry(pos: Float32Array, col: Float32Array, size: Float32Array, ring: Float32Array): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  g.setAttribute('aRing', new THREE.BufferAttribute(ring, 1))
  return g
}

function label(className: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = `absolute left-0 top-0 hidden whitespace-nowrap will-change-transform ${className}`
  return el
}

const SECTOR_LABEL = 'text-[10px] uppercase tracking-wider text-sky-200/75'
const SELECT_LABEL =
  'rounded-sm border border-ring/60 bg-popover/95 px-1.5 py-0.5 text-xs font-medium text-accent-foreground shadow-md'

export class MapScene {
  private readonly container: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly camera: THREE.PerspectiveCamera
  private readonly controls: OrbitControls
  private readonly scene = new THREE.Scene()
  private readonly labelLayer: HTMLDivElement
  private readonly resizeObserver: ResizeObserver
  private readonly map: StarMap
  private readonly data: MapData
  private readonly nameOf = new Map<string, string>()

  private readonly pointsGeo: THREE.BufferGeometry
  private readonly pointsMat: THREE.ShaderMaterial
  private readonly points: THREE.Points
  private readonly wormholeLines: THREE.LineSegments
  private readonly gridLines: THREE.LineSegments
  private readonly markerGeo: THREE.BufferGeometry
  private readonly markerMat: THREE.ShaderMaterial
  private readonly markers: THREE.Points
  private readonly cityMarkers: THREE.Points
  private readonly spacecraftMarkers: THREE.Points
  private readonly ringMarkers: THREE.Points
  private readonly ringMat: THREE.ShaderMaterial
  private readonly ringCount: number
  private readonly reducedMotion: MediaQueryList | undefined
  private readonly ringObserver: MutationObserver | undefined
  private readonly sectorLabels: { el: HTMLDivElement; pos: Vec3; name: string }[] = []
  private readonly selectLabel = label(SELECT_LABEL)

  private highlight?: ReadonlyMap<string, number>
  private layers: Layers
  private selected = -1
  private hovered = -1
  private sizes: Float32Array
  /** 1 for highlighted points while a highlight is active (hit-test preference). */
  private preferred?: Uint8Array
  private refDist = 1
  private pixelRatio = 1
  private projected?: ProjectedPoints
  private projectedStale = true
  private width = 1
  private height = 1
  private frameId = 0
  private fly?: { from: CameraPose; to: CameraPose; start: number; duration: number; systemId?: string; flyIn?: boolean }
  private downAt?: { x: number; y: number }
  private disposed = false
  private readonly onSelect: (systemId: string) => void
  private readonly onHover?: (systemId: string | undefined, x: number, y: number) => void
  private labelFormat: LabelFormat
  private readonly viewProj = new THREE.Matrix4()

  constructor(container: HTMLElement, opts: SceneOptions) {
    this.container = container
    this.map = opts.map
    this.onSelect = opts.onSelect
    if (opts.onHover) this.onHover = opts.onHover
    this.labelFormat = opts.labelFormat ?? PLAIN_LABEL
    this.layers = opts.layers
    this.highlight = opts.highlight
    // Throws when WebGL is unavailable; MapView shows a message.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setClearColor(BG, 1)
    // Colors are authored display-ready; skip three's linear->sRGB output conversion.
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(pixelRatio)
    const canvas = this.renderer.domElement
    canvas.className = 'absolute inset-0 block h-full w-full outline-none'
    container.appendChild(canvas)

    this.labelLayer = document.createElement('div')
    this.labelLayer.className = 'pointer-events-none absolute inset-0 overflow-hidden'
    container.appendChild(this.labelLayer)

    for (const s of this.map.systems) {
      this.nameOf.set(s.systemId, s.name)
    }

    this.data = buildMapData(this.map, this.highlight, this.styleOptions())
    const d = this.data
    this.sizes = d.sizes.slice()
    this.updatePreferred()

    const refDist = frameDistance(d.frame.radius, FOV, 1.6)
    this.refDist = refDist
    this.pixelRatio = pixelRatio
    this.camera = new THREE.PerspectiveCamera(FOV, 1, Math.max(0.05, d.bounds.radius / 5000), d.bounds.radius * 40)
    this.pointsMat = pointsMaterial(refDist, pixelRatio, true)
    this.pointsGeo = pointsGeometry(d.positions, d.colors, this.sizes, d.rings)
    this.points = new THREE.Points(this.pointsGeo, this.pointsMat)
    this.points.frustumCulled = false
    this.points.renderOrder = 2
    this.scene.add(this.points)

    // City and spacecraft glyphs (W16).
    const mk = buildMarkers(this.map)
    this.cityMarkers = markerPoints(mk.cities, CITY_STYLE, refDist, pixelRatio)
    this.spacecraftMarkers = markerPoints(mk.spacecraft, SPACECRAFT_STYLE, refDist, pixelRatio)
    this.scene.add(this.cityMarkers, this.spacecraftMarkers)

    // Ringworld marker (R4): one point per ringworld system.
    const rw = buildRingworldMarkers(this.map)
    this.ringCount = rw.count
    const rg = new THREE.BufferGeometry()
    rg.setAttribute('position', new THREE.BufferAttribute(rw.positions, 3))
    this.ringMat = new THREE.ShaderMaterial({
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uPixelRatio: { value: pixelRatio },
        uRefDist: { value: refDist },
        uSize: { value: RING_SIZE_PX },
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(...RING_COLOR) },
      },
    })
    this.ringMarkers = new THREE.Points(rg, this.ringMat)
    this.ringMarkers.frustumCulled = false
    this.ringMarkers.renderOrder = 2.5
    this.scene.add(this.ringMarkers)

    // Wormholes.
    const wg = new THREE.BufferGeometry()
    wg.setAttribute('position', new THREE.BufferAttribute(d.wormholes.positions, 3))
    wg.setAttribute('color', new THREE.BufferAttribute(d.wormholes.colors, 3))
    this.wormholeLines = new THREE.LineSegments(
      wg,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: WORMHOLE_OPACITY, depthWrite: false }),
    )
    this.wormholeLines.frustumCulled = false
    this.wormholeLines.renderOrder = 1
    this.scene.add(this.wormholeLines)

    // Sector grid: 12 edges per cube.
    const gp = new Float32Array(d.sectors.length * 24 * 3)
    d.sectors.forEach((s, i) => gp.set(cubeEdges(s.min, s.max), i * 72))
    const gg = new THREE.BufferGeometry()
    gg.setAttribute('position', new THREE.BufferAttribute(gp, 3))
    this.gridLines = new THREE.LineSegments(
      gg,
      new THREE.LineBasicMaterial({ color: 0x6f8fb0, transparent: true, opacity: 0.38, depthWrite: false }),
    )
    this.gridLines.frustumCulled = false
    this.gridLines.renderOrder = 0
    this.scene.add(this.gridLines)

    for (const s of d.sectors) {
      const el = label(SECTOR_LABEL)
      this.labelLayer.appendChild(el)
      this.sectorLabels.push({ el, pos: s.labelPosition, name: s.name })
    }
    this.applySectorLabels()
    this.labelLayer.append(this.selectLabel)

    // Markers: point 0 = selected (cyan), point 1 = hovered (white). Size 0 hides.
    this.markerGeo = pointsGeometry(
      new Float32Array(6),
      new Float32Array([0.35, 0.9, 1, 1, 1, 1]),
      new Float32Array([0, 0]),
      new Float32Array([2, 2]),
    )
    this.markerMat = pointsMaterial(refDist, pixelRatio, false)
    this.markers = new THREE.Points(this.markerGeo, this.markerMat)
    this.markers.frustumCulled = false
    this.markers.renderOrder = 3
    this.scene.add(this.markers)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.12
    this.controls.screenSpacePanning = true
    this.controls.minDistance = 2
    this.controls.maxDistance = Math.max(d.bounds.radius * 8, 50)
    this.controls.addEventListener('change', this.invalidate)

    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerleave', this.onPointerLeave)
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointerup', this.onPointerUp)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    // The ring animation pauses with the tab and with an inactive (inert) pane; these wake it up.
    document.addEventListener('visibilitychange', this.invalidate)
    this.reducedMotion = typeof matchMedia === 'function' ? matchMedia(RING_PAUSE_QUERY) : undefined
    this.reducedMotion?.addEventListener('change', this.invalidate)
    if (typeof MutationObserver === 'function') {
      this.ringObserver = new MutationObserver(this.invalidate)
      this.ringObserver.observe(document.body, { attributes: true, attributeFilter: ['inert'], subtree: true })
    }
    this.resize()
    this.resetView(false)
    this.setLayers(this.layers)
    this.setSelected(opts.selectedSystemId)
    this.invalidate()
  }

  // ---- public API -------------------------------------------------------------------------

  setHighlight(highlight: ReadonlyMap<string, number> | undefined): void {
    this.highlight = highlight
    this.refreshStyle()
  }

  setLayers(layers: Layers): void {
    const statusChanged = layers.status !== this.layers.status || layers.starColor !== this.layers.starColor
    this.layers = layers
    this.wormholeLines.visible = layers.wormholes
    this.gridLines.visible = layers.sectors
    this.cityMarkers.visible = layers.cities
    this.spacecraftMarkers.visible = layers.spacecraft
    this.ringMarkers.visible = layers.ringworlds && this.ringCount > 0
    for (const s of this.sectorLabels) s.el.style.display = layers.sectors ? '' : 'none'
    if (statusChanged) this.refreshStyle()
    this.invalidate()
  }

  /** Change how names are rendered in labels (e.g. censoring). Re-applies to all labels. */
  setLabelFormat(format: LabelFormat | undefined): void {
    this.labelFormat = format ?? PLAIN_LABEL
    this.applySectorLabels()
    this.updateMarkers()
    this.invalidate()
  }

  private setLabelText(el: HTMLElement, name: string, kind: LabelKind): void {
    const f = this.labelFormat(name, kind)
    el.textContent = f.text
    // Keep the base classes; toggle only the formatter's classes.
    const prev = el.dataset.fmtApplied
    if (prev) el.classList.remove(...prev.split(' '))
    if (f.className) el.classList.add(...f.className.split(' '))
    el.dataset.fmtApplied = f.className ?? ''
  }

  private applySectorLabels(): void {
    for (const s of this.sectorLabels) this.setLabelText(s.el, s.name, 'sector')
  }

  setSelected(systemId: string | undefined): void {
    this.selected = systemId === undefined ? -1 : (this.data.indexOfSystem.get(systemId) ?? -1)
    this.updateMarkers()
    this.invalidate()
  }

  resetView(animate = true): void {
    const { center, radius } = this.data.frame
    const dist = frameDistance(radius, FOV, this.camera.aspect)
    const to: CameraPose = {
      target: center,
      position: [center[0] + dist * 0.45, center[1] + dist * 0.55, center[2] + dist * 0.7],
    }
    // Normalize the direction to the framing distance.
    const dx = to.position[0] - center[0]
    const dy = to.position[1] - center[1]
    const dz = to.position[2] - center[2]
    const k = dist / Math.hypot(dx, dy, dz)
    to.position = [center[0] + dx * k, center[1] + dy * k, center[2] + dz * k]
    if (animate) this.startFly(to)
    else this.applyPose(to)
  }

  /** Animate the camera to look at a system. Unknown ids are ignored. */
  flyTo(systemId: string): void {
    const i = this.data.indexOfSystem.get(systemId)
    if (i === undefined) return
    const p = this.data.positions
    this.startFly(
      flyDestination(this.currentPose(), [p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!], this.data.frame.radius),
      FLY_DURATION_MS,
      systemId,
    )
    if (this.fly) this.fly.flyIn = true
  }

  /**
   * Smoothly re-center on a system keeping the current zoom distance and angle (W1). Does nothing
   * for unknown ids (Deep Space has no coordinates) or while any fly-in runs (a fly-in always wins).
   */
  centerOn(systemId: string): void {
    const i = this.data.indexOfSystem.get(systemId)
    if (i === undefined || this.fly?.flyIn || this.fly?.systemId === systemId) return
    const p = this.data.positions
    this.startFly(centerPose(this.currentPose(), [p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!]), CENTER_DURATION_MS, systemId)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.frameId)
    this.resizeObserver.disconnect()
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointermove', this.onPointerMove)
    canvas.removeEventListener('pointerleave', this.onPointerLeave)
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    this.controls.removeEventListener('change', this.invalidate)
    document.removeEventListener('visibilitychange', this.invalidate)
    this.reducedMotion?.removeEventListener('change', this.invalidate)
    this.ringObserver?.disconnect()
    this.controls.dispose()
    for (const o of [this.points, this.wormholeLines, this.gridLines, this.markers, this.cityMarkers, this.spacecraftMarkers, this.ringMarkers]) {
      o.geometry.dispose()
      ;(o.material as THREE.Material).dispose()
    }
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    canvas.remove()
    this.labelLayer.remove()
  }

  // ---- styling ----------------------------------------------------------------------------

  private styleOptions(): StyleOptions {
    return { starColor: this.layers.starColor, status: this.layers.status }
  }

  private updatePreferred(): void {
    const h = this.highlight
    if (!h) {
      this.preferred = undefined
      return
    }
    const d = this.data
    const m = new Uint8Array(d.count)
    for (let i = 0; i < d.count; i++) m[i] = h.has(d.systemIds[i]!) ? 1 : 0
    this.preferred = m
  }

  /** Recompute highlight/status styling and update attributes in place. */
  private refreshStyle(): void {
    const fresh = buildMapData(this.map, this.highlight, this.styleOptions())
    const d = this.data
    d.colors.set(fresh.colors)
    d.sizes.set(fresh.sizes)
    d.rings.set(fresh.rings)
    this.sizes.set(d.sizes)
    this.updatePreferred()
    for (const name of ['aColor', 'aSize', 'aRing']) {
      this.pointsGeo.getAttribute(name)!.needsUpdate = true
    }
    this.invalidate()
  }

  // ---- camera -----------------------------------------------------------------------------

  private currentPose(): CameraPose {
    const p = this.camera.position
    const t = this.controls.target
    return { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] }
  }

  private applyPose(pose: CameraPose): void {
    this.camera.position.set(...pose.position)
    this.controls.target.set(...pose.target)
    this.camera.lookAt(this.controls.target)
    this.controls.update()
    this.invalidate()
  }

  private startFly(to: CameraPose, duration = FLY_DURATION_MS, systemId?: string): void {
    this.fly = { from: this.currentPose(), to, start: performance.now(), duration, ...(systemId !== undefined && { systemId }) }
    this.invalidate()
  }

  // ---- picking and pointer ----------------------------------------------------------------

  private pointerPos(e: PointerEvent): { x: number; y: number } {
    const r = this.renderer.domElement.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private pickAt(x: number, y: number): number {
    if (!this.projected || this.projectedStale) {
      this.camera.updateMatrixWorld()
      this.viewProj.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)
      this.projected = projectPoints(this.data.positions, this.viewProj.elements, this.width, this.height, this.projected)
      this.projectedStale = false
    }
    return pickNearest(this.projected, x, y, PICK_RADIUS_PX, this.sizes, {
      screen: { refDist: this.refDist, pixelRatio: this.pixelRatio },
      ...(this.preferred && { prefer: this.preferred }),
    })
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.buttons !== 0) {
      this.setHovered(-1) // dragging the camera: drop the hover card
      return
    }
    const { x, y } = this.pointerPos(e)
    this.setHovered(this.pickAt(x, y))
    if (this.hovered >= 0) this.onHover?.(this.data.systemIds[this.hovered]!, x, y)
  }

  private readonly onPointerLeave = (): void => this.setHovered(-1)

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.setHovered(-1)
    this.downAt = e.button === 0 ? this.pointerPos(e) : undefined
  }

  private readonly onPointerUp = (e: PointerEvent): void => {
    const down = this.downAt
    this.downAt = undefined
    if (!down || e.button !== 0) return
    const p = this.pointerPos(e)
    if (Math.hypot(p.x - down.x, p.y - down.y) > CLICK_SLOP_PX) return
    const i = this.pickAt(p.x, p.y)
    if (i >= 0) this.onSelect(this.data.systemIds[i]!)
  }

  private setHovered(i: number): void {
    if (i === this.hovered) return
    this.hovered = i
    if (i < 0) this.onHover?.(undefined, 0, 0)
    this.renderer.domElement.style.cursor = i >= 0 ? 'pointer' : ''
    this.updateMarkers()
    this.invalidate()
  }

  private updateMarkers(): void {
    const pos = this.markerGeo.getAttribute('position') as THREE.BufferAttribute
    const size = this.markerGeo.getAttribute('aSize') as THREE.BufferAttribute
    const src = this.data.positions
    const slots: [number, number][] = [
      [0, this.selected],
      [1, this.hovered === this.selected ? -1 : this.hovered],
    ]
    for (const [slot, idx] of slots) {
      if (idx < 0) {
        size.setX(slot, 0)
      } else {
        pos.setXYZ(slot, src[idx * 3]!, src[idx * 3 + 1]!, src[idx * 3 + 2]!)
        size.setX(slot, slot === 0 ? 26 : 20)
      }
    }
    pos.needsUpdate = true
    size.needsUpdate = true
    const name = (i: number): string => this.nameOf.get(this.data.systemIds[i]!) ?? ''
    this.setLabelText(this.selectLabel, this.selected >= 0 ? name(this.selected) : '', 'system')
  }

  // ---- render loop ------------------------------------------------------------------------

  private readonly invalidate = (): void => {
    this.projectedStale = true
    if (!this.frameId && !this.disposed) this.frameId = requestAnimationFrame(this.frame)
  }

  private readonly frame = (now: number): void => {
    this.frameId = 0
    if (this.disposed) return
    let again = false
    if (this.fly) {
      const f = this.fly
      const elapsed = now - f.start
      const pose = flyPose(f.from, f.to, elapsed, f.duration)
      this.camera.position.set(...pose.position)
      this.controls.target.set(...pose.target)
      if (elapsed >= f.duration) this.fly = undefined
      else again = true
    }
    // With damping, update() returns true while inertia is still moving the camera.
    if (this.controls.update()) again = true
    // Continuous loop only for the ringworld animation: toggle on, a ringworld exists, motion
    // allowed, tab visible and pane active. Otherwise rendering stays on demand.
    if (this.ringAnimating()) {
      this.ringMat.uniforms.uTime!.value = (now / 1000) % 3600
      again = true
    } else this.ringMat.uniforms.uTime!.value = 0
    this.render()
    if (again) {
      this.projectedStale = true
      if (!this.frameId) this.frameId = requestAnimationFrame(this.frame)
    }
  }

  /** True while the ring marker should keep the render loop running. */
  private ringAnimating(): boolean {
    return (
      this.layers.ringworlds &&
      this.ringCount > 0 &&
      !this.reducedMotion?.matches &&
      !document.hidden &&
      !this.container.closest('[inert]')
    )
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera)
    this.camera.updateMatrixWorld()
    this.viewProj.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)
    const m = this.viewProj.elements
    const place = (el: HTMLElement, pos: Vec3, dy: number, fade = 1): void => {
      const p = projectPoint(m, pos[0], pos[1], pos[2], this.width, this.height)
      if (!p.visible || p.x < -80 || p.y < -20 || p.x > this.width + 80 || p.y > this.height + 20) {
        el.style.visibility = 'hidden'
        return
      }
      el.style.visibility = 'visible'
      el.style.opacity = String(fade)
      el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y + dy)}px) translate(-50%, 0)`
    }
    const showAt = (el: HTMLElement, idx: number, dy: number): void => {
      if (idx < 0) {
        el.style.display = 'none'
        return
      }
      el.style.display = ''
      const s = this.data.positions
      place(el, [s[idx * 3]!, s[idx * 3 + 1]!, s[idx * 3 + 2]!], dy)
    }
    showAt(this.selectLabel, this.selected, 16)
    if (this.layers.sectors) {
      const r = this.data.bounds.radius
      const cam = this.camera.position
      for (const s of this.sectorLabels) {
        s.el.style.display = ''
        // Fade labels with distance so near sectors read and far ones do not clutter.
        const dist = Math.hypot(s.pos[0] - cam.x, s.pos[1] - cam.y, s.pos[2] - cam.z)
        const fade = Math.max(0, Math.min(1, 1.6 - dist / (r * 0.9)))
        place(s.el, s.pos, 0, fade)
        if (fade <= 0.02) s.el.style.visibility = 'hidden'
      }
    }
  }

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    this.width = w
    this.height = h
    this.renderer.setSize(w, h, false)
    const buf = this.renderer.getDrawingBufferSize(new THREE.Vector2())
    for (const m of [this.cityMarkers, this.spacecraftMarkers]) {
      ;(m.material as THREE.ShaderMaterial).uniforms.uViewport!.value.copy(buf)
    }
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.invalidate()
  }
}
