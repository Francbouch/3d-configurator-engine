import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useState } from 'react'
import * as THREE from 'three'
import ProductCamera from '../camera/ProductCamera'
import StudioLighting, { DEFAULT_SCENE_SETTINGS } from '../lighting/StudioLighting'
import ProductModel from '../model/ProductModel'
import product from '../../data/products/product.example.json'
import { resolveAssetUrl } from '../assets/resolveAssetUrl'

const FALLBACK_MODEL_URL = resolveAssetUrl(product.model?.url)
const SUPABASE_URL = 'https://vnaoawlrotdogslykbmm.supabase.co'
const SUPABASE_KEY = 'sb_publishable_AvnQSWs0wrO4QHhMMKCMKw_Depqj2Fk'

function SceneCalibration({ settings }) {
  const { gl } = useThree()
  useEffect(() => {
    gl.toneMappingExposure = Number(settings.exposure ?? 1)
  }, [gl, settings.exposure])
  return null
}

export default function ConfiguratorScene({ sceneOverride = null }) {
  const [modelUrl, setModelUrl] = useState(FALLBACK_MODEL_URL)
  const [publishedScene, setPublishedScene] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${SUPABASE_URL}/rest/v1/configurator_publications?product_id=eq.${encodeURIComponent(product.id)}&select=model_path,configuration&limit=1`, {
      headers: { apikey: SUPABASE_KEY },
    })
      .then((response) => response.ok ? response.json() : [])
      .then((rows) => {
        const path = rows?.[0]?.model_path
        if (!cancelled) setPublishedScene(rows?.[0]?.configuration?.scene ?? null)
        if (!cancelled && path) {
          setModelUrl(`${SUPABASE_URL}/storage/v1/object/public/models/${path.split('/').map(encodeURIComponent).join('/')}`)
        }
      })
      .catch((error) => console.warn('Unable to load published model', error))
    return () => { cancelled = true }
  }, [])

  const sceneSettings = { ...DEFAULT_SCENE_SETTINGS, ...(publishedScene ?? {}), ...(sceneOverride ?? {}) }

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [4.2, 2.5, 5.2], fov: 34, near: 0.01, far: 100 }}
      gl={{
        antialias: true,
        alpha: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0
      }}
    >
      <color attach="background" args={[sceneSettings.background]} />
      <Suspense fallback={null}>
        <SceneCalibration settings={sceneSettings} />
        <StudioLighting settings={sceneSettings} />
        <ProductModel url={modelUrl} />
      </Suspense>
      <ProductCamera />
    </Canvas>
  )
}
