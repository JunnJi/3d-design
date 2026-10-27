<script setup lang="ts">
import { TOOLS } from '../catalog'
import { ui } from '../store'
import ToolIcon from './ToolIcon.vue'
</script>

<template>
  <aside class="flex w-[6.25rem] shrink-0 flex-col gap-1 border-r border-white/8 bg-panel px-2 py-3">
    <button
      v-for="tool in TOOLS"
      :key="tool.id"
      type="button"
      class="tool-btn"
      :class="ui.tool === tool.id ? 'tool-btn-on' : ''"
      :title="`${tool.hint}（${tool.shortcut}）`"
      @click="ui.tool = tool.id"
    >
      <ToolIcon :name="tool.id" />
      <span>{{ tool.label }}</span>
    </button>
  </aside>
</template>
