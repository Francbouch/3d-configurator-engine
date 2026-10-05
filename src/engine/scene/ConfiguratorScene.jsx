import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import * as THREE from 'three'
import ProductCamera from '../camera/ProductCamera'
import StudioLighting from '../lighting/StudioLighting'
import ProductModel from '../model/ProductModel'

const DEVELOPMENT_MODEL_URL = `${import.meta.env.BASE_URL}CABINET%20TEST.glb`

export default function ConfiguratorScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [4.2, 2.5, 5.2], fov: 34, near: 0.01, far: 100 }}
      gl={{
        antialias: true,
        alpha: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15
      }}
    >
      <color attach="background" args={['#f7f7f5']} />
      <Suspense fallback={null}>
        <StudioLighting />
        <ProductModel url={DEVELOPMENT_MODEL_URL} />
      </Suspense>
      <ProductCamera />
    </Canvas>
  )
}
