import { Bounds, Center, Clone, useGLTF } from '@react-three/drei'

function LoadedProduct({ url }) {
  const { scene } = useGLTF(url)

  return (
    <Bounds fit clip observe margin={1.18}>
      <Center bottom>
        <Clone object={scene} castShadow receiveShadow />
      </Center>
    </Bounds>
  )
}

export default function ProductModel({ url }) {
  if (!url) return null
  return <LoadedProduct url={url} />
}
