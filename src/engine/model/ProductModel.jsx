import { Clone, useGLTF } from '@react-three/drei'

function LoadedProduct({ url }) {
  const { scene } = useGLTF(url)
  return <Clone object={scene} castShadow receiveShadow />
}

export default function ProductModel({ url }) {
  if (!url) return null
  return <LoadedProduct url={url} />
}
