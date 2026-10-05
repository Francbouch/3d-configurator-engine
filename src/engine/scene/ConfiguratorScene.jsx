import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import ProductCamera from '../camera/ProductCamera'
import StudioLighting from '../lighting/StudioLighting'
import ProductPlaceholder from '../model/ProductPlaceholder'

export default function ConfiguratorScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [4.2, 2.5, 5.2], fov: 34 }}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={['#f5f5f3']} />
      <Suspense fallback={null}>
        <StudioLighting />
        <ProductPlaceholder />
      </Suspense>
      <ProductCamera />
    </Canvas>
  )
}
