import * as THREE from 'three'

export function concreteTexture(width: number, depth: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)
  const gradient = ctx.createLinearGradient(0, 0, 512, 512)
  gradient.addColorStop(0, '#cfd5dd')
  gradient.addColorStop(0.5, '#d8dde4')
  gradient.addColorStop(1, '#c7ced7')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 512, 512)
  for (let index = 0; index < 1800; index += 1) {
    const shade = 90 + Math.random() * 70
    ctx.fillStyle = `rgba(${shade}, ${shade + 4}, ${shade + 8}, 0.05)`
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2)
  }
  ctx.strokeStyle = 'rgba(78, 88, 102, 0.14)'
  ctx.lineWidth = 4
  ctx.strokeRect(3, 3, 506, 506)
  ctx.strokeStyle = 'rgba(120, 132, 148, 0.08)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(256, 8)
  ctx.lineTo(256, 504)
  ctx.moveTo(8, 256)
  ctx.lineTo(504, 256)
  ctx.stroke()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(Math.max(width / 4.5, 1), Math.max(depth / 4.5, 1))
  texture.anisotropy = 8
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
  ctx.fillStyle = '#f0c94d'
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
