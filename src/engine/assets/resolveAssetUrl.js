export function resolveAssetUrl(path) {
  if (!path) return null

  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }

  const base = import.meta.env.BASE_URL || './'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const normalizedPath = String(path).replace(/^\.\//, '').replace(/^\//, '')

  return `${normalizedBase}${normalizedPath}`
}
