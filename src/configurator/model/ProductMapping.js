import { scanModel, getEditableCandidates } from '../../engine/model/ModelScanner'

function findExistingPart(node, existingParts = []) {
  return existingParts.find((part) =>
    (part.nodePath && part.nodePath === node.path) ||
    (part.node && part.node === node.name)
  )
}

export function buildProductMappingDraft(root, existingParts = []) {
  const scan = scanModel(root)

  return {
    scan,
    parts: getEditableCandidates(scan).map((node) => {
      const existing = findExistingPart(node, existingParts)

      return {
        node: node.name,
        nodePath: node.path,
        group: existing?.group ?? null,
        materialEditable: existing?.materialEditable === true,
        sourceMaterials: node.materialNames,
      }
    }),
  }
}

export function validateProductMapping(mapping, materialGroups = {}) {
  const errors = []
  const warnings = []
  const editable = (mapping.parts ?? []).filter((part) => part.materialEditable)

  const seenPaths = new Set()

  editable.forEach((part) => {
    const label = part.node || part.nodePath || 'Sans nom'
    const identity = part.nodePath || part.node

    if (!part.group) {
      errors.push(`La pièce modifiable "${label}" n’a aucun groupe sémantique.`)
      return
    }

    if (!materialGroups[part.group]) {
      warnings.push(`Le groupe "${part.group}" de la pièce "${label}" n’existe pas encore dans le produit.`)
    }

    if (identity) {
      if (seenPaths.has(identity)) {
        errors.push(`La pièce "${label}" est mappée plus d’une fois.`)
      }
      seenPaths.add(identity)
    }
  })

  Object.keys(materialGroups).forEach((groupId) => {
    if (!editable.some((part) => part.group === groupId)) {
      warnings.push(`Le groupe "${groupId}" n’a aucune pièce modifiable dans le modèle.`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export function toProductParts(mapping) {
  return (mapping.parts ?? []).map(({ node, nodePath, group, materialEditable }) => ({
    node,
    ...(nodePath ? { nodePath } : {}),
    group: group || null,
    materialEditable: materialEditable === true,
  }))
}
