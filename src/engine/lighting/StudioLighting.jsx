import { ContactShadows, Environment, Lightformer } from '@react-three/drei'

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
})

export default function StudioLighting({ settings = {} }) {
  const s = { ...DEFAULT_SCENE_SETTINGS, ...settings }
  return (
    <>
      <hemisphereLight args={['#ffffff', '#d8d8d5', s.hemisphereIntensity]} />
      <rectAreaLight position={[4.8, 5.8, 5.2]} rotation={[-0.72, 0.55, 0.38]} width={5.5} height={7} intensity={s.keyIntensity} color="#fffdf8" />
      <rectAreaLight position={[-4.5, 3.8, 3.2]} rotation={[-0.25, -0.82, -0.2]} width={4} height={6} intensity={s.fillIntensity} color="#f7faff" />
      <rectAreaLight position={[3.2, 3.8, -4.8]} rotation={[0.1, 0.15, 0]} width={3} height={5.5} intensity={s.rimIntensity} color="#ffffff" />
      <rectAreaLight position={[0, 7.5, 0.4]} rotation={[-Math.PI / 2, 0, 0]} width={5} height={4} intensity={s.topIntensity} color="#ffffff" />
      <Environment resolution={512} environmentIntensity={s.environmentIntensity}>
        <Lightformer form="rect" intensity={4.2} position={[5, 3.5, 4]} rotation={[0, -0.82, 0]} scale={[5, 8, 1]} />
        <Lightformer form="rect" intensity={2.8} position={[-5, 3, 3]} rotation={[0, 0.88, 0]} scale={[4, 7, 1]} />
        <Lightformer form="rect" intensity={3.4} position={[3, 3, -5]} rotation={[0, 0.15, 0]} scale={[3, 6, 1]} />
        <Lightformer form="rect" intensity={1.7} position={[-2, 6, -1]} rotation={[Math.PI / 2, 0, 0]} scale={[6, 4, 1]} />
      </Environment>
      <ContactShadows position={[0, -1.02, 0]} opacity={s.shadowOpacity} scale={12} blur={s.shadowBlur} far={5} resolution={1024} />
    </>
  )
}
