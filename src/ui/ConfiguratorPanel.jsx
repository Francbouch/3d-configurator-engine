import { useState } from 'react'
import materials from '../data/materials/materials.json'
import { useConfiguratorStore } from '../configurator/state/configuratorStore'

const sections = [
  { id: 'facade', label: 'Façade' },
  { id: 'caisson', label: 'Caisson' },
  { id: 'interieur', label: 'Intérieur' },
]

export default function ConfiguratorPanel() {
  const [openSection, setOpenSection] = useState(null)
  const selectedMaterials = useConfiguratorStore((state) => state.selectedMaterials)
  const setMaterial = useConfiguratorStore((state) => state.setMaterial)

  return (
    <aside className="panel">
      <div className="panel__eyebrow">Configurateur 3D</div>
      <h1>Votre meuble</h1>
      <p className="panel__intro">Choisissez les finitions de chaque partie du meuble.</p>

      <div className="panel__sections">
        {sections.map((section) => {
          const isOpen = openSection === section.id
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
                  {materials.map((material) => (
                    <button
                      className={selectedMaterials[section.id] === material.id ? 'material-chip is-selected' : 'material-chip'}
                      type="button"
                      key={material.id}
                      onClick={() => setMaterial(section.id, material.id)}
                    >
                      {material.name}
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
