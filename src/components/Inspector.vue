<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { OBJECT_ORDER, TYPE_LABEL, ZONE_COLORS, objectCode, uid, type RackPresetId } from '../catalog'
import { viewportCapture } from '../bridge'
import { rackFrameHeight } from '../geometry'
import {
  addViewpoint,
  applyRackPreset,
  askConfirm,
  beginEdit,
  checkpoint,
  doc,
  duplicateSelected,
  endEdit,
  patchFloor,
  patchMeta,
  patchObject,
  removeObject,
  removeViewpoint,
  selectObject,
  setConfine,
  setGridSize,
  setSnap,
  showViewpoint,
  toast,
  ui,
} from '../store'
import type { FloorSpec, ObjectPatch, SceneMeta } from '../types'
import NumberField from './NumberField.vue'

const focus = ref<'object' | 'scene'>('object')
const viewName = ref('')
const selected = computed(() => doc.objects.find((item) => item.id === ui.selectedId) ?? null)
const groups = computed(() =>
  OBJECT_ORDER.map((type) => ({
    type,
    label: TYPE_LABEL[type],
    items: doc.objects.filter((item) => item.type === type),
  })).filter((group) => group.items.length > 0),
)
const rackHeight = computed(() => (selected.value?.type === 'rack' ? rackFrameHeight(selected.value) : 0))

watch(
  () => ui.selectedId,
  () => {
    focus.value = 'object'
  },
)

function edit(patch: ObjectPatch, kind: 'structure' | 'transform') {
  if (!selected.value) return
  patchObject(selected.value.id, patch, kind)
}

function editRotation(value: number) {
  edit({ rotationY: value }, 'transform')
  if (selected.value) ui.placeRotation = selected.value.rotationY
}

function turnQuarter() {
  if (!selected.value) return
  checkpoint()
  editRotation(selected.value.rotationY + 90)
}

function paint(color: string) {
  checkpoint()
  edit({ color }, 'structure')
}

function editName(event: Event) {
  edit({ name: (event.target as HTMLInputElement).value }, 'structure')
}

function editCode(event: Event) {
  edit({ code: (event.target as HTMLInputElement).value }, 'structure')
}

function editMeta(patch: Partial<SceneMeta>) {
  patchMeta(patch)
}

function editFloor(patch: Partial<FloorSpec>) {
  patchFloor(patch)
}

function usePreset(preset: RackPresetId) {
  if (selected.value) applyRackPreset(selected.value.id, preset)
}

function saveView() {
  const shot = viewportCapture()
  if (!shot) {
    toast('三维视图还没准备好')
    return
  }
  addViewpoint({
    id: uid('view'),
    name: viewName.value.trim() || `视角 ${doc.viewpoints.length + 1}`,
    ...shot,
  })
  viewName.value = ''
  toast('已保存视角')
}

const panels = [
  { id: 'props' as const, label: '属性' },
  { id: 'outline' as const, label: '大纲' },
  { id: 'views' as const, label: '视角' },
]
</script>

<template>
  <aside class="flex w-[22rem] shrink-0 flex-col border-l border-white/8 bg-panel">
    <div class="px-3.5 pt-3">
      <div class="flex rounded-xl bg-black/30 p-1">
        <button
          v-for="panel in panels"
          :key="panel.id"
          type="button"
          class="h-9 flex-1 rounded-lg text-base"
          :class="ui.panel === panel.id ? 'bg-white/10 text-zinc-50' : 'text-zinc-500 hover:text-zinc-300'"
          @click="ui.panel = panel.id"
        >
          {{ panel.label }}
        </button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-auto px-3.5 py-3">
      <template v-if="ui.panel === 'props'">
        <div v-if="selected" class="mb-3 flex rounded-xl bg-black/25 p-1">
          <button
            type="button"
            class="h-9 flex-1 rounded-lg text-sm"
            :class="focus === 'object' ? 'bg-white/10 text-zinc-100' : 'text-zinc-500'"
            @click="focus = 'object'"
          >
            当前物体
          </button>
          <button
            type="button"
            class="h-9 flex-1 rounded-lg text-sm"
            :class="focus === 'scene' ? 'bg-white/10 text-zinc-100' : 'text-zinc-500'"
            @click="focus = 'scene'"
          >
            场景
          </button>
        </div>

        <div v-if="selected && focus === 'object'" class="space-y-3">
          <p class="text-sm font-semibold text-accent-soft">{{ TYPE_LABEL[selected.type] }}</p>
          <label class="block">
            <span class="field-label">{{ selected.type === 'label' ? '文字' : '名称' }}</span>
            <input class="field" :value="selected.name" @focus="beginEdit" @blur="endEdit" @input="editName" />
          </label>
          <label v-if="selected.type === 'rack' || selected.type === 'zone' || selected.type === 'dock'" class="block">
            <span class="field-label">编码</span>
            <input class="field" :value="selected.code" @focus="beginEdit" @blur="endEdit" @input="editCode" />
          </label>

          <div class="grid grid-cols-2 gap-2.5">
            <NumberField label="X" :model-value="selected.position.x" :min="0" :max="doc.floor.width" :step="doc.gridSize" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ position: { x: $event } }, 'transform')" />
            <NumberField label="Z" :model-value="selected.position.z" :min="0" :max="doc.floor.depth" :step="doc.gridSize" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ position: { z: $event } }, 'transform')" />
          </div>
          <NumberField
            v-if="selected.type === 'label'"
            label="离地高度"
            :model-value="selected.position.y"
            :min="0"
            :max="20"
            :step="0.1"
            @edit-start="beginEdit"
            @edit-end="endEdit"
            @update:model-value="edit({ position: { y: $event } }, 'transform')"
          />
          <div class="flex items-end gap-2">
            <NumberField class="min-w-0 flex-1" label="旋转 °" :model-value="selected.rotationY" :min="0" :max="359" :step="1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="editRotation" />
            <button type="button" class="btn btn-line shrink-0 px-3" @click="turnQuarter">转 90°</button>
          </div>

          <template v-if="selected.type === 'rack'">
            <div class="grid grid-cols-3 gap-1.5">
              <button type="button" class="btn btn-line px-1 text-sm" @click="usePreset('light')">轻型</button>
              <button type="button" class="btn btn-line px-1 text-sm" @click="usePreset('medium')">中型</button>
              <button type="button" class="btn btn-line px-1 text-sm" @click="usePreset('heavy')">重型</button>
            </div>
            <div class="grid grid-cols-2 gap-2.5">
              <NumberField label="列数" integer :model-value="selected.bays" :min="1" :max="40" :step="1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ bays: $event }, 'structure')" />
              <NumberField label="层数" integer :model-value="selected.levels" :min="1" :max="16" :step="1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ levels: $event }, 'structure')" />
              <NumberField label="列宽 m" :model-value="selected.bayWidth" :min="0.2" :max="20" :step="0.1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ bayWidth: $event }, 'structure')" />
              <NumberField label="进深 m" :model-value="selected.depth" :min="0.2" :max="20" :step="0.1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ depth: $event }, 'structure')" />
              <NumberField label="层高 m" :model-value="selected.levelHeight" :min="0.15" :max="8" :step="0.05" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ levelHeight: $event }, 'structure')" />
            </div>
            <p class="text-sm leading-6 text-zinc-200">
              {{ selected.bays * selected.levels }} 个库位，编码 {{ selected.code }}-列-层。架高 {{ rackHeight.toFixed(2) }} m。
            </p>
            <p v-if="rackHeight > doc.floor.clearHeight" class="text-sm text-accent-soft">超过库房净高 {{ doc.floor.clearHeight }} m</p>
            <div class="grid grid-cols-3 gap-2.5">
              <label class="block min-w-0">
                <span class="field-label">立柱</span>
                <input class="swatch-chip" type="color" :value="selected.frameColor" @focus="beginEdit" @blur="endEdit" @input="edit({ frameColor: ($event.target as HTMLInputElement).value }, 'structure')" />
              </label>
              <label class="block min-w-0">
                <span class="field-label">横梁</span>
                <input class="swatch-chip" type="color" :value="selected.beamColor" @focus="beginEdit" @blur="endEdit" @input="edit({ beamColor: ($event.target as HTMLInputElement).value }, 'structure')" />
              </label>
              <label class="block min-w-0">
                <span class="field-label">层板</span>
                <input class="swatch-chip" type="color" :value="selected.shelfColor" @focus="beginEdit" @blur="endEdit" @input="edit({ shelfColor: ($event.target as HTMLInputElement).value }, 'structure')" />
              </label>
            </div>
          </template>

          <template v-else-if="selected.type === 'wall'">
            <div class="grid grid-cols-2 gap-2.5">
              <NumberField label="长度 m" :model-value="selected.length" :min="0.2" :max="200" :step="0.1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ length: $event }, 'structure')" />
              <NumberField label="高度 m" :model-value="selected.height" :min="0.4" :max="30" :step="0.1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ height: $event }, 'structure')" />
              <NumberField label="厚度 m" :model-value="selected.thickness" :min="0.05" :max="2" :step="0.01" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ thickness: $event }, 'structure')" />
            </div>
          </template>

          <template v-else-if="selected.type === 'column'">
            <div class="grid grid-cols-2 gap-2.5">
              <NumberField label="宽度 m" :model-value="selected.width" :min="0.1" :max="4" :step="0.05" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ width: $event }, 'structure')" />
              <NumberField label="进深 m" :model-value="selected.depth" :min="0.1" :max="4" :step="0.05" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ depth: $event }, 'structure')" />
              <NumberField label="高度 m" :model-value="selected.height" :min="0.4" :max="30" :step="0.1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ height: $event }, 'structure')" />
            </div>
          </template>

          <template v-else-if="selected.type === 'door'">
            <div class="grid grid-cols-2 gap-2.5">
              <NumberField label="宽度 m" :model-value="selected.width" :min="0.6" :max="12" :step="0.1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ width: $event }, 'structure')" />
              <NumberField label="高度 m" :model-value="selected.height" :min="1" :max="8" :step="0.1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ height: $event }, 'structure')" />
            </div>
          </template>

          <template v-else-if="selected.type === 'zone'">
            <div class="grid grid-cols-2 gap-2.5">
              <NumberField label="长度 m" :model-value="selected.length" :min="0.5" :max="200" :step="0.1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ length: $event }, 'structure')" />
              <NumberField label="进深 m" :model-value="selected.depth" :min="0.5" :max="200" :step="0.1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ depth: $event }, 'structure')" />
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in ZONE_COLORS"
                :key="color"
                type="button"
                class="h-9 w-9 rounded-full border-2"
                :class="selected.color === color ? 'border-white' : 'border-transparent'"
                :style="{ background: color }"
                @click="paint(color)"
              />
            </div>
          </template>

          <template v-else-if="selected.type === 'dock'">
            <div class="grid grid-cols-2 gap-2.5">
              <NumberField label="长度 m" :model-value="selected.length" :min="0.5" :max="40" :step="0.1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ length: $event }, 'structure')" />
              <NumberField label="进深 m" :model-value="selected.depth" :min="0.5" :max="20" :step="0.1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ depth: $event }, 'structure')" />
              <NumberField label="高度 m" :model-value="selected.height" :min="0.2" :max="3" :step="0.05" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ height: $event }, 'structure')" />
            </div>
          </template>

          <template v-else-if="selected.type === 'station'">
            <div class="grid grid-cols-2 gap-2.5">
              <NumberField label="长度 m" :model-value="selected.length" :min="0.4" :max="8" :step="0.1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ length: $event }, 'structure')" />
              <NumberField label="进深 m" :model-value="selected.depth" :min="0.3" :max="4" :step="0.1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ depth: $event }, 'structure')" />
              <NumberField label="高度 m" :model-value="selected.height" :min="0.4" :max="2" :step="0.05" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="edit({ height: $event }, 'structure')" />
            </div>
          </template>

          <label v-if="selected.type !== 'rack'" class="block">
            <span class="field-label">颜色</span>
            <input class="swatch max-w-[8.5rem]" type="color" :value="selected.color" @focus="beginEdit" @blur="endEdit" @input="edit({ color: ($event.target as HTMLInputElement).value }, 'structure')" />
          </label>

          <div class="flex gap-2 pt-1">
            <button type="button" class="btn btn-line flex-1" @click="duplicateSelected">复制</button>
            <button type="button" class="btn btn-line flex-1 text-red-300" @click="removeObject(selected.id)">删除</button>
          </div>
        </div>

        <div v-else class="space-y-3">
          <label class="block">
            <span class="field-label">库房名称</span>
            <input class="field" :value="doc.meta.name" @focus="beginEdit" @blur="endEdit" @input="editMeta({ name: ($event.target as HTMLInputElement).value })" />
          </label>
          <label class="block">
            <span class="field-label">场地</span>
            <input class="field" :value="doc.meta.site" @focus="beginEdit" @blur="endEdit" @input="editMeta({ site: ($event.target as HTMLInputElement).value })" />
          </label>
          <label class="block">
            <span class="field-label">备注</span>
            <textarea class="field h-20 py-1.5" :value="doc.meta.remark" @focus="beginEdit" @blur="endEdit" @input="editMeta({ remark: ($event.target as HTMLTextAreaElement).value })" />
          </label>
          <div class="grid grid-cols-2 gap-2.5">
            <NumberField label="长度 m" :model-value="doc.floor.width" :min="4" :max="200" :step="0.5" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="editFloor({ width: $event })" />
            <NumberField label="进深 m" :model-value="doc.floor.depth" :min="4" :max="200" :step="0.5" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="editFloor({ depth: $event })" />
            <NumberField label="净高 m" :model-value="doc.floor.clearHeight" :min="2" :max="40" :step="0.1" @edit-start="beginEdit" @edit-end="endEdit" @update:model-value="editFloor({ clearHeight: $event })" />
          </div>
          <label class="block">
            <span class="field-label">地面颜色</span>
            <input class="swatch max-w-[8.5rem]" type="color" :value="doc.floor.color" @focus="beginEdit" @blur="endEdit" @input="editFloor({ color: ($event.target as HTMLInputElement).value })" />
          </label>
          <label class="block">
            <span class="field-label">网格</span>
            <select class="field" :value="String(doc.gridSize)" @change="setGridSize(Number(($event.target as HTMLSelectElement).value))">
              <option value="0.1">0.1 m</option>
              <option value="0.5">0.5 m</option>
              <option value="1">1 m</option>
              <option value="2">2 m</option>
            </select>
          </label>
          <label class="flex items-center gap-2 text-base text-zinc-100">
            <input class="accent-accent" type="checkbox" :checked="doc.snap" @change="setSnap(($event.target as HTMLInputElement).checked)" />
            放置和拖动时吸附网格
          </label>
          <label class="flex items-center gap-2 text-base text-zinc-100">
            <input class="accent-accent" type="checkbox" :checked="doc.confine" @change="setConfine(($event.target as HTMLInputElement).checked)" />
            物体限制在库房内
          </label>
          <button type="button" class="btn btn-line w-full" @click="askConfirm('clear')">清空物体</button>
        </div>
      </template>

      <template v-else-if="ui.panel === 'outline'">
        <p v-if="groups.length === 0" class="text-base text-zinc-300">还没有物体</p>
        <section v-for="group in groups" :key="group.type" class="mb-3">
          <h3 class="mb-1 text-sm font-medium text-zinc-300">{{ group.label }} · {{ group.items.length }}</h3>
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            class="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-base"
            :class="item.id === ui.selectedId ? 'bg-accent/15 text-accent-soft' : 'text-zinc-300 hover:bg-white/6'"
            @click="selectObject(item.id)"
          >
            <span class="truncate">{{ item.name }}</span>
            <span v-if="objectCode(item)" class="ml-auto shrink-0 text-sm text-zinc-300">{{ objectCode(item) }}</span>
          </button>
        </section>
      </template>

      <template v-else>
        <div class="mb-3 flex gap-2">
          <input v-model="viewName" class="field" placeholder="视角名称" @keydown.enter="saveView" />
          <button type="button" class="btn btn-line shrink-0" @click="saveView">保存当前</button>
        </div>
        <p v-if="doc.viewpoints.length === 0" class="text-base text-zinc-300">把看板要用的机位存下来，会写进场景文件。</p>
        <div v-for="view in doc.viewpoints" :key="view.id" class="mb-1 flex items-center gap-2">
          <button type="button" class="min-w-0 flex-1 truncate rounded-xl px-2.5 py-2 text-left text-base text-zinc-100 hover:bg-white/8" @click="showViewpoint(view)">
            {{ view.name }}
            <span class="ml-1 text-sm text-zinc-300">{{ view.projection === 'top' ? '俯视' : '透视' }}</span>
          </button>
          <button type="button" class="btn btn-ghost px-2 text-sm" @click="removeViewpoint(view.id)">删除</button>
        </div>
      </template>
    </div>
  </aside>
</template>
