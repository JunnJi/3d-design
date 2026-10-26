<script setup lang="ts">
const props = defineProps<{
  label: string
  modelValue: number
  min: number
  max: number
  step: number
  integer?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
  editStart: []
  editEnd: []
}>()

function onInput(event: Event) {
  const next = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(next)) emit('update:modelValue', next)
}

function onBlur(event: FocusEvent) {
  const raw = Number((event.target as HTMLInputElement).value)
  let next = Number.isFinite(raw) ? raw : props.modelValue
  next = Math.min(props.max, Math.max(props.min, next))
  if (props.integer) next = Math.round(next)
  emit('update:modelValue', next)
  emit('editEnd')
}
</script>

<template>
  <label class="block min-w-0">
    <span class="field-label">{{ label }}</span>
    <input
      class="field"
      type="number"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      @focus="emit('editStart')"
      @blur="onBlur"
      @input="onInput"
    />
  </label>
</template>
