import { Environment, Lightformer } from '@react-three/drei'
import { useEffect, useRef } from 'react'

export const DEFAULT_SCENE_SETTINGS = Object.freeze({
  background: '#f7f7f5',
  exposure: 1,
  environmentIntensity: 0.72,
  hemisphereIntensity: 0.28,
  keyIntensity: 5.2,
  fillIntensity: 3.2,
  rimIntensity: 3.6,
  topIntensity: 2.1,
  shadowOpacity: 0.24,
  shadowBlur: 3.2,
  shadowRadius: 5,
  shadowBias: -0.00015,
  shadowNormalBias: 0.012,
  shadowStrength: 0.7,
  groundY: -1.02,
  keyPosition: [-4.8, 5.8, 5.2],
  fillPosition: [4.5, 3.8, 3.2],
  rimPosition: [-3.2, 3.8, -4.8],
  topPosition: [0, 7.5, 0.4],
  shadowPosition: [-4.8, 5.8, 5.2],
  planes: [],
})

export default function StudioLighting({ settings = {}, externalShadowLight = false }) {
  const s = { ...DEFAULT_SCENE_SETTINGS, ...settings }
  const shadowLightRef = useRef()
  const shadowTargetRef = useRef()

  useEffect(() => {
    if (!shadowLightRef.current || !shadowTargetRef.current) return
    shadowLightRef.current.target = shadowTargetRef.current
    shadowLightRef.current.target.updateMatrixWorld()
    shadowLightRef.current.shadow?.camera?.updateProjectionMatrix()
    shadowLightRef.current.shadow.needsUpdate = true
  }, [s.shadowPosition])

  return (
    <>
      <hemisphereLight args={['#ffffff', '#d8d8d5', s.hemisphereIntensity]} />
      {/* RectAreaLight gives the broad studio reflection; a dedicated directional light controls only the projected shadow. */}
      <rectAreaLight position={s.keyPosition} rotation={[-0.72, -0.55, -0.38]} width={5.5} height={7} intensity={s.keyIntensity} color="#fffdf8" />
      <object3D ref={shadowTargetRef} position={[0, 0.8, 0]} />
      {!externalShadowLight && (
        <>
          <directionalLight
            ref={shadowLightRef}
            position={s.shadowPosition}
            intensity={Math.max(0.35, s.keyIntensity * 0.22)}
            color="#fffdf8"
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-4}
            shadow-camera-right={4}
            shadow-camera-top={5}
            shadow-camera-bottom={-3}
            shadow-camera-near={0.1}
            shadow-camera-far={30}
            shadow-bias={s.shadowBias}
            shadow-normalBias={s.shadowNormalBias}
            shadow-radius={s.shadowRadius}
          />
        </>
      )}
      <rectAreaLight position={s.fillPosition} rotation={[-0.25, 0.82, 0.2]} width={4} height={6} intensity={s.fillIntensity} color="#f7faff" />
      <rectAreaLight position={s.rimPosition} rotation={[0.1, -0.15, 0]} width={3} height={5.5} intensity={s.rimIntensity} color="#ffffff" />
      <rectAreaLight position={s.topPosition} rotation={[-Math.PI / 2, 0, 0]} width={5} height={4} intensity={s.topIntensity} color="#ffffff" />
      <Environment resolution={512} environmentIntensity={s.environmentIntensity}>
        <Lightformer form="rect" intensity={4.2} position={[-5, 3.5, 4]} rotation={[0, 0.82, 0]} scale={[5, 8, 1]} />
        <Lightformer form="rect" intensity={2.8} position={[5, 3, 3]} rotation={[0, -0.88, 0]} scale={[4, 7, 1]} />
        <Lightformer form="rect" intensity={3.4} position={[-3, 3, -5]} rotation={[0, -0.15, 0]} scale={[3, 6, 1]} />
        <Lightformer form="rect" intensity={1.7} position={[-2, 6, -1]} rotation={[Math.PI / 2, 0, 0]} scale={[6, 4, 1]} />
      </Environment>
      {/* Invisible floor: receives every real shadow without turning the scene into a grey slab. */}
      <mesh position={[0, s.groundY, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial transparent opacity={s.shadowStrength} depthWrite={false} />
      </mesh>
      {(s.planes ?? []).map((plane) => (
        <mesh key={plane.id} position={plane.position} rotation={plane.rotation} scale={plane.scale} receiveShadow castShadow>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial color={plane.color || '#eeeeec'} roughness={0.9} side={2} />
        </mesh>
      ))}
    </>
  )
}
