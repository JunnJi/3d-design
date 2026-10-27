<script setup lang="ts">
import { computed } from 'vue'
import { TOOLS } from '@/domain/catalog'
import { collectSlots } from '@/domain/geometry'
import { doc, ui } from '@/domain/store'

const slotCount = computed(() => collectSlots(doc.objects).length)
const rackCount = computed(() => doc.objects.filter((item) => item.type === 'rack').length)
const hint = computed(() => TOOLS.find((tool) => tool.id === ui.tool)?.hint ?? '')
const pointer = computed(() =>
  ui.pointer.valid ? `X ${ui.pointer.x.toFixed(2)} m · Z ${ui.pointer.z.toFixed(2)} m` : 'X — · Z —',
)
</script>

<template>
  <footer class="flex h-12 shrink-0 items-center gap-4 border-t border-white/8 bg-panel px-4 text-base text-mist">
    <span class="text-[#e9eef5]">{{ hint }}</span>
    <span class="h-4 w-px bg-white/15" />
    <span>货架 <span class="tabular-nums text-accent-soft">{{ rackCount }}</span></span>
    <span>库位 <span class="tabular-nums text-accent-soft">{{ slotCount }}</span></span>
    <span>物体 <span class="tabular-nums text-[#e9eef5]">{{ doc.objects.length }}</span></span>
    <span class="ml-auto tabular-nums text-[#e9eef5]">{{ pointer }}</span>
    <span class="tabular-nums">网格 {{ doc.gridSize }} m</span>
  </footer>
</template>
