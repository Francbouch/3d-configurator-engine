import { CameraControls } from '@react-three/drei'

export default function ProductCamera() {
  return (
    <CameraControls
      makeDefault
      dollyToCursor
      minDistance={1.2}
      maxDistance={12}
      minPolarAngle={Math.PI * 0.12}
      maxPolarAngle={Math.PI * 0.62}
      smoothTime={0.22}
    />
  )
}
