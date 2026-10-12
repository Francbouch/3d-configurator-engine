// Staging-only smoke test: verify the R2 publication, model and every referenced texture.
const api = 'https://configurator-api.francbouch.workers.dev'
const productId = 'lit-cabinet-development'
const publicationResponse = await fetch(`${api}/v1/publications/${productId}`)
if (!publicationResponse.ok) throw new Error(`Publication HTTP ${publicationResponse.status}`)
const publication = await publicationResponse.json()
const config = publication.configuration
if (!config || !Array.isArray(config.materials) || !Array.isArray(config.parts)) {
  throw new Error('Publication must contain configuration.materials and configuration.parts')
}
const urls = [...new Set(config.materials.map((material) => material?.source?.imageUrl).filter(Boolean))]
const modelUrl = publication.modelUrl || `${api}/v1/models/lit-cabinet.glb`
const assets = [modelUrl, ...urls]
const failures = []
for (const url of assets) {
  if (!url.startsWith(`${api}/v1/`)) {
    failures.push(`Unexpected external asset URL: ${url}`)
    continue
  }
  try {
    const response = await fetch(url, { method: 'HEAD' })
    if (!response.ok) failures.push(`HTTP ${response.status}: ${url}`)
    else console.log(`OK ${response.status}: ${url}`)
  } catch (error) {
    failures.push(`${url}: ${error.message}`)
  }
}
console.log(`Checked ${config.materials.length} materials, ${config.parts.length} parts, ${urls.length} unique texture URLs, and one model`)
if (failures.length) throw new Error(failures.join('\\n'))
