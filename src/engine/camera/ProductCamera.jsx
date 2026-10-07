import { OrbitControls } from '@react-three/drei'
import { MOUSE } from 'three'
import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'

export default function ProductCamera({ initialView = null, onViewChange = null }) {
  const controlsRef = useRef()
  const { camera } = useThree()

  useEffect(() => {
    if (!initialView || !controlsRef.current) return
    if (Array.isArray(initialView.position)) camera.position.fromArray(initialView.position)
    if (Array.isArray(initialView.target)) controlsRef.current.target.fromArray(initialView.target)
    camera.updateProjectionMatrix()
    controlsRef.current.update()
    if (onViewChange) {
      onViewChange({
        position: camera.position.toArray(),
        target: controlsRef.current.target.toArray(),
        fov: camera.fov,
        aspect: camera.aspect,
      })
    }
  }, [camera, initialView, onViewChange])

  const reportView = () => {
    if (!controlsRef.current || !onViewChange) return
    onViewChange({
      position: camera.position.toArray(),
      target: controlsRef.current.target.toArray(),
      fov: camera.fov,
      aspect: camera.aspect,
    })
  }

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableRotate
      enableZoom
      enablePan
      mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
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
      target={initialView?.target ?? [0, 1.12, 0]}
      onEnd={reportView}
    />
  )
}
