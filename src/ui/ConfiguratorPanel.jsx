import { useState } from 'react'
import materials from '../data/materials/materials.json'
import product from '../data/products/product.example.json'
import { getAllowedMaterials } from '../configurator/rules/RulesEngine'
import { useConfiguratorStore } from '../configurator/state/configuratorStore'
import MaterialPreview from './MaterialPreview'

export default function ConfiguratorPanel() {
  const [openSection, setOpenSection] = useState(null)
  const selectedMaterials = useConfiguratorStore((state) => state.selectedMaterials)
  const setMaterial = useConfiguratorStore((state) => state.setMaterial)

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
          const collectionIds = product.materialGroups[section.id]?.allowedCollectionIds ?? []
          const collectionMaterialIds = new Set(
            product.materialCollections
              .filter((collection) => collectionIds.includes(collection.id))
              .flatMap((collection) => collection.materialIds),
          )
          const groupMaterials = collectionIds.length
            ? materials.filter((material) => material.active !== false && collectionMaterialIds.has(material.id))
            : materials.filter((material) => material.active !== false)

          const allowedMaterials = getAllowedMaterials({
            groupId: section.id,
            selected: selectedMaterials,
            materials: groupMaterials,
            rules: product.rules,
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
                        {material.code && material.code !== material.name && (
                          <span className="material-chip__code">{material.code}</span>
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
    </aside>
  )
}
