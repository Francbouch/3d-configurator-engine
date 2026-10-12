export function buildMaterialLibrary(root) {
  const library = new Map()

  root.traverse((object) => {
    if (!object.isMesh || !object.material) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]

    materials.forEach((material) => {
      if (!material?.name || library.has(material.name)) return
      library.set(material.name, material)
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

  // Published mappings can include a scene-root segment that differs between
  // Blender exports and GLTFLoader's cloned scene. Resolve the exact path first,
  // then match the trailing mesh/node name without modifying stored mappings.
  const path = part.meshPath ?? part.nodePath
  const exact = findByPath(root, path)
  if (exact) return exact
  const trailingName = typeof path === 'string' ? path.split('/').filter(Boolean).pop() : null
  return (part.node && root.getObjectByName(part.node))
    || (trailingName && root.getObjectByName(trailingName))
    || null
}

function assignMaterial(mesh, part, material) {
  if (!mesh?.isMesh) return false

  // Only swap the material. Geometry/UV attributes from the product GLB remain untouched.
  const slot = Number(part?.materialIndex)
  if (Array.isArray(mesh.material) && Number.isInteger(slot) && slot >= 0 && slot < mesh.material.length) {
    const next = [...mesh.material]
    next[slot] = material
    mesh.material = next
  } else {
    mesh.material = material
  }
  return true
}

export function applyMaterialToParts(root, parts, material) {
  const targets = Array.isArray(parts) ? parts : [parts]
  let applied = false

  targets.forEach((part) => {
    const target = resolvePart(root, part)
    if (!target) return

    if (target.isMesh) {
      applied = assignMaterial(target, part, material) || applied
      return
    }

    target.traverse((object) => {
      if (!object.isMesh) return
      applied = assignMaterial(object, part, material) || applied
    })
  })

  return applied
}

export function applyMaterialToUngroupedParts(root, parts, material) {
  const ungrouped = (parts ?? []).filter((part) => !part.group)
  return applyMaterialToParts(root, ungrouped, material)
}
