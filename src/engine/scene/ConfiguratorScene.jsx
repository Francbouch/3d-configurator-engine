import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { TransformControls as DreiTransformControls } from '@react-three/drei'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
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
  const { gl, camera, scene } = useThree()
  const [bundle] = useState(() => {
    const light = new THREE.DirectionalLight('#fffdf8', 1)
    light.castShadow = true
    light.shadow.mapSize.set(2048, 2048)
    light.shadow.camera.left = -4
    light.shadow.camera.right = 4
    light.shadow.camera.top = 5
    light.shadow.camera.bottom = -3
    light.shadow.camera.near = 0.1
    light.shadow.camera.far = 30
    const target = new THREE.Object3D()
    target.position.set(0, 0.8, 0)
    light.target = target
    return { light, target }
  })

  useEffect(() => {
    const { light, target } = bundle
    scene.add(light)
    scene.add(target)
    return () => {
      scene.remove(light)
      scene.remove(target)
      light.shadow.map?.dispose()
      light.dispose()
    }
  }, [bundle, scene])

  useEffect(() => {
    const { light } = bundle
    light.position.fromArray(settings.shadowPosition ?? DEFAULT_SCENE_SETTINGS.shadowPosition)
    light.intensity = Math.max(0.35, Number(settings.keyIntensity ?? 5.2) * 0.22)
    light.shadow.bias = Number(settings.shadowBias ?? -0.00015)
    light.shadow.normalBias = Number(settings.shadowNormalBias ?? 0.012)
    light.shadow.radius = Number(settings.shadowRadius ?? 5)
    light.shadow.camera.updateProjectionMatrix()
    light.shadow.needsUpdate = true
  }, [bundle, settings.shadowPosition, settings.keyIntensity, settings.shadowBias, settings.shadowNormalBias, settings.shadowRadius])

  useEffect(() => {
    if (!(editor?.selection?.type === 'light' && editor?.selection?.id === 'shadow')) return undefined
    const controls = new THREE.TransformControls(camera, gl.domElement)
    controls.setMode(editor.mode || 'translate')
    controls.setSpace('world')
    controls.setSize(1.35)
    controls.attach(bundle.light)

    const onChange = () => {
      bundle.light.shadow.needsUpdate = true
      gl.shadowMap.needsUpdate = true
    }
    const onDragChanged = (event) => {
      const orbit = scene.userData.__r3f?.controls
      if (orbit) orbit.enabled = !event.value
      if (!event.value) {
        editor.onTransform?.({
          type: 'light',
          id: 'shadow',
          position: bundle.light.position.toArray(),
          rotation: [bundle.light.rotation.x, bundle.light.rotation.y, bundle.light.rotation.z],
          scale: bundle.light.scale.toArray(),
        })
      }
    }

    controls.addEventListener('objectChange', onChange)
    controls.addEventListener('dragging-changed', onDragChanged)
    scene.add(controls)

    return () => {
      controls.removeEventListener('objectChange', onChange)
      controls.removeEventListener('dragging-changed', onDragChanged)
      controls.detach()
      scene.remove(controls)
      controls.dispose()
    }
  }, [bundle, camera, gl, scene, editor?.selection?.type, editor?.selection?.id, editor?.mode, editor?.onTransform])

  return null
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
    <DreiTransformControls mode={editor.mode || 'translate'} space="world" size={1.4} onMouseUp={commit}>
      <mesh ref={targetRef} position={plane.position} rotation={plane.rotation} scale={plane.scale} renderOrder={1000}>
        <boxGeometry args={[1,1,0.06]} />
        <meshBasicMaterial color="#4f7cff" transparent opacity={0.7} depthTest={false} depthWrite={false} />
      </mesh>
    </DreiTransformControls>
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
