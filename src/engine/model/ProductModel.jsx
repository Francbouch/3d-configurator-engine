import { Bounds, Center, useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useConfiguratorStore } from '../../configurator/state/configuratorStore'
import product from '../../data/products/product.example.json'
import { applyMaterialToParts, buildMaterialLibrary } from '../materials/MaterialEngine'
import { MASTER_MATERIAL_LIBRARY_URL } from '../materials/MasterMaterialLibrary'

function LoadedProduct({ url }) {
  const productGltf = useGLTF(url)
  const materialGltf = useGLTF(MASTER_MATERIAL_LIBRARY_URL)
  const selectedMaterials = useConfiguratorStore((state) => state.selectedMaterials)
  const animationProgress = useConfiguratorStore((state) => state.animationProgress)
  const animationTime = useRef(0)

  const model = useMemo(() => productGltf.scene.clone(true), [productGltf.scene])
  const animation = product.animations?.open
  const animationClip = useMemo(() => {
    if (!animation?.enabled) return null
    return productGltf.animations.find((clip) => clip.name === animation.clip) ?? productGltf.animations[0] ?? null
  }, [animation?.clip, animation?.enabled, productGltf.animations])
  const mixer = useMemo(() => animationClip ? new THREE.AnimationMixer(model) : null, [animationClip, model])

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

  useEffect(() => {
    if (!mixer || !animationClip) return undefined
    const action = mixer.clipAction(animationClip)
    action.reset()
    action.enabled = true
    action.setEffectiveWeight(1)
    action.setEffectiveTimeScale(1)
    action.play()
    mixer.update(0)
    mixer.setTime(0)
    return () => mixer.stopAllAction()
  }, [animationClip, mixer])

  useFrame((_, delta) => {
    if (!mixer || !animationClip) return
    const targetTime = THREE.MathUtils.clamp(animationProgress, 0, 1) * animationClip.duration
    const step = Math.max(animationClip.duration / 1.25, 0.01) * delta
    animationTime.current = THREE.MathUtils.damp(animationTime.current, targetTime, 7, delta)
    if (Math.abs(animationTime.current - targetTime) <= step * 0.02) {
      animationTime.current = targetTime
    }
    mixer.setTime(animationTime.current)
    mixer.update(0)
  })

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
