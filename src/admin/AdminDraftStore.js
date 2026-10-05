const VERSION = 1

function storageKey(productId) {
  return `configurator-admin-draft:${productId}`
}

export function loadAdminDraft(productId) {
  try {
    const raw = window.localStorage.getItem(storageKey(productId))
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (parsed?.version !== VERSION || parsed?.productId !== productId) return null

    return parsed.payload ?? null
  } catch (error) {
    console.warn('Unable to load local admin draft', error)
    return null
  }
}

export function saveAdminDraft(productId, payload) {
  try {
    window.localStorage.setItem(
      storageKey(productId),
      JSON.stringify({
        version: VERSION,
        productId,
        savedAt: new Date().toISOString(),
        payload,
      }),
    )
    return true
  } catch (error) {
    console.warn('Unable to save local admin draft', error)
    return false
  }
}

export function clearAdminDraft(productId) {
  try {
    window.localStorage.removeItem(storageKey(productId))
    return true
  } catch (error) {
    console.warn('Unable to clear local admin draft', error)
    return false
  }
}
