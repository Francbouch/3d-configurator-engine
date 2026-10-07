function conditionMatches(condition, selected) {
  if (!condition) return true

  const value = selected[condition.group]

  switch (condition.operator) {
    case 'in':
      return (condition.values ?? []).includes(value)
    case 'notIn':
      return !(condition.values ?? []).includes(value)
    case 'equals':
      return value === condition.value
    case 'notEquals':
      return value !== condition.value
    default:
      return false
  }
}

function resolveAllowedIds(rule, selected) {
  const ids = new Set(rule.allow?.materialIds ?? [])

  ;(rule.allow?.selectedFromGroups ?? []).forEach((groupId) => {
    const selectedId = selected[groupId]
    if (selectedId) ids.add(selectedId)
  })

  return ids
}

export function getAllowedMaterials({
  groupId,
  selected,
  materials,
  rules = [],
}) {
  const activeRules = rules.filter(
    (rule) =>
      rule.enabled !== false &&
      rule.targetGroup === groupId &&
      conditionMatches(rule.when, selected),
  )

  if (activeRules.length === 0) return materials

  return materials.filter((material) =>
    activeRules.every((rule) => resolveAllowedIds(rule, selected).has(material.id)),
  )
}

export function validateSelection({
  groupId,
  materialId,
  selected,
  materials,
  rules = [],
}) {
  return getAllowedMaterials({ groupId, selected, materials, rules })
    .some((material) => material.id === materialId)
}


function blockMaterialIds(block) {
  if (Array.isArray(block?.materialIds)) return block.materialIds
  return block?.materialId ? [block.materialId] : []
}

export function getRuleGraphAllowedMaterials({
  groupId,
  selected = {},
  materials = [],
  ruleGraph,
  activeCauseGroupId = null,
}) {
  // Default selections initialize the furniture visually, but they are not
  // user actions and must never trigger Cause -> Effect restrictions.
  if (!activeCauseGroupId) return materials

  const blocks = Array.isArray(ruleGraph?.blocks) ? ruleGraph.blocks : []
  const connections = Array.isArray(ruleGraph?.connections) ? ruleGraph.connections : []
  if (!blocks.length || !connections.length) return materials

  const blockById = new Map(blocks.map((block) => [block.id, block]))
  const activeAllowedIds = new Set()
  let hasActiveRestriction = false

  connections.forEach((connection) => {
    const cause = blockById.get(connection.causeId)
    const effect = blockById.get(connection.effectId)
    if (!cause || !effect || cause.type !== 'cause' || effect.type !== 'effect') return
    if (!(effect.groupIds ?? []).includes(groupId)) return

    // Cause blocks intentionally use one group. Reading the first item also
    // keeps older saved graphs compatible if they still contain several.
    const causeGroupId = (cause.groupIds ?? [])[0]
    if (!causeGroupId || causeGroupId !== activeCauseGroupId) return

    const selectedCauseMaterial = selected[causeGroupId]
    const triggerIds = blockMaterialIds(cause)
    if (!selectedCauseMaterial || !triggerIds.includes(selectedCauseMaterial)) return

    hasActiveRestriction = true
    blockMaterialIds(effect).forEach((materialId) => {
      if (materialId === '__cause_material__') {
        activeAllowedIds.add(selectedCauseMaterial)
      } else {
        activeAllowedIds.add(materialId)
      }
    })
  })

  // No connected Cause is currently active: do not restrict the group at all.
  if (!hasActiveRestriction) return materials

  // Several active Causes use UNION semantics.
  return materials.filter((material) => activeAllowedIds.has(material.id))
}
