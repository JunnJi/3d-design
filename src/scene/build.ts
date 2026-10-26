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
    new THREE.MeshStandardMaterial({ color: '#2c3340', roughness: 0.94, metalness: 0.04 }),
  )
  plinth.position.y = -0.16
  plinth.receiveShadow = true
  group.add(plinth, slab, ...floorBoundary(floor))
  return group
}

function floorBoundary(floor: FloorSpec) {
  const paint = new THREE.MeshStandardMaterial({
    color: '#f0b429',
    roughness: 0.5,
    metalness: 0.06,
    emissive: new THREE.Color('#f0b429'),
    emissiveIntensity: 0.35,
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
    new THREE.MeshStandardMaterial({ color: '#242b38', roughness: 1, metalness: 0 }),
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
  const widthLabel = makeSprite(`${trimNumber(floor.width)} m`, 3.2, 0.9, '#1a1408', 'rgba(240,180,41,0.94)')
  widthLabel.position.set(0, 0.4, floor.depth / 2 + 1.2)
  const depthLabel = makeSprite(`${trimNumber(floor.depth)} m`, 3.2, 0.9, '#1a1408', 'rgba(240,180,41,0.94)')
  depthLabel.position.set(-floor.width / 2 - 1.7, 0.4, 0)
  const origin = makeSprite('原点', 1.8, 0.7, '#1a1408', 'rgba(240,180,41,0.94)')
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
  const post = 0.08
  const frame = mat(obj.frameColor, 0.55, 0.38)
  const beam = mat(obj.beamColor, 0.42, 0.4)
  const shelf = mat(obj.shelfColor, 0.06, 0.74)
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
      const sprite = makeSprite(cell.code, 1.8, 0.55, '#1a1408', 'rgba(240,180,41,0.94)')
      sprite.position.set(cell.local.x, cell.shelfY + 0.42, obj.depth / 2 + 0.08)
      group.add(sprite)
    }
  }

  const sign = makeSprite(obj.code || obj.name, 1.55, 0.62, '#1a1408', 'rgba(240,180,41,0.96)')
  const stagger = Math.round(obj.position.z) % 2 === 0 ? 0.15 : 0.95
  sign.position.set(-length / 2 - 0.2, postHeight + stagger, 0)
  group.add(sign)
}

function addWall(group: THREE.Group, obj: Extract<SceneObject, { type: 'wall' }>) {
  const body = box(obj.length, obj.height, obj.thickness, mat(obj.color, 0.05, 0.86))
  body.position.y = obj.height / 2
  const skirt = box(obj.length, 0.18, obj.thickness + 0.04, mat('#8e97a6', 0.16, 0.62))
  skirt.position.y = 0.09
  const cap = box(obj.length + 0.04, 0.07, obj.thickness + 0.08, mat(obj.color, 0.22, 0.42))
  cap.position.y = obj.height + 0.02
  group.add(body, skirt, cap)
}

function addColumn(group: THREE.Group, obj: Extract<SceneObject, { type: 'column' }>) {
  const concrete = mat(obj.color, 0.08, 0.8)
  const metal = mat('#6d7380', 0.35, 0.45)
  const shaft = box(obj.width, obj.height, obj.depth, concrete)
  shaft.position.y = obj.height / 2
  const base = box(obj.width * 1.4, 0.12, obj.depth * 1.4, metal)
  base.position.y = 0.06
  const cap = box(obj.width * 1.25, 0.1, obj.depth * 1.25, metal)
  cap.position.y = obj.height
  group.add(shaft, base, cap)
}

function addDoor(group: THREE.Group, obj: Extract<SceneObject, { type: 'door' }>) {
  const frame = mat('#d5dbe3', 0.55, 0.32)
  const leaf = mat(obj.color, 0.18, 0.58)
  const opening = mat('#15181e', 0.05, 0.9)
  const jamb = 0.1
  const span = Math.max(obj.width - jamb * 2, 0.4)
  const openingMesh = box(span, Math.max(obj.height - jamb, 0.4), 0.04, opening)
  openingMesh.position.y = (obj.height - jamb) / 2
  const left = box(jamb, obj.height, 0.16, frame)
  left.position.set(-obj.width / 2 + jamb / 2, obj.height / 2, 0)
  const right = box(jamb, obj.height, 0.16, frame)
  right.position.set(obj.width / 2 - jamb / 2, obj.height / 2, 0)
  const header = box(obj.width, jamb, 0.16, frame)
  header.position.set(0, obj.height - jamb / 2, 0)
  const doorLeaf = box(span * 0.48, Math.max(obj.height - jamb * 1.6, 0.4), 0.05, leaf)
  doorLeaf.position.set(-obj.width * 0.12, (obj.height - jamb) / 2, 0.04)
  const title = makeSprite(obj.name, 2.4, 0.72, '#f8fafc')
  title.position.set(0, obj.height + 0.55, 0)
  group.add(openingMesh, left, right, header, doorLeaf, title)
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
  const title = makeSprite(obj.name, 2.8, 0.78, '#1a1404', 'rgba(245,196,0,0.96)')
  title.position.set(0, obj.height + 0.85, 0)
  group.add(body, lip, title)
}

function addStation(group: THREE.Group, obj: Extract<SceneObject, { type: 'station' }>) {
  const top = box(obj.length, 0.08, obj.depth, mat(obj.color, 0.25, 0.42))
  top.position.y = obj.height
  const legMaterial = mat('#232833', 0.4, 0.42)
  const insetX = Math.max(obj.length / 2 - 0.08, 0.05)
  const insetZ = Math.max(obj.depth / 2 - 0.08, 0.05)
  group.add(top)
  for (const x of [-insetX, insetX]) {
    for (const z of [-insetZ, insetZ]) {
      const leg = box(0.07, obj.height, 0.07, legMaterial)
      leg.position.set(x, obj.height / 2, z)
      group.add(leg)
    }
  }
  const title = makeSprite(obj.name, 2.2, 0.66, '#f8fafc')
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
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, envMapIntensity: 0.65 })
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
  const color = major ? [0.78, 0.58, 0.28] : [0.55, 0.6, 0.68]
  colors.push(...color, ...color)
}
