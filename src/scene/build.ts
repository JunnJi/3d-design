import * as THREE from 'three'
import { previewStatus } from '../catalog'
import { rackCells, rackFrameHeight } from '../geometry'
import type { FloorSpec, SceneObject } from '../types'
import { concreteTexture, hazardTexture } from './textures'

export interface BuildOptions {
  preview: boolean
  showSlots: boolean
}

export function buildFloor(floor: FloorSpec) {
  const group = new THREE.Group()
  group.name = '地面'
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(floor.width, 0.16, floor.depth),
    new THREE.MeshStandardMaterial({
      color: floor.color,
      map: concreteTexture(floor.width, floor.depth),
      roughness: 0.92,
      metalness: 0.03,
      envMapIntensity: 0.35,
    }),
  )
  slab.position.y = -0.08
  slab.receiveShadow = true
  slab.castShadow = true
  slab.name = '地面'
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(floor.width + 0.28, 0.1, floor.depth + 0.28),
    new THREE.MeshStandardMaterial({ color: '#243040', roughness: 0.9, metalness: 0.06, envMapIntensity: 0.4 }),
  )
  plinth.position.y = -0.16
  plinth.receiveShadow = true
  group.add(plinth, slab, ...floorBoundary(floor))
  return group
}

function floorBoundary(floor: FloorSpec) {
  const paint = new THREE.MeshStandardMaterial({
    color: '#4fc3b8',
    roughness: 0.5,
    metalness: 0.06,
    emissive: new THREE.Color('#4fc3b8'),
    emissiveIntensity: 0.28,
  })
  const inset = 0.42
  const thickness = 0.1
  const alongWidth = Math.max(floor.width - inset * 2, 0.4)
  const alongDepth = Math.max(floor.depth - inset * 2, 0.4)
  const zEdge = floor.depth / 2 - inset - thickness / 2
  const xEdge = floor.width / 2 - inset - thickness / 2
  const strips = [
    [alongWidth, thickness, 0, zEdge],
    [alongWidth, thickness, 0, -zEdge],
    [thickness, alongDepth, xEdge, 0],
    [thickness, alongDepth, -xEdge, 0],
  ]
  return strips.map(([width, depth, x, z]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.025, depth), paint)
    mesh.position.set(x, 0.014, z)
    mesh.receiveShadow = true
    return mesh
  })
}

export function buildGround(floor: FloorSpec) {
  const span = Math.max(floor.width, floor.depth) * 4.5
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(span / 2, 72),
    new THREE.MeshStandardMaterial({ color: '#171e28', roughness: 1, metalness: 0 }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = -0.22
  mesh.receiveShadow = true
  mesh.name = '场地'
  return mesh
}

export function buildGrid(floor: FloorSpec, step: number) {
  const positions: number[] = []
  const colors: number[] = []
  const y = 0.012
  const x0 = -floor.width / 2
  const z0 = -floor.depth / 2
  const visualStep = step < 0.5 ? 1 : step
  for (let x = 0; x <= floor.width + 0.001; x += visualStep) {
    pushLine(positions, colors, x0 + x, y, z0, x0 + x, y, z0 + floor.depth, isMajor(x, floor.width))
  }
  for (let z = 0; z <= floor.depth + 0.001; z += visualStep) {
    pushLine(positions, colors, x0, y, z0 + z, x0 + floor.width, y, z0 + z, isMajor(z, floor.depth))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42 })
  material.fog = false
  return new THREE.LineSegments(geometry, material)
}

export function buildDimensions(floor: FloorSpec) {
  const group = new THREE.Group()
  const widthLabel = makeSprite(`${trimNumber(floor.width)} m`, 3.2, 0.9, '#06201d', 'rgba(79,195,184,0.94)')
  widthLabel.position.set(0, 0.4, floor.depth / 2 + 1.2)
  const depthLabel = makeSprite(`${trimNumber(floor.depth)} m`, 3.2, 0.9, '#06201d', 'rgba(79,195,184,0.94)')
  depthLabel.position.set(-floor.width / 2 - 1.7, 0.4, 0)
  const origin = makeSprite('原点', 1.8, 0.7, '#06201d', 'rgba(79,195,184,0.94)')
  origin.position.set(-floor.width / 2 + 1.3, 0.45, -floor.depth / 2 + 0.9)
  group.add(widthLabel, depthLabel, origin)
  return group
}

export function buildObject(obj: SceneObject, options: BuildOptions) {
  const group = new THREE.Group()
  group.name = objectTitle(obj)
  switch (obj.type) {
    case 'rack':
      addRack(group, obj, options)
      break
    case 'wall':
      addWall(group, obj)
      break
    case 'column':
      addColumn(group, obj)
      break
    case 'door':
      addDoor(group, obj)
      break
    case 'zone':
      addZone(group, obj)
      break
    case 'dock':
      addDock(group, obj)
      break
    case 'station':
      addStation(group, obj)
      break
    case 'label':
      addLabel(group, obj)
      break
  }
  tag(group, obj.id)
  return group
}

function addRack(group: THREE.Group, obj: Extract<SceneObject, { type: 'rack' }>, options: BuildOptions) {
  const length = obj.bays * obj.bayWidth
  const postHeight = rackFrameHeight(obj) + 0.12
  const post = 0.075
  const frame = mat(obj.frameColor, 0.62, 0.32)
  const beam = mat(obj.beamColor, 0.48, 0.34)
  const shelf = mat(obj.shelfColor, 0.08, 0.68)
  for (let index = 0; index <= obj.bays; index += 1) {
    const x = -length / 2 + index * obj.bayWidth
    for (const z of [-obj.depth / 2 + post / 2, obj.depth / 2 - post / 2]) {
      const upright = box(post, postHeight, post, frame)
      upright.position.set(x, postHeight / 2, z)
      group.add(upright)
    }
    const tie = box(0.04, 0.04, Math.max(obj.depth - post, 0.12), frame)
    tie.position.set(x, Math.min(postHeight * 0.46, obj.levelHeight * 0.7), 0)
    group.add(tie)
  }
  for (let level = 0; level < obj.levels; level += 1) {
    const y = (level + 1) * obj.levelHeight
    for (const z of [-obj.depth / 2 + 0.05, obj.depth / 2 - 0.05]) {
      const beamMesh = box(length, 0.075, 0.055, beam)
      beamMesh.position.set(0, y, z)
      group.add(beamMesh)
    }
    const board = box(Math.max(length - 0.1, 0.2), 0.035, Math.max(obj.depth - 0.16, 0.2), shelf)
    board.position.set(0, y + 0.045, 0)
    group.add(board)
  }

  const cells = rackCells(obj)
  const cartonHeight = Math.min(obj.levelHeight * 0.42, 0.75)
  const palletMaterial = mat('#b08968', 0.04, 0.82)
  for (const cell of cells) {
    const anchor = new THREE.Object3D()
    anchor.name = cell.code
    anchor.position.set(cell.local.x, cell.local.y, cell.local.z)
    group.add(anchor)
    if (options.preview) {
      const status = previewStatus(cell.code)
      if (status.rank > 0) {
        const cartonMaterial = mat(status.color, 0.12, 0.52)
        cartonMaterial.emissive = new THREE.Color(status.color)
        cartonMaterial.emissiveIntensity = 0.16
        const pallet = box(obj.bayWidth * 0.72, 0.07, obj.depth * 0.68, palletMaterial)
        pallet.position.set(cell.local.x, cell.shelfY + 0.1, 0)
        const carton = box(obj.bayWidth * 0.56, cartonHeight, obj.depth * 0.52, cartonMaterial)
        carton.position.set(cell.local.x, cell.shelfY + 0.14 + cartonHeight / 2, 0)
        carton.name = cell.code
        group.add(pallet, carton)
      }
    }
    if (options.showSlots) {
      const sprite = makeSprite(cell.code, 1.8, 0.55, '#06201d', 'rgba(79,195,184,0.94)')
      sprite.position.set(cell.local.x, cell.shelfY + 0.42, obj.depth / 2 + 0.08)
      group.add(sprite)
    }
  }

  const sign = makeSprite(obj.code || obj.name, 1.55, 0.62, '#06201d', 'rgba(79,195,184,0.96)')
  const stagger = Math.round(obj.position.z) % 2 === 0 ? 0.15 : 0.95
  sign.position.set(-length / 2 - 0.2, postHeight + stagger, 0)
  group.add(sign)
}

function addWall(group: THREE.Group, obj: Extract<SceneObject, { type: 'wall' }>) {
  const body = box(obj.length, obj.height, obj.thickness, mat(obj.color, 0.04, 0.9))
  body.position.y = obj.height / 2
  const skirt = box(obj.length + 0.02, 0.28, obj.thickness + 0.06, mat('#7d8796', 0.18, 0.55))
  skirt.position.y = 0.14
  const rail = box(obj.length, 0.06, obj.thickness + 0.03, mat('#cfd6e0', 0.12, 0.5))
  rail.position.y = Math.min(obj.height * 0.42, 1.65)
  const cap = box(obj.length + 0.06, 0.08, obj.thickness + 0.1, mat('#dce3ec', 0.28, 0.38))
  cap.position.y = obj.height + 0.02
  group.add(body, skirt, rail, cap)
}

function addColumn(group: THREE.Group, obj: Extract<SceneObject, { type: 'column' }>) {
  const concrete = mat(obj.color, 0.06, 0.78)
  const metal = mat('#8a93a1', 0.48, 0.36)
  const shaft = box(obj.width, obj.height, obj.depth, concrete)
  shaft.position.y = obj.height / 2
  const base = box(obj.width * 1.45, 0.14, obj.depth * 1.45, metal)
  base.position.y = 0.07
  const ring = box(obj.width * 1.18, 0.05, obj.depth * 1.18, metal)
  ring.position.y = Math.min(obj.height * 0.55, 2.4)
  const cap = box(obj.width * 1.28, 0.1, obj.depth * 1.28, metal)
  cap.position.y = obj.height
  group.add(shaft, base, ring, cap)
}

function addDoor(group: THREE.Group, obj: Extract<SceneObject, { type: 'door' }>) {
  const metal = mat('#d7dee7', 0.82, 0.22)
  const darkMetal = mat('#667181', 0.72, 0.3)
  const glassTint = obj.color === '#8d6a45' ? '#9ec9db' : obj.color
  const glass = new THREE.MeshPhysicalMaterial({
    color: glassTint,
    metalness: 0,
    roughness: 0.06,
    transmission: 0.82,
    thickness: 0.045,
    ior: 1.45,
    transparent: true,
    opacity: 1,
    envMapIntensity: 1.15,
    depthWrite: false,
  })

  const jamb = 0.09
  const trackH = 0.12
  const sillH = 0.07
  const depth = 0.18
  const openingW = Math.max(obj.width - jamb * 2, 0.8)
  const openingH = Math.max(obj.height - trackH - sillH, 1)
  const leafW = openingW * 0.54
  const leafH = openingH - 0.05
  const leafY = sillH + openingH / 2

  const recess = box(openingW, openingH, 0.03, mat('#10151c', 0.04, 0.92))
  recess.position.set(0, leafY, -0.02)
  recess.castShadow = false

  const left = box(jamb, obj.height, depth, metal)
  left.position.set(-obj.width / 2 + jamb / 2, obj.height / 2, 0)
  const right = box(jamb, obj.height, depth, metal)
  right.position.set(obj.width / 2 - jamb / 2, obj.height / 2, 0)
  const header = box(obj.width, trackH, depth + 0.04, metal)
  header.position.set(0, obj.height - trackH / 2, 0)
  const sill = box(obj.width, sillH, depth + 0.05, darkMetal)
  sill.position.set(0, sillH / 2, 0.01)
  const track = box(openingW, 0.035, 0.06, darkMetal)
  track.position.set(0, obj.height - trackH + 0.02, 0.06)
  const guide = box(openingW, 0.02, 0.05, darkMetal)
  guide.position.set(0, sillH + 0.01, 0.07)

  group.add(recess, left, right, header, sill, track, guide)
  group.add(glassLeaf(-openingW * 0.16, leafY, leafW, leafH, 0.035, glass, metal, darkMetal, 'left'))
  group.add(glassLeaf(openingW * 0.16, leafY, leafW, leafH, 0.055, glass, metal, darkMetal, 'right'))

  const title = makeSprite(obj.name, Math.max(2.6, obj.width * 0.7), 0.7, '#f8fafc', 'rgba(16,24,32,0.88)')
  title.position.set(0, obj.height + 0.55, 0)
  group.add(title)
}

function glassLeaf(
  x: number,
  y: number,
  width: number,
  height: number,
  z: number,
  glass: THREE.Material,
  metal: THREE.Material,
  handleMetal: THREE.Material,
  side: 'left' | 'right',
) {
  const leaf = new THREE.Group()
  leaf.position.set(x, y, z)
  const pane = new THREE.Mesh(new THREE.BoxGeometry(Math.max(width - 0.08, 0.2), Math.max(height - 0.08, 0.2), 0.018), glass)
  pane.castShadow = false
  pane.receiveShadow = true
  const frameW = 0.04
  const top = box(width, frameW, 0.04, metal)
  top.position.y = height / 2 - frameW / 2
  const bottom = box(width, frameW, 0.04, metal)
  bottom.position.y = -height / 2 + frameW / 2
  const left = box(frameW, height, 0.04, metal)
  left.position.x = -width / 2 + frameW / 2
  const right = box(frameW, height, 0.04, metal)
  right.position.x = width / 2 - frameW / 2
  const mullion = box(0.03, height - frameW * 2, 0.03, metal)
  const bar = box(0.03, Math.min(height * 0.42, 1.15), 0.03, handleMetal)
  bar.position.set(side === 'left' ? width / 2 - 0.08 : -width / 2 + 0.08, 0, 0.03)
  leaf.add(pane, top, bottom, left, right, mullion, bar)
  return leaf
}

function addZone(group: THREE.Group, obj: Extract<SceneObject, { type: 'zone' }>) {
  const material = new THREE.MeshStandardMaterial({
    color: obj.color,
    transparent: true,
    opacity: 0.2,
    roughness: 1,
    metalness: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(obj.length, obj.depth), material)
  plane.rotation.x = -Math.PI / 2
  plane.position.y = 0.04
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(obj.length, obj.depth)),
    new THREE.LineBasicMaterial({ color: obj.color }),
  )
  edges.rotation.x = -Math.PI / 2
  edges.position.y = 0.055
  const title = makeSprite(obj.name, Math.min(Math.max(obj.length * 0.55, 2.4), 4.6), 0.95, '#ffffff', withAlpha(obj.color, 0.92))
  title.position.y = 0.55
  group.add(plane, edges, title)
}

function addDock(group: THREE.Group, obj: Extract<SceneObject, { type: 'dock' }>) {
  const body = box(obj.length, obj.height, obj.depth, mat(obj.color, 0.08, 0.84))
  body.position.y = obj.height / 2
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(obj.length, 0.08, 0.28),
    new THREE.MeshStandardMaterial({ map: hazardTexture(obj.length), roughness: 0.55, metalness: 0.08 }),
  )
  lip.castShadow = true
  lip.position.set(0, obj.height + 0.03, obj.depth / 2 - 0.14)
  const title = makeSprite(obj.name, 2.8, 0.78, '#06201d', 'rgba(79,195,184,0.96)')
  title.position.set(0, obj.height + 0.85, 0)
  group.add(body, lip, title)
}

function addStation(group: THREE.Group, obj: Extract<SceneObject, { type: 'station' }>) {
  const top = box(obj.length, 0.07, obj.depth, mat(obj.color, 0.32, 0.36))
  top.position.y = obj.height
  const apron = box(obj.length * 0.96, 0.12, obj.depth * 0.92, mat('#2a3340', 0.35, 0.45))
  apron.position.y = obj.height - 0.1
  const legMaterial = mat('#1f2732', 0.55, 0.34)
  const insetX = Math.max(obj.length / 2 - 0.1, 0.05)
  const insetZ = Math.max(obj.depth / 2 - 0.1, 0.05)
  group.add(top, apron)
  for (const x of [-insetX, insetX]) {
    for (const z of [-insetZ, insetZ]) {
      const leg = box(0.06, obj.height - 0.08, 0.06, legMaterial)
      leg.position.set(x, (obj.height - 0.08) / 2, z)
      group.add(leg)
    }
  }
  const title = makeSprite(obj.name, 2.2, 0.66, '#f8fafc', 'rgba(16,24,32,0.88)')
  title.position.set(0, obj.height + 0.62, 0)
  group.add(title)
}

function addLabel(group: THREE.Group, obj: Extract<SceneObject, { type: 'label' }>) {
  const poleHeight = Math.max(obj.position.y, 0.3)
  const pole = box(0.035, poleHeight, 0.035, mat('#d5d8de', 0.5, 0.36))
  pole.position.y = -poleHeight / 2
  const title = makeSprite(obj.name, Math.max(1.8, obj.name.length * 0.55), 0.72, obj.color, 'rgba(16,18,24,0.9)')
  title.position.y = 0.16
  group.add(pole, title)
}

function objectTitle(obj: SceneObject) {
  if (obj.type === 'rack' || obj.type === 'zone' || obj.type === 'dock') return obj.code || obj.name
  return obj.name
}

function tag(root: THREE.Object3D, id: string) {
  root.traverse((child) => {
    child.userData.objectId = id
  })
}

function mat(color: string, metalness: number, roughness: number) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, envMapIntensity: 0.85 })
}

function box(width: number, height: number, depth: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(width, 0.02), Math.max(height, 0.02), Math.max(depth, 0.02)),
    material,
  )
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function makeSprite(text: string, width: number, height: number, color: string, background = 'rgba(12,16,24,0.78)') {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = Math.max(220, Math.round(1024 * (height / width)))
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.Sprite()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = background
  roundRect(ctx, 12, 12, canvas.width - 24, canvas.height - 24, 40)
  ctx.fill()
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let fontSize = Math.floor(canvas.height * 0.52)
  ctx.font = `700 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
  while (ctx.measureText(text).width > canvas.width * 0.86 && fontSize > 36) {
    fontSize -= 4
    ctx.font = `700 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
  }
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  material.toneMapped = false
  material.fog = false
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(width, height, 1)
  return sprite
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function withAlpha(hex: string, alpha: number) {
  const value = hex.replace('#', '')
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function trimNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function isMajor(value: number, limit: number) {
  return value < 0.001 || Math.abs(value - limit) < 0.02 || Math.abs(value / 5 - Math.round(value / 5)) < 0.02
}

function pushLine(
  positions: number[],
  colors: number[],
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  major: boolean,
) {
  positions.push(x1, y1, z1, x2, y2, z2)
  const color = major ? [0.42, 0.72, 0.7] : [0.42, 0.5, 0.58]
  colors.push(...color, ...color)
}
