const DEFAULT_FURNITURE_PROFILE = Object.freeze({
  minRoughness: 0.62,
  envMapIntensity: 0.72,
  metalness: 0,
  clearcoatMax: 0.08,
})

function normalizeFurnitureMaterial(source, profile = DEFAULT_FURNITURE_PROFILE) {
  const material = source.clone()
  // The master GLB is the source of truth for all texture/UV data.
  // Never replace, rescale, repeat, rotate, offset or regenerate its maps.
  const sourceMaps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']
  sourceMaps.forEach((key) => {
    if (source[key]) material[key] = source[key]
  })

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
  if ('clearcoat' in material) {
    material.clearcoat = Math.min(material.clearcoat ?? 0, profile.clearcoatMax)
  }
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

      const masterMaterial = normalizeFurnitureMaterial(material, profile)
      masterMaterial.userData = {
        ...masterMaterial.userData,
        masterGlbMaterial: true,
        masterGlbMaterialName: material.name,
      }
      library.set(material.name, masterMaterial)
    })
  })

  return library
}

function findByPath(root, path) {
  if (!path) return null
  const segments = path.split('/').filter(Boolean)
  let current = root

  for (const segment of segments) {
    current = current.children.find((child) => (child.name || child.type) === segment)
    if (!current) return null
  }

  return current
}

function resolvePart(root, part) {
  if (typeof part === 'string') return root.getObjectByName(part)
  if (!part) return null
  return findByPath(root, part.nodePath) ?? root.getObjectByName(part.node)
}

export function applyMaterialToParts(root, parts, material) {
  const targets = Array.isArray(parts) ? parts : [parts]
  let applied = false

  targets.forEach((part) => {
    const target = resolvePart(root, part)
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
