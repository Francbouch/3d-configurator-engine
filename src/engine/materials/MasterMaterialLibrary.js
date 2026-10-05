export const MASTER_MATERIAL_LIBRARY_VERSION = '92268e654ea8dedb8d010144ad9713599311df5e'
export const MASTER_MATERIAL_LIBRARY_URL = `${import.meta.env.BASE_URL}CUBES%20TEXTURES%20TEST.glb?v=${MASTER_MATERIAL_LIBRARY_VERSION}`

export function materialRecordsFromScene(root, savedMaterials = []) {
  const savedById = new Map(savedMaterials.map((item) => [item.id, item]))
  const records = []
  const seen = new Set()

  root.traverse((object) => {
    if (!object.isMesh || !object.material) return
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material]
    sourceMaterials.forEach((source) => {
      const id = source?.name?.trim()
      if (!id || seen.has(id)) return
      seen.add(id)
      const saved = savedById.get(id) ?? {}
      records.push({
        ...saved,
        id,
        name: saved.name || id,
        code: saved.code || id,
        manufacturer: saved.manufacturer || '',
        category: saved.category || 'decor',
        active: saved.active !== false,
        priceAdjustment: Number(saved.priceAdjustment ?? 0),
        source: { type: 'glb-material', materialName: id },
      })
    })
  })
  return records
}
