import { createApp } from 'vue'
import 'virtual:uno.css'
import App from './App.vue'
import { doc, ui } from '@/domain/store'
import { toExportFile } from '@/io/export'

if (import.meta.env.DEV) {
  Object.assign(window, { __designer: { doc, ui, toExportFile } })
}

createApp(App).mount('#app')
