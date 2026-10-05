import { ContactShadows, Environment } from '@react-three/drei'

export default function StudioLighting() {
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight
        castShadow
        position={[4, 7, 5]}
        intensity={2.2}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-4, 3, 2]} intensity={0.8} />
      <Environment preset="studio" environmentIntensity={0.55} />
      <ContactShadows
        position={[0, -1.5, 0]}
        opacity={0.22}
        scale={10}
        blur={2.8}
        far={5}
      />
    </>
  )
}
