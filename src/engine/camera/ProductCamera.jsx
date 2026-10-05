import { OrbitControls } from '@react-three/drei'

export default function ProductCamera() {
  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      minDistance={3.2}
      maxDistance={9}
      minPolarAngle={Math.PI * 0.18}
      maxPolarAngle={Math.PI * 0.58}
      target={[0, 0, 0]}
    />
  )
}
