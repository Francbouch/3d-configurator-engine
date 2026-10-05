export default function ProductPlaceholder() {
  return (
    <group position={[0, -0.1, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.9, 2.8, 0.65]} />
        <meshStandardMaterial color="#e7e4de" roughness={0.58} />
      </mesh>
      <mesh position={[0, 0, 0.34]} castShadow>
        <boxGeometry args={[1.72, 2.55, 0.08]} />
        <meshStandardMaterial color="#f5f3ef" roughness={0.5} />
      </mesh>
    </group>
  )
}
