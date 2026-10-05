const FURNITURE_MIN_ROUGHNESS = 0.62

function prepareFurnitureMaterial(source) {
  const material = source.clone()

  if ('roughness' in material && (material.metalness ?? 0) < 0.5) {
    material.roughness = Math.max(material.roughness ?? 0.5, FURNITURE_MIN_ROUGHNESS)
  }

  material.needsUpdate = true
  return material
}

export function buildMaterialLibrary(root) {
  const library = new Map()

  root.traverse((object) => {
    if (!object.isMesh || !object.material) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      if (material?.name && !library.has(material.name)) {
        library.set(material.name, prepareFurnitureMaterial(material))
      }
    })
  })

  return library
}

export function applyMaterialToParts(root, partNames, material) {
  const names = Array.isArray(partNames) ? partNames : [partNames]
  let applied = false

  names.forEach((partName) => {
    const target = root.getObjectByName(partName)
    if (!target) return

    target.traverse((object) => {
      if (!object.isMesh) return
      object.material = material.clone()
      object.material.needsUpdate = true
      applied = true
    })
  })

  return applied
}
