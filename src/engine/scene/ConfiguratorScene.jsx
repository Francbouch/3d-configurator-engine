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
  const draggingRef = useRef(false)

  if (!editor?.selection) return null

  const { type, id } = editor.selection
  let position = [0, 0, 0]
  let rotation = [0, 0, 0]
  let scale = [1, 1, 1]

  if (type === 'light') position = settings[id + 'Position'] ?? position
  if (type === 'plane') {
    const plane = (settings.planes ?? []).find((item) => item.id === id)
    if (!plane) return null
    position = plane.position
    rotation = plane.rotation
    scale = plane.scale
  }

  const readTransform = () => {
    const object = targetRef.current
    if (!object) return null
    return {
      type,
      id,
      position: object.position.toArray(),
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: object.scale.toArray(),
    }
  }

  const commit = () => {
    const change = readTransform()
    if (change) editor.onTransform?.(change)
  }

  return (
    <TransformControls
      key={'transform-' + type + '-' + id}
      mode={editor.mode || 'translate'}
      space="world"
      size={1.4}
      onMouseDown={() => { draggingRef.current = true }}
      onMouseUp={() => {
        draggingRef.current = false
        commit()
      }}
    >
      <mesh
        ref={targetRef}
        position={position}
        rotation={rotation}
        scale={scale}
        renderOrder={1000}
      >
        {type === 'light' ? <sphereGeometry args={[0.22, 20, 20]} /> : <boxGeometry args={[1, 1, 0.06]} />}
        <meshBasicMaterial
          color={type === 'light' ? (id === 'shadow' ? '#ff5a00' : '#ffcc33') : '#4f7cff'}
          transparent
          opacity={0.95}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </TransformControls>
  )
}

export default function ConfiguratorScene({ sceneOverride = null, editor = null }) {
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
      shadows={{ type: THREE.PCFSoftShadowMap }}
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
        {editor && <EditorGizmo editor={editor} settings={sceneSettings} />}
      </Suspense>
      <ProductCamera />
    </Canvas>
  )
}
