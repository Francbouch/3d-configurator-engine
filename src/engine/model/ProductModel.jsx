import { Center, Clone, useGLTF } from '@react-three/drei'

function LoadedProduct({ url }) {
  const { scene } = useGLTF(url)

  return (
    <Center bottom>
      <Clone object={scene} castShadow receiveShadow />
    </Center>
  )
}

export default function ProductModel({ url }) {
  if (!url) return null
  return <LoadedProduct url={url} />
}
