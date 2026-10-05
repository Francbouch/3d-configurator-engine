import { scanModel, getEditableCandidates } from './ModelScanner'

export function buildProductMappingDraft(root) {
  const scan = scanModel(root)

  return {
    scan,
    parts: getEditableCandidates(scan).map((node) => ({
      node: node.name,
      nodePath: node.path,
      group: null,
      materialEditable: false,
      sourceMaterials: node.materialNames,
    })),
  }
}

export function validateProductMapping(mapping) {
  const errors = []
  const editable = mapping.parts.filter((part) => part.materialEditable)

  editable.forEach((part) => {
    if (!part.group) errors.push(`Editable part "${part.node || part.nodePath}" has no semantic group.`)
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}
