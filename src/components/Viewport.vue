<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { PREVIEW_LEGEND } from '../catalog'
import { mountViewport } from '../scene/viewport'
import { doc, requestFit, ui } from '../store'
import type { Projection } from '../types'

const host = ref<HTMLDivElement | null>(null)
const objectCount = computed(() => doc.objects.length)
let dispose: (() => void) | null = null

const viewButtons: { id: Projection; label: string }[] = [
  { id: 'perspective', label: '透视' },
  { id: 'top', label: '俯视' },
]

onMounted(() => {
  if (host.value) dispose = mountViewport(host.value)
})

onBeforeUnmount(() => dispose?.())

function setProjection(mode: Projection) {
  ui.projection = mode
}
</script>

<template>
  <section class="relative min-w-0 flex-1 overflow-hidden bg-[#0e1218]">
    <div
      ref="host"
      class="absolute inset-0 touch-none"
      :class="ui.preview || ui.tool === 'select' ? 'cursor-default' : 'cursor-crosshair'"
    />
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_62%,rgba(6,8,12,0.28)_100%)]" />
    <div class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
      <div class="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-[#12161e]/80 p-1 shadow-lg shadow-black/40 backdrop-blur-md">
        <button
          v-for="mode in viewButtons"
          :key="mode.id"
          type="button"
          class="chip"
          :class="ui.projection === mode.id ? 'chip-on' : ''"
          @click="setProjection(mode.id)"
        >
          {{ mode.label }}
        </button>
        <button type="button" class="chip" @click="requestFit">适配</button>
        <span class="mx-0.5 h-4 w-px bg-white/10" />
        <button type="button" class="chip" :class="ui.showGrid ? 'chip-on' : ''" @click="ui.showGrid = !ui.showGrid">网格</button>
        <button type="button" class="chip" :class="ui.showSlotCodes ? 'chip-on' : ''" @click="ui.showSlotCodes = !ui.showSlotCodes">
          库位号
        </button>
        <span class="mx-0.5 h-4 w-px bg-white/10" />
        <button type="button" class="chip" :class="ui.preview ? 'chip-on' : ''" @click="ui.preview = !ui.preview">
          {{ ui.preview ? '退出预览' : '看板预览' }}
        </button>
      </div>
      <p class="rounded-full border border-white/10 bg-[#12161e]/80 px-4 py-2 text-sm text-zinc-100 backdrop-blur-md">右键平移 · 滚轮缩放 · R 旋转</p>
    </div>
    <div
      v-if="ui.preview"
      class="pointer-events-none absolute bottom-3 left-3 rounded-2xl border border-white/10 bg-[#12161e]/85 px-4 py-3 text-base text-zinc-50 shadow-lg backdrop-blur-md"
    >
      <p class="mb-2 text-sm text-zinc-200">演示库存，导出后由看板按库位编码着色</p>
      <div class="flex flex-wrap gap-x-4 gap-y-1.5">
        <span v-for="item in PREVIEW_LEGEND" :key="item.label" class="inline-flex items-center gap-2">
          <i class="inline-block h-3.5 w-3.5 rounded-sm" :style="{ background: item.color }" />
          {{ item.label }}
        </span>
      </div>
    </div>
    <p
      v-else-if="objectCount === 0"
      class="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-[#12161e]/85 px-5 py-2.5 text-base text-zinc-50 backdrop-blur-md"
    >
      从左侧选择货架或墙体，再点击地面放置
    </p>
  </section>
</template>
