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
  const animationAction = useRef(null)

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
    action.setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
    action.play()
    action.paused = true
    action.time = 0
    animationTime.current = 0
    animationAction.current = action
    mixer.update(0)

    return () => {
      animationAction.current = null
      mixer.stopAllAction()
    }
  }, [animationClip, mixer])

  useFrame((_, delta) => {
    const action = animationAction.current
    if (!mixer || !animationClip || !action) return

    const targetTime = THREE.MathUtils.clamp(animationProgress, 0, 1) * animationClip.duration
    const isClosing = targetTime < animationTime.current
    const closingEndZone = animationClip.duration * 0.12
    const isNearClosed = isClosing && animationTime.current <= closingEndZone

    // Keep the current soft motion overall, but remove the long easing tail
    // during the last part of the closing animation.
    const damping = isNearClosed ? 4.5 : 1.5
    animationTime.current = THREE.MathUtils.damp(animationTime.current, targetTime, damping, delta * 0.5)

    if (Math.abs(animationTime.current - targetTime) < (isNearClosed ? 0.02 : 0.001)) {
      animationTime.current = targetTime
    }

    // A paused AnimationAction does not advance with mixer.setTime().
    // Set the action time directly, then evaluate the pose without advancing it.
    action.time = THREE.MathUtils.clamp(animationTime.current, 0, animationClip.duration)
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
