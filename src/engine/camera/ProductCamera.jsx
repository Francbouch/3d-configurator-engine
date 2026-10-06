import { OrbitControls } from '@react-three/drei'
import { MOUSE } from 'three'

export default function ProductCamera() {
  return (
    <OrbitControls
      makeDefault
      enableRotate
      enableZoom
      enablePan
      mouseButtons={{
        LEFT: MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.PAN,
      }}
      screenSpacePanning
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.65}
      zoomSpeed={0.8}
      panSpeed={0.5}
      minDistance={1.2}
      maxDistance={12}
      minPolarAngle={Math.PI * 0.12}
      maxPolarAngle={Math.PI * 0.62}
      target={[0, 1.12, 0]}
    />
  )
}
