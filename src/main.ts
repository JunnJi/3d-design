import { createApp } from 'vue'
import 'virtual:uno.css'
import App from './App.vue'
import { toExportFile } from './io'
import { doc, ui } from './store'

if (import.meta.env.DEV) {
  Object.assign(window, { __designer: { doc, ui, toExportFile } })
}

createApp(App).mount('#app')
