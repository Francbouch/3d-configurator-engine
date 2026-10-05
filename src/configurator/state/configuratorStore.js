import { create } from 'zustand'
import materials from '../../data/materials/materials.json'
import product from '../../data/products/product.example.json'
import { getAllowedMaterials } from '../rules/RulesEngine'

const groupOrder = product.configurationFlow ?? Object.keys(product.materialGroups)
const initialMaterials = Object.fromEntries(
  groupOrder.map((groupId) => [
    groupId,
    product.materialGroups[groupId]?.defaultMaterialId ?? materials[0]?.id ?? null,
  ]),
)

function repairDownstreamSelections(selected, changedGroupId) {
  const repaired = { ...selected }
  const changedIndex = groupOrder.indexOf(changedGroupId)

  if (changedIndex < 0) return repaired

  for (let index = changedIndex + 1; index < groupOrder.length; index += 1) {
    const groupId = groupOrder[index]
    const allowed = getAllowedMaterials({
      groupId,
      selected: repaired,
      materials,
      rules: product.rules,
    })

    const currentIsValid = allowed.some(
      (material) => material.id === repaired[groupId],
    )

    if (!currentIsValid) {
      const defaultId = product.materialGroups[groupId]?.defaultMaterialId
      const preferredDefault = allowed.find((material) => material.id === defaultId)
      repaired[groupId] = preferredDefault?.id ?? allowed[0]?.id ?? null
    }
  }

  return repaired
}

export const useConfiguratorStore = create((set) => ({
  productId: product.id,
  selectedMaterials: initialMaterials,
  animationProgress: 0,

  setMaterial: (groupId, materialId) =>
    set((state) => {
      const selected = {
        ...state.selectedMaterials,
        [groupId]: materialId,
      }

      return {
        selectedMaterials: repairDownstreamSelections(selected, groupId),
      }
    }),

  setAnimationProgress: (animationProgress) => set({ animationProgress }),

  reset: () =>
    set({
      selectedMaterials: { ...initialMaterials },
      animationProgress: 0,
    }),
}))
