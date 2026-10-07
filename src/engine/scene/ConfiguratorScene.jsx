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

function EditableShadowLight({ editor, settings }) {
  const lightRef = useRef()
  const targetRef = useRef()
  const selected = editor?.selection?.type === 'light' && editor?.selection?.id === 'shadow'

  useEffect(() => {
    if (!lightRef.current || !targetRef.current) return
    lightRef.current.target = targetRef.current
    targetRef.current.updateMatrixWorld()
    lightRef.current.shadow.needsUpdate = true
  }, [])

  const commit = () => {
    const light = lightRef.current
    if (!light) return
    light.shadow.needsUpdate = true
    editor.onTransform?.({
      type: 'light',
      id: 'shadow',
      position: light.position.toArray(),
      rotation: [light.rotation.x, light.rotation.y, light.rotation.z],
      scale: light.scale.toArray(),
    })
  }

  const light = (
    <directionalLight
      ref={lightRef}
      position={settings.shadowPosition}
      intensity={Math.max(0.35, settings.keyIntensity * 0.22)}
      color="#fffdf8"
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-left={-4}
      shadow-camera-right={4}
      shadow-camera-top={5}
      shadow-camera-bottom={-3}
      shadow-camera-near={0.1}
      shadow-camera-far={30}
      shadow-bias={settings.shadowBias}
      shadow-normalBias={settings.shadowNormalBias}
      shadow-radius={settings.shadowRadius}
    />
  )

  return (
    <>
      <object3D ref={targetRef} position={[0, 0.8, 0]} />
      {selected ? (
        <TransformControls
          mode={editor.mode || 'translate'}
          space="world"
          size={1.4}
          onObjectChange={() => {
            if (lightRef.current) lightRef.current.shadow.needsUpdate = true
          }}
          onMouseUp={commit}
        >
          {light}
        </TransformControls>
      ) : light}
    </>
  )
}

function EditorGizmo({ editor, settings }) {
  const targetRef = useRef()
  if (!editor?.selection || editor.selection.type === 'light') return null
  const { type, id } = editor.selection
  const plane = (settings.planes ?? []).find((item) => item.id === id)
  if (!plane) return null
  const commit = () => {
    const o = targetRef.current
    if (!o) return
    editor.onTransform?.({ type, id, position:o.position.toArray(), rotation:[o.rotation.x,o.rotation.y,o.rotation.z], scale:o.scale.toArray() })
  }
  return (
    <TransformControls mode={editor.mode || 'translate'} space="world" size={1.4} onMouseUp={commit}>
      <mesh ref={targetRef} position={plane.position} rotation={plane.rotation} scale={plane.scale} renderOrder={1000}>
        <boxGeometry args={[1,1,0.06]} />
        <meshBasicMaterial color="#4f7cff" transparent opacity={0.7} depthTest={false} depthWrite={false} />
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
        <StudioLighting settings={sceneSettings} externalShadowLight={Boolean(editor)} />
        {editor && <EditableShadowLight editor={editor} settings={sceneSettings} />}
        <ProductModel url={modelUrl} />
        {editor && <EditorGizmo editor={editor} settings={sceneSettings} />}
      </Suspense>
      <ProductCamera />
    </Canvas>
  )
}
