export function createPriceAdjustment({
  id,
  label,
  amount = 0,
  group = null,
  materialId = null,
}) {
  return {
    id,
    label,
    amount: Number(amount) || 0,
    enabled: true,
    ...(group && materialId
      ? { when: { group, operator: 'equals', value: materialId } }
      : {}),
  }
}

export function formatPrice(amount, currency = 'CAD', locale = 'fr-CA') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0)
}
