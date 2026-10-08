import { useEffect, useMemo, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import product from '../data/products/product.example.json'
import { getGroupMaterials } from '../configurator/materials/MaterialAvailability'
import { useConfiguratorStore } from '../configurator/state/configuratorStore'
import { calculatePrice } from '../configurator/pricing/PriceEngine'
import { formatPrice } from '../configurator/pricing/PricingUtils'
import MaterialPreview from './MaterialPreview'
import { MASTER_MATERIAL_LIBRARY_URL, materialRecordsFromScene } from '../engine/materials/MasterMaterialLibrary'
import { SUPABASE_PROJECT_URL, supabaseHeaders } from '../admin/AdminAuth'

const CONFIGURATOR_DRAFT_KEY = `configurator-admin-draft:${product.id}`

export default function ConfiguratorPanel() {
  const [openSection, setOpenSection] = useState(null)
  const [publishedConfig, setPublishedConfig] = useState(null)
  const [localGroups, setLocalGroups] = useState([])
  const [manualGroupId, setManualGroupId] = useState(null)
  const [hasManualMaterialSelection, setHasManualMaterialSelection] = useState(false)
  const materialGltf = useGLTF(MASTER_MATERIAL_LIBRARY_URL)
  const legacyMaterials = useMemo(() => materialRecordsFromScene(materialGltf.scene), [materialGltf.scene])
  const materials = useMemo(() => {
    const source = Array.isArray(publishedConfig?.materials) ? publishedConfig.materials : legacyMaterials
    return source.filter((material) => material.active !== false)
  }, [publishedConfig, legacyMaterials])
  const initializeMaterialCatalog = useConfiguratorStore((state) => state.initializeMaterialCatalog)
  const initializeDynamicGroups = useConfiguratorStore((state) => state.initializeDynamicGroups)
  const selectedMaterials = useConfiguratorStore((state) => state.selectedMaterials)
  const setMaterial = useConfiguratorStore((state) => state.setMaterial)
  const setAnimationProgress = useConfiguratorStore((state) => state.setAnimationProgress)
  const selectedModules = useConfiguratorStore((state) => state.selectedModules)
  const toggleModule = useConfiguratorStore((state) => state.toggleModule)
  const publishedGroups = Array.isArray(publishedConfig?.materialGroups) ? publishedConfig.materialGroups : []
  const dynamicGroups = publishedGroups.length ? publishedGroups : localGroups
  const runtimeMaterialGroups = Object.fromEntries(dynamicGroups.map((group) => [
    group.id,
    {
      label: group.name || group.id,
      defaultMaterialId: group.materialId || null,
    },
  ]))
  const runtimeProduct = publishedConfig ? {
    ...product,
    model: { ...product.model, parts: publishedConfig.parts ?? product.model?.parts ?? [] },
    materialGroups: runtimeMaterialGroups,
    rules: publishedConfig.rules ?? product.rules,
    ruleGraph: publishedConfig.ruleGraph ?? product.ruleGraph,
    modules: publishedConfig.modules ?? product.modules,
    pricing: publishedConfig.pricing ?? product.pricing,
    name: publishedConfig.name ?? product.name,
  } : {
    ...product,
    materialGroups: dynamicGroups.length ? runtimeMaterialGroups : product.materialGroups,
  }

  useEffect(() => {
    let cancelled = false
    fetch(
      `${SUPABASE_PROJECT_URL}/rest/v1/configurator_publications?product_id=eq.${encodeURIComponent(product.id)}&select=configuration&limit=1`,
      { headers: supabaseHeaders() },
    )
      .then((response) => response.ok ? response.json() : [])
      .then((rows) => { if (!cancelled) setPublishedConfig(rows?.[0]?.configuration ?? null) })
      .catch((error) => console.warn('Unable to load published configuration', error))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    initializeMaterialCatalog(materials)
  }, [initializeMaterialCatalog, materials])

  const modules = (runtimeProduct.modules ?? []).filter((module) => module.enabled !== false && module.model?.url)

  useEffect(() => {
    const readGroups = () => {
      try {
        const raw = window.localStorage.getItem(CONFIGURATOR_DRAFT_KEY)
        const stored = raw ? JSON.parse(raw) : null
        setLocalGroups(Array.isArray(stored?.payload?.materialGroups) ? stored.payload.materialGroups : [])
      } catch {
        setLocalGroups([])
      }
    }
    readGroups()
    window.addEventListener('storage', readGroups)
    window.addEventListener('focus', readGroups)
    return () => {
      window.removeEventListener('storage', readGroups)
      window.removeEventListener('focus', readGroups)
    }
  }, [])

  const sections = dynamicGroups
    .filter((group) => group.role === 'modifiable')
    .map((group) => ({ id: group.id, label: group.name || 'Groupe', defaultMaterialId: group.materialId }))

  const effectiveSelections = sections.map((section) => ({
    sectionId: section.id,
    materialId: selectedMaterials[section.id] || section.defaultMaterialId || null,
  }))
  const chargedMaterialIds = [...new Set(effectiveSelections.map((item) => item.materialId).filter(Boolean))]
  const paidMaterialOwner = {}
  effectiveSelections.forEach(({ sectionId, materialId }) => {
    const material = materials.find((item) => item.id === materialId)
    if (materialId && Number(material?.priceAdjustment ?? 0) > 0 && !paidMaterialOwner[materialId]) {
      paidMaterialOwner[materialId] = sectionId
    }
  })
  const basePrice = Number(runtimeProduct.pricing?.basePrice ?? 0)
  const materialSupplement = chargedMaterialIds.reduce((total, materialId) => {
    const material = materials.find((item) => item.id === materialId)
    const amount = Number(material?.priceAdjustment ?? 0)
    return total + (Number.isFinite(amount) && amount > 0 ? amount : 0)
  }, 0)
  const price = basePrice + materialSupplement
  const discount = Math.max(0, Number(runtimeProduct.pricing?.discount ?? 0) || 0)
  const hasDiscount = discount > 0
  const discountedPrice = Math.max(0, basePrice - discount) + materialSupplement
  const showPrice = publishedConfig
    ? publishedConfig?.pricing?.displayPrice === true && Number.isFinite(price)
    : product.pricing?.displayPrice !== false && Number.isFinite(price)

  useEffect(() => {
    initializeDynamicGroups(dynamicGroups)
  }, [dynamicGroups, initializeDynamicGroups])

  return (
    <aside className="panel">
      <div className="panel__eyebrow">Configurateur 3D</div>
      <h1>{runtimeProduct.name || 'Votre meuble'}</h1>
      <p className="panel__intro">Choisissez les finitions de chaque partie du meuble.</p>

      <div className="panel__sections">
        {sections.map((section) => {
          const isOpen = openSection === section.id
          const allowedMaterials = getGroupMaterials({
            product: runtimeProduct,
            groupId: section.id,
            selected: selectedMaterials,
            materials,
            activeCauseGroupId: hasManualMaterialSelection ? manualGroupId : null,
          })
          const sectionMaterials = allowedMaterials.filter((material) => material.active !== false)

          return (
            <div className="panel__group" key={section.id}>
              <button
                className="panel__section"
                type="button"
                onClick={() => {
                  if (!isOpen && /façade|facade/i.test(section.label)) setAnimationProgress(0)
                  setOpenSection(isOpen ? null : section.id)
                }}
              >
                <span>{section.label}</span>
                <span className="panel__value">{
                  materials.find((material) => material.id === (selectedMaterials[section.id] || section.defaultMaterialId))?.name
                  ?? ''
                }</span>
                <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
              </button>

              {isOpen && (
                <div className="material-grid">
                  {sectionMaterials.map((material) => (
                    <button
                      className={selectedMaterials[section.id] === material.id ? 'material-chip is-selected' : 'material-chip'}
                      type="button"
                      key={material.id}
                      onClick={() => {
                        // The user's last manual choice is authoritative.
                        // Rules may repair other groups, but those automatic repairs must
                        // not cascade back and override the group the user just chose.
                        const authoritativeGroupId = section.id
                        // Rules stay completely dormant until the first real material click.
                        setHasManualMaterialSelection(true)
                        setManualGroupId(authoritativeGroupId)
                        const nextSelected = { ...selectedMaterials, [authoritativeGroupId]: material.id }
                        const repaired = { ...nextSelected }

                        sections.forEach((targetSection) => {
                          if (targetSection.id === authoritativeGroupId) return

                          const available = getGroupMaterials({
                            product: runtimeProduct,
                            groupId: targetSection.id,
                            selected: nextSelected,
                            materials,
                            activeCauseGroupId: authoritativeGroupId,
                          })

                          if (!available.some((item) => item.id === repaired[targetSection.id])) {
                            repaired[targetSection.id] = available.find((item) => item.id === targetSection.defaultMaterialId)?.id
                              ?? available[0]?.id
                              ?? null
                          }
                        })

                        useConfiguratorStore.setState({ selectedMaterials: repaired })
                      }}
                    >
                      <span className="material-chip__preview">
                        <MaterialPreview material={material} />
                      </span>
                      <span className="material-chip__meta">
                        <span className="material-chip__name">{material.name}</span>
                        {Number(material.priceAdjustment ?? 0) > 0 &&
                          (!chargedMaterialIds.includes(material.id) || paidMaterialOwner[material.id] === section.id) && (
                            <small className="material-chip__price">+{Number(material.priceAdjustment).toFixed(2)}$</small>
                          )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {modules.length > 0 && (
        <div className="panel__sections">
          <div className="panel__group">
            <div className="panel__section">
              <span>Options</span>
            </div>
            <div className="material-grid">
              {modules.map((module) => (
                <button
                  className={selectedModules[module.id] ? 'material-chip is-selected' : 'material-chip'}
                  type="button"
                  key={module.id}
                  onClick={() => toggleModule(module.id)}
                >
                  <span className="material-chip__meta">
                    <span className="material-chip__name">{module.name}</span>
                    {Number(module.price ?? 0) > 0 && (
                      <span>+ {formatPrice(Number(module.price), product.pricing?.currency ?? 'CAD')}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showPrice && (
        <div className="panel__price panel__price--floating">
          <span>Votre configuration</span>
          {hasDiscount ? (
            <div className="panel__discount-prices">
              <del>{formatPrice(price, runtimeProduct.pricing?.currency ?? 'CAD')}</del>
              <strong>{formatPrice(discountedPrice, runtimeProduct.pricing?.currency ?? 'CAD')}</strong>
            </div>
          ) : (
            <strong>{formatPrice(price, runtimeProduct.pricing?.currency ?? 'CAD')}</strong>
          )}
        </div>
      )}
    </aside>
  )
}
