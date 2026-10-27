import { reactive, ref } from 'vue'
import {
  OBJECT_ORDER,
  RACK_PRESETS,
  SCENE_FORMAT,
  SCENE_VERSION,
  TYPE_LABEL,
  createDefault,
  createDemo,
  createEmpty,
  objectCode,
  uid,
  type RackPresetId,
} from './catalog'
import { parsePersisted } from './document'
import { clampToFloor, cloneData } from './geometry'
import type { ObjectPatch, ObjectType, Persisted, SceneObject, ToolId, Viewpoint } from './types'

const STORAGE_KEY = 'warehouse-designer-v1'

export const structureTick = ref(0)
export const transformTick = ref(0)

export const history = reactive({
  past: [] as string[],
  future: [] as string[],
})

export const ui = reactive({
  tool: 'select' as ToolId,
  selectedId: null as string | null,
  projection: 'perspective' as 'perspective' | 'top',
  placeRotation: 0,
  showGrid: true,
  showSlotCodes: true,
  preview: false,
  panel: 'props' as 'props' | 'outline' | 'views',
  toast: '',
  help: false,
  examples: false,
  confirm: null as null | 'new' | 'demo' | 'clear',
  pointer: { x: 0, z: 0, valid: false },
  fitToken: 0,
  cameraToken: 0,
  cameraRequest: null as Viewpoint | null,
})

export const doc = reactive<Persisted>(loadInitial())

const brushes = new Map<ObjectType, SceneObject>()
let editDepth = 0
let persistTimer = 0
let toastTimer = 0

export function toast(message: string) {
  ui.toast = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    if (ui.toast === message) ui.toast = ''
  }, 2400)
}

export function checkpoint() {
  history.past.push(snapshot())
  if (history.past.length > 80) history.past.shift()
  history.future.splice(0, history.future.length)
}

export function beginEdit() {
  if (editDepth === 0) checkpoint()
  editDepth += 1
}

export function endEdit() {
  editDepth = Math.max(0, editDepth - 1)
  if (editDepth === 0) dropCheckpointIfUnchanged()
}

export function dropCheckpointIfUnchanged() {
  if (history.past.at(-1) === snapshot()) history.past.pop()
}

export function undo() {
  const prev = history.past.pop()
  if (!prev) return
  history.future.push(snapshot())
  restore(prev)
}

export function redo() {
  const next = history.future.pop()
  if (!next) return
  history.past.push(snapshot())
  restore(next)
}

export function selectObject(id: string | null, showProps = false) {
  ui.selectedId = id
  if (showProps && id) ui.panel = 'props'
  const obj = id ? doc.objects.find((item) => item.id === id) : undefined
  if (obj) ui.placeRotation = obj.rotationY
}

export function placeObject(type: ObjectType, x: number, z: number) {
  const source = cloneData(brushes.get(type) ?? createDefault(type))
  source.id = uid(type)
  source.name = uniqueName(type)
  source.rotationY = ui.placeRotation
  source.position = { x, y: source.position.y, z }
  if (source.type === 'rack' || source.type === 'zone' || source.type === 'dock') {
    source.code = uniqueCode(source.code)
  }
  if (doc.confine) clampToFloor(source, doc.floor)
  checkpoint()
  doc.objects.push(source)
  rememberBrush(source)
  selectObject(source.id, true)
  bump('structure')
}

export function patchObject(id: string, patch: ObjectPatch, kind: 'structure' | 'transform') {
  const obj = doc.objects.find((item) => item.id === id)
  if (!obj) return
  if (patch.position) {
    if (patch.position.x != null) obj.position.x = patch.position.x
    if (patch.position.y != null) obj.position.y = patch.position.y
    if (patch.position.z != null) obj.position.z = patch.position.z
  }
  if (patch.name != null) obj.name = patch.name
  if (patch.rotationY != null) obj.rotationY = normalizeAngle(patch.rotationY)
  applyFields(obj, patch)
  if (doc.confine) clampToFloor(obj, doc.floor)
  rememberBrush(obj)
  bump(kind)
}

export function patchFloor(patch: Partial<Persisted['floor']>) {
  if (patch.width != null) doc.floor.width = clamp(patch.width, 4, 200)
  if (patch.depth != null) doc.floor.depth = clamp(patch.depth, 4, 200)
  if (patch.clearHeight != null) doc.floor.clearHeight = clamp(patch.clearHeight, 2, 40)
  if (patch.color != null) doc.floor.color = patch.color
  if (doc.confine) {
    for (const obj of doc.objects) clampToFloor(obj, doc.floor)
  }
  bump('structure')
}

export function patchMeta(patch: Partial<Persisted['meta']>) {
  Object.assign(doc.meta, patch)
  persist()
}

export function setGridSize(size: number) {
  checkpoint()
  doc.gridSize = clamp(size, 0.1, 5)
  bump('structure')
}

export function commitTransform() {
  bump('transform')
}

export function setSnap(enabled: boolean) {
  checkpoint()
  doc.snap = enabled
  persist()
}

export function setConfine(enabled: boolean) {
  checkpoint()
  doc.confine = enabled
  if (enabled) {
    for (const obj of doc.objects) clampToFloor(obj, doc.floor)
    bump('transform')
    return
  }
  persist()
}

export function applyRackPreset(id: string, preset: RackPresetId) {
  const obj = doc.objects.find((item) => item.id === id)
  if (!obj || obj.type !== 'rack') return
  checkpoint()
  Object.assign(obj, cloneData(RACK_PRESETS[preset]))
  rememberBrush(obj)
  bump('structure')
}

export function rotateBy(id: string, delta: number) {
  const obj = doc.objects.find((item) => item.id === id)
  if (!obj) return
  checkpoint()
  obj.rotationY = normalizeAngle(obj.rotationY + delta)
  ui.placeRotation = obj.rotationY
  if (doc.confine) clampToFloor(obj, doc.floor)
  rememberBrush(obj)
  bump('transform')
}

export function duplicateSelected() {
  const obj = selected()
  if (!obj) return
  const copy = cloneData(obj)
  copy.id = uid(obj.type)
  copy.position = { ...copy.position, x: copy.position.x + Math.max(doc.gridSize, 0.5) }
  copy.name = uniqueName(obj.type)
  if (copy.type === 'rack' || copy.type === 'zone' || copy.type === 'dock') copy.code = uniqueCode(copy.code)
  if (doc.confine) clampToFloor(copy, doc.floor)
  checkpoint()
  doc.objects.push(copy)
  rememberBrush(copy)
  selectObject(copy.id, true)
  bump('structure')
}

export function removeObject(id: string) {
  const index = doc.objects.findIndex((item) => item.id === id)
  if (index < 0) return
  checkpoint()
  doc.objects.splice(index, 1)
  if (ui.selectedId === id) ui.selectedId = null
  bump('structure')
}

export function addViewpoint(view: Viewpoint) {
  checkpoint()
  doc.viewpoints.push(view)
  persist()
}

export function removeViewpoint(id: string) {
  checkpoint()
  doc.viewpoints = doc.viewpoints.filter((item) => item.id !== id)
  persist()
}

export function showViewpoint(view: Viewpoint) {
  ui.cameraRequest = cloneData(view)
  ui.projection = view.projection
  ui.cameraToken += 1
}

export function requestFit() {
  ui.fitToken += 1
}

export function askConfirm(action: 'new' | 'demo' | 'clear') {
  ui.confirm = action
}

export function applyConfirm() {
  const action = ui.confirm
  ui.confirm = null
  if (action === 'new') replaceDocument(createEmpty())
  if (action === 'demo') replaceDocument(createDemo())
  if (action === 'clear') {
    checkpoint()
    doc.objects = []
    ui.selectedId = null
    bump('structure')
  }
}

export function replaceDocument(next: Persisted) {
  checkpoint()
  assignDocument(next)
  ui.selectedId = null
  ui.placeRotation = 0
  bump('structure')
  requestFit()
}

export function persistedState(): Persisted {
  return {
    meta: cloneData(doc.meta),
    floor: cloneData(doc.floor),
    gridSize: doc.gridSize,
    snap: doc.snap,
    confine: doc.confine,
    objects: cloneData(doc.objects),
    viewpoints: cloneData(doc.viewpoints),
  }
}

export function brushFor(type: ObjectType) {
  return cloneData(brushes.get(type) ?? createDefault(type))
}

function selected() {
  return doc.objects.find((item) => item.id === ui.selectedId) ?? null
}

function rememberBrush(obj: SceneObject) {
  brushes.set(obj.type, cloneData(obj))
}

function assignDocument(next: Persisted) {
  doc.meta = cloneData(next.meta)
  doc.floor = cloneData(next.floor)
  doc.gridSize = next.gridSize
  doc.snap = next.snap
  doc.confine = next.confine
  doc.objects = cloneData(next.objects)
  doc.viewpoints = cloneData(next.viewpoints)
}

function restore(raw: string) {
  try {
    assignDocument(parsePersisted(JSON.parse(raw)))
  } catch {
    toast('无法恢复这一步')
    return
  }
  if (ui.selectedId && !doc.objects.some((item) => item.id === ui.selectedId)) ui.selectedId = null
  bump('structure')
}

function bump(kind: 'structure' | 'transform') {
  if (kind === 'structure') structureTick.value += 1
  else transformTick.value += 1
  persist()
}

function persist() {
  window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, snapshot())
    } catch {
      // The scene still lives in memory when storage is unavailable.
    }
  }, 250)
}

function snapshot() {
  return JSON.stringify({
    format: SCENE_FORMAT,
    version: SCENE_VERSION,
    ...persistedState(),
  })
}

function loadInitial(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDemo()
    return parsePersisted(JSON.parse(raw))
  } catch {
    return createDemo()
  }
}

function uniqueName(type: ObjectType) {
  const used = new Set(doc.objects.map((item) => item.name))
  let index = doc.objects.filter((item) => item.type === type).length + 1
  let name = `${TYPE_LABEL[type]} ${index}`
  while (used.has(name)) {
    index += 1
    name = `${TYPE_LABEL[type]} ${index}`
  }
  return name
}

function uniqueCode(code: string) {
  const used = new Set(doc.objects.map(objectCode).filter(Boolean))
  let next = code
  let guard = 0
  while (used.has(next) && guard < 500) {
    next = incrementCode(next)
    guard += 1
  }
  return next
}

function incrementCode(code: string) {
  const matched = code.match(/^(.*?)(\d+)$/)
  if (!matched) return `${code}-2`
  const digits = matched[2] ?? '1'
  return `${matched[1]}${String(Number(digits) + 1).padStart(digits.length, '0')}`
}

function applyFields(obj: SceneObject, patch: ObjectPatch) {
  switch (obj.type) {
    case 'rack':
      if (patch.code != null) obj.code = patch.code.trim() || obj.code
      if (patch.bays != null) obj.bays = clampInt(patch.bays, 1, 40)
      if (patch.levels != null) obj.levels = clampInt(patch.levels, 1, 16)
      if (patch.bayWidth != null) obj.bayWidth = clamp(patch.bayWidth, 0.2, 20)
      if (patch.depth != null) obj.depth = clamp(patch.depth, 0.2, 20)
      if (patch.levelHeight != null) obj.levelHeight = clamp(patch.levelHeight, 0.15, 8)
      if (patch.frameColor != null) obj.frameColor = patch.frameColor
      if (patch.beamColor != null) obj.beamColor = patch.beamColor
      if (patch.shelfColor != null) obj.shelfColor = patch.shelfColor
      break
    case 'wall':
      if (patch.length != null) obj.length = clamp(patch.length, 0.2, 200)
      if (patch.height != null) obj.height = clamp(patch.height, 0.4, 30)
      if (patch.thickness != null) obj.thickness = clamp(patch.thickness, 0.05, 2)
      if (patch.color != null) obj.color = patch.color
      break
    case 'column':
      if (patch.width != null) obj.width = clamp(patch.width, 0.1, 4)
      if (patch.depth != null) obj.depth = clamp(patch.depth, 0.1, 4)
      if (patch.height != null) obj.height = clamp(patch.height, 0.4, 30)
      if (patch.color != null) obj.color = patch.color
      break
    case 'door':
      if (patch.width != null) obj.width = clamp(patch.width, 0.6, 12)
      if (patch.height != null) obj.height = clamp(patch.height, 1, 8)
      if (patch.color != null) obj.color = patch.color
      break
    case 'zone':
      if (patch.code != null) obj.code = patch.code.trim() || obj.code
      if (patch.length != null) obj.length = clamp(patch.length, 0.5, 200)
      if (patch.depth != null) obj.depth = clamp(patch.depth, 0.5, 200)
      if (patch.color != null) obj.color = patch.color
      break
    case 'dock':
      if (patch.code != null) obj.code = patch.code.trim() || obj.code
      if (patch.length != null) obj.length = clamp(patch.length, 0.5, 40)
      if (patch.depth != null) obj.depth = clamp(patch.depth, 0.5, 20)
      if (patch.height != null) obj.height = clamp(patch.height, 0.2, 3)
      if (patch.color != null) obj.color = patch.color
      break
    case 'station':
      if (patch.length != null) obj.length = clamp(patch.length, 0.4, 8)
      if (patch.depth != null) obj.depth = clamp(patch.depth, 0.3, 4)
      if (patch.height != null) obj.height = clamp(patch.height, 0.4, 2)
      if (patch.color != null) obj.color = patch.color
      break
    case 'label':
      if (patch.color != null) obj.color = patch.color
      break
  }
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function clampInt(value: number, min: number, max: number) {
  return Math.round(clamp(value, min, max))
}

function normalizeAngle(value: number) {
  if (!Number.isFinite(value)) return 0
  return ((value % 360) + 360) % 360
}

export { OBJECT_ORDER }
