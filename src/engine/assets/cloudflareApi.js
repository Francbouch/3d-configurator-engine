// Cloudflare migration adapter. Staging only: no production behavior changes.
export const CLOUDFLARE_API = 'https://configurator-api.francbouch.workers.dev'
export const CABINET_MODEL_URL = `${CLOUDFLARE_API}/v1/models/lit-cabinet.glb`

// Share publication requests across scene, model and panel. Refresh after 60 seconds.
const publicationCache = new Map()
const PUBLICATION_TTL_MS = 60_000

export function fetchCloudflarePublication(productId) {
  const cached = publicationCache.get(productId)
  if (cached && Date.now() - cached.createdAt < PUBLICATION_TTL_MS) return cached.promise

  const promise = fetch(`${CLOUDFLARE_API}/v1/publications/${encodeURIComponent(productId)}`)
    .then((response) => {
      if (!response.ok) throw new Error(`Cloudflare publication unavailable (HTTP ${response.status})`)
      return response.json()
    })
    .catch((error) => {
      if (publicationCache.get(productId)?.promise === promise) publicationCache.delete(productId)
      throw error
    })
  publicationCache.set(productId, { createdAt: Date.now(), promise })
  return promise
}

// Staging Cloudflare admin uses the separate authenticated Worker API.\n