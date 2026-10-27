<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast, ui } from '@/domain/store'
import { downloadExample, exampleEntry, type ExampleKind } from '@/examples/pack'

const kind = ref<ExampleKind>('vue')
const packing = ref(false)
const entry = computed(() => exampleEntry(kind.value))
const tabs: { id: ExampleKind; label: string }[] = [
  { id: 'vue', label: 'Vue 3' },
  { id: 'react', label: 'React' },
]

async function save() {
  if (packing.value) return
  packing.value = true
  toast('正在打包 Demo（含 GLB）…')
  try {
    await downloadExample(kind.value)
    toast(kind.value === 'vue' ? '已下载 Vue 3 Demo' : '已下载 React Demo')
  } catch (error) {
    toast(error instanceof Error ? error.message : '打包失败')
  } finally {
    packing.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm" @click.self="ui.examples = false">
    <div class="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-panel shadow-2xl">
      <div class="flex items-start justify-between gap-4 px-5 pt-5">
        <div>
          <h2 class="text-lg font-semibold">看板使用示例</h2>
          <p class="mt-1 text-base text-zinc-300">TypeScript Demo，内置与设计器同款的 JSON + GLB，看板外观一致。</p>
        </div>
        <button type="button" class="btn btn-ghost px-2" @click="ui.examples = false">关闭</button>
      </div>
      <div class="mt-4 flex gap-2 px-5">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="rounded-full px-4 py-1.5 text-base font-medium"
          :class="kind === tab.id ? 'bg-accent text-[#06201d]' : 'bg-white/6 text-zinc-200 hover:bg-white/10'"
          @click="kind = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
      <pre class="mx-5 mt-4 min-h-0 flex-1 overflow-auto rounded-xl bg-black/35 p-4 text-[15px] leading-7 text-zinc-100">{{ entry }}</pre>
      <div class="flex items-center justify-between gap-3 px-5 py-4">
        <p class="text-sm text-zinc-300">解压后执行 pnpm install 和 pnpm dev。包内已含 warehouse.json 与 warehouse.glb。</p>
        <button type="button" class="btn btn-solid shrink-0 px-4" :disabled="packing" @click="save">
          {{ packing ? '打包中…' : kind === 'vue' ? '下载 Vue 3 Demo' : '下载 React Demo' }}
        </button>
      </div>
    </div>
  </div>
</template>
