import { ContactShadows, Environment } from '@react-three/drei'

export default function StudioLighting() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#d8d8d5', 1.15]} />
      <directionalLight
        castShadow
        position={[4.5, 7, 5.5]}
        intensity={2.1}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00015}
      />
      <directionalLight position={[-4, 4, 3]} intensity={1.15} />
      <directionalLight position={[1, 3, -4]} intensity={0.65} />
      <Environment preset="studio" environmentIntensity={0.75} />
      <ContactShadows
        position={[0, 0.002, 0]}
        opacity={0.2}
        scale={12}
        blur={3.2}
        far={6}
      />
    </>
  )
}
