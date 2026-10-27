export type ObjectType =
  | 'rack'
  | 'wall'
  | 'column'
  | 'door'
  | 'zone'
  | 'dock'
  | 'station'
  | 'label'

export type ToolId = 'select' | ObjectType
export type Projection = 'perspective' | 'top'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface SceneMeta {
  name: string
  site: string
  remark: string
}

export interface FloorSpec {
  width: number
  depth: number
  clearHeight: number
  color: string
}

export interface Viewpoint {
  id: string
  name: string
  projection: Projection
  position: Vec3
  target: Vec3
}

interface BaseObject {
  id: string
  name: string
  position: Vec3
  rotationY: number
}

export interface RackObject extends BaseObject {
  type: 'rack'
  code: string
  bayWidth: number
  depth: number
  levelHeight: number
  bays: number
  levels: number
  frameColor: string
  beamColor: string
  shelfColor: string
}

export interface WallObject extends BaseObject {
  type: 'wall'
  length: number
  height: number
  thickness: number
  color: string
}

export interface ColumnObject extends BaseObject {
  type: 'column'
  width: number
  depth: number
  height: number
  color: string
}

export interface DoorObject extends BaseObject {
  type: 'door'
  width: number
  height: number
  color: string
}

export interface ZoneObject extends BaseObject {
  type: 'zone'
  code: string
  length: number
  depth: number
  color: string
}

export interface DockObject extends BaseObject {
  type: 'dock'
  code: string
  length: number
  depth: number
  height: number
  color: string
}

export interface StationObject extends BaseObject {
  type: 'station'
  length: number
  depth: number
  height: number
  color: string
}

export interface LabelObject extends BaseObject {
  type: 'label'
  color: string
}

export type SceneObject =
  | RackObject
  | WallObject
  | ColumnObject
  | DoorObject
  | ZoneObject
  | DockObject
  | StationObject
  | LabelObject

export interface Persisted {
  meta: SceneMeta
  floor: FloorSpec
  gridSize: number
  snap: boolean
  confine: boolean
  objects: SceneObject[]
  viewpoints: Viewpoint[]
}

export interface SlotRecord {
  code: string
  rackId: string
  rackCode: string
  rackName: string
  bay: number
  level: number
  position: Vec3
  size: { length: number; depth: number; height: number }
}

export interface SceneStats {
  racks: number
  slots: number
  zones: number
  walls: number
  doors: number
  docks: number
}

export interface WarehouseFile extends Persisted {
  format: 'warehouse-scene'
  version: 1
  unit: 'm'
  origin: 'corner'
  generator: 'warehouse-designer'
  exportedAt: string
  slots: SlotRecord[]
  stats: SceneStats
}

export interface ObjectPatch {
  name?: string
  rotationY?: number
  position?: Partial<Vec3>
  code?: string
  color?: string
  length?: number
  depth?: number
  height?: number
  thickness?: number
  width?: number
  bayWidth?: number
  levelHeight?: number
  bays?: number
  levels?: number
  frameColor?: string
  beamColor?: string
  shelfColor?: string
}
