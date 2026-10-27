import { SCENE_FORMAT, SCENE_VERSION, createDemo } from '../catalog'
import { collectSlots, round3 } from '../geometry'
import { exportPersistedGlb } from '../scene/exportModel'
import type { SlotRecord } from '../types'
import { zipFiles, type ZipEntry } from './zip'

export type ExampleKind = 'vue' | 'react'

type TextFile = { path: string; text: string }

const viewer = `import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export type Vec3 = { x: number; y: number; z: number }

export type WarehouseFile = {
  meta: { name: string }
  floor: { width: number; depth: number; height: number; color: string }
  slots: Array<{
    code: string
    position: Vec3
    size: { length: number; depth: number; height: number }
  }>
}

export function cornerToThree(position: Vec3, floor: { width: number; depth: number }) {
  return {
    x: position.x - floor.width / 2,
    y: position.y,
    z: position.z - floor.depth / 2,
  }
}

const STATUS = ['#6b7280', '#7eb6ff', '#f0b429', '#3cba8b', '#e85d4c']

function statusColor(code: string) {
  let hash = 2166136261
  for (const char of code) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return STATUS[(hash >>> 0) % STATUS.length]
}

/** 优先加载设计器同款 GLB；库位货物叠在模型上。光照与设计器对齐。 */
export async function mountWarehouse(host: HTMLElement, file: WarehouseFile): Promise<() => void> {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500)
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.18
  host.appendChild(renderer.domElement)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environment
  scene.environmentIntensity = 0.72
  pmrem.dispose()

  const floor = file.floor
  const dist = Math.max(floor.width, floor.depth)
  const bg = 0x0a0f14
  scene.background = new THREE.Color(bg)
  scene.fog = new THREE.Fog(bg, dist * 1.35, dist * 3.4)

  const hemi = new THREE.HemisphereLight(0xeaf2f8, 0x2a3340, 0.82)
  const sun = new THREE.DirectionalLight(0xfff6ea, 1.65)
  sun.position.set(dist * 0.62, dist * 0.72, dist * 0.22)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.radius = 2.2
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02
  const shadow = sun.shadow.camera
  shadow.left = -dist
  shadow.right = dist
  shadow.top = dist
  shadow.bottom = -dist
  shadow.near = 0.5
  shadow.far = dist * 3
  shadow.updateProjectionMatrix()
  const fill = new THREE.DirectionalLight(0xb9d0e8, 0.38)
  fill.position.set(-16, 12, -10)
  const rim = new THREE.DirectionalLight(0x9fd7d0, 0.22)
  rim.position.set(4, 10, -22)
  scene.add(hemi, sun, sun.target, fill, rim)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  const billboards: THREE.Object3D[] = []
  let modelLoaded = false
  try {
    const gltf = await new GLTFLoader().loadAsync('/warehouse.glb')
    gltf.scene.traverse((node) => {
      if (node.userData?.billboard) {
        billboards.push(node)
        return
      }
      const mesh = node as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    scene.add(gltf.scene)
    modelLoaded = true
  } catch {
    // Demo 包应自带 warehouse.glb；缺失时退回简单地面。
  }

  if (!modelLoaded) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(floor.width, 0.12, floor.depth),
      new THREE.MeshStandardMaterial({ color: floor.color, roughness: 0.92 }),
    )
    slab.position.y = -0.06
    slab.receiveShadow = true
    scene.add(slab)
  }

  for (const slot of file.slots) {
    const at = cornerToThree(slot.position, floor)
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(slot.size.length * 0.62, Math.min(slot.size.height * 0.45, 0.7), slot.size.depth * 0.55),
      new THREE.MeshStandardMaterial({ color: statusColor(slot.code), roughness: 0.5 }),
    )
    box.position.set(at.x, at.y + 0.15, at.z)
    box.name = slot.code
    box.castShadow = true
    scene.add(box)
  }

  camera.position.set(dist * 0.58, dist * 0.4, dist * 0.52)
  controls.target.set(0, 0.8, 0)
  controls.update()

  const resize = () => {
    const width = Math.max(host.clientWidth, 1)
    const height = Math.max(host.clientHeight, 1)
    renderer.setSize(width, height, false)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  let frameId = 0
  const frame = () => {
    for (const label of billboards) label.quaternion.copy(camera.quaternion)
    controls.update()
    renderer.render(scene, camera)
    frameId = requestAnimationFrame(frame)
  }
  frame()

  return () => {
    cancelAnimationFrame(frameId)
    observer.disconnect()
    controls.dispose()
    environment.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }
}
`

const vueApp = `<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { mountWarehouse, type WarehouseFile } from './warehouse'

const host = ref<HTMLElement | null>(null)
const title = ref('库房看板')
let stop = () => {}

onMounted(async () => {
  const file = (await fetch('/warehouse.json').then((response) => response.json())) as WarehouseFile
  title.value = file.meta.name
  if (host.value) stop = await mountWarehouse(host.value, file)
})

onBeforeUnmount(() => stop())
</script>

<template>
  <main class="page">
    <header>
      <strong>{{ title }}</strong>
      <span>模型来自设计器同款 GLB · 可替换 public 目录</span>
    </header>
    <div ref="host" class="view"></div>
  </main>
</template>

<style>
html, body, #app, .page { height: 100%; margin: 0; }
.page { display: flex; flex-direction: column; background: #10141c; color: #f4f7fb; font: 16px/1.5 "PingFang SC", sans-serif; }
header { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 14px 18px; }
header span { color: #c5cedd; font-size: 14px; }
.view { flex: 1; min-height: 0; }
</style>
`

const reactApp = `import { useEffect, useRef, useState } from 'react'
import { mountWarehouse, type WarehouseFile } from './warehouse'

export default function App() {
  const host = useRef<HTMLDivElement | null>(null)
  const [title, setTitle] = useState('库房看板')

  useEffect(() => {
    let stop = () => {}
    let alive = true
    fetch('/warehouse.json')
      .then((response) => response.json())
      .then(async (file: WarehouseFile) => {
        if (!alive || !host.current) return
        setTitle(file.meta.name)
        stop = await mountWarehouse(host.current, file)
      })
    return () => {
      alive = false
      stop()
    }
  }, [])

  return (
    <main className="page">
      <header>
        <strong>{title}</strong>
        <span>模型来自设计器同款 GLB · 可替换 public 目录</span>
      </header>
      <div ref={host} className="view" />
    </main>
  )
}
`

const reactCss = `html, body, #root, .page { height: 100%; margin: 0; }
.page { display: flex; flex-direction: column; background: #10141c; color: #f4f7fb; font: 16px/1.5 "PingFang SC", sans-serif; }
header { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 14px 18px; }
header span { color: #c5cedd; font-size: 14px; }
.view { flex: 1; min-height: 0; }
`

const readme = `# 库房看板 Demo

TypeScript 示例：加载设计器同款 \`warehouse.json\` + \`warehouse.glb\`，再按库位叠放货物。

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

\`public/\` 已自带示例成品库的 JSON 和 GLB（与设计器同一套建模）。要换成自己的场景，用设计器导出后替换这两个文件即可。

JSON 原点在地面西南角。示例里的 \`cornerToThree\` 会把它平移到 three.js 的地面中心（与 GLB 一致）。
`

const vueTsconfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]
}
`

const reactTsconfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "vite.config.ts"]
}
`

const vueEnv = `/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
`

export function exampleEntry(kind: ExampleKind) {
  return kind === 'vue' ? vueApp : reactApp
}

export async function exampleZip(kind: ExampleKind): Promise<Blob> {
  const root = kind === 'vue' ? 'warehouse-dashboard-vue' : 'warehouse-dashboard-react'
  const textFiles = kind === 'vue' ? vueFiles() : reactFiles()
  const glb = await exportPersistedGlb(createDemo())
  const entries: ZipEntry[] = [
    ...textFiles.map((file) => ({ path: `${root}/${file.path}`, text: file.text })),
    { path: `${root}/public/warehouse.glb`, data: new Uint8Array(glb) },
  ]
  return zipFiles(entries)
}

export async function downloadExample(kind: ExampleKind) {
  const blob = await exampleZip(kind)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = kind === 'vue' ? 'warehouse-dashboard-vue.zip' : 'warehouse-dashboard-react.zip'
  link.click()
  URL.revokeObjectURL(url)
}

function vueFiles(): TextFile[] {
  return [
    { path: 'package.json', text: vuePackage },
    { path: 'tsconfig.json', text: vueTsconfig },
    { path: 'vite.config.ts', text: vueVite },
    { path: 'index.html', text: html('/src/main.ts', '库房看板 Vue Demo') },
    { path: 'README.md', text: readme },
    { path: '.gitignore', text: gitignore },
    { path: 'src/vite-env.d.ts', text: vueEnv },
    { path: 'src/main.ts', text: "import { createApp } from 'vue'\nimport App from './App.vue'\n\ncreateApp(App).mount('#app')\n" },
    { path: 'src/App.vue', text: vueApp },
    { path: 'src/warehouse.ts', text: viewer },
    { path: 'public/warehouse.json', text: demoWarehouseText() },
  ]
}

function reactFiles(): TextFile[] {
  return [
    { path: 'package.json', text: reactPackage },
    { path: 'tsconfig.json', text: reactTsconfig },
    { path: 'vite.config.ts', text: reactVite },
    { path: 'index.html', text: html('/src/main.tsx', '库房看板 React Demo') },
    { path: 'README.md', text: readme },
    { path: '.gitignore', text: gitignore },
    { path: 'src/main.tsx', text: "import { createRoot } from 'react-dom/client'\nimport App from './App'\nimport './index.css'\n\ncreateRoot(document.getElementById('root')!).render(<App />)\n" },
    { path: 'src/App.tsx', text: reactApp },
    { path: 'src/index.css', text: reactCss },
    { path: 'src/warehouse.ts', text: viewer },
    { path: 'public/warehouse.json', text: demoWarehouseText() },
  ]
}

const vuePackage = `{
  "name": "warehouse-dashboard-vue",
  "private": true,
  "packageManager": "pnpm@10.33.2",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "three": "^0.186.1",
    "vue": "^3.5.22"
  },
  "devDependencies": {
    "@types/three": "^0.186.0",
    "@vitejs/plugin-vue": "^6.0.1",
    "typescript": "~5.9.0",
    "vite": "^8.0.0",
    "vue-tsc": "^3.0.0"
  }
}
`

const reactPackage = `{
  "name": "warehouse-dashboard-react",
  "private": true,
  "packageManager": "pnpm@10.33.2",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "three": "^0.186.1"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@types/three": "^0.186.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "~5.9.0",
    "vite": "^8.0.0"
  }
}
`

const vueVite = `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})
`

const reactVite = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`

const gitignore = `node_modules
dist
package-lock.json
yarn.lock
.DS_Store
`

function html(entry: string, title: string) {
  const mountId = entry.includes('main.tsx') || entry.includes('main.jsx') ? 'root' : 'app'
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="${mountId}"></div>
    <script type="module" src="${entry}"></script>
  </body>
</html>
`
}

function demoWarehouseText() {
  const state = createDemo()
  const slots = collectSlots(state.objects).map(roundSlot)
  const count = (type: string) => state.objects.filter((item) => item.type === type).length
  return JSON.stringify(
    {
      format: SCENE_FORMAT,
      version: SCENE_VERSION,
      unit: 'm',
      origin: 'corner',
      generator: 'warehouse-designer',
      exportedAt: new Date().toISOString(),
      ...state,
      slots,
      stats: {
        racks: count('rack'),
        slots: slots.length,
        zones: count('zone'),
        walls: count('wall'),
        doors: count('door'),
        docks: count('dock'),
      },
    },
    null,
    2,
  )
}

function roundSlot(slot: SlotRecord): SlotRecord {
  return {
    ...slot,
    position: { x: round3(slot.position.x), y: round3(slot.position.y), z: round3(slot.position.z) },
    size: { length: round3(slot.size.length), depth: round3(slot.size.depth), height: round3(slot.size.height) },
  }
}
