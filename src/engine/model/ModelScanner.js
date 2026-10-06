function materialSlots(object) {
  if (!object?.material) return []
  const materials = Array.isArray(object.material) ? object.material : [object.material]
  const groups = Array.isArray(object.geometry?.groups) ? object.geometry.groups : []
  if (groups.length) {
    return [...new Set(groups.map((group) => group.materialIndex ?? 0))].map((materialIndex) => ({
      materialIndex,
      materialName: materials[materialIndex]?.name || `Matériau ${materialIndex + 1}`,
    }))
  }
  return materials.filter(Boolean).map((material, materialIndex) => ({
    materialIndex,
    materialName: material.name || `Matériau ${materialIndex + 1}`,
  }))
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
      materialNames: materialSlots(object).map((slot) => slot.materialName),
      materialSlots: materialSlots(object),
      childCount: object.children.length,
    })
  })

  return {
    nodeCount: nodes.length,
    meshCount: nodes.filter((node) => node.isMesh).length,
    partCount: nodes.filter((node) => node.isMesh).reduce((total, node) => total + Math.max(node.materialSlots?.length ?? 0, 1), 0),
    nodes,
  }
}

export function getEditableCandidates(scan) {
  return scan.nodes.filter((node) => node.isMesh).flatMap((node) => {
    const slots = node.materialSlots?.length ? node.materialSlots : [{ materialIndex: 0, materialName: node.materialNames?.[0] || 'Sans matériau' }]
    return slots.map((slot) => ({
      ...node,
      path: `${node.path}::material:${slot.materialIndex}`,
      meshPath: node.path,
      materialIndex: slot.materialIndex,
      materialName: slot.materialName,
      materialNames: [slot.materialName],
    }))
  })
}
