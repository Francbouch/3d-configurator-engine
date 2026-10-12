// Cloudflare migration adapter. Staging only: no production behavior changes.
export const CLOUDFLARE_API = 'https://configurator-api.francbouch.workers.dev'
export const CABINET_MODEL_URL = `${CLOUDFLARE_API}/v1/models/lit-cabinet.glb`

export async function fetchCloudflarePublication(productId) {
  const response = await fetch(`${CLOUDFLARE_API}/v1/publications/${encodeURIComponent(productId)}`)
  if (!response.ok) {
    throw new Error(`Cloudflare publication unavailable (HTTP ${response.status})`)
  }
  return response.json()
}

// The current admin still requires Supabase Auth and its write APIs.
// Do not switch it to Cloudflare until authenticated uploads and publishing
// are implemented, tested, and the source assets have been migrated.
