import { Environment } from '@react-three/drei'

export const DEFAULT_STUDIO_LIGHTING = Object.freeze({
  hemisphere: {
    skyColor: '#ffffff',
    groundColor: '#e7e7e4',
    intensity: 0.34,
  },
  key: {
    position: [9.5, 3.4, 7.5],
    intensity: 1.0,
  },
  fill: {
    position: [-5.5, 3.2, 4],
    intensity: 1.0,
  },
  rim: {
    position: [2.5, 4, -6],
    intensity: 0.85,
  },
  environmentIntensity: 0.78,
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
      <Environment preset="studio" environmentIntensity={preset.environmentIntensity} />
    </>
  )
}
