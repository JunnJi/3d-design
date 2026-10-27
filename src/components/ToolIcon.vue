<script setup lang="ts">
import type { ToolId } from '@/domain/types'

defineProps<{ name: ToolId }>()
</script>

<template>
  <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path v-if="name === 'select'" d="M5 4v14l4.2-4.2L13 20l2-1-3.7-6.2H19z" fill="currentColor" stroke="none" />
    <path v-else-if="name === 'rack'" d="M7 20V5M17 20V5M7 8.5h10M7 13h10M7 17.5h10" />
    <rect v-else-if="name === 'wall'" x="4" y="6" width="16" height="12" rx="1" />
    <path v-else-if="name === 'column'" d="M8 20h8M9.5 20V8h5v12M10 8l2-3 2 3" />
    <path v-else-if="name === 'door'" d="M4 20V6h7v14M13 20V6h7v14M4 20h16M8.5 12h1M15.5 12h1" />
    <rect v-else-if="name === 'zone'" x="4" y="5" width="16" height="14" rx="1.5" stroke-dasharray="3 2" />
    <path v-else-if="name === 'dock'" d="M3 16h18M5 16V9h14v7M8 9V6h8v3" />
    <path v-else-if="name === 'station'" d="M4 9h16v3.5H4zM7 12.5V19M17 12.5V19" />
    <path v-else d="M4 12V6h7l8 6-8 6H4z" />
  </svg>
</template>
