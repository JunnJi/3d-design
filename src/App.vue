<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import Inspector from './components/Inspector.vue'
import StatusBar from './components/StatusBar.vue'
import ToolRail from './components/ToolRail.vue'
import TopBar from './components/TopBar.vue'
import Viewport from './components/Viewport.vue'
import {
  applyConfirm,
  duplicateSelected,
  redo,
  removeObject,
  requestFit,
  rotateBy,
  toast,
  ui,
  undo,
} from './store'
import type { ToolId } from './types'

const toolKeys: Record<string, ToolId> = {
  v: 'select',
  '1': 'rack',
  '2': 'wall',
  '3': 'column',
  '4': 'door',
  '5': 'zone',
  '6': 'dock',
  '7': 'station',
  '8': 'label',
}

const confirmCopy = {
  new: ['新建场景', '当前布置会被替换。这一步可以撤销。', '新建'],
  demo: ['加载示例库房', '用示例成品库替换当前场景。这一步可以撤销。', '加载'],
  clear: ['清空物体', '库房尺寸和名称会保留，物体全部删除。这一步可以撤销。', '清空'],
} as const

function onKey(event: KeyboardEvent) {
  const target = event.target
  if (target instanceof HTMLElement && target.closest('input, textarea, select')) return
  const meta = event.metaKey || event.ctrlKey
  const key = event.key.toLowerCase()

  if (key === 'escape') {
    if (ui.help) ui.help = false
    else if (ui.confirm) ui.confirm = null
    else ui.tool = 'select'
    return
  }
  if (meta && key === 'z') {
    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
    return
  }
  if (meta && key === 'y') {
    event.preventDefault()
    redo()
    return
  }
  if (meta && key === 'd') {
    event.preventDefault()
    duplicateSelected()
    return
  }
  if (meta && key === 's') {
    event.preventDefault()
    toast('场景已保存在本机浏览器')
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    if (ui.selectedId) removeObject(ui.selectedId)
    return
  }
  if (!meta && key === 'r') {
    if (ui.selectedId && ui.tool === 'select') rotateBy(ui.selectedId, event.shiftKey ? -90 : 90)
    else ui.placeRotation = (ui.placeRotation + (event.shiftKey ? -90 : 90) + 360) % 360
    return
  }
  if (!meta && key === 'f') {
    requestFit()
    return
  }
  if (!meta && (key === 't' || key === 'p')) {
    ui.projection = key === 't' ? 'top' : 'perspective'
    return
  }
  const tool = toolKeys[key]
  if (!meta && tool) ui.tool = tool
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="flex h-screen min-w-[1180px] flex-col overflow-hidden bg-ink text-base text-zinc-50">
    <div class="h-px shrink-0 bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />
    <TopBar />
    <div class="flex min-h-0 flex-1">
      <ToolRail />
      <Viewport />
      <Inspector />
    </div>
    <StatusBar />

    <p
      v-if="ui.toast"
      class="fixed bottom-16 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-zinc-100 px-5 py-2.5 text-base text-zinc-900 shadow-2xl"
    >
      {{ ui.toast }}
    </p>

    <div v-if="ui.confirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm" @click.self="ui.confirm = null">
      <div class="w-full max-w-sm rounded-2xl border border-white/10 bg-panel p-5 shadow-2xl">
        <h2 class="text-lg font-semibold">{{ confirmCopy[ui.confirm][0] }}</h2>
        <p class="mt-2 text-base leading-7 text-zinc-300">{{ confirmCopy[ui.confirm][1] }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="btn btn-ghost" @click="ui.confirm = null">取消</button>
          <button type="button" class="btn btn-solid" @click="applyConfirm">{{ confirmCopy[ui.confirm][2] }}</button>
        </div>
      </div>
    </div>

    <div v-if="ui.help" class="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm" @click.self="ui.help = false">
      <div class="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl border border-white/10 bg-panel p-5 shadow-2xl">
        <div class="flex items-start justify-between gap-4">
          <h2 class="text-lg font-semibold">怎么交给库房看板</h2>
          <button type="button" class="btn btn-ghost px-2" @click="ui.help = false">关闭</button>
        </div>
        <div class="mt-3 space-y-3 text-base leading-7 text-zinc-200">
          <p>原点在地面西南角。X 沿库房长度，Z 沿进深，Y 向上，单位是米。编辑会自动留在这台浏览器里。</p>
          <p>场景 JSON 是看板的主文件。用 <span class="text-amber-200">slots</span> 里的库位编码和仓储系统对齐，用 <span class="text-amber-200">position</span> 摆货物。GLB 的原点在库房地面中心，方便直接丢进三维引擎。</p>
          <p>若看板用 three.js，把 JSON 坐标平移到中心：<span class="text-zinc-400">threeX = x - 长度 / 2</span>，<span class="text-zinc-400">threeZ = z - 进深 / 2</span>。</p>
        </div>
        <dl class="mt-4 grid grid-cols-[5.5rem_1fr] gap-y-1.5 text-base text-zinc-300">
          <dt class="text-zinc-200">V / 1-8</dt>
          <dd>选择、货架、墙、柱、门、库区、月台、作业台、标注</dd>
          <dt class="text-zinc-200">R</dt>
          <dd>旋转 90°，按住 Shift 反向</dd>
          <dt class="text-zinc-200">Del</dt>
          <dd>删除选中物体</dd>
          <dt class="text-zinc-200">⌘/Ctrl D</dt>
          <dd>复制</dd>
          <dt class="text-zinc-200">⌘/Ctrl Z</dt>
          <dd>撤销，加 Shift 重做</dd>
          <dt class="text-zinc-200">F / T / P</dt>
          <dd>适配视图、俯视、透视</dd>
        </dl>
      </div>
    </div>
  </div>
</template>
