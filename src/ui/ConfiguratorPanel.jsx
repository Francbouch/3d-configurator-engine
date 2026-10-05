import { useState } from 'react'
import materials from '../data/materials/materials.json'
import product from '../data/products/product.example.json'
import { getGroupMaterials } from '../configurator/materials/MaterialAvailability'
import { useConfiguratorStore } from '../configurator/state/configuratorStore'
import { calculatePrice } from '../configurator/pricing/PriceEngine'
import { formatPrice } from '../configurator/pricing/PricingUtils'
import MaterialPreview from './MaterialPreview'

export default function ConfiguratorPanel() {
  const [openSection, setOpenSection] = useState(null)
  const selectedMaterials = useConfiguratorStore((state) => state.selectedMaterials)
  const setMaterial = useConfiguratorStore((state) => state.setMaterial)

  const price = calculatePrice(product.pricing, selectedMaterials)
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

      {showPrice && (
        <div className="panel__price">
          <span>Prix</span>
          <strong>{formatPrice(price.total, price.currency)}</strong>
        </div>
      )}
    </aside>
  )
}
