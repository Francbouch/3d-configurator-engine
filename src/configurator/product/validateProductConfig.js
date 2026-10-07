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

  materials.forEach((material) => {
    const label = material?.name ?? material?.id ?? 'sans nom'

    if (!material?.id?.trim()) {
      errors.push(`Le matériau "${label}" doit avoir un id.`)
    }

    if (!material?.name?.trim()) {
      errors.push(`Le matériau "${label}" doit avoir un nom.`)
    }

    if (
      material?.priceAdjustment != null &&
      !Number.isFinite(Number(material.priceAdjustment))
    ) {
      errors.push(`Le matériau "${label}" a un supplément invalide.`)
    }
  })

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


  Object.entries(product?.animations ?? {}).forEach(([animationId, animation]) => {
    if (animation?.enabled === false) return

    const label = animationId || 'sans id'
    if (!animation?.clip?.trim()) {
      errors.push(`L’animation "${label}" doit référencer un clip GLB.`)
    }

    const closedFrame = Number(animation?.closedFrame)
    const openFrame = Number(animation?.openFrame)
    if (!Number.isFinite(closedFrame) || !Number.isFinite(openFrame)) {
      errors.push(`L’animation "${label}" doit avoir des frames numériques.`)
    } else if (closedFrame < 0 || openFrame < 0 || closedFrame >= openFrame) {
      errors.push(`L’animation "${label}" doit respecter 0 ≤ frame fermée < frame ouverte.`)
    }
  })

  const modules = product?.modules ?? []
  const duplicateModuleIds = modules
    .map((module) => module.id)
    .filter(Boolean)
    .filter((id, index, ids) => ids.indexOf(id) !== index)

  if (duplicateModuleIds.length) {
    errors.push(`IDs de modules dupliqués: ${[...new Set(duplicateModuleIds)].join(', ')}.`)
  }

  modules.forEach((module) => {
    const label = module.name ?? module.id ?? 'sans nom'
    if (!module.id) errors.push(`Le module "${label}" doit avoir un id.`)
    if (!module.name?.trim()) errors.push(`Le module "${label}" doit avoir un nom.`)
    if (!Number.isFinite(Number(module.price ?? 0)) || Number(module.price ?? 0) < 0) {
      errors.push(`Le module "${label}" a un supplément invalide.`)
    }
    if (module.materialGroup && !groupIds.has(module.materialGroup)) {
      errors.push(`Le module "${label}" référence le groupe inexistant "${module.materialGroup}".`)
    }
    if (module.model?.url && !module.model?.anchor?.trim()) {
      errors.push(`Le module "${label}" doit avoir une position d’assemblage.`)
    }
  })

  const basePrice = product?.pricing?.basePrice
  if (
    basePrice != null &&
    (!Number.isFinite(Number(basePrice)) || Number(basePrice) < 0)
  ) {
    errors.push('Le prix de base doit être un nombre positif ou nul.')
  }

  const adjustments = product?.pricing?.adjustments ?? []
  const duplicateAdjustmentIds = adjustments
    .map((adjustment) => adjustment.id)
    .filter(Boolean)
    .filter((id, index, ids) => ids.indexOf(id) !== index)

  if (duplicateAdjustmentIds.length) {
    errors.push(
      `IDs de suppléments dupliqués: ${[...new Set(duplicateAdjustmentIds)].join(', ')}.`,
    )
  }

  adjustments.forEach((adjustment) => {
    const label = adjustment.id ?? adjustment.label ?? 'sans id'

    if (!adjustment.id?.trim()) {
      errors.push(`Le supplément "${label}" doit avoir un id.`)
    }

    if (!adjustment.label?.trim()) {
      errors.push(`Le supplément "${label}" doit avoir un libellé.`)
    }

    if (!Number.isFinite(Number(adjustment.amount ?? 0))) {
      errors.push(`Le supplément "${label}" a un montant invalide.`)
    }

    if (adjustment.when?.group && !groupIds.has(adjustment.when.group)) {
      errors.push(
        `Le supplément "${label}" dépend du groupe inexistant "${adjustment.when.group}".`,
      )
    }

    if (
      adjustment.when?.operator === 'equals' ||
      adjustment.when?.operator === 'notEquals'
    ) {
      if (adjustment.when.value && !materialIds.has(adjustment.when.value)) {
        errors.push(
          `Le supplément "${label}" référence le matériau inexistant "${adjustment.when.value}".`,
        )
      }
    }

    if (adjustment.when?.operator === 'in' || adjustment.when?.operator === 'notIn') {
      ;(adjustment.when.values ?? []).forEach((materialId) => {
        if (!materialIds.has(materialId)) {
          errors.push(
            `Le supplément "${label}" référence le matériau inexistant "${materialId}".`,
          )
        }
      })
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
