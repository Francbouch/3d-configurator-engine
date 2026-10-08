import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'

RectAreaLightUniformsLib.init()

export const DEFAULT_SCENE_SETTINGS = Object.freeze({
  background: '#f7f7f5',
  exposure: 0.78,
  environmentIntensity: 0.52,
  hemisphereIntensity: 0.65,
  keyIntensity: 3.0,
  fillIntensity: 1.9,
  rimIntensity: 2.3,
  topIntensity: 1.1,
  shadowOpacity: 0.1,
  shadowBlur: 3.2,
  shadowRadius: 5,
  shadowBias: -0.00015,
  shadowNormalBias: 0.012,
  shadowStrength: 0.85,
  groundY: -1.02,
  keyPosition: [4.8, 5.8, -5.2],
  fillPosition: [-4.5, 3.8, -3.2],
  rimPosition: [3.2, 3.8, 4.8],
  topPosition: [0, 7.5, 0.4],
  shadowPosition: [4.8, 5.8, -5.2],
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
      {/* Fixed, balanced softboxes: camera orbit does not move the lighting. */}
      <hemisphereLight args={['#ffffff', '#c4c8ce', s.hemisphereIntensity]} />
      <ambientLight intensity={0.08} color="#ffffff" />
      <object3D ref={shadowTargetRef} position={[0, 0.8, 0]} />
      {!externalShadowLight && (
        <directionalLight
          ref={shadowLightRef}
          position={[7.5, 8, 8.5]}
          intensity={1.75}
          color="#fffdf8"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={6}
          shadow-camera-bottom={-4}
          shadow-camera-near={0.1}
          shadow-camera-far={35}
          shadow-bias={s.shadowBias}
          shadow-normalBias={s.shadowNormalBias}
          shadow-radius={s.shadowRadius}
        />
      )}
      <rectAreaLight position={[5, 4.5, 5]} rotation={[-0.35, 0.75, 0]} width={5} height={7} intensity={s.keyIntensity} color="#fffaf3" />
      <rectAreaLight position={[-5, 3.8, 4]} rotation={[-0.25, -0.8, 0]} width={4} height={7} intensity={s.fillIntensity} color="#f3f7ff" />
      <rectAreaLight position={[4.5, 3.5, -5]} rotation={[-0.2, 2.35, 0]} width={4} height={6} intensity={s.rimIntensity} color="#ffffff" />
      <rectAreaLight position={[-5, 3.5, -4]} rotation={[-0.2, -2.35, 0]} width={4} height={6} intensity={s.fillIntensity * 0.7} color="#ffffff" />
      <rectAreaLight position={[0, 7, 0]} rotation={[-Math.PI / 2, 0, 0]} width={6} height={5} intensity={s.topIntensity} color="#ffffff" />
      {/* Procedural HDR environment: broad studio reflections from every side, without an external HDR file. */}
      <Environment resolution={256} environmentIntensity={s.environmentIntensity} environmentRotation={[0, 0, 0]}>
        <Lightformer form="rect" intensity={2.5} position={[5, 4, 5]} rotation={[0, Math.PI / 4, 0]} scale={[5, 7, 1]} />
        <Lightformer form="rect" intensity={2} position={[-5, 4, 4]} rotation={[0, -Math.PI / 4, 0]} scale={[4, 7, 1]} />
        <Lightformer form="rect" intensity={2.5} position={[5, 4, -5]} rotation={[0, 3 * Math.PI / 4, 0]} scale={[4, 7, 1]} />
        <Lightformer form="rect" intensity={1.8} position={[-5, 4, -5]} rotation={[0, -3 * Math.PI / 4, 0]} scale={[4, 7, 1]} />
        <Lightformer form="rect" intensity={1.1} position={[0, 7, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[7, 6, 1]} />
      </Environment>
      {/* Contact controls behave like a simplified DCC shadow catcher. */}
      {s.shadowOpacity > 0 && (
        <ContactShadows
          position={[0, s.groundY + 0.003, 0]}
          opacity={s.shadowOpacity}
          blur={s.shadowBlur}
          scale={12}
          far={8}
          frames={1}
        />
      )}
      {/* Invisible floor: receives every real projected shadow without turning the scene into a grey slab. */}
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
