import { watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { clampToFloor, cornerToThree, snapTo, threeToCorner } from '@/domain/geometry'
import {
  brushFor,
  checkpoint,
  commitTransform,
  doc,
  dropCheckpointIfUnchanged,
  placeObject,
  selectObject,
  structureTick,
  transformTick,
  ui,
} from '@/domain/store'
import type { ObjectType, Vec3 } from '@/domain/types'
import { bindViewport, type CameraShot } from '@/io/bridge'
import { buildDimensions, buildFloor, buildGrid, buildGround, buildObject } from './build'
import { exportRootGlb } from './exportModel'

export function mountViewport(host: HTMLElement) {
  const scene = new THREE.Scene()
  const persp = new THREE.PerspectiveCamera(40, 1, 0.1, 500)
  const ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400)
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.18
  renderer.outputColorSpace = THREE.SRGBColorSpace
  host.appendChild(renderer.domElement)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environment
  scene.environmentIntensity = 0.72
  pmrem.dispose()

  const hemi = new THREE.HemisphereLight(0xeaf2f8, 0x2a3340, 0.82)
  const sun = new THREE.DirectionalLight(0xfff6ea, 1.65)
  sun.position.set(18, 28, 14)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.radius = 2.2
  sun.shadow.bias = -0.00035
  sun.shadow.normalBias = 0.02
  const fill = new THREE.DirectionalLight(0xb9d0e8, 0.38)
  fill.position.set(-16, 12, -10)
  const rim = new THREE.DirectionalLight(0x9fd7d0, 0.22)
  rim.position.set(4, 10, -22)
  scene.add(hemi, sun, sun.target, fill, rim)

  const exportRoot = new THREE.Group()
  exportRoot.name = 'warehouse'
  const helperRoot = new THREE.Group()
  scene.add(exportRoot, helperRoot)

  const initialCamera: THREE.Camera = persp
  const controls = new OrbitControls(initialCamera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.screenSpacePanning = true
  controls.minDistance = 2
  controls.maxDistance = 280
  controls.minZoom = 0.35
  controls.maxZoom = 8

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hitPoint = new THREE.Vector3()
  const meshMap = new Map<string, THREE.Group>()
  let ghost: THREE.Group | null = null
  let selection: THREE.BoxHelper | null = null
  let lastCorner: { x: number; z: number } | null = null
  let tracking = false
  let dragging = false
  let armed = false
  let downX = 0
  let downY = 0
  let downId: string | null = null
  let dragId: string | null = null
  let grabX = 0
  let grabZ = 0
  let seenToken = ui.cameraToken
  let raf = 0

  const abort = new AbortController()
  const listen = { signal: abort.signal }
  renderer.domElement.addEventListener('pointerdown', onPointerDown, listen)
  renderer.domElement.addEventListener('pointermove', onPointerMove, listen)
  window.addEventListener('pointerup', onPointerUp, listen)
  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault(), listen)
  const observer = new ResizeObserver(() => resize())
  observer.observe(host)

  resize()
  fit()
  rebuild()

  const stops = [
    watch(
      () => [structureTick.value, ui.preview, ui.showGrid, ui.showSlotCodes, ui.selectedId] as const,
      (next, prev) => {
        if (!prev) return
        const structureChanged = next[0] !== prev[0]
        const visualChanged = next[1] !== prev[1] || next[2] !== prev[2] || next[3] !== prev[3]
        const slotLabels = ui.showSlotCodes && next[4] !== prev[4]
        if (structureChanged || visualChanged || slotLabels) rebuild()
        else updateSelection()
      },
    ),
    watch(transformTick, () => syncTransforms()),
    watch(
      () => [ui.projection, ui.cameraToken] as const,
      ([, token]) => {
        if (token !== seenToken) {
          seenToken = token
          applyRequest()
          return
        }
        applyProjection()
      },
    ),
    watch(
      () => [ui.tool, ui.placeRotation] as const,
      () => refreshGhost(),
    ),
    watch(
      () => ui.fitToken,
      () => fit(),
    ),
  ]

  const unbind = bindViewport({
    exportGlb,
    capture,
    fit,
  })
  frame()

  return () => {
    abort.abort()
    observer.disconnect()
    cancelAnimationFrame(raf)
    stops.forEach((stop) => stop())
    unbind()
    clearSelection()
    if (ghost) disposeNode(ghost)
    emptyGroup(exportRoot)
    emptyGroup(helperRoot)
    controls.dispose()
    environment.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }

  function frame() {
    controls.update()
    selection?.update()
    renderer.render(scene, activeCamera())
    raf = requestAnimationFrame(frame)
  }

  function activeCamera() {
    return ui.projection === 'top' ? ortho : persp
  }

  function resize() {
    const width = Math.max(host.clientWidth, 1)
    const height = Math.max(host.clientHeight, 1)
    renderer.setSize(width, height, false)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    persp.aspect = width / height
    persp.updateProjectionMatrix()
    fitOrthoFrustum()
  }

  function fitOrthoFrustum() {
    const aspect = host.clientWidth / Math.max(host.clientHeight, 1)
    const span = Math.max(doc.floor.width, doc.floor.depth) * 0.58
    ortho.left = -span * aspect
    ortho.right = span * aspect
    ortho.top = span
    ortho.bottom = -span
    ortho.updateProjectionMatrix()
  }

  function fit() {
    const dist = Math.max(doc.floor.width, doc.floor.depth)
    controls.target.set(0, ui.projection === 'top' ? 0 : 0.9, 0)
    if (ui.projection === 'top') {
      configureControls('top')
      ortho.position.set(0, 80, 0)
      ortho.up.set(0, 0, -1)
      ortho.zoom = 1
      fitOrthoFrustum()
      ortho.lookAt(controls.target)
    } else {
      configureControls('perspective')
      persp.up.set(0, 1, 0)
      persp.position.set(dist * 0.58, dist * 0.4, dist * 0.52)
      controls.target.set(0, 0.9, 0)
    }
    controls.update()
  }

  function configureControls(mode: 'perspective' | 'top') {
    controls.object = mode === 'top' ? ortho : persp
    controls.enableRotate = mode !== 'top'
    controls.mouseButtons.LEFT = mode === 'top' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE
    controls.minPolarAngle = 0
    controls.maxPolarAngle = mode === 'top' ? Math.PI : Math.PI / 2 - 0.04
  }

  function applyProjection() {
    configureControls(ui.projection)
    if (ui.projection === 'top') {
      ortho.up.set(0, 0, -1)
      ortho.position.set(controls.target.x, 80, controls.target.z)
      ortho.zoom = 1
      fitOrthoFrustum()
      ortho.lookAt(controls.target)
    } else {
      persp.up.set(0, 1, 0)
    }
    controls.update()
  }

  function applyRequest() {
    const request = ui.cameraRequest
    if (!request) return
    configureControls(request.projection)
    const position = cornerToThree(request.position, doc.floor)
    const target = cornerToThree(request.target, doc.floor)
    const camera = activeCamera()
    camera.position.set(position.x, position.y, position.z)
    controls.target.set(target.x, target.y, target.z)
    if (request.projection === 'top') {
      camera.up.set(0, 0, -1)
      fitOrthoFrustum()
      camera.lookAt(controls.target)
    }
    controls.update()
  }

  function capture(): CameraShot {
    const camera = activeCamera()
    return {
      projection: ui.projection,
      position: threeToCorner(toVec(camera.position), doc.floor),
      target: threeToCorner(toVec(controls.target), doc.floor),
    }
  }

  async function exportGlb() {
    return exportRootGlb(exportRoot)
  }

  function rebuild() {
    clearSelection()
    emptyGroup(exportRoot)
    emptyGroup(helperRoot)
    meshMap.clear()
    exportRoot.add(buildFloor(doc.floor))
    for (const obj of doc.objects) {
      const group = buildObject(obj, {
        preview: ui.preview,
        showSlots: ui.showSlotCodes && ui.selectedId === obj.id && obj.type === 'rack',
      })
      placeGroup(group, obj.position, obj.rotationY)
      exportRoot.add(group)
      meshMap.set(obj.id, group)
    }
    helperRoot.add(buildGround(doc.floor))
    if (!ui.preview && ui.showGrid) {
      helperRoot.add(buildGrid(doc.floor, doc.gridSize))
      helperRoot.add(buildDimensions(doc.floor))
      const axes = new THREE.AxesHelper(1.8)
      const origin = cornerToThree({ x: 0, y: 0, z: 0 }, doc.floor)
      axes.position.set(origin.x, 0.03, origin.z)
      helperRoot.add(axes)
    }
    applyAtmosphere()
    updateShadow()
    if (ui.projection === 'top') fitOrthoFrustum()
    updateSelection()
    refreshGhost()
  }

  function syncTransforms() {
    for (const obj of doc.objects) {
      const group = meshMap.get(obj.id)
      if (!group) continue
      placeGroup(group, obj.position, obj.rotationY)
    }
    updateSelection()
  }

  function placeGroup(group: THREE.Object3D, position: Vec3, rotationY: number) {
    const placed = cornerToThree(position, doc.floor)
    group.position.set(placed.x, placed.y, placed.z)
    group.rotation.y = (rotationY * Math.PI) / 180
  }

  function refreshGhost() {
    if (ghost) {
      scene.remove(ghost)
      disposeNode(ghost)
      ghost = null
    }
    if (!isPlaceTool(ui.tool) || ui.preview) return
    const sample = brushFor(ui.tool)
    sample.rotationY = ui.placeRotation
    ghost = buildObject(sample, { preview: false, showSlots: false })
    ghost.traverse((child) => {
      child.userData.objectId = ''
      const meshed = child as THREE.Mesh
      const materials = Array.isArray(meshed.material) ? meshed.material : meshed.material ? [meshed.material] : []
      for (const material of materials) {
        material.transparent = true
        material.opacity = Math.min(material.opacity, 0.38)
        material.depthWrite = false
      }
      if (meshed.isMesh) {
        meshed.castShadow = false
        meshed.receiveShadow = false
      }
      if ((child as THREE.Sprite).isSprite) child.visible = false
    })
    ghost.visible = false
    scene.add(ghost)
    if (lastCorner) moveGhost(lastCorner.x, lastCorner.z)
  }

  function moveGhost(x: number, z: number) {
    if (!ghost || !isPlaceTool(ui.tool)) return
    const sample = brushFor(ui.tool)
    sample.position = { x, y: sample.position.y, z }
    sample.rotationY = ui.placeRotation
    if (doc.confine) clampToFloor(sample, doc.floor)
    placeGroup(ghost, sample.position, sample.rotationY)
    ghost.visible = true
  }

  function updateSelection() {
    clearSelection()
    if (!ui.selectedId || ui.preview) return
    const group = meshMap.get(ui.selectedId)
    if (!group) return
    selection = new THREE.BoxHelper(group, 0x4fc3b8)
    scene.add(selection)
  }

  function clearSelection() {
    if (!selection) return
    scene.remove(selection)
    selection.geometry.dispose()
    disposeMaterial(selection.material)
    selection = null
  }

  function applyAtmosphere() {
    const color = ui.preview ? 0x080c10 : 0x0a0f14
    scene.background = new THREE.Color(color)
    const dist = Math.max(doc.floor.width, doc.floor.depth)
    scene.fog = new THREE.Fog(color, dist * 1.35, dist * 3.4)
  }

  function updateShadow() {
    const dist = Math.max(doc.floor.width, doc.floor.depth)
    sun.position.set(dist * 0.62, dist * 0.72, dist * 0.22)
    sun.target.position.set(0, 0, 0)
    const camera = sun.shadow.camera
    camera.left = -dist
    camera.right = dist
    camera.top = dist
    camera.bottom = -dist
    camera.near = 0.5
    camera.far = dist * 3
    camera.updateProjectionMatrix()
    sun.shadow.bias = -0.0004
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return
    tracking = true
    dragging = false
    armed = false
    downX = event.clientX
    downY = event.clientY
    downId = pick(event)
    dragId = null
    if (ui.preview || ui.tool !== 'select' || !downId) return
    const obj = doc.objects.find((item) => item.id === downId)
    const point = floorPoint(event)
    if (!obj || !point) return
    const corner = threeToCorner(toVec(point), doc.floor)
    grabX = obj.position.x - corner.x
    grabZ = obj.position.z - corner.z
    dragId = downId
    selectObject(downId, true)
    controls.enabled = false
    try {
      renderer.domElement.setPointerCapture(event.pointerId)
    } catch {
      // Window pointerup still closes the gesture if capture is unavailable.
    }
  }

  function onPointerMove(event: PointerEvent) {
    const point = floorPoint(event)
    if (point) {
      const corner = threeToCorner(toVec(point), doc.floor)
      const x = snapTo(corner.x, doc.gridSize, doc.snap)
      const z = snapTo(corner.z, doc.gridSize, doc.snap)
      ui.pointer.x = x
      ui.pointer.z = z
      ui.pointer.valid = true
      lastCorner = { x, z }
      if (isPlaceTool(ui.tool) && !ui.preview) moveGhost(x, z)
    } else {
      ui.pointer.valid = false
    }
    if (!tracking || !dragId || ui.preview || !point) return
    if (Math.hypot(event.clientX - downX, event.clientY - downY) < 4) return
    if (!dragging) {
      dragging = true
      controls.enabled = false
      checkpoint()
      armed = true
    }
    const corner = threeToCorner(toVec(point), doc.floor)
    const obj = doc.objects.find((item) => item.id === dragId)
    const group = dragId ? meshMap.get(dragId) : undefined
    if (!obj || !group) return
    obj.position.x = snapTo(corner.x + grabX, doc.gridSize, doc.snap)
    obj.position.z = snapTo(corner.z + grabZ, doc.gridSize, doc.snap)
    if (doc.confine) clampToFloor(obj, doc.floor)
    placeGroup(group, obj.position, obj.rotationY)
  }

  function onPointerUp(event: PointerEvent) {
    if (!tracking || event.button !== 0) return
    tracking = false
    controls.enabled = true
    const moved = Math.hypot(event.clientX - downX, event.clientY - downY) > 5
    if (dragging) {
      dragging = false
      dragId = null
      if (armed) {
        dropCheckpointIfUnchanged()
        commitTransform()
      }
      return
    }
    dragId = null
    if (moved) return
    if (ui.preview || ui.tool === 'select') {
      selectObject(downId, Boolean(downId))
      return
    }
    if (!lastCorner || !isPlaceTool(ui.tool)) return
    placeObject(ui.tool, lastCorner.x, lastCorner.z)
  }

  function pick(event: PointerEvent) {
    if (!project(event)) return null
    const hits = raycaster.intersectObjects(exportRoot.children, true)
    const nearest = hits[0]
    if (!nearest) return null
    let current: THREE.Object3D | null = nearest.object
    while (current) {
      const id = current.userData.objectId
      if (typeof id === 'string' && id) return id
      current = current.parent
    }
    return null
  }

  function floorPoint(event: PointerEvent) {
    if (!project(event)) return null
    return raycaster.ray.intersectPlane(floorPlane, hitPoint) ? hitPoint : null
  }

  function project(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, activeCamera())
    return true
  }
}

function toVec(vector: THREE.Vector3): Vec3 {
  return { x: vector.x, y: vector.y, z: vector.z }
}

function isPlaceTool(tool: string): tool is ObjectType {
  return tool !== 'select'
}

function emptyGroup(group: THREE.Group) {
  for (const child of [...group.children]) {
    group.remove(child)
    disposeNode(child)
  }
}

function disposeNode(node: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  node.traverse((child) => {
    const meshed = child as THREE.Mesh
    if (meshed.geometry) geometries.add(meshed.geometry)
    if (Array.isArray(meshed.material)) meshed.material.forEach((item) => materials.add(item))
    else if (meshed.material) materials.add(meshed.material)
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => disposeMaterial(material))
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  const list = Array.isArray(material) ? material : [material]
  for (const item of list) {
    for (const value of Object.values(item)) {
      if (value instanceof THREE.Texture) value.dispose()
    }
    item.dispose()
  }
}
