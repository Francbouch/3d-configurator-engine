import { Environment, Lightformer } from '@react-three/drei'

export const DEFAULT_STUDIO_LIGHTING = Object.freeze({
  hemisphere: {
    skyColor: '#ffffff',
    groundColor: '#e7e7e4',
    intensity: 0.34,
  },
  key: {
    position: [10.5, 2.6, 4.5],
    intensity: 1.2,
  },
  fill: {
    position: [-5.5, 3.2, 4],
    intensity: 1.1,
  },
  rim: {
    position: [2.5, 4, -6],
    intensity: 0.95,
  },
  environmentIntensity: 0.58,
})

export default function StudioLighting({ preset = DEFAULT_STUDIO_LIGHTING }) {
  return (
    <>
      <hemisphereLight
        args={[
          preset.hemisphere.skyColor,
          preset.hemisphere.groundColor,
          preset.hemisphere.intensity,
        ]}
      />
      <directionalLight position={preset.key.position} intensity={preset.key.intensity} />
      <directionalLight position={preset.fill.position} intensity={preset.fill.intensity} />
      <directionalLight position={preset.rim.position} intensity={preset.rim.intensity} />

      <Environment resolution={256} environmentIntensity={preset.environmentIntensity}>
        <Lightformer
          form="rect"
          intensity={2.8}
          position={[5, 2.5, 4]}
          rotation={[0, -0.75, 0]}
          scale={[4, 7, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.9}
          position={[-5, 1.5, 2]}
          rotation={[0, 0.9, 0]}
          scale={[3.5, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.45}
          position={[1, 2.5, -5]}
          rotation={[0, 0, 0]}
          scale={[5, 4, 1]}
        />
      </Environment>
    </>
  )
}
