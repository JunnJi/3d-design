import { SCENE_FORMAT, SCENE_VERSION, createDefault, uid } from './catalog'
import type {
  FloorSpec,
  ObjectType,
  Persisted,
  Projection,
  SceneMeta,
  SceneObject,
  Vec3,
  Viewpoint,
} from './types'

const OBJECT_TYPES: ObjectType[] = ['rack', 'wall', 'column', 'door', 'zone', 'dock', 'station', 'label']

export function parsePersisted(input: unknown): Persisted {
  if (!isRecord(input)) throw new Error('文件不是有效的 JSON 对象')
  if (input.format !== SCENE_FORMAT) throw new Error('这不是库房场景文件')
  if (input.version !== SCENE_VERSION) throw new Error('场景文件版本不支持')
  if (!Array.isArray(input.objects)) throw new Error('场景缺少物体列表')

  const metaIn = isRecord(input.meta) ? input.meta : {}
  const floorIn = isRecord(input.floor) ? input.floor : {}
  const meta: SceneMeta = {
    name: text(metaIn.name, '未命名库房'),
    site: typeof metaIn.site === 'string' ? metaIn.site : '',
    remark: typeof metaIn.remark === 'string' ? metaIn.remark : '',
  }
  const floor: FloorSpec = {
    width: num(floorIn.width, 24, 4, 200),
    depth: num(floorIn.depth, 16, 4, 200),
    clearHeight: num(floorIn.clearHeight, 6, 2, 40),
    color: hexColor(floorIn.color, '#5c6370'),
  }

  const seen = new Set<string>()
  const objects = input.objects.map((item) => {
    const obj = normalizeObject(item)
    if (!obj) throw new Error('场景里有无法识别的物体')
    if (seen.has(obj.id)) obj.id = uid(obj.type)
    seen.add(obj.id)
    return obj
  })

  const viewpoints = Array.isArray(input.viewpoints)
    ? input.viewpoints.flatMap((item) => {
        const view = normalizeViewpoint(item)
        return view ? [view] : []
      })
    : []

  return {
    meta,
    floor,
    gridSize: num(input.gridSize, 0.5, 0.1, 5),
    snap: input.snap !== false,
    confine: input.confine !== false,
    objects,
    viewpoints,
  }
}

function normalizeObject(input: unknown): SceneObject | null {
  if (!isRecord(input) || !isObjectType(input.type)) return null
  const id = text(input.id, uid(input.type))
  const rotationY = angle(input.rotationY)

  switch (input.type) {
    case 'rack': {
      const base = createDefault('rack')
      return {
        ...base,
        id,
        name: text(input.name, base.name),
        position: vec(input.position, base.position),
        rotationY,
        code: text(input.code, base.code),
        bays: int(input.bays, base.bays, 1, 40),
        levels: int(input.levels, base.levels, 1, 16),
        bayWidth: num(input.bayWidth, base.bayWidth, 0.2, 20),
        depth: num(input.depth, base.depth, 0.2, 20),
        levelHeight: num(input.levelHeight, base.levelHeight, 0.15, 8),
        frameColor: hexColor(input.frameColor, base.frameColor),
        beamColor: hexColor(input.beamColor, base.beamColor),
        shelfColor: hexColor(input.shelfColor, base.shelfColor),
      }
    }
    case 'wall': {
      const base = createDefault('wall')
      return {
        ...base,
        id,
        name: text(input.name, base.name),
        position: vec(input.position, base.position),
        rotationY,
        length: num(input.length, base.length, 0.2, 200),
        height: num(input.height, base.height, 0.4, 30),
        thickness: num(input.thickness, base.thickness, 0.05, 2),
        color: hexColor(input.color, base.color),
      }
    }
    case 'column': {
      const base = createDefault('column')
      return {
        ...base,
        id,
        name: text(input.name, base.name),
        position: vec(input.position, base.position),
        rotationY,
        width: num(input.width, base.width, 0.1, 4),
        depth: num(input.depth, base.depth, 0.1, 4),
        height: num(input.height, base.height, 0.4, 30),
        color: hexColor(input.color, base.color),
      }
    }
    case 'door': {
      const base = createDefault('door')
      return {
        ...base,
        id,
        name: text(input.name, base.name),
        position: vec(input.position, base.position),
        rotationY,
        width: num(input.width, base.width, 0.6, 12),
        height: num(input.height, base.height, 1, 8),
        color: hexColor(input.color, base.color),
      }
    }
    case 'zone': {
      const base = createDefault('zone')
      return {
        ...base,
        id,
        name: text(input.name, base.name),
        position: vec(input.position, base.position),
        rotationY,
        code: text(input.code, base.code),
        length: num(input.length, base.length, 0.5, 200),
        depth: num(input.depth, base.depth, 0.5, 200),
        color: hexColor(input.color, base.color),
      }
    }
    case 'dock': {
      const base = createDefault('dock')
      return {
        ...base,
        id,
        name: text(input.name, base.name),
        position: vec(input.position, base.position),
        rotationY,
        code: text(input.code, base.code),
        length: num(input.length, base.length, 0.5, 40),
        depth: num(input.depth, base.depth, 0.5, 20),
        height: num(input.height, base.height, 0.2, 3),
        color: hexColor(input.color, base.color),
      }
    }
    case 'station': {
      const base = createDefault('station')
      return {
        ...base,
        id,
        name: text(input.name, base.name),
        position: vec(input.position, base.position),
        rotationY,
        length: num(input.length, base.length, 0.4, 8),
        depth: num(input.depth, base.depth, 0.3, 4),
        height: num(input.height, base.height, 0.4, 2),
        color: hexColor(input.color, base.color),
      }
    }
    case 'label': {
      const base = createDefault('label')
      return {
        ...base,
        id,
        name: text(input.name, base.name),
        position: vec(input.position, base.position),
        rotationY,
        color: hexColor(input.color, base.color),
      }
    }
  }
}

function normalizeViewpoint(input: unknown): Viewpoint | null {
  if (!isRecord(input)) return null
  const projection: Projection = input.projection === 'top' ? 'top' : 'perspective'
  return {
    id: text(input.id, uid('view')),
    name: text(input.name, '视角'),
    projection,
    position: vec(input.position, { x: 0, y: 20, z: 0 }),
    target: vec(input.target, { x: 0, y: 0, z: 0 }),
  }
}

function isObjectType(value: unknown): value is ObjectType {
  return typeof value === 'string' && OBJECT_TYPES.includes(value as ObjectType)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown, fallback: number, min: number, max: number) {
  const next = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.min(max, Math.max(min, next))
}

function int(value: unknown, fallback: number, min: number, max: number) {
  return Math.round(num(value, fallback, min, max))
}

function text(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function angle(value: unknown) {
  const next = num(value, 0, -3600, 3600)
  return ((next % 360) + 360) % 360
}

function vec(value: unknown, fallback: Vec3): Vec3 {
  if (!isRecord(value)) return { ...fallback }
  return {
    x: num(value.x, fallback.x, -500, 500),
    y: num(value.y, fallback.y, -5, 80),
    z: num(value.z, fallback.z, -500, 500),
  }
}

function hexColor(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
}
