import { create } from 'zustand'

export const useConfiguratorStore = create((set) => ({
  productId: null,
  selectedMaterials: {
    facade: null,
    caisson: null,
    interieur: null,
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
      selectedMaterials: { facade: null, caisson: null, interieur: null },
      animationProgress: 0,
    }),
}))
