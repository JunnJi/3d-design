import { SCENE_FORMAT, SCENE_VERSION } from '@/domain/catalog'
import { parsePersisted } from '@/domain/document'
import { collectSlots, round3 } from '@/domain/geometry'
import { persistedState, replaceDocument, toast } from '@/domain/store'
import type { SceneStats, SlotRecord, WarehouseFile } from '@/domain/types'
import { viewportExportGlb } from './bridge'

export function toExportFile(): WarehouseFile {
  const state = persistedState()
  const slots = collectSlots(state.objects).map(roundSlot)
  return {
    format: SCENE_FORMAT,
    version: SCENE_VERSION,
    unit: 'm',
    origin: 'corner',
    generator: 'warehouse-designer',
    exportedAt: new Date().toISOString(),
    ...state,
    slots,
    stats: sceneStats(state.objects, slots.length),
  }
}

export function exportJson() {
  const file = toExportFile()
  download(`${fileBase(file.meta.name)}.warehouse.json`, JSON.stringify(file, null, 2), 'application/json')
  toast('已导出场景 JSON')
}

export function exportCsv() {
  const file = toExportFile()
  const header = ['code', 'rackId', 'rackCode', 'rackName', 'bay', 'level', 'x', 'y', 'z', 'length', 'depth', 'height']
  const lines = file.slots.map((slot) =>
    [
      slot.code,
      slot.rackId,
      slot.rackCode,
      csvEscape(slot.rackName),
      slot.bay,
      slot.level,
      slot.position.x,
      slot.position.y,
      slot.position.z,
      slot.size.length,
      slot.size.depth,
      slot.size.height,
    ].join(','),
  )
  download(`${fileBase(file.meta.name)}-库位.csv`, `\uFEFF${header.join(',')}\n${lines.join('\n')}\n`, 'text/csv')
  toast(`已导出 ${file.slots.length} 个库位`)
}

export async function exportGlb() {
  try {
    const buffer = await viewportExportGlb()
    if (!buffer) {
      toast('三维视图还没准备好')
      return
    }
    const blob = new Blob([buffer], { type: 'model/gltf-binary' })
    downloadBlob(blob, `${fileBase(persistedState().meta.name)}.glb`)
    toast('已导出 GLB 模型')
  } catch (error) {
    toast(error instanceof Error ? error.message : '模型导出失败')
  }
}

export function importJsonText(text: string) {
  replaceDocument(parsePersisted(JSON.parse(text)))
  toast('已导入场景')
}

function sceneStats(objects: WarehouseFile['objects'], slotCount: number): SceneStats {
  const count = (type: WarehouseFile['objects'][number]['type']) => objects.filter((item) => item.type === type).length
  return {
    racks: count('rack'),
    slots: slotCount,
    zones: count('zone'),
    walls: count('wall'),
    doors: count('door'),
    docks: count('dock'),
  }
}

function roundSlot(slot: SlotRecord): SlotRecord {
  return {
    ...slot,
    position: { x: round3(slot.position.x), y: round3(slot.position.y), z: round3(slot.position.z) },
    size: { length: round3(slot.size.length), depth: round3(slot.size.depth), height: round3(slot.size.height) },
  }
}

function fileBase(name: string) {
  return name.trim() || 'warehouse'
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

function download(filename: string, text: string, type: string) {
  downloadBlob(new Blob([text], { type }), filename)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
