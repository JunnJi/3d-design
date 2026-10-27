import { cloneData } from './geometry'
import type {
  ColumnObject,
  DockObject,
  DoorObject,
  LabelObject,
  ObjectType,
  Persisted,
  RackObject,
  SceneObject,
  StationObject,
  ToolId,
  WallObject,
  ZoneObject,
} from './types'

export const SCENE_FORMAT = 'warehouse-scene'
export const SCENE_VERSION = 1

export const TYPE_LABEL: Record<ObjectType, string> = {
  rack: '货架',
  wall: '墙体',
  column: '立柱',
  door: '库门',
  zone: '库区',
  dock: '月台',
  station: '作业台',
  label: '标注',
}

export const OBJECT_ORDER: ObjectType[] = [
  'zone',
  'rack',
  'wall',
  'door',
  'column',
  'dock',
  'station',
  'label',
]

export const TOOLS: { id: ToolId; label: string; shortcut: string; hint: string }[] = [
  { id: 'select', label: '选择', shortcut: 'V', hint: '点击选择，拖动移动，右键平移' },
  { id: 'rack', label: '货架', shortcut: '1', hint: '点击地面连续放置，R 旋转' },
  { id: 'wall', label: '墙体', shortcut: '2', hint: '点击地面放置墙段' },
  { id: 'column', label: '立柱', shortcut: '3', hint: '点击地面放置立柱' },
  { id: 'door', label: '库门', shortcut: '4', hint: '点击地面放置库门' },
  { id: 'zone', label: '库区', shortcut: '5', hint: '点击地面划分库区' },
  { id: 'dock', label: '月台', shortcut: '6', hint: '点击地面放置月台' },
  { id: 'station', label: '作业台', shortcut: '7', hint: '点击地面放置作业台' },
  { id: 'label', label: '标注', shortcut: '8', hint: '点击地面放置文字' },
]

export const ZONE_COLORS = ['#2563eb', '#0f9f6e', '#ea8a1a', '#7c5cbf', '#e11d48', '#0891b2']

export const PREVIEW_LEGEND = [
  { label: '空位', color: '#6b7280' },
  { label: '低库存', color: '#7eb6ff' },
  { label: '半仓', color: '#f0b429' },
  { label: '满仓', color: '#3cba8b' },
  { label: '锁定', color: '#e85d4c' },
] as const

export const RACK_PRESETS = {
  light: {
    bayWidth: 1.2,
    depth: 0.5,
    levelHeight: 0.45,
    bays: 4,
    levels: 5,
    frameColor: '#2f6f4e',
    beamColor: '#d5dbe3',
    shelfColor: '#e7ebf0',
  },
  medium: {
    bayWidth: 2.2,
    depth: 1,
    levelHeight: 1.4,
    bays: 2,
    levels: 3,
    frameColor: '#1f4e89',
    beamColor: '#e08a2c',
    shelfColor: '#d5d8de',
  },
  heavy: {
    bayWidth: 2.7,
    depth: 1.1,
    levelHeight: 1.6,
    bays: 2,
    levels: 4,
    frameColor: '#1c3f73',
    beamColor: '#ef8b2c',
    shelfColor: '#cfd4dc',
  },
} satisfies Record<string, Omit<RackObject, 'id' | 'type' | 'name' | 'code' | 'position' | 'rotationY'>>

export type RackPresetId = keyof typeof RACK_PRESETS

let sequence = 0

export function uid(prefix: string) {
  sequence += 1
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`
}

export function previewStatus(code: string) {
  let hash = 2166136261
  for (let index = 0; index < code.length; index += 1) {
    hash ^= code.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const rank = (hash >>> 0) % PREVIEW_LEGEND.length
  return { rank, ...PREVIEW_LEGEND[rank]! }
}

export function createDefault(type: 'rack'): RackObject
export function createDefault(type: 'wall'): WallObject
export function createDefault(type: 'column'): ColumnObject
export function createDefault(type: 'door'): DoorObject
export function createDefault(type: 'zone'): ZoneObject
export function createDefault(type: 'dock'): DockObject
export function createDefault(type: 'station'): StationObject
export function createDefault(type: 'label'): LabelObject
export function createDefault(type: ObjectType): SceneObject
export function createDefault(type: ObjectType): SceneObject {
  const base = { id: uid(type), name: TYPE_LABEL[type], position: { x: 0, y: 0, z: 0 }, rotationY: 0 }
  switch (type) {
    case 'rack':
      return { ...base, type, code: 'A-01', ...cloneData(RACK_PRESETS.medium) }
    case 'wall':
      return { ...base, type, length: 6, height: 4.2, thickness: 0.24, color: '#eef2f7' }
    case 'column':
      return { ...base, type, width: 0.45, depth: 0.45, height: 5.2, color: '#a8b1bd' }
    case 'door':
      return { ...base, type, width: 3.6, height: 3.2, color: '#9ec9db' }
    case 'zone':
      return { ...base, type, code: 'A', length: 8, depth: 6, color: ZONE_COLORS[0] }
    case 'dock':
      return { ...base, type, code: 'DK-01', length: 6, depth: 2.4, height: 1.15, color: '#6b7280' }
    case 'station':
      return { ...base, type, length: 1.8, depth: 0.8, height: 0.9, color: '#4b5568' }
    case 'label':
      return { ...base, type, name: '标注', position: { x: 0, y: 2.2, z: 0 }, color: '#f0a202' }
  }
}

export function createEmpty(): Persisted {
  return {
    meta: { name: '未命名库房', site: '', remark: '' },
    floor: { width: 24, depth: 16, clearHeight: 6, color: '#5c6370' },
    gridSize: 0.5,
    snap: true,
    confine: true,
    objects: [],
    viewpoints: [],
  }
}

export function createDemo(): Persisted {
  const width = 32
  const depth = 18
  const wallT = 0.24
  const objects: SceneObject[] = []

  const add = <T extends SceneObject>(type: T['type'], patch: Partial<T> & Pick<T, 'name' | 'position'>) => {
    objects.push(Object.assign(createDefault(type), patch) as T)
  }

  const doorW = 4.2
  const doorX = width / 2
  const northLeftLen = doorX - doorW / 2
  const northRightLen = width - (doorX + doorW / 2)
  add('wall', {
    name: '南墙',
    position: { x: 16, y: 0, z: wallT / 2 },
    length: width,
    height: 4.4,
    thickness: wallT,
    color: '#eef2f7',
  })
  add('wall', {
    name: '北墙-左',
    position: { x: northLeftLen / 2, y: 0, z: depth - wallT / 2 },
    length: northLeftLen,
    height: 4.4,
    thickness: wallT,
    color: '#eef2f7',
  })
  add('wall', {
    name: '北墙-右',
    position: { x: doorX + doorW / 2 + northRightLen / 2, y: 0, z: depth - wallT / 2 },
    length: northRightLen,
    height: 4.4,
    thickness: wallT,
    color: '#eef2f7',
  })
  add('wall', {
    name: '西墙',
    position: { x: wallT / 2, y: 0, z: 9 },
    rotationY: 90,
    length: depth,
    height: 4.4,
    thickness: wallT,
    color: '#eef2f7',
  })
  add('wall', {
    name: '东墙-南',
    position: { x: width - wallT / 2, y: 0, z: 2.5 },
    rotationY: 90,
    length: 5,
    height: 4.4,
    thickness: wallT,
    color: '#eef2f7',
  })
  add('wall', {
    name: '东墙-北',
    position: { x: width - wallT / 2, y: 0, z: 15.5 },
    rotationY: 90,
    length: 5,
    height: 4.4,
    thickness: wallT,
    color: '#eef2f7',
  })
  add('door', {
    name: '正门玻璃移门',
    position: { x: doorX, y: 0, z: depth - wallT / 2 },
    width: doorW,
    height: 3.4,
    color: '#9ec9db',
  })

  add('zone', {
    name: '存储区',
    code: 'A',
    position: { x: 9, y: 0, z: 8.4 },
    length: 16,
    depth: 12.4,
    color: '#3b82f6',
  })
  add('zone', {
    name: '发货区',
    code: 'S',
    position: { x: 23.5, y: 0, z: 8.4 },
    length: 10,
    depth: 12.4,
    color: '#f59e0b',
  })
  add('zone', {
    name: '收货暂存',
    code: 'R',
    position: { x: doorX, y: 0, z: depth - 2.1 },
    length: 5.2,
    depth: 2.2,
    color: '#8b7cc9',
  })

  const rackX = [3.5, 8.1, 12.7]
  const rackZ = [3.8, 4.8, 8.2, 9.2, 12.6, 13.6]
  let index = 1
  for (const z of rackZ) {
    for (const x of rackX) {
      const code = `A-${String(index).padStart(2, '0')}`
      add('rack', { name: `货架 ${code}`, code, position: { x, y: 0, z } })
      index += 1
    }
  }

  for (const z of [5, 9, 13]) {
    add('column', { name: `立柱 ${z}`, position: { x: 17.8, y: 0, z }, width: 0.4, depth: 0.4, height: 5.4 })
  }

  add('station', { name: '打包台 1', position: { x: 22, y: 0, z: 4.6 } })
  add('station', { name: '打包台 2', position: { x: 22, y: 0, z: 8 } })
  add('station', { name: '复核台', position: { x: 25.6, y: 0, z: 12.4 }, length: 1.6, depth: 0.7 })
  add('dock', {
    name: '1号月台',
    code: 'DK-01',
    position: { x: 30.68, y: 0, z: 9 },
    rotationY: 90,
    length: 8,
    depth: 2.4,
    height: 1.15,
  })
  add('label', { name: '正门入口', position: { x: doorX, y: 2.8, z: depth - 1.15 }, color: '#4fc3b8' })
  add('label', { name: '发货月台', position: { x: 27.2, y: 2.6, z: 9 }, color: '#f8fafc' })

  return {
    meta: {
      name: '示例成品库',
      site: '一号园区',
      remark: '按实际场地改尺寸和货架后导出，供 3D 库房看板加载。',
    },
    floor: { width, depth, clearHeight: 6, color: '#6b7584' },
    gridSize: 0.5,
    snap: true,
    confine: true,
    objects,
    viewpoints: [
      {
        id: uid('view'),
        name: '总览',
        projection: 'perspective',
        position: { x: 16, y: 13.5, z: 31 },
        target: { x: 16, y: 1.3, z: 12 },
      },
      {
        id: uid('view'),
        name: '平面',
        projection: 'top',
        position: { x: 16, y: 50, z: 9 },
        target: { x: 16, y: 0, z: 9 },
      },
    ],
  }
}

export function objectCode(obj: SceneObject) {
  if (obj.type === 'rack' || obj.type === 'zone' || obj.type === 'dock') return obj.code
  return ''
}
