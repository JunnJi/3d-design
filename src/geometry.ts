import type { FloorSpec, RackObject, SceneObject, SlotRecord, Vec3 } from './types'

export function round3(value: number) {
  return Math.round(value * 1000) / 1000
}

export function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function cornerToThree(position: Vec3, floor: FloorSpec): Vec3 {
  return {
    x: position.x - floor.width / 2,
    y: position.y,
    z: position.z - floor.depth / 2,
  }
}

export function threeToCorner(position: Vec3, floor: FloorSpec): Vec3 {
  return {
    x: position.x + floor.width / 2,
    y: position.y,
    z: position.z + floor.depth / 2,
  }
}

/** Three.js Y-up rotation: local +X turns toward -Z when the angle increases. */
export function localToCorner(origin: Vec3, rotationY: number, local: Vec3): Vec3 {
  const rad = (rotationY * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: origin.x + local.x * cos + local.z * sin,
    y: origin.y + local.y,
    z: origin.z - local.x * sin + local.z * cos,
  }
}

export function snapTo(value: number, grid: number, enabled: boolean) {
  if (!enabled || grid <= 0) return round3(value)
  return round3(Math.round(value / grid) * grid)
}

export function footprint(obj: SceneObject) {
  switch (obj.type) {
    case 'rack':
      return { length: obj.bays * obj.bayWidth, depth: obj.depth }
    case 'wall':
      return { length: obj.length, depth: obj.thickness }
    case 'column':
      return { length: obj.width, depth: obj.depth }
    case 'door':
      return { length: obj.width, depth: 0.2 }
    case 'zone':
      return { length: obj.length, depth: obj.depth }
    case 'dock':
      return { length: obj.length, depth: obj.depth }
    case 'station':
      return { length: obj.length, depth: obj.depth }
    case 'label':
      return { length: 0.4, depth: 0.4 }
  }
}

export function halfExtents(obj: SceneObject) {
  const { length, depth } = footprint(obj)
  const hx = length / 2
  const hz = depth / 2
  const rad = (obj.rotationY * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  return { ex: hx * cos + hz * sin, ez: hx * sin + hz * cos }
}

export function clampToFloor(obj: SceneObject, floor: FloorSpec) {
  const { ex, ez } = halfExtents(obj)
  obj.position.x = clampAxis(obj.position.x, ex, floor.width)
  obj.position.z = clampAxis(obj.position.z, ez, floor.depth)
}

function clampAxis(value: number, half: number, size: number) {
  if (half * 2 >= size) return round3(size / 2)
  return round3(Math.min(size - half, Math.max(half, value)))
}

export function rackFrameHeight(rack: RackObject) {
  return rack.levels * rack.levelHeight
}

export interface RackCell {
  code: string
  bay: number
  level: number
  shelfY: number
  local: Vec3
}

export function rackCells(rack: RackObject): RackCell[] {
  const length = rack.bays * rack.bayWidth
  const cells: RackCell[] = []
  for (let level = 0; level < rack.levels; level += 1) {
    const shelfY = (level + 1) * rack.levelHeight
    for (let bay = 0; bay < rack.bays; bay += 1) {
      cells.push({
        code: `${rack.code}-${pad(bay + 1)}-${pad(level + 1)}`,
        bay: bay + 1,
        level: level + 1,
        shelfY,
        local: {
          x: -length / 2 + (bay + 0.5) * rack.bayWidth,
          y: shelfY + Math.min(rack.levelHeight * 0.25, 0.45),
          z: 0,
        },
      })
    }
  }
  return cells
}

export function collectSlots(objects: SceneObject[]): SlotRecord[] {
  const slots: SlotRecord[] = []
  for (const obj of objects) {
    if (obj.type !== 'rack') continue
    for (const cell of rackCells(obj)) {
      slots.push({
        code: cell.code,
        rackId: obj.id,
        rackCode: obj.code,
        rackName: obj.name,
        bay: cell.bay,
        level: cell.level,
        position: localToCorner(obj.position, obj.rotationY, cell.local),
        size: { length: obj.bayWidth, depth: obj.depth, height: obj.levelHeight },
      })
    }
  }
  return slots
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}
