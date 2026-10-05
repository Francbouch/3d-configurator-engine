import { Bounds, Center, Clone, useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { useConfiguratorStore } from '../../configurator/state/configuratorStore'
import product from '../../data/products/product.example.json'
import materials from '../../data/materials/materials.json'
import { applyMaterialToParts, buildMaterialLibrary } from '../materials/MaterialEngine'

const MATERIAL_LIBRARY_URL = `${import.meta.env.BASE_URL}CUBES%20TEXTURES%20TEST.glb`

function LoadedProduct({ url }) {
  const productGltf = useGLTF(url)
  const materialGltf = useGLTF(MATERIAL_LIBRARY_URL)
  const selectedMaterials = useConfiguratorStore((state) => state.selectedMaterials)

  const model = useMemo(() => productGltf.scene.clone(true), [productGltf.scene])
  const materialProfiles = useMemo(
    () => Object.fromEntries(
      materials.map((material) => [
        material.source?.materialName ?? material.id,
        material.finish ?? {},
      ]),
    ),
    []
  )

  const materialLibrary = useMemo(
    () => buildMaterialLibrary(materialGltf.scene, materialProfiles),
    [materialGltf.scene, materialProfiles]
  )

  useEffect(() => {
    Object.entries(selectedMaterials).forEach(([groupId, materialId]) => {
      const material = materialLibrary.get(materialId)
      const partNames = product.model.parts
        .filter((part) => part.group === groupId && part.materialEditable)
        .map((part) => part.node)

      if (material && partNames.length) {
        applyMaterialToParts(model, partNames, material)
      }
    })
  }, [materialLibrary, model, selectedMaterials])

  return (
    <Bounds fit clip observe margin={1.18}>
      <Center bottom>
        <Clone object={model} castShadow receiveShadow />
      </Center>
    </Bounds>
  )
}

export default function ProductModel({ url }) {
  if (!url) return null
  return <LoadedProduct url={url} />
}
