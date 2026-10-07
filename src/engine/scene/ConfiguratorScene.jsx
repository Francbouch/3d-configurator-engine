import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { TransformControls } from '@react-three/drei'
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
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.shadowMap.autoUpdate = true
    gl.shadowMap.needsUpdate = true
  }, [gl, settings])
  return null
}

function EditorGizmo({ editor, settings }) {
  const targetRef = useRef()
  if (!editor?.selection) return null

  const { type, id } = editor.selection
  let position = [0, 0, 0]
  let rotation = [0, 0, 0]
  let scale = [1, 1, 1]

  if (type === 'light' && id === 'shadow') {
    position = settings.shadowPosition ?? DEFAULT_SCENE_SETTINGS.shadowPosition
  } else if (type === 'plane') {
    const plane = (settings.planes ?? []).find((item) => item.id === id)
    if (!plane) return null
    position = plane.position
    rotation = plane.rotation
    scale = plane.scale
  } else {
    return null
  }

  const commit = () => {
    const o = targetRef.current
    if (!o) return
    editor.onTransform?.({
      type,
      id,
      position: o.position.toArray(),
      rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
      scale: o.scale.toArray(),
    })
  }

  return (
    <TransformControls mode={editor.mode || 'translate'} space="world" size={1.4} onMouseUp={commit}>
      <mesh ref={targetRef} position={position} rotation={rotation} scale={scale} renderOrder={1000}>
        {type === 'light' ? <sphereGeometry args={[0.22, 20, 20]} /> : <boxGeometry args={[1, 1, 0.06]} />}
        <meshBasicMaterial color={type === 'light' ? '#ff5a00' : '#4f7cff'} transparent opacity={0.9} depthTest={false} depthWrite={false} />
      </mesh>
    </TransformControls>
  )
}

export default function ConfiguratorScene({ sceneOverride = null, editor = null, onCameraViewChange = null, matchPublishedView = false }) {
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

  const publishedWithoutLegacyLightRig = publishedScene
    ? {
        ...publishedScene,
        // Lighting placement now comes from the code-defined studio rig.
        // Older saved back-office positions were overriding every lighting adjustment.
        keyPosition: undefined,
        fillPosition: undefined,
        rimPosition: undefined,
        topPosition: undefined,
        shadowPosition: undefined,
      }
    : null
  const effectiveOverride = matchPublishedView ? null : sceneOverride
  const sceneSettings = {
    ...DEFAULT_SCENE_SETTINGS,
    ...(publishedWithoutLegacyLightRig ?? {}),
    ...(effectiveOverride ?? {}),
  }
  if (!effectiveOverride) {
    sceneSettings.keyPosition = DEFAULT_SCENE_SETTINGS.keyPosition
    sceneSettings.fillPosition = DEFAULT_SCENE_SETTINGS.fillPosition
    sceneSettings.rimPosition = DEFAULT_SCENE_SETTINGS.rimPosition
    sceneSettings.topPosition = DEFAULT_SCENE_SETTINGS.topPosition
    sceneSettings.shadowPosition = DEFAULT_SCENE_SETTINGS.shadowPosition
  }

  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={[1, 2]}
      camera={{ position: [-4.35, 2.35, 5.55], fov: 34, near: 0.01, far: 100 }}
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
        {editor && !matchPublishedView && <EditorGizmo editor={editor} settings={sceneSettings} />}
      </Suspense>
      <ProductCamera initialView={sceneSettings.cameraView ?? null} onViewChange={onCameraViewChange} />
    </Canvas>
  )
}
