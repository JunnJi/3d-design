<script setup lang="ts">
import { ref } from 'vue'
import { exportCsv, exportGlb, exportJson, importJsonText } from '../io'
import { askConfirm, beginEdit, doc, endEdit, history, patchMeta, redo, toast, ui, undo } from '../store'

const menu = ref(false)
const file = ref<HTMLInputElement | null>(null)

function onName(event: Event) {
  patchMeta({ name: (event.target as HTMLInputElement).value })
}

function onSite(event: Event) {
  patchMeta({ site: (event.target as HTMLInputElement).value })
}

function choose(action: 'json' | 'csv' | 'glb') {
  menu.value = false
  if (action === 'json') exportJson()
  if (action === 'csv') exportCsv()
  if (action === 'glb') void exportGlb()
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = input.files?.[0]
  input.value = ''
  if (!picked) return
  try {
    importJsonText(await picked.text())
  } catch (error) {
    toast(error instanceof Error ? error.message : '导入失败')
  }
}
</script>

<template>
  <header class="flex h-16 shrink-0 items-center gap-3 border-b border-white/8 bg-gradient-to-r from-[#2a2116] via-panel to-panel px-4">
    <div class="flex shrink-0 items-center gap-2.5">
      <span class="grid h-10 w-10 place-items-center rounded-xl bg-amber-400 text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M7 19V6M17 19V6M7 9h10M7 13h10M7 17h10" />
        </svg>
      </span>
      <div class="leading-tight">
        <p class="text-lg font-semibold tracking-tight">库房设计器</p>
        <p class="text-sm text-zinc-300">导出给 3D 看板</p>
      </div>
    </div>
    <div class="mx-1 hidden h-8 w-px bg-white/10 sm:block" />
    <input
      class="field max-w-[18rem] text-lg font-semibold"
      :value="doc.meta.name"
      aria-label="库房名称"
      @focus="beginEdit"
      @blur="endEdit"
      @input="onName"
    />
    <input
      class="field hidden max-w-[12rem] lg:block"
      :value="doc.meta.site"
      placeholder="场地"
      aria-label="场地"
      @focus="beginEdit"
      @blur="endEdit"
      @input="onSite"
    />
    <div class="ml-auto flex items-center gap-1">
      <button type="button" class="btn btn-ghost h-10 w-10 px-0" title="撤销" aria-label="撤销" :disabled="history.past.length === 0" @click="undo">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 8H4v4" />
          <path d="M4 8c2.2-2.4 5-3.5 8-3.5 4.6 0 8 3.1 8 7.5S16.6 19.5 12 19.5c-2.4 0-4.5-.8-6-2.2" />
        </svg>
      </button>
      <button type="button" class="btn btn-ghost h-10 w-10 px-0" title="重做" aria-label="重做" :disabled="history.future.length === 0" @click="redo">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 8h4v4" />
          <path d="M20 8c-2.2-2.4-5-3.5-8-3.5-4.6 0-8 3.1-8 7.5s3.4 7.5 8 7.5c2.4 0 4.5-.8 6-2.2" />
        </svg>
      </button>
      <span class="mx-1 h-5 w-px bg-white/10" />
      <button type="button" class="btn btn-ghost px-2" @click="askConfirm('new')">新建</button>
      <button type="button" class="btn btn-ghost px-2" @click="askConfirm('demo')">示例</button>
      <button type="button" class="btn btn-line px-2.5" @click="file?.click()">导入</button>
      <div class="relative">
        <button type="button" class="btn btn-solid px-3" @click="menu = !menu">导出</button>
        <button v-if="menu" type="button" class="fixed inset-0 z-20 cursor-default" aria-label="关闭菜单" @click="menu = false" />
        <div v-if="menu" class="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#191e28] py-1 shadow-2xl">
          <button type="button" class="block w-full px-4 py-2.5 text-left hover:bg-white/8" @click="choose('json')">
            <span class="block text-base text-zinc-50">场景 JSON</span>
            <span class="block text-sm text-zinc-300">看板直接加载</span>
          </button>
          <button type="button" class="block w-full px-4 py-2.5 text-left hover:bg-white/8" @click="choose('csv')">
            <span class="block text-base text-zinc-50">库位 CSV</span>
            <span class="block text-sm text-zinc-300">和仓储编码对齐</span>
          </button>
          <button type="button" class="block w-full px-4 py-2.5 text-left hover:bg-white/8" @click="choose('glb')">
            <span class="block text-base text-zinc-50">模型 GLB</span>
            <span class="block text-sm text-zinc-300">地面中心，1 单位 = 1 米</span>
          </button>
        </div>
      </div>
      <button type="button" class="btn btn-ghost px-2" @click="ui.help = true">说明</button>
    </div>
    <input ref="file" class="hidden" type="file" accept="application/json,.json" @change="onFile" />
  </header>
</template>
