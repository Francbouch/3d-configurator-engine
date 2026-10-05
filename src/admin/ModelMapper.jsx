import { useGLTF } from '@react-three/drei'
import { useMemo, useState } from 'react'
import product from '../data/products/product.example.json'
import { buildProductMappingDraft } from '../configurator/model/ProductMapping'

const MODEL_URL = `${import.meta.env.BASE_URL}CABINET%20TEST.glb`

export default function ModelMapper() {
  const gltf = useGLTF(MODEL_URL)
  const draft = useMemo(() => buildProductMappingDraft(gltf.scene), [gltf.scene])
  const [parts, setParts] = useState(draft.parts)
  const [basePrice, setBasePrice] = useState(product.pricing?.basePrice ?? 0)

  function updatePart(index, patch) {
    setParts((current) => current.map((part, i) => i === index ? { ...part, ...patch } : part))
  }

  return (
    <main className="admin">
      <header className="admin__header">
        <div>
          <div className="admin__eyebrow">Back-office · Modèle 3D</div>
          <h1>Pièces du modèle</h1>
          <p>{draft.scan.meshCount} pièces détectées automatiquement.</p>
        </div>
        <a className="admin__link" href="./">Retour au configurateur</a>
      </header>

      <section className="admin__pricing">
        <div>
          <strong>Prix de base</strong>
          <small>Le moteur ajoutera ensuite les suppléments selon la configuration.</small>
        </div>
        <label>
          <input type="number" min="0" step="1" value={basePrice} onChange={(event) => setBasePrice(Number(event.target.value))} />
          <span>$ CAD</span>
        </label>
      </section>

      <section className="admin__card">
        <div className="admin__table-head">
          <span>Pièce GLB</span><span>Rôle</span><span>Groupe</span>
        </div>
        {parts.map((part, index) => (
          <div className="admin__row" key={part.nodePath}>
            <div className="admin__part">
              <strong>{part.node || 'Sans nom'}</strong>
              <small>{part.sourceMaterials.join(', ') || 'Aucun matériau'}</small>
            </div>
            <select
              value={part.materialEditable ? 'editable' : 'fixed'}
              onChange={(event) => updatePart(index, { materialEditable: event.target.value === 'editable' })}
            >
              <option value="fixed">Fixe</option>
              <option value="editable">Modifiable</option>
            </select>
            <input
              value={part.group ?? ''}
              disabled={!part.materialEditable}
              placeholder={part.materialEditable ? 'ex. facade' : '—'}
              onChange={(event) => updatePart(index, { group: event.target.value || null })}
            />
          </div>
        ))}
      </section>
    </main>
  )
}
