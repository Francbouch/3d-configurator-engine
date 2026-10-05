import { create } from 'zustand'

export const useConfiguratorStore = create((set) => ({
  productId: 'lit-cabinet-development',
  selectedMaterials: {
    facade: 'Blanc',
    caisson: 'Blanc',
    interieur: 'Blanc',
  },
  animationProgress: 0,
  setMaterial: (part, materialId) =>
    set((state) => ({
      selectedMaterials: {
        ...state.selectedMaterials,
        [part]: materialId,
      },
    })),
  setAnimationProgress: (animationProgress) => set({ animationProgress }),
  reset: () =>
    set({
      selectedMaterials: { facade: 'Blanc', caisson: 'Blanc', interieur: 'Blanc' },
      animationProgress: 0,
    }),
}))
