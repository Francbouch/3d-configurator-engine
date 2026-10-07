import { ContactShadows, Environment, Lightformer } from '@react-three/drei'

/*
 * Neutral product-photography rig.
 * Large area sources create broad, readable reflections on flat cabinet faces
 * without shifting the authored material colour.
 */
export default function StudioLighting() {
  return (
    <>
      {/* Low neutral ambient lift; the environment does most of the global fill. */}
      <hemisphereLight args={['#ffffff', '#d8d8d5', 0.28]} />

      {/* Large softboxes: key, fill and edge/rim. */}
      <rectAreaLight
        position={[4.8, 5.8, 5.2]}
        rotation={[-0.72, 0.55, 0.38]}
        width={5.5}
        height={7}
        intensity={5.2}
        color="#fffdf8"
      />
      <rectAreaLight
        position={[-4.5, 3.8, 3.2]}
        rotation={[-0.25, -0.82, -0.2]}
        width={4}
        height={6}
        intensity={3.2}
        color="#f7faff"
      />
      <rectAreaLight
        position={[3.2, 3.8, -4.8]}
        rotation={[0.1, 0.15, 0]}
        width={3}
        height={5.5}
        intensity={3.6}
        color="#ffffff"
      />

      {/* Soft top light reveals the top plane without washing it out. */}
      <rectAreaLight
        position={[0, 7.5, 0.4]}
        rotation={[-Math.PI / 2, 0, 0]}
        width={5}
        height={4}
        intensity={2.1}
        color="#ffffff"
      />

      {/* Procedural HDR-style studio environment: reflection cards + global illumination. */}
      <Environment resolution={512} environmentIntensity={0.72}>
        <Lightformer form="rect" intensity={4.2} position={[5, 3.5, 4]} rotation={[0, -0.82, 0]} scale={[5, 8, 1]} />
        <Lightformer form="rect" intensity={2.8} position={[-5, 3, 3]} rotation={[0, 0.88, 0]} scale={[4, 7, 1]} />
        <Lightformer form="rect" intensity={3.4} position={[3, 3, -5]} rotation={[0, 0.15, 0]} scale={[3, 6, 1]} />
        <Lightformer form="rect" intensity={1.7} position={[-2, 6, -1]} rotation={[Math.PI / 2, 0, 0]} scale={[6, 4, 1]} />
      </Environment>

      {/* Grounding only: no visible floor, just a broad soft contact shadow. */}
      <ContactShadows
        position={[0, -1.02, 0]}
        opacity={0.24}
        scale={12}
        blur={3.2}
        far={5}
        resolution={1024}
      />
    </>
  )
}
