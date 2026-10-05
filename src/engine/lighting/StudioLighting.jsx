import { Environment } from '@react-three/drei'

export const DEFAULT_STUDIO_LIGHTING = Object.freeze({
  hemisphere: {
    skyColor: '#ffffff',
    groundColor: '#eeeeec',
    intensity: 1.1,
  },
  key: {
    position: [6.5, 11, 8],
    intensity: 1.7,
  },
  fill: {
    position: [-4, 4, 3],
    intensity: 1.1,
  },
  rim: {
    position: [1, 3, -4],
    intensity: 0.6,
  },
  environmentIntensity: 0.68,
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
