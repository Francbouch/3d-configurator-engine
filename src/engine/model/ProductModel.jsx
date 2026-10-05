import { Bounds, Center, useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { useConfiguratorStore } from '../../configurator/state/configuratorStore'
import product from '../../data/products/product.example.json'
import { applyMaterialToParts, buildMaterialLibrary } from '../materials/MaterialEngine'
import { MASTER_MATERIAL_LIBRARY_URL } from '../materials/MasterMaterialLibrary'

function LoadedProduct({ url }) {
  const productGltf = useGLTF(url)
  const materialGltf = useGLTF(MASTER_MATERIAL_LIBRARY_URL)
  const selectedMaterials = useConfiguratorStore((state) => state.selectedMaterials)

  const model = useMemo(() => productGltf.scene.clone(true), [productGltf.scene])
  const materialLibrary = useMemo(
    () => buildMaterialLibrary(materialGltf.scene),
    [materialGltf.scene]
  )

  useEffect(() => {
    Object.entries(selectedMaterials).forEach(([groupId, materialId]) => {
      const material = materialLibrary.get(materialId)
      const mappedParts = (product.model?.parts ?? [])
        .filter((part) => part.group === groupId && part.materialEditable)

      if (material && mappedParts.length) {
        applyMaterialToParts(model, mappedParts, material)
      }
    })
  }, [materialLibrary, model, selectedMaterials])

  return (
    <Bounds fit clip observe margin={1.18}>
      <Center bottom>
        <primitive object={model} />
      </Center>
    </Bounds>
  )
}

export default function ProductModel({ url }) {
  if (!url) return null
  return <LoadedProduct url={url} />
}
