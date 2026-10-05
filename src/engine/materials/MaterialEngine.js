import * as THREE from 'three'

export function createMaterial(definition) {
  return new THREE.MeshStandardMaterial({
    color: definition.color ?? '#ffffff',
    roughness: definition.roughness ?? 0.5,
    metalness: definition.metalness ?? 0,
  })
}

export function applyMaterialToPart(root, partName, material) {
  const target = root.getObjectByName(partName)
  if (!target) return false

  target.traverse((object) => {
    if (object.isMesh) object.material = material
  })

  return true
}
