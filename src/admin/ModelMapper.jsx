import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { useEffect, useMemo, useState } from 'react'
import product from '../data/products/product.example.json'
import {
  buildProductMappingDraft,
  toProductParts,
  validateProductMapping,
} from '../configurator/model/ProductMapping'
import { formatPrice } from '../configurator/pricing/PricingUtils'
import { resolveAssetUrl } from '../engine/assets/resolveAssetUrl'
import { clearAdminDraft, loadAdminDraft, saveAdminDraft } from './AdminDraftStore'

const MODEL_URL = resolveAssetUrl(product.model?.url)

export default function ModelMapper() {
  const [draft, setDraft] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [parts, setParts] = useState([])
  const [basePrice, setBasePrice] = useState(product.pricing?.basePrice ?? 0)
  const [adjustments, setAdjustments] = useState(product.pricing?.adjustments ?? [])
  const [saveStatus, setSaveStatus] = useState('')

  const groupIds = product.configurationFlow ?? Object.keys(product.materialGroups ?? {})
  const validation = useMemo(
    () => validateProductMapping({ parts }, product.materialGroups ?? {}),
    [parts],
  )

  useEffect(() => {
    let cancelled = false

    if (!MODEL_URL) {
      setLoadError('Aucun modèle 3D n’est configuré pour ce produit.')
      return undefined
    }

    const loader = new GLTFLoader()

    loader.load(
      MODEL_URL,
      (gltf) => {
        if (cancelled) return

        const nextDraft = buildProductMappingDraft(
          gltf.scene,
          product.model?.parts ?? [],
        )
        const saved = loadAdminDraft(product.id)

        setDraft(nextDraft)
        const restoredDraft = Array.isArray(saved?.parts)
          ? buildProductMappingDraft(gltf.scene, saved.parts)
          : nextDraft
        setParts(restoredDraft.parts)
        setBasePrice(
          Number.isFinite(saved?.pricing?.basePrice)
            ? saved.pricing.basePrice
            : product.pricing?.basePrice ?? 0,
        )
        setAdjustments(
          Array.isArray(saved?.pricing?.adjustments)
            ? saved.pricing.adjustments
            : product.pricing?.adjustments ?? [],
        )
        if (saved) setSaveStatus('Brouillon local restauré')
      },
      undefined,
      (error) => {
        if (cancelled) return
        console.error('Unable to load GLB for back-office mapping', error)
        setLoadError(
          'Impossible de charger le modèle 3D. Vérifiez que le fichier GLB est bien déployé.',
        )
      },
    )

    return () => {
      cancelled = true
    }
  }, [])

  function addAdjustment() {
    setAdjustments((current) => [
      ...current,
      { id: `adjustment-${Date.now()}`, label: '', amount: 0, enabled: true },
    ])
    setSaveStatus('')
  }

  function updateAdjustment(index, patch) {
    setAdjustments((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    )
    setSaveStatus('')
  }

  function removeAdjustment(index) {
    setAdjustments((current) => current.filter((_, i) => i !== index))
    setSaveStatus('')
  }

  function updatePart(index, patch) {
    setParts((current) =>
      current.map((part, i) => (i === index ? { ...part, ...patch } : part)),
    )
    setSaveStatus('')
  }

  function saveDraft() {
    const ok = saveAdminDraft(product.id, {
      parts: toProductParts({ parts }),
      pricing: {
        currency: product.pricing?.currency ?? 'CAD',
        basePrice,
        adjustments,
      },
    })

    setSaveStatus(ok ? 'Brouillon enregistré sur cet appareil' : 'Échec de l’enregistrement')
  }

  function resetDraft() {
    clearAdminDraft(product.id)
    setParts(draft.parts)
    setBasePrice(product.pricing?.basePrice ?? 0)
    setAdjustments(product.pricing?.adjustments ?? [])
    setSaveStatus('Brouillon local réinitialisé')
  }

  if (loadError) {
    return (
      <main className="admin admin--status">
        <div className="admin__status-card">
          <div className="admin__eyebrow">Back-office · Modèle 3D</div>
          <h1>Le modèle ne s’est pas chargé</h1>
          <p>{loadError}</p>
          <a className="admin__link" href="./">Retour au configurateur</a>
        </div>
      </main>
    )
  }

  if (!draft) {
    return (
      <main className="admin admin--status">
        <div className="admin__status-card">
          <div className="admin__eyebrow">Back-office · Modèle 3D</div>
          <h1>Chargement du modèle…</h1>
          <p>Lecture des pièces du GLB en cours.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="admin">
      <header className="admin__header">
        <div>
          <div className="admin__eyebrow">Back-office · Modèle 3D</div>
          <h1>{product.name}</h1>
          <p>{draft.scan.meshCount} pièces détectées automatiquement.</p>
        </div>
        <a className="admin__link" href="./">Retour au configurateur</a>
      </header>

      <section className="admin__draftbar">
        <div>
          <strong>Brouillon local</strong>
          <small>
            Les changements restent séparés du configurateur publié jusqu’à la future étape Publier.
          </small>
          {saveStatus && <span className="admin__save-status">{saveStatus}</span>}
        </div>
        <div className="admin__draft-actions">
          <button type="button" className="admin__secondary" onClick={resetDraft}>
            Réinitialiser
          </button>
          <button type="button" onClick={saveDraft} disabled={!validation.valid}>
            Enregistrer
          </button>
        </div>
      </section>

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <section className="admin__validation">
          {validation.errors.map((message) => (
            <p className="is-error" key={message}>{message}</p>
          ))}
          {validation.warnings.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </section>
      )}

      <section className="admin__pricing">
        <div>
          <strong>Prix de base</strong>
          <small>Le moteur ajoutera ensuite les suppléments selon la configuration.</small>
        </div>
        <label>
          <input
            type="number"
            min="0"
            step="1"
            value={basePrice}
            onChange={(event) => {
              setBasePrice(Number(event.target.value))
              setSaveStatus('')
            }}
          />
          <span>$ CAD</span>
        </label>
      </section>

      <section className="admin__pricing-list">
        <div className="admin__pricing-title">
          <div>
            <strong>Suppléments</strong>
            <small>Options, matériaux ou dimensions pourront utiliser ces ajustements.</small>
          </div>
          <button type="button" onClick={addAdjustment}>+ Ajouter</button>
        </div>

        {adjustments.length === 0 && (
          <div className="admin__empty">Aucun supplément configuré.</div>
        )}

        {adjustments.map((item, index) => (
          <div className="admin__price-row" key={item.id}>
            <input
              placeholder="Nom du supplément"
              value={item.label}
              onChange={(event) => updateAdjustment(index, { label: event.target.value })}
            />
            <input
              type="number"
              step="1"
              value={item.amount}
              onChange={(event) =>
                updateAdjustment(index, { amount: Number(event.target.value) })
              }
            />
            <span>{formatPrice(item.amount, product.pricing?.currency)}</span>
            <button
              type="button"
              className="admin__remove"
              onClick={() => removeAdjustment(index)}
              aria-label="Supprimer le supplément"
            >
              ×
            </button>
          </div>
        ))}
      </section>

      <section className="admin__card">
        <div className="admin__table-head">
          <span>Pièce GLB</span>
          <span>Rôle</span>
          <span>Groupe</span>
        </div>

        {parts.map((part, index) => (
          <div className="admin__row" key={part.nodePath || part.node}>
            <div className="admin__part">
              <strong>{part.node || 'Sans nom'}</strong>
              <small>{part.sourceMaterials?.join(', ') || 'Aucun matériau source'}</small>
            </div>

            <select
              value={part.materialEditable ? 'editable' : 'fixed'}
              onChange={(event) =>
                updatePart(index, {
                  materialEditable: event.target.value === 'editable',
                  ...(event.target.value === 'fixed' ? { group: null } : {}),
                })
              }
            >
              <option value="fixed">Fixe</option>
              <option value="editable">Modifiable</option>
            </select>

            <select
              value={part.group ?? ''}
              disabled={!part.materialEditable}
              onChange={(event) =>
                updatePart(index, { group: event.target.value || null })
              }
            >
              <option value="">Choisir…</option>
              {groupIds.map((groupId) => (
                <option value={groupId} key={groupId}>
                  {product.materialGroups?.[groupId]?.label ?? groupId}
                </option>
              ))}
            </select>
          </div>
        ))}
      </section>
    </main>
  )
}
