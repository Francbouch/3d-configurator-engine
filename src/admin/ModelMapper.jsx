import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { useEffect, useMemo, useState } from 'react'
import product from '../data/products/product.example.json'
import initialMaterials from '../data/materials/materials.json'
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
  const [publishedDraft, setPublishedDraft] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [parts, setParts] = useState([])
  const [basePrice, setBasePrice] = useState(product.pricing?.basePrice ?? 0)
  const [adjustments, setAdjustments] = useState(product.pricing?.adjustments ?? [])
  const [saveStatus, setSaveStatus] = useState('')
  const [modelName, setModelName] = useState(product.name)
  const [uploadedModelName, setUploadedModelName] = useState('')
  const [materials, setMaterials] = useState(initialMaterials)
  const [activeSection, setActiveSection] = useState('model')
  const [rules, setRules] = useState(product.rules ?? [])
  const [modules, setModules] = useState(product.modules ?? [])
  const [displayPrice, setDisplayPrice] = useState(product.pricing?.displayPrice === true)

  const groupIds = product.configurationFlow ?? Object.keys(product.materialGroups ?? {})
  const validation = useMemo(
    () => validateProductMapping({ parts }, product.materialGroups ?? {}),
    [parts],
  )
  const materialIds = useMemo(() => new Set(materials.map((material) => material.id)), [materials])
  const duplicateMaterialIds = useMemo(
    () => materials.map((material) => material.id).filter((id, index, ids) => id && ids.indexOf(id) !== index),
    [materials],
  )
  const adminErrors = useMemo(() => {
    const errors = [...validation.errors]
    if (!modelName.trim()) errors.push('Le meuble doit avoir un nom.')
    if (!Number.isFinite(basePrice) || basePrice < 0) errors.push('Le prix de base doit être un nombre positif.')
    if (duplicateMaterialIds.length) errors.push(`IDs de matériaux dupliqués : ${[...new Set(duplicateMaterialIds)].join(', ')}.`)
    materials.forEach((material) => {
      if (!material.id?.trim()) errors.push('Chaque matériau doit avoir un identifiant.')
      if (!material.name?.trim()) errors.push(`Le matériau "${material.id || 'sans id'}" doit avoir un nom.`)
      if (material.active !== false && !material.source?.materialName?.trim()) {
        errors.push(`Le matériau "${material.name || material.id}" n’a pas de matériau source GLB.`)
      }
      if (!Number.isFinite(Number(material.priceAdjustment ?? 0))) {
        errors.push(`Le prix du matériau "${material.name || material.id}" doit être un nombre.`)
      }
    })
    return [...new Set(errors)]
  }, [validation.errors, modelName, basePrice, duplicateMaterialIds, materials])
  const canSave = adminErrors.length === 0
  const publishReady = canSave && !uploadedModelName && modules.every((module) => !module.glbFileName)

  function buildDraftPayload() {
    return {
      parts: toProductParts({ parts }),
      name: modelName.trim(),
      materials,
      modules,
      rules,
      pricing: {
        currency: product.pricing?.currency ?? 'CAD',
        basePrice,
        adjustments,
        displayPrice,
      },
    }
  }

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
        setModelName(typeof saved?.name === 'string' ? saved.name : product.name)
        setMaterials(Array.isArray(saved?.materials) ? saved.materials : initialMaterials)
        setRules(Array.isArray(saved?.rules) ? saved.rules : product.rules ?? [])
        setModules(Array.isArray(saved?.modules) ? saved.modules : product.modules ?? [])
        setDisplayPrice(saved?.pricing?.displayPrice ?? (product.pricing?.displayPrice === true))
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

  function scanScene(scene, existingParts = []) {
    const nextDraft = buildProductMappingDraft(scene, existingParts)
    setDraft(nextDraft)
    setParts(nextDraft.parts)
    setLoadError('')
    return nextDraft
  }

  function handleModelUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.glb')) {
      setSaveStatus('Le fichier doit être un GLB.')
      event.target.value = ''
      return
    }

    const url = URL.createObjectURL(file)
    const loader = new GLTFLoader()
    setSaveStatus('Analyse du GLB…')

    loader.load(
      url,
      (gltf) => {
        const nextDraft = scanScene(gltf.scene)
        setUploadedModelName(file.name)
        setModelName(file.name.replace(/\.glb$/i, ''))
        setSaveStatus(`${nextDraft.scan.meshCount} pièces détectées dans ${file.name}`)
        URL.revokeObjectURL(url)
      },
      undefined,
      (error) => {
        console.error('Unable to scan uploaded GLB', error)
        setSaveStatus('Impossible d’analyser ce GLB.')
        URL.revokeObjectURL(url)
      },
    )

    event.target.value = ''
  }

  function addMaterial() {
    const id = `material-${Date.now()}`
    setMaterials((current) => [
      ...current,
      {
        id,
        name: 'Nouveau matériau',
        code: '',
        manufacturer: '',
        category: 'decor',
        active: true,
        source: { type: 'glb-material', materialName: id },
      },
    ])
    setSaveStatus('')
  }

  function updateMaterial(index, patch) {
    setMaterials((current) =>
      current.map((material, i) => (i === index ? { ...material, ...patch } : material)),
    )
    setSaveStatus('')
  }

  function removeMaterial(index) {
    setMaterials((current) => current.filter((_, i) => i !== index))
    setSaveStatus('')
  }

  function duplicateMaterial(index) {
    const source = materials[index]
    const id = `${source.id || 'material'}-copy-${Date.now()}`
    setMaterials((current) => [
      ...current,
      { ...source, id, name: `${source.name || 'Matériau'} copie` },
    ])
    setSaveStatus('')
  }

  function addModule() {
    setModules((current) => [...current, {
      id: `module-${Date.now()}`,
      name: 'Nouvelle option',
      enabled: true,
      price: 0,
      glbFileName: '',
      anchor: '',
      materialGroup: '',
    }])
    setSaveStatus('')
  }

  function updateModule(index, patch) {
    setModules((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)))
    setSaveStatus('')
  }

  function removeModule(index) {
    setModules((current) => current.filter((_, i) => i !== index))
    setSaveStatus('')
  }

  function handleModuleGlb(index, event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.glb')) {
      setSaveStatus('Le module doit être un fichier GLB.')
      event.target.value = ''
      return
    }
    updateModule(index, { glbFileName: file.name })
    setSaveStatus(`${file.name} prêt à être associé au module.`)
    event.target.value = ''
  }

  function updateRule(index, patch) {
    setRules((current) => current.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)))
    setSaveStatus('')
  }

  function toggleRuleMaterial(index, materialId) {
    setRules((current) => current.map((rule, i) => {
      if (i !== index) return rule
      const ids = rule.allow?.materialIds ?? []
      const nextIds = ids.includes(materialId) ? ids.filter((id) => id !== materialId) : [...ids, materialId]
      return { ...rule, allow: { ...(rule.allow ?? {}), materialIds: nextIds } }
    }))
    setSaveStatus('')
  }

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
      name: modelName.trim(),
      materials,
      modules,
      rules,
      pricing: {
        currency: product.pricing?.currency ?? 'CAD',
        basePrice,
        adjustments,
        displayPrice,
      },
    })

    setSaveStatus(ok ? 'Brouillon enregistré sur cet appareil' : 'Échec de l’enregistrement')
  }

  function resetDraft() {
    clearAdminDraft(product.id)
    const source = publishedDraft ?? draft
    if (source) {
      setDraft(source)
      setParts(source.parts ?? [])
    }
    setModelName(product.name)
    setUploadedModelName('')
    setBasePrice(product.pricing?.basePrice ?? 0)
    setAdjustments(product.pricing?.adjustments ?? [])
    setMaterials(initialMaterials)
    setRules(product.rules ?? [])
    setModules(product.modules ?? [])
    setDisplayPrice(product.pricing?.displayPrice === true)
    setSaveStatus('Brouillon local réinitialisé à la version publiée')
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

      <nav className="admin__tabs" aria-label="Sections du back-office">
        {[
          ['model', 'Meuble & pièces'],
          ['materials', 'Matériaux'],
          ['modules', 'Options'],
          ['rules', 'Règles'],
          ['pricing', 'Prix'],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={activeSection === id ? 'is-active' : ''}
            onClick={() => setActiveSection(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeSection === 'model' && <section className="admin__model-import">
        <div>
          <strong>Ajouter un meuble</strong>
          <small>Déposez un fichier GLB : les pièces sont détectées automatiquement, sans modifier le configurateur publié.</small>
        </div>
        <div className="admin__model-import-fields">
          <input
            aria-label="Nom du meuble"
            placeholder="Nom du meuble"
            value={modelName}
            onChange={(event) => setModelName(event.target.value)}
          />
          <label className="admin__upload">
            <input type="file" accept=".glb,model/gltf-binary" onChange={handleModelUpload} />
            <span>{uploadedModelName ? 'Changer le GLB' : '+ Choisir un GLB'}</span>
          </label>
        </div>
        {uploadedModelName && <span className="admin__model-file">{uploadedModelName}</span>}
      </section>}

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
          <button type="button" onClick={saveDraft} disabled={!canSave}>
            Enregistrer
          </button>
          <button
            type="button"
            className="admin__publish"
            disabled={!publishReady}
            title={publishReady ? 'Configuration prête à être publiée' : 'Enregistrez les nouveaux fichiers 3D avant publication'}
            onClick={() => {
              const payload = buildDraftPayload()
              saveAdminDraft(product.id, payload)
              setSaveStatus('Configuration prête à publier. Publication serveur non encore connectée.')
            }}
          >
            Publier
          </button>
        </div>
      </section>

      {(adminErrors.length > 0 || validation.warnings.length > 0) && (
        <section className="admin__validation">
          {adminErrors.map((message) => (
            <p className="is-error" key={message}>{message}</p>
          ))}
          {validation.warnings.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </section>
      )}

      {activeSection === 'materials' && (
        <section className="admin__materials">
          <div className="admin__pricing-title">
            <div>
              <strong>Bibliothèque de matériaux</strong>
              <small>Matériaux disponibles pour les groupes du configurateur.</small>
            </div>
            <button type="button" onClick={addMaterial}>+ Ajouter un matériau</button>
          </div>
          <div className="admin__materials-head">
            <span>Nom</span><span>Code</span><span>Fabricant</span><span>Matériau 3D source</span><span>Prix</span><span>Actif</span><span>Actions</span>
          </div>
          {materials.map((material, index) => (
            <div className="admin__material-row" key={material.id}>
              <input value={material.name ?? ''} onChange={(e) => updateMaterial(index, { name: e.target.value })} />
              <input placeholder="L000K" value={material.code ?? ''} onChange={(e) => updateMaterial(index, { code: e.target.value })} />
              <input placeholder="Fabricant" value={material.manufacturer ?? ''} onChange={(e) => updateMaterial(index, { manufacturer: e.target.value })} />
              <input placeholder="Nom dans le GLB" value={material.source?.materialName ?? ''} onChange={(e) => updateMaterial(index, { source: { ...(material.source ?? {}), type: 'glb-material', materialName: e.target.value } })} />
              <div className="admin__money"><input aria-label={`Prix du matériau ${material.name}`} type="number" step="1" value={material.priceAdjustment ?? 0} onChange={(e) => updateMaterial(index, { priceAdjustment: Number(e.target.value) })} /><span>$ CAD</span></div>
              <label className="admin__toggle"><input type="checkbox" checked={material.active !== false} onChange={(e) => updateMaterial(index, { active: e.target.checked })} /><span>{material.active !== false ? 'Oui' : 'Non'}</span></label>
              <div className="admin__material-actions"><button type="button" className="admin__icon-button" onClick={() => duplicateMaterial(index)} aria-label="Dupliquer le matériau">＋</button><button type="button" className="admin__remove" onClick={() => removeMaterial(index)} aria-label="Supprimer le matériau">×</button></div>
            </div>
          ))}
        </section>
      )}

      {activeSection === 'modules' && (
        <section className="admin__modules">
          <div className="admin__pricing-title">
            <div><strong>Options et modules 3D</strong><small>Ajoutez des éléments qui apparaîtront directement sur le meuble du client.</small></div>
            <button type="button" onClick={addModule}>+ Ajouter une option</button>
          </div>
          {modules.length === 0 && <div className="admin__empty">Aucune option configurée.</div>}
          {modules.map((module, index) => (
            <div className="admin__module-card" key={module.id}>
              <div className="admin__module-top">
                <input aria-label="Nom de l'option" value={module.name} onChange={(e) => updateModule(index, { name: e.target.value })} />
                <label className="admin__toggle"><input type="checkbox" checked={module.enabled !== false} onChange={(e) => updateModule(index, { enabled: e.target.checked })} /><span>{module.enabled !== false ? 'Active' : 'Inactive'}</span></label>
                <button type="button" className="admin__remove" onClick={() => removeModule(index)} aria-label="Supprimer l'option">×</button>
              </div>
              <div className="admin__module-grid">
                <label><span>Fichier 3D du module</span><div className="admin__module-file"><strong>{module.glbFileName || 'Aucun fichier'}</strong><label className="admin__upload"><input type="file" accept=".glb,model/gltf-binary" onChange={(e) => handleModuleGlb(index, e)} /><span>Choisir</span></label></div></label>
                <label><span>Position d’assemblage</span><input placeholder="Ex. rangement_droite" value={module.anchor} onChange={(e) => updateModule(index, { anchor: e.target.value })} /></label>
                <label><span>Supplément</span><div className="admin__money"><input type="number" min="0" step="1" value={module.price} onChange={(e) => updateModule(index, { price: Number(e.target.value) })} /><span>$ CAD</span></div></label>
                <label><span>Matériaux</span><select value={module.materialGroup} onChange={(e) => updateModule(index, { materialGroup: e.target.value })}><option value="">Fixe / aucun</option>{groupIds.map((id) => <option key={id} value={id}>{product.materialGroups?.[id]?.label ?? id}</option>)}</select></label>
              </div>
            </div>
          ))}
        </section>
      )}

      {activeSection === 'rules' && (
        <section className="admin__rules">
          <div className="admin__pricing-title"><div><strong>Règles de compatibilité</strong><small>Contrôlez les combinaisons proposées au client sans toucher au code.</small></div></div>
          {rules.map((rule, index) => (
            <div className="admin__rule-card" key={rule.id ?? index}>
              <div className="admin__rule-top">
                <div><strong>{rule.id}</strong><small>Cible : {product.materialGroups?.[rule.targetGroup]?.label ?? rule.targetGroup}</small></div>
                <label className="admin__toggle"><input type="checkbox" checked={rule.enabled !== false} onChange={(e) => updateRule(index, { enabled: e.target.checked })} /><span>{rule.enabled !== false ? 'Active' : 'Inactive'}</span></label>
              </div>
              <div className="admin__rule-materials">
                {materials.map((material) => {
                  const checked = (rule.allow?.materialIds ?? []).includes(material.id)
                  return <label key={material.id} className={checked ? 'is-selected' : ''}><input type="checkbox" checked={checked} onChange={() => toggleRuleMaterial(index, material.id)} /><span>{material.name}<small>{material.code}</small></span></label>
                })}
              </div>
              {(rule.allow?.selectedFromGroups ?? []).length > 0 && <p className="admin__rule-note">Autorise aussi le matériau choisi dans : {rule.allow.selectedFromGroups.map((id) => product.materialGroups?.[id]?.label ?? id).join(', ')}</p>}
            </div>
          ))}
        </section>
      )}

      {activeSection === 'pricing' && <>
<section className="admin__pricing">
        <div>
          <strong>Prix de base</strong>
          <small>Le moteur ajoutera ensuite les suppléments selon la configuration.</small>
        </div>
        <label className="admin__toggle">
          <input type="checkbox" checked={displayPrice} onChange={(event) => { setDisplayPrice(event.target.checked); setSaveStatus('') }} />
          <span>{displayPrice ? 'Prix visible sur le site' : 'Prix masqué sur le site'}</span>
        </label>
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
      </>}

      {activeSection === 'model' && <section className="admin__card">
        <div className="admin__table-head">
          <span>Pièce du meuble</span>
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
      </section>}
    </main>
  )
}
