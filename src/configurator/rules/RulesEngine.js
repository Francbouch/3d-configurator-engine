export function getAllowedMaterials({ part, selected, materials, rules = [] }) {
  const relevantRules = rules.filter((rule) => rule.target === part)
  if (relevantRules.length === 0) return materials

  return materials.filter((material) =>
    relevantRules.every((rule) => {
      if (!rule.when) return true
      const selectedValue = selected[rule.when.part]
      if (!rule.when.materials.includes(selectedValue)) return true
      return rule.allow.includes(material.id)
    }),
  )
}
