import { Environment } from '@react-three/drei'

export default function StudioLighting() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#eeeeec', 1.15]} />
      <directionalLight position={[4.5, 7, 5.5]} intensity={2.1} />
      <directionalLight position={[-4, 4, 3]} intensity={1.15} />
      <directionalLight position={[1, 3, -4]} intensity={0.65} />
      <Environment preset="studio" environmentIntensity={0.75} />
    </>
  )
}
