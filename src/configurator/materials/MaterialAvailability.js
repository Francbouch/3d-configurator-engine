import { getAllowedMaterials, getRuleGraphAllowedMaterials } from '../rules/RulesEngine'

export function getGroupMaterials({
  product,
  groupId,
  selected = {},
  materials = [],
}) {
  const activeMaterials = materials.filter((material) => material.active !== false)
  const group = product.materialGroups?.[groupId]
  if (!group) return []

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

  const legacyAllowed = getAllowedMaterials({
    groupId,
    selected,
    materials: candidates,
    rules: product.rules ?? [],
  })

  return getRuleGraphAllowedMaterials({
    groupId,
    selected,
    materials: legacyAllowed,
    ruleGraph: product.ruleGraph,
  })
}

export function isMaterialAvailable(args, materialId) {
  return getGroupMaterials(args).some((material) => material.id === materialId)
}
