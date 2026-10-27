import type { Projection, Vec3 } from './types'

export interface CameraShot {
  projection: Projection
  position: Vec3
  target: Vec3
}

interface ViewportBridge {
  exportGlb: () => Promise<ArrayBuffer>
  capture: () => CameraShot
  fit: () => void
}

let current: ViewportBridge | null = null

export function bindViewport(bridge: ViewportBridge) {
  current = bridge
  return () => {
    if (current === bridge) current = null
  }
}

export function viewportExportGlb() {
  return current?.exportGlb() ?? null
}

export function viewportCapture() {
  return current?.capture() ?? null
}

export function viewportFit() {
  current?.fit()
}
