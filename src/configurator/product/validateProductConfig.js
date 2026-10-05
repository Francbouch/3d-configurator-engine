export function validateProductConfig(product, materials = []) {
  const errors = []
  const warnings = []
  const groups = product?.materialGroups ?? {}
  const groupIds = new Set(Object.keys(groups))
  const materialIds = new Set(materials.map((material) => material.id))
  const collections = product?.materialCollections ?? []
  const collectionIds = new Set(collections.map((collection) => collection.id))

  if (!product?.id) errors.push('Le produit doit avoir un id.')
  if (!product?.model?.url) errors.push('Le produit doit avoir une URL de modèle 3D.')

  const duplicateMaterialIds = materials
    .map((material) => material.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index)
  if (duplicateMaterialIds.length) {
    errors.push(`IDs de matériaux dupliqués: ${[...new Set(duplicateMaterialIds)].join(', ')}.`)
  }

  const flow = product?.configurationFlow ?? []
  flow.forEach((groupId) => {
    if (!groupIds.has(groupId)) {
      errors.push(`Le parcours référence un groupe inexistant: "${groupId}".`)
    }
  })

  Object.entries(groups).forEach(([groupId, group]) => {
    if (!flow.includes(groupId)) {
      warnings.push(`Le groupe "${groupId}" n’est pas présent dans configurationFlow.`)
    }

    if (group.defaultMaterialId && !materialIds.has(group.defaultMaterialId)) {
      errors.push(
        `Le matériau par défaut "${group.defaultMaterialId}" du groupe "${groupId}" n’existe pas.`,
      )
    }

    ;(group.allowedCollectionIds ?? []).forEach((collectionId) => {
      if (!collectionIds.has(collectionId)) {
        errors.push(
          `Le groupe "${groupId}" référence la collection inexistante "${collectionId}".`,
        )
      }
    })
  })

  collections.forEach((collection) => {
    ;(collection.materialIds ?? []).forEach((materialId) => {
      if (!materialIds.has(materialId)) {
        errors.push(
          `La collection "${collection.id}" référence le matériau inexistant "${materialId}".`,
        )
      }
    })
  })

  ;(product?.model?.parts ?? []).forEach((part) => {
    if (part.materialEditable && !part.group) {
      errors.push(`La pièce modifiable "${part.node ?? part.nodePath ?? 'Sans nom'}" n’a aucun groupe.`)
    }
    if (part.group && !groupIds.has(part.group)) {
      errors.push(
        `La pièce "${part.node ?? part.nodePath ?? 'Sans nom'}" référence le groupe inexistant "${part.group}".`,
      )
    }
  })

  ;(product?.rules ?? []).forEach((rule) => {
    if (!groupIds.has(rule.targetGroup)) {
      errors.push(`La règle "${rule.id ?? 'sans id'}" cible un groupe inexistant.`)
    }

    if (rule.when?.group && !groupIds.has(rule.when.group)) {
      errors.push(
        `La règle "${rule.id ?? 'sans id'}" dépend du groupe inexistant "${rule.when.group}".`,
      )
    }

    ;(rule.allow?.selectedFromGroups ?? []).forEach((groupId) => {
      if (!groupIds.has(groupId)) {
        errors.push(
          `La règle "${rule.id ?? 'sans id'}" référence le groupe inexistant "${groupId}".`,
        )
      }
    })

    ;(rule.allow?.materialIds ?? []).forEach((materialId) => {
      if (!materialIds.has(materialId)) {
        errors.push(
          `La règle "${rule.id ?? 'sans id'}" référence le matériau inexistant "${materialId}".`,
        )
      }
    })
  })

  const basePrice = product?.pricing?.basePrice
  if (basePrice != null && !Number.isFinite(Number(basePrice))) {
    errors.push('Le prix de base doit être numérique.')
  }

  ;(product?.pricing?.adjustments ?? []).forEach((adjustment) => {
    if (!Number.isFinite(Number(adjustment.amount ?? 0))) {
      errors.push(`Le supplément "${adjustment.id ?? adjustment.label ?? 'sans id'}" a un montant invalide.`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
