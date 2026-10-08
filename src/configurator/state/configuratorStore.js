import { create } from 'zustand'
import product from '../../data/products/product.example.json'
import { getGroupMaterials } from '../materials/MaterialAvailability'

const groupOrder = product.configurationFlow ?? Object.keys(product.materialGroups ?? {})

function buildInitialMaterials(materials = []) {
  const selected = {}

  groupOrder.forEach((groupId) => {
    const allowed = getGroupMaterials({
      product,
      groupId,
      selected,
      materials,
    })
    const defaultId = product.materialGroups?.[groupId]?.defaultMaterialId
    const preferredDefault = allowed.find((material) => material.id === defaultId)
    selected[groupId] = preferredDefault?.id ?? allowed[0]?.id ?? null
  })

  return selected
}

const initialMaterials = {}

function repairDownstreamSelections(selected, changedGroupId, materials = []) {
  const repaired = { ...selected }
  const changedIndex = groupOrder.indexOf(changedGroupId)

  if (changedIndex < 0) return repaired

  for (let index = changedIndex + 1; index < groupOrder.length; index += 1) {
    const groupId = groupOrder[index]
    const allowed = getGroupMaterials({
      product,
      groupId,
      selected: repaired,
      materials,
    })

    const currentIsValid = allowed.some(
      (material) => material.id === repaired[groupId],
    )

    if (!currentIsValid) {
      const defaultId = product.materialGroups?.[groupId]?.defaultMaterialId
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
  autoOpenCancelled: false,
  selectedModules: {},
  materialCatalog: [],

  initializeMaterialCatalog: (materials) => set((state) => ({ materialCatalog: materials, selectedMaterials: Object.keys(state.selectedMaterials).length ? state.selectedMaterials : buildInitialMaterials(materials) })),

  initializeDynamicGroups: (groups = []) =>
    set(() => {
      // Each fresh configurator load starts from the exact defaults configured
      // for the current back-office groups. Static/legacy selections must not leak in.
      const selectedMaterials = {}
      groups.forEach((group) => {
        if (group?.id) selectedMaterials[group.id] = group.materialId || null
      })
      return { selectedMaterials }
    }),

  setMaterialDirect: (groupId, materialId) =>
    set((state) => ({ selectedMaterials: { ...state.selectedMaterials, [groupId]: materialId } })),

  setMaterial: (groupId, materialId) =>
    set((state) => {
      const materials = state.materialCatalog
      const allowed = getGroupMaterials({
        product,
        groupId,
        selected: state.selectedMaterials,
        materials,
      })

      if (!allowed.some((material) => material.id === materialId)) {
        return state
      }

      const selected = {
        ...state.selectedMaterials,
        [groupId]: materialId,
      }

      return {
        selectedMaterials: repairDownstreamSelections(selected, groupId, materials),
      }
    }),

  setModuleEnabled: (moduleId, enabled) =>
    set((state) => ({
      selectedModules: {
        ...state.selectedModules,
        [moduleId]: Boolean(enabled),
      },
    })),

  toggleModule: (moduleId) =>
    set((state) => ({
      selectedModules: {
        ...state.selectedModules,
        [moduleId]: !state.selectedModules[moduleId],
      },
    })),

  setAnimationProgress: (animationProgress) => set({ animationProgress, autoOpenCancelled: true }),

  reset: () =>
    set({
      selectedMaterials: buildInitialMaterials(useConfiguratorStore.getState().materialCatalog),
      animationProgress: 0,
      autoOpenCancelled: false,
      selectedModules: {},
    }),
}))
