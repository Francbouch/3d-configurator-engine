function adjustmentMatches(adjustment, configuration) {
  if (adjustment.enabled === false) return false
  const when = adjustment.when
  if (!when) return true

  const value = configuration[when.group]
  switch (when.operator) {
    case 'equals': return value === when.value
    case 'notEquals': return value !== when.value
    case 'in': return (when.values ?? []).includes(value)
    case 'notIn': return !(when.values ?? []).includes(value)
    default: return false
  }
}

export function calculatePrice(pricing, configuration = {}, modules = [], selectedModules = {}) {
  const basePrice = Number(pricing?.basePrice ?? 0)
  const adjustments = (pricing?.adjustments ?? [])
    .filter((adjustment) => adjustmentMatches(adjustment, configuration))
    .map((adjustment) => ({
      id: adjustment.id,
      label: adjustment.label,
      amount: Number(adjustment.amount ?? 0),
    }))

  const moduleAdjustments = modules
    .filter((module) => module.enabled !== false && selectedModules[module.id])
    .map((module) => ({
      id: `module:${module.id}`,
      label: module.name,
      amount: Number(module.price ?? 0),
    }))

  const allAdjustments = [...adjustments, ...moduleAdjustments]

  return {
    currency: pricing?.currency ?? 'CAD',
    basePrice,
    adjustments: allAdjustments,
    total: allAdjustments.reduce((total, item) => total + item.amount, basePrice),
  }
}
