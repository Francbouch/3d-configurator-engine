function materialNames(object) {
  if (!object?.material) return []
  const materials = Array.isArray(object.material) ? object.material : [object.material]
  return materials.filter(Boolean).map((material) => material.name || null)
}

function nodePath(object, root) {
  const parts = []
  let current = object
  while (current && current !== root) {
    parts.unshift(current.name || current.type)
    current = current.parent
  }
  return parts.join('/')
}

export function scanModel(root) {
  const nodes = []

  root.traverse((object) => {
    if (object === root) return

    nodes.push({
      id: object.uuid,
      name: object.name || '',
      type: object.type,
      path: nodePath(object, root),
      parentName: object.parent && object.parent !== root ? object.parent.name || null : null,
      isMesh: Boolean(object.isMesh),
      isBone: Boolean(object.isBone),
      visible: object.visible,
      materialNames: materialNames(object),
      childCount: object.children.length,
    })
  })

  return {
    nodeCount: nodes.length,
    meshCount: nodes.filter((node) => node.isMesh).length,
    nodes,
  }
}

export function getEditableCandidates(scan) {
  return scan.nodes.filter((node) => node.isMesh)
}
