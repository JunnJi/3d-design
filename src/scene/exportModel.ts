import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { cornerToThree } from '@/domain/geometry'
import type { Persisted } from '@/domain/types'
import { buildFloor, buildObject } from './build'

/** 用和设计器相同的建模逻辑导出 GLB，原点在地面中心。 */
export async function exportPersistedGlb(state: Persisted): Promise<ArrayBuffer> {
  const root = new THREE.Group()
  root.name = 'warehouse'
  root.add(buildFloor(state.floor))
  for (const obj of state.objects) {
    const group = buildObject(obj, { preview: false, showSlots: false })
    const at = cornerToThree(obj.position, state.floor)
    group.position.set(at.x, at.y, at.z)
    group.rotation.y = (obj.rotationY * Math.PI) / 180
    root.add(group)
  }
  replaceSpritesWithPlanes(root)
  root.updateMatrixWorld(true)
  try {
    return await encodeGlb(root)
  } finally {
    disposeObject(root, true)
  }
}

/** 导出当前场景根节点；Sprite 会转成可进 GLB 的平面标注。 */
export async function exportRootGlb(root: THREE.Object3D): Promise<ArrayBuffer> {
  const clone = root.clone(true)
  const created = replaceSpritesWithPlanes(clone)
  clone.updateMatrixWorld(true)
  try {
    return await encodeGlb(clone)
  } finally {
    // clone 与场景共享 geometry / 贴图，只释放本次新建的标注平面
    for (const plane of created) {
      plane.geometry.dispose()
      const material = plane.material
      if (Array.isArray(material)) material.forEach((item) => item.dispose())
      else material.dispose()
    }
  }
}

async function encodeGlb(root: THREE.Object3D) {
  const result = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true })
  if (!(result instanceof ArrayBuffer)) throw new Error('模型导出失败')
  return result
}

/**
 * GLTF 不支持 Sprite。转成带贴图的平面，并打上 billboard 标记，
 * 看板加载后按相机朝向即可对齐设计器里的标注效果。
 */
export function replaceSpritesWithPlanes(root: THREE.Object3D) {
  const sprites: THREE.Sprite[] = []
  const created: THREE.Mesh[] = []
  root.traverse((node) => {
    if ((node as THREE.Sprite).isSprite) sprites.push(node as THREE.Sprite)
  })
  for (const sprite of sprites) {
    const parent = sprite.parent
    if (!parent) continue
    const map = sprite.material.map
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    )
    plane.name = sprite.name || 'label'
    plane.position.copy(sprite.position)
    plane.rotation.copy(sprite.rotation)
    plane.scale.copy(sprite.scale)
    plane.renderOrder = sprite.renderOrder || 2
    plane.userData.billboard = true
    parent.add(plane)
    parent.remove(sprite)
    created.push(plane)
  }
  return created
}

function disposeObject(root: THREE.Object3D, disposeMaps: boolean) {
  root.traverse((node) => {
    if (node instanceof THREE.Mesh || node instanceof THREE.LineSegments || node instanceof THREE.Sprite) {
      node.geometry?.dispose()
      const material = node.material
      if (Array.isArray(material)) material.forEach((item) => disposeMaterial(item, disposeMaps))
      else if (material) disposeMaterial(material, disposeMaps)
    }
  })
}

function disposeMaterial(material: THREE.Material, disposeMaps: boolean) {
  if (disposeMaps) {
    const mapped = material as THREE.MeshBasicMaterial & { map?: THREE.Texture | null }
    mapped.map?.dispose()
  }
  material.dispose()
}
