import { useEffect, useMemo, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import product from '../data/products/product.example.json'
import { getGroupMaterials } from '../configurator/materials/MaterialAvailability'
import { useConfiguratorStore } from '../configurator/state/configuratorStore'
import { calculatePrice } from '../configurator/pricing/PriceEngine'
import { formatPrice } from '../configurator/pricing/PricingUtils'
import MaterialPreview from './MaterialPreview'
import { MASTER_MATERIAL_LIBRARY_URL, materialRecordsFromScene } from '../engine/materials/MasterMaterialLibrary'

export default function ConfiguratorPanel() {
  const [openSection, setOpenSection] = useState(null)
  const materialGltf = useGLTF(MASTER_MATERIAL_LIBRARY_URL)
  const materials = useMemo(() => materialRecordsFromScene(materialGltf.scene), [materialGltf.scene])
  const initializeMaterialCatalog = useConfiguratorStore((state) => state.initializeMaterialCatalog)
  const selectedMaterials = useConfiguratorStore((state) => state.selectedMaterials)
  const setMaterial = useConfiguratorStore((state) => state.setMaterial)
  const selectedModules = useConfiguratorStore((state) => state.selectedModules)
  const toggleModule = useConfiguratorStore((state) => state.toggleModule)
  const animationProgress = useConfiguratorStore((state) => state.animationProgress)
  const setAnimationProgress = useConfiguratorStore((state) => state.setAnimationProgress)
  const bedAnimation = product.animations?.open

  useEffect(() => {
    initializeMaterialCatalog(materials)
  }, [initializeMaterialCatalog, materials])

  const modules = (product.modules ?? []).filter((module) => module.enabled !== false && module.model?.url)
  const price = calculatePrice(product.pricing, selectedMaterials, modules, selectedModules)
  const showPrice = product.pricing?.displayPrice === true

  const groupOrder = product.configurationFlow ?? Object.keys(product.materialGroups)
  const sections = groupOrder
    .filter((id) => product.materialGroups[id])
    .map((id) => ({
      id,
      label: product.materialGroups[id].label,
    }))

  return (
    <aside className="panel">
      <div className="panel__eyebrow">Configurateur 3D</div>
      <h1>Votre meuble</h1>
      <p className="panel__intro">Choisissez les finitions de chaque partie du meuble.</p>

      <div className="panel__sections">
        {sections.map((section) => {
          const isOpen = openSection === section.id
          const allowedMaterials = getGroupMaterials({
            product,
            groupId: section.id,
            selected: selectedMaterials,
            materials,
          })

          return (
            <div className="panel__group" key={section.id}>
              <button
                className="panel__section"
                type="button"
                onClick={() => setOpenSection(isOpen ? null : section.id)}
              >
                <span>{section.label}</span>
                <span className="panel__value">{selectedMaterials[section.id]}</span>
                <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
              </button>

              {isOpen && (
                <div className="material-grid">
                  {allowedMaterials.map((material) => (
                    <button
                      className={selectedMaterials[section.id] === material.id ? 'material-chip is-selected' : 'material-chip'}
                      type="button"
                      key={material.id}
                      onClick={() => setMaterial(section.id, material.id)}
                    >
                      <span className="material-chip__preview">
                        <MaterialPreview material={material} />
                      </span>
                      <span className="material-chip__meta">
                        <span className="material-chip__name">{material.name}</span>
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

      {bedAnimation?.enabled && (
        <div className="panel__bed-control" aria-label="Position du lit">
          <button
            className={animationProgress < 0.5 ? 'bed-toggle is-active' : 'bed-toggle'}
            type="button"
            onClick={() => setAnimationProgress(0)}
          >
            {bedAnimation.labelClose ?? 'Fermer le lit'}
          </button>
          <button
            className={animationProgress >= 0.5 ? 'bed-toggle is-active' : 'bed-toggle'}
            type="button"
            onClick={() => setAnimationProgress(1)}
          >
            {bedAnimation.labelOpen ?? 'Ouvrir le lit'}
          </button>
        </div>
      )}

      {showPrice && (
        <div className="panel__price">
          <span>Prix</span>
          <strong>{formatPrice(price.total, price.currency)}</strong>
        </div>
      )}
    </aside>
  )
}
