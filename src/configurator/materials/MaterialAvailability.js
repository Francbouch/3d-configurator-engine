import { getAllowedMaterials, getRuleGraphAllowedMaterials } from '../rules/RulesEngine'

export function getGroupMaterials({
  product,
  groupId,
  selected = {},
  materials = [],
}) {
  const activeMaterials = materials.filter((material) => material.active !== false)
  const group = product.materialGroups?.[groupId]
  if (!group) return activeMaterials

  // Dynamic back-office groups expose every active material by default.
  // A ruleGraph restriction is applied only when a connected cause is active.
  if (product.ruleGraph) {
    return getRuleGraphAllowedMaterials({
      groupId,
      selected,
      materials: activeMaterials,
      ruleGraph: product.ruleGraph,
    })
  }

  // Legacy/static product configuration keeps its older collection/rule behavior.
  const collectionIds = group.allowedCollectionIds ?? []
  let candidates = activeMaterials

  if (collectionIds.length) {
    const allowedIds = new Set(
      (product.materialCollections ?? [])
        .filter((collection) => collectionIds.includes(collection.id))
        .flatMap((collection) => collection.materialIds ?? []),
    )
    candidates = activeMaterials.filter((material) => allowedIds.has(material.id))
  }

  return getAllowedMaterials({
    groupId,
    selected,
    materials: candidates,
    rules: product.rules ?? [],
  })
}

export function isMaterialAvailable(args, materialId) {
  return getGroupMaterials(args).some((material) => material.id === materialId)
}
