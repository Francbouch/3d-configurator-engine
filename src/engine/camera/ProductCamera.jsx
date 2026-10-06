import { OrbitControls } from '@react-three/drei'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

const HOME_TARGET = [0, 1, 0]
const PAN_LIMIT = { x: 0.85, yMin: 0.35, yMax: 1.65, z: 0.55 }

export default function ProductCamera() {
  const controls = useRef()

  useFrame(() => {
    const target = controls.current?.target
    if (!target) return
    target.x = Math.max(-PAN_LIMIT.x, Math.min(PAN_LIMIT.x, target.x))
    target.y = Math.max(PAN_LIMIT.yMin, Math.min(PAN_LIMIT.yMax, target.y))
    target.z = Math.max(-PAN_LIMIT.z, Math.min(PAN_LIMIT.z, target.z))
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableRotate
      enableZoom
      enablePan
      mouseButtons={{
        LEFT: 0,
        MIDDLE: 1,
        RIGHT: 2,
      }}
      screenSpacePanning
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.65}
      zoomSpeed={0.8}
      panSpeed={0.65}
      minDistance={1.2}
      maxDistance={12}
      minPolarAngle={Math.PI * 0.12}
      maxPolarAngle={Math.PI * 0.62}
      target={HOME_TARGET}
    />
  )
}
