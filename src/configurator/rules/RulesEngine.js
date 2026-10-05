function conditionMatches(condition, selected) {
  if (!condition) return true

  const value = selected[condition.group]

  switch (condition.operator) {
    case 'in':
      return condition.values.includes(value)
    case 'notIn':
      return !condition.values.includes(value)
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
