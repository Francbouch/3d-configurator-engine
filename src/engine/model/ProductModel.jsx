import { CLOUDFLARE_API, fetchCloudflarePublication } from '../assets/cloudflareApi'
import { Bounds, Center, useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useConfiguratorStore } from '../../configurator/state/configuratorStore'
import product from '../../data/products/product.example.json'
import { applyMaterialToParts } from '../materials/MaterialEngine'
import { SUPABASE_PROJECT_URL, supabaseHeaders } from '../../admin/AdminAuth'

function LoadedProduct({ url, onReady, rotationY = 0, roughness = 0.48, materialsOverride = null }) {
  const productGltf = useGLTF(url)
   const selectedMaterials = useConfiguratorStore((state) => state.selectedMaterials)
  const animationProgress = useConfiguratorStore((state) => state.animationProgress)
  const [publishedConfig, setPublishedConfig] = useState(null)
  const animationTime = useRef(0)
  const animationAction = useRef(null)

  const model = useMemo(() => {
    const clone = productGltf.scene.clone(true)
    clone.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true
        object.receiveShadow = true
        // Never mutate GLTFLoader's cached source materials when previewing roughness.
        if (Array.isArray(object.material)) object.material = object.material.map((material) => material.clone())
        else if (object.material) object.material = object.material.clone()
      }
    })
    return clone
  }, [productGltf.scene])
  const animation = product.animations?.open
  const animationClip = useMemo(() => {
    if (!animation?.enabled) return null
    return productGltf.animations.find((clip) => clip.name === animation.clip) ?? productGltf.animations[0] ?? null
  }, [animation?.clip, animation?.enabled, productGltf.animations])
  const mixer = useMemo(() => animationClip ? new THREE.AnimationMixer(model) : null, [animationClip, model])

  useEffect(() => {
    let cancelled = false
    if (new URLSearchParams(window.location.search).get('assetSource') === 'cloudflare') {
      fetchCloudflarePublication(product.id)
        .then((publication) => { if (!cancelled) setPublishedConfig(publication.configuration ?? null) })
        .catch((error) => { console.warn('Cloudflare staging configuration unavailable', error); if (!cancelled) setPublishedConfig({}) })
    } else {
      fetch(`${SUPABASE_PROJECT_URL}/rest/v1/configurator_publications?product_id=eq.${encodeURIComponent(product.id)}&select=configuration&limit=1`, { headers: supabaseHeaders() })
        .then((response) => response.ok ? response.json() : [])
        .then((rows) => { if (!cancelled) setPublishedConfig(rows?.[0]?.configuration ?? null) })
        .catch((error) => { console.warn('Unable to load published part mapping', error); if (!cancelled) setPublishedConfig({}) })
  
    }
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!publishedConfig || !onReady) return undefined
    let cancelled = false
    const urls = [...new Set((publishedConfig.materials ?? []).map((record) => record?.source?.imageUrl).filter(Boolean))]
    Promise.all(urls.map((url) => new Promise((resolve) => {
      const image = new Image()
      image.onload = resolve
      image.onerror = resolve
      image.src = url
    }))).then(() => {
      if (!cancelled) onReady()
    })
    return () => { cancelled = true }
  }, [publishedConfig, onReady])

  // R2 uses a flat materials/ prefix. Older publication records can still
  // contain Supabase URLs or nested imagePath values from the back office.
  const resolveTextureUrl = (record) => {
    const source = record?.source ?? {}
    if (new URLSearchParams(window.location.search).get('assetSource') !== 'cloudflare') return source.imageUrl
    const path = source.imagePath || source.imageUrl
    if (!path || String(path).startsWith('blob:')) return null
    const filename = String(path).split('?')[0].split('/').pop()
    return filename ? `${CLOUDFLARE_API}/v1/materials/${encodeURIComponent(filename)}` : null
  }

  const configuredMaterials = useMemo(() => {
    const records = Array.isArray(materialsOverride) ? materialsOverride : (Array.isArray(publishedConfig?.materials) ? publishedConfig.materials : [])
    const library = new Map()
    const textureLoader = new THREE.TextureLoader()

    records.forEach((record) => {
      let material
      if (resolveTextureUrl(record)) {
        const texture = textureLoader.load(resolveTextureUrl(record), undefined, undefined, (error) => {
          console.warn('[Cloudflare materials] Texture unavailable:', record.id, resolveTextureUrl(record), error)
        })
        texture.colorSpace = THREE.SRGBColorSpace
        texture.flipY = false
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        texture.needsUpdate = true
        material = new THREE.MeshPhysicalMaterial({
          map: texture,
          color: 0xffffff,
          roughness: 0.48,
          metalness: 0,
          clearcoat: 0.12,
          clearcoatRoughness: 0.38,
          ior: 1.5,
        })
      } else {
        material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(record?.color || '#000000'),
          roughness: 0.48,
          metalness: 0,
          clearcoat: 0.12,
          clearcoatRoughness: 0.38,
          ior: 1.5,
        })
      }
      material.name = record.id
      library.set(record.id, material)
    })
    return library
  }, [publishedConfig, materialsOverride])

  useEffect(() => {
    const parts = publishedConfig?.parts ?? []
    const groups = Array.isArray(publishedConfig?.materialGroups) ? publishedConfig.materialGroups : []

    groups.forEach((group) => {
      // The group's back-office material is the default. A client selection in the
      // configurator overrides it only for that group.
      const materialId = selectedMaterials[group.id] || group.materialId
      const material = configuredMaterials.get(materialId)
      const mappedParts = parts.filter((part) => part.group === group.id)
      if (!material || !mappedParts.length) {
        if (new URLSearchParams(window.location.search).get('assetSource') === 'cloudflare') {
          console.warn('[Cloudflare mapping] No applicable material or mapped parts', {
            group: group.id,
            selectedMaterial: materialId,
            materialFound: Boolean(material),
            mappedPartCount: mappedParts.length,
          })
        }
        return
      }
      const applied = applyMaterialToParts(model, mappedParts, material)
      if (!applied && new URLSearchParams(window.location.search).get('assetSource') === 'cloudflare') {
        console.warn('[Cloudflare mapping] Parts not found in loaded GLB', {
          group: group.id,
          selectedMaterial: materialId,
          mappedParts: mappedParts.map((part) => ({
            node: part.node,
            nodePath: part.nodePath,
            meshPath: part.meshPath,
          })),
        })
      }
    })
  }, [configuredMaterials, model, publishedConfig, selectedMaterials])

  // Per-material sliders override the global scene roughness only above zero.
  // A zero/absent slider means inherit the global value (or default metalness).
  useEffect(() => {
    const globalRoughness = THREE.MathUtils.clamp(Number(roughness ?? 0.48), 0, 1)
    const records = Array.isArray(materialsOverride) ? materialsOverride : (publishedConfig?.materials ?? [])
    const overrides = new Map(records.map((record) => [record.id, record]))
    model.traverse((object) => {
      if (!object.isMesh) return
      const list = Array.isArray(object.material) ? object.material : [object.material]
      list.forEach((material) => {
        if (!material) return
        const record = overrides.get(material.name)
        const localRoughness = Number(record?.roughness ?? 0)
        const localMetalness = Number(record?.metalness ?? 0)
        if ('roughness' in material) material.roughness = localRoughness > 0 ? THREE.MathUtils.clamp(localRoughness, 0, 1) : globalRoughness
        if ('metalness' in material) material.metalness = localMetalness > 0 ? THREE.MathUtils.clamp(localMetalness, 0, 1) : 0
      })
    })
  }, [model, roughness, configuredMaterials, selectedMaterials, publishedConfig, materialsOverride])

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

    // Wait until the GLB and its animation are ready, then let the closed model
    // settle visually before the one-time opening presentation.
    const autoOpenTimer = window.setTimeout(() => {
      const state = useConfiguratorStore.getState()
      if (!state.autoOpenCancelled && state.animationProgress === 0) {
        useConfiguratorStore.setState({ animationProgress: 1, autoOpenCancelled: true })
      }
    }, 1100)

    return () => {
      window.clearTimeout(autoOpenTimer)
      animationAction.current = null
      mixer.stopAllAction()
    }
  }, [animationClip, mixer])

  useFrame((_, delta) => {
    const action = animationAction.current
    if (!mixer || !animationClip || !action) return

    const targetTime = THREE.MathUtils.clamp(animationProgress, 0, 1) * animationClip.duration
    const isClosing = targetTime < animationTime.current

    if (isClosing) {
      // Test mode: no easing/damping on closing. Move at a constant speed.
      const closingSpeed = animationClip.duration * 0.75
      const distance = closingSpeed * delta
      animationTime.current = Math.max(targetTime, animationTime.current - distance)
    } else {
      // Keep opening exactly as it was.
      animationTime.current = THREE.MathUtils.damp(animationTime.current, targetTime, 1.5, delta * 0.5)

      if (Math.abs(animationTime.current - targetTime) < 0.001) {
        animationTime.current = targetTime
      }
    }

    // A paused AnimationAction does not advance with mixer.setTime().
    // Set the action time directly, then evaluate the pose without advancing it.
    action.time = THREE.MathUtils.clamp(animationTime.current, 0, animationClip.duration)
    mixer.update(0)
  })

  return (
    <Bounds fit clip observe margin={1.18}>
      <Center bottom>
        <group rotation={[0, rotationY, 0]}>
          <primitive object={model} />
        </group>
      </Center>
    </Bounds>
  )
}

export default function ProductModel({ url, onReady, rotationY = 0, roughness = 0.48, materialsOverride = null }) {
  if (!url) return null
  return <LoadedProduct url={url} onReady={onReady} rotationY={rotationY} roughness={roughness} materialsOverride={materialsOverride} />
}
