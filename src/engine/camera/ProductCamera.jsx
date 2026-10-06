import { OrbitControls } from '@react-three/drei'

export default function ProductCamera() {
  return (
    <OrbitControls
      makeDefault
      enableRotate
      enableZoom
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.65}
      zoomSpeed={0.8}
      minDistance={1.2}
      maxDistance={12}
      minPolarAngle={Math.PI * 0.12}
      maxPolarAngle={Math.PI * 0.62}
      target={[0, 1.12, 0]}
    />
  )
}
