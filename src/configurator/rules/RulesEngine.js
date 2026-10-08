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
  const causesByEffect = new Map()

  // Gather every Cause connected to each Effect targeting this group.
  connections.forEach((connection) => {
    const cause = blockById.get(connection.causeId)
    const effect = blockById.get(connection.effectId)
    if (!cause || !effect || cause.type !== 'cause' || effect.type !== 'effect') return
    if (!(effect.groupIds ?? []).includes(groupId)) return

    const causeGroupId = (cause.groupIds ?? [])[0]
    if (!causeGroupId) return
    if (!causesByEffect.has(effect.id)) causesByEffect.set(effect.id, { effect, causes: [] })
    causesByEffect.get(effect.id).causes.push({ cause, causeGroupId })
  })

  const activeAllowedIds = new Set()
  let hasActiveRestriction = false

  causesByEffect.forEach(({ effect, causes }) => {
    // All connected Causes must match (AND). Material choices inside a
    // single Cause remain alternatives (OR).
    if (!causes.some(({ causeGroupId }) => causeGroupId === activeCauseGroupId)) return
    if (!causes.every(({ cause, causeGroupId }) => {
      const chosenMaterial = selected[causeGroupId]
      return Boolean(chosenMaterial) && blockMaterialIds(cause).includes(chosenMaterial)
    })) return

    hasActiveRestriction = true
    blockMaterialIds(effect).forEach((materialId) => {
      if (materialId === '__cause_material__') {
        causes.forEach(({ causeGroupId }) => {
          const chosenMaterial = selected[causeGroupId]
          if (chosenMaterial) activeAllowedIds.add(chosenMaterial)
        })
      } else {
        activeAllowedIds.add(materialId)
      }
    })
  })

  // No fully matched set of Causes: leave materials unrestricted.
  if (!hasActiveRestriction) return materials

  // Keep existing UNION behavior between distinct active Effect blocks.
  return materials.filter((material) => activeAllowedIds.has(material.id))
}
