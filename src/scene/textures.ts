import * as THREE from 'three'

export function concreteTexture(width: number, depth: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)
  ctx.fillStyle = '#d5d8de'
  ctx.fillRect(0, 0, 256, 256)
  for (let index = 0; index < 900; index += 1) {
    const shade = 70 + Math.random() * 50
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.08)`
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
  }
  ctx.strokeStyle = 'rgba(70, 76, 88, 0.16)'
  ctx.lineWidth = 3
  ctx.strokeRect(1.5, 1.5, 253, 253)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(Math.max(width / 4, 1), Math.max(depth / 4, 1))
  texture.anisotropy = 4
  return texture
}

export function hazardTexture(length: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)
  ctx.fillStyle = '#16181d'
  ctx.fillRect(0, 0, 128, 32)
  ctx.fillStyle = '#f5c400'
  ctx.beginPath()
  for (let start = -32; start < 160; start += 32) {
    ctx.moveTo(start, 32)
    ctx.lineTo(start + 16, 0)
    ctx.lineTo(start + 32, 0)
    ctx.lineTo(start + 16, 32)
  }
  ctx.fill()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.repeat.set(Math.max(length / 0.8, 1), 1)
  return texture
}
