import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MASTER_MATERIAL_LIBRARY_URL } from '../engine/materials/MasterMaterialLibrary'

const cache = new Map()
let sourcePromise
function sourceScene() {
  if (!sourcePromise) sourcePromise = new Promise((resolve, reject) => {
    new GLTFLoader().load(MASTER_MATERIAL_LIBRARY_URL, (g) => resolve(g.scene), undefined, reject)
  })
  return sourcePromise
}
function findMaterial(root, name) {
  let found
  root.traverse((o) => {
    if (found || !o.isMesh) return
    const list = Array.isArray(o.material) ? o.material : [o.material]
    found = list.find((m) => m?.name === name)
  })
  return found
}
async function renderPreview(name) {
  if (cache.has(name)) return cache.get(name)
  const source = await sourceScene()
  const material = findMaterial(source, name)
  if (!material) return null
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setSize(128, 128)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#f1f1ee')
  const camera = new THREE.OrthographicCamera(-0.625, 0.625, 0.625, -0.625, 0.1, 10)
  camera.position.set(0, 0, 3)
  camera.lookAt(0, 0, 0)
  scene.add(new THREE.HemisphereLight('#ffffff', '#d8d8d2', 2))
  const key = new THREE.DirectionalLight('#ffffff', 2.8); key.position.set(3, 4, 5); scene.add(key)
  const fill = new THREE.DirectionalLight('#ffffff', 1.2); fill.position.set(-4, 2, 2); scene.add(fill)
  const geometry = new THREE.PlaneGeometry(1.25, 1.25)
  const previewMaterial = material.clone()
  previewMaterial.side = THREE.DoubleSide
  const swatch = new THREE.Mesh(geometry, previewMaterial)
  scene.add(swatch)
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/webp', 0.86)
  geometry.dispose(); swatch.material.dispose(); renderer.dispose()
  cache.set(name, url)
  return url
}
export default function MaterialPreview({ material }) {
  const ref = useRef(null)
  useEffect(() => {
    if (material.thumbnail || !material.source?.materialName) return
    let active = true
    renderPreview(material.source.materialName).then((url) => {
      if (active && url && ref.current) ref.current.src = url
    }).catch(() => {})
    return () => { active = false }
  }, [material])
  if (material.thumbnail) return <img src={material.thumbnail} alt="" />
  return <span className="material-preview"><img ref={ref} alt="" /><span className="material-chip__fallback" aria-hidden="true" /></span>
}
