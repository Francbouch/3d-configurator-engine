const DEFAULT_FURNITURE_PROFILE = Object.freeze({
  minRoughness: 0.62,
  envMapIntensity: 0.72,
  metalness: 0,
})

function normalizeFurnitureMaterial(source, profile = DEFAULT_FURNITURE_PROFILE) {
  const material = source.clone()

  // Furniture finishes are treated as dielectric surfaces by default.
  if ('metalness' in material && (material.metalness ?? 0) < 0.5) {
    material.metalness = profile.metalness
  }

  if ('roughness' in material && (material.metalness ?? 0) < 0.5) {
    material.roughness = Math.max(
      material.roughness ?? profile.minRoughness,
      profile.minRoughness
    )
  }

  // Keep studio reflections realistic without allowing the environment
  // to overpower the material's base colour and texture.
  if ('envMapIntensity' in material) {
    material.envMapIntensity = profile.envMapIntensity
  }

  // Normalize optional physical lobes when a GLB exports MeshPhysicalMaterial.
  if ('clearcoat' in material) material.clearcoat = Math.min(material.clearcoat ?? 0, 0.08)
  if ('clearcoatRoughness' in material) {
    material.clearcoatRoughness = Math.max(material.clearcoatRoughness ?? 0.6, 0.6)
  }

  material.userData = {
    ...material.userData,
    configuratorMaterialProfile: { ...profile },
  }
  material.needsUpdate = true
  return material
}

export function buildMaterialLibrary(root, materialProfiles = {}) {
  const library = new Map()

  root.traverse((object) => {
    if (!object.isMesh || !object.material) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]

    materials.forEach((material) => {
      if (!material?.name || library.has(material.name)) return

      const profile = {
        ...DEFAULT_FURNITURE_PROFILE,
        ...(materialProfiles[material.name] ?? {}),
      }

      library.set(material.name, normalizeFurnitureMaterial(material, profile))
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
