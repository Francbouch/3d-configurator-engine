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
      object.material = material
      applied = true
    })
  })

  return applied
}
