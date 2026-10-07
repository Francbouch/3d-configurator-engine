import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import product from '../data/products/product.example.json'
import {
  buildProductMappingDraft,
  toProductParts,
  validateProductMapping,
} from '../configurator/model/ProductMapping'
import { formatPrice } from '../configurator/pricing/PricingUtils'
import { resolveAssetUrl } from '../engine/assets/resolveAssetUrl'
import { loadAdminSession, SUPABASE_PROJECT_URL, supabaseHeaders } from './AdminAuth'
import ConfiguratorScene from '../engine/scene/ConfiguratorScene'
import { DEFAULT_SCENE_SETTINGS } from '../engine/lighting/StudioLighting'

const MODEL_URL = resolveAssetUrl(product.model?.url)

export default function ModelMapper({ onSignOut }) {
  const [draft, setDraft] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [parts, setParts] = useState([])
  const [basePrice, setBasePrice] = useState(product.pricing?.basePrice ?? 0)
  const [adjustments, setAdjustments] = useState(product.pricing?.adjustments ?? [])
  const [saveStatus, setSaveStatus] = useState('')
  const [modelName, setModelName] = useState(product.name)
  const [uploadedModelName, setUploadedModelName] = useState('')
  const [uploadedModelFile, setUploadedModelFile] = useState(null)
  const [materials, setMaterials] = useState([])
  const [publishedMaterials, setPublishedMaterials] = useState([])
  const [materialImageFiles, setMaterialImageFiles] = useState({})
  const [isTextureDragOver, setIsTextureDragOver] = useState(false)
  const [activeSection, setActiveSection] = useState('model')
  const [rules, setRules] = useState(product.rules ?? [])
  const [modules, setModules] = useState(product.modules ?? [])
  const [displayPrice, setDisplayPrice] = useState(product.pricing?.displayPrice !== false)
  const [sceneSettings, setSceneSettings] = useState({ ...DEFAULT_SCENE_SETTINGS })
  const [sceneSelection, setSceneSelection] = useState({ type: 'light', id: 'shadow' })
  const [sceneTransformMode, setSceneTransformMode] = useState('translate')
  const [currentCameraView, setCurrentCameraView] = useState(null)
  const captureCameraView = useCallback((view) => setCurrentCameraView(view), [])
  const [materialGroups, setMaterialGroups] = useState(() =>
    Object.entries(product.materialGroups ?? {}).map(([id, group]) => ({
      id,
      name: group.label ?? id,
      materialId: group.defaultMaterialId ?? '',
      role: 'modifiable',
    })),
  )

  const groupIds = materialGroups.map((group) => group.id)
  const validation = useMemo(
    () => validateProductMapping(
      { parts },
      Object.fromEntries(materialGroups.map((group) => [group.id, group])),
    ),
    [parts, materialGroups],
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

      if (!Number.isFinite(Number(material.priceAdjustment ?? 0))) {
        errors.push(`Le prix du matériau "${material.name || material.id}" doit être un nombre.`)
      }
    })
    return [...new Set(errors)]
  }, [validation.errors, modelName, basePrice, duplicateMaterialIds, materials])
  const canSave = adminErrors.length === 0
  const publishReady = canSave && modules.every((module) => !module.glbFileName)

  function buildDraftPayload() {
    return {
      parts: toProductParts({ parts }),
      materialGroups,
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
      scene: sceneSettings,
    }
  }

  useEffect(() => {
    let cancelled = false

    if (!MODEL_URL) {
      setLoadError('Aucun modèle 3D n’est configuré pour ce produit.')
      return undefined
    }

    const loader = new GLTFLoader()

    async function loadPublishedPublication() {
      try {
        const response = await fetch(
          `${SUPABASE_PROJECT_URL}/rest/v1/configurator_publications?product_id=eq.${encodeURIComponent(product.id)}&select=model_path,configuration&limit=1`,
          { headers: supabaseHeaders(loadAdminSession()?.access_token) },
        )
        if (!response.ok) return { modelUrl: MODEL_URL, configuration: null }
        const rows = await response.json()
        const publication = rows?.[0]
        const modelPath = publication?.model_path
        return {
          modelUrl: modelPath
            ? `${SUPABASE_PROJECT_URL}/storage/v1/object/public/models/${encodeURI(modelPath)}`
            : MODEL_URL,
          configuration: publication?.configuration ?? null,
        }
      } catch {
        return { modelUrl: MODEL_URL, configuration: null }
      }
    }
    loadPublishedPublication().then(({ modelUrl: activeModelUrl, configuration: publishedConfig }) => loader.load(
      activeModelUrl,
      (gltf) => {
        if (cancelled) return

        const nextDraft = buildProductMappingDraft(
          gltf.scene,
          product.model?.parts ?? [],
        )
        // Supabase is the single source of truth for the back-office.
        const baseline = publishedConfig ?? {}

        setDraft(nextDraft)
        const restoredDraft = Array.isArray(publishedConfig?.parts)
          ? buildProductMappingDraft(gltf.scene, publishedConfig.parts)
          : nextDraft
        setParts(restoredDraft.parts)
        setBasePrice(
          Number.isFinite(baseline?.pricing?.basePrice)
            ? baseline.pricing.basePrice
            : product.pricing?.basePrice ?? 0,
        )
        setAdjustments(
          Array.isArray(baseline?.pricing?.adjustments)
            ? baseline.pricing.adjustments
            : product.pricing?.adjustments ?? [],
        )
        setModelName(typeof baseline?.name === 'string' ? baseline.name : product.name)
        // The material library is image-driven only. Never seed it from the legacy GLB.
        // Also ignore legacy material records that do not have an uploaded image source.
        // Keep every back-office material. A material may intentionally use only
        // its fallback color and therefore does not need an uploaded image.
        const imageMaterials = Array.isArray(baseline?.materials) ? baseline.materials : []
        const publishedImageMaterials = Array.isArray(publishedConfig?.materials) ? publishedConfig.materials : []
        setPublishedMaterials(publishedImageMaterials)
        setMaterials(imageMaterials)
        setRules(Array.isArray(baseline?.rules) ? baseline.rules : product.rules ?? [])
        setModules(Array.isArray(baseline?.modules) ? baseline.modules : product.modules ?? [])
        setDisplayPrice(baseline?.pricing?.displayPrice ?? (product.pricing?.displayPrice !== false))
        setSceneSettings({ ...DEFAULT_SCENE_SETTINGS, ...(baseline?.scene ?? {}) })
        if (Array.isArray(baseline?.materialGroups)) setMaterialGroups(baseline.materialGroups)
        if (publishedConfig) setSaveStatus('Configuration Supabase chargée')
      },
      undefined,
      (error) => {
        if (cancelled) return
        console.error('Unable to load GLB for back-office mapping', error)
        setLoadError(
          'Impossible de charger le modèle 3D. Vérifiez que le fichier GLB est bien déployé.',
        )
      },
    ))

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
        setUploadedModelFile(file)
        setModelName(file.name.replace(/\.glb$/i, ''))
        setSaveStatus(`${nextDraft.scan.partCount ?? nextDraft.scan.meshCount} pièces détectées dans ${file.name}`)
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

  async function persistMaterialLibrary(nextMaterials, pendingFiles = materialImageFiles) {
    const session = loadAdminSession()
    if (!session?.access_token) throw new Error('Session expirée. Reconnecte-toi au back-office.')

    const existingResponse = await fetch(
      `${SUPABASE_PROJECT_URL}/rest/v1/configurator_publications?product_id=eq.${encodeURIComponent(product.id)}&select=model_path,model_name,configuration&limit=1`,
      { headers: supabaseHeaders(session.access_token) },
    )
    if (!existingResponse.ok) throw new Error('Impossible de lire la configuration publiée.')
    const rows = await existingResponse.json()
    const current = rows?.[0]
    if (!current?.model_path) throw new Error('Publie d’abord le meuble GLB.')

    const storedMaterials = []
    for (const material of nextMaterials) {
      const imageFile = pendingFiles[material.id]
      if (!imageFile) {
        storedMaterials.push(material)
        continue
      }
      const extension = imageFile.name.toLowerCase().endsWith('.png') ? 'png' : 'jpg'
      const safeId = material.id.replace(/[^a-zA-Z0-9._-]+/g, '-')
      const imagePath = `${product.id}/materials/${safeId}-${Date.now()}.${extension}`
      const upload = await fetch(
        `${SUPABASE_PROJECT_URL}/storage/v1/object/models/${encodeURI(imagePath)}`,
        {
          method: 'POST',
          headers: {
            ...supabaseHeaders(session.access_token, imageFile.type || (extension === 'png' ? 'image/png' : 'image/jpeg')),
            'x-upsert': 'true',
          },
          body: imageFile,
        },
      )
      if (!upload.ok) throw new Error(`Upload texture impossible (${material.name}).`)
      storedMaterials.push({
        ...material,
        source: {
          type: 'image',
          fileName: imageFile.name,
          imagePath,
          imageUrl: `${SUPABASE_PROJECT_URL}/storage/v1/object/public/models/${imagePath.split('/').map(encodeURIComponent).join('/')}`,
        },
      })
    }

    const configuration = { ...(current.configuration ?? {}), materials: storedMaterials }
    const response = await fetch(
      `${SUPABASE_PROJECT_URL}/rest/v1/configurator_publications?on_conflict=product_id`,
      {
        method: 'POST',
        headers: { ...supabaseHeaders(session.access_token), Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          product_id: product.id,
          model_path: current.model_path,
          model_name: current.model_name ?? modelName.trim(),
          configuration,
          updated_at: new Date().toISOString(),
          updated_by: session.user?.id ?? null,
        }),
      },
    )
    if (!response.ok) throw new Error('Impossible d’enregistrer la bibliothèque de matériaux.')

    setMaterials(storedMaterials)
    setPublishedMaterials(storedMaterials)
    setMaterialImageFiles({})
    return storedMaterials
  }

  function materialNameFromFile(fileName) {
    return fileName.replace(/\.(png|jpe?g)$/i, '').trim() || 'Nouveau matériau'
  }

  function materialIdFromFile(fileName, suffix = '') {
    const base = materialNameFromFile(fileName).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'material'
    return `${base}-${Date.now()}${suffix}`
  }

  function addTextureFiles(fileList) {
    const files = Array.from(fileList ?? []).filter((file) => /^image\/(png|jpeg)$/.test(file.type) || /\.(png|jpe?g)$/i.test(file.name))
    if (!files.length) {
      setSaveStatus('Ajoute des images PNG ou JPEG.')
      return
    }
    const created = files.map((file, index) => {
      const id = materialIdFromFile(file.name, `-${index}`)
      setMaterialImageFiles((current) => ({ ...current, [id]: file }))
      return {
        id,
        name: materialNameFromFile(file.name),
        code: '',
        manufacturer: '',
        category: 'decor',
        active: true,
        priceAdjustment: 0,
        source: { type: 'image', fileName: file.name, imagePath: '', imageUrl: URL.createObjectURL(file) },
      }
    })
    const nextMaterials = [...materials, ...created]
    const nextFiles = { ...materialImageFiles }
    files.forEach((file, index) => { nextFiles[created[index].id] = file })
    setMaterials(nextMaterials)
    setMaterialImageFiles(nextFiles)
    setSaveStatus('Enregistrement des textures…')
    persistMaterialLibrary(nextMaterials, nextFiles)
      .then(() => setSaveStatus(`${created.length} matériau${created.length > 1 ? 'x' : ''} enregistré${created.length > 1 ? 's' : ''} durablement ✓`))
      .catch((error) => setSaveStatus(error instanceof Error ? error.message : 'Enregistrement impossible.'))
  }

  function handleTextureDrop(event) {
    event.preventDefault()
    setIsTextureDragOver(false)
    addTextureFiles(event.dataTransfer.files)
  }

  function replaceMaterialImage(index, file) {
    if (!file || !(/^image\/(png|jpeg)$/.test(file.type) || /\.(png|jpe?g)$/i.test(file.name))) {
      setSaveStatus('L’image source doit être un PNG ou JPEG.')
      return
    }
    const material = materials[index]
    setMaterialImageFiles((current) => ({ ...current, [material.id]: file }))
    updateMaterial(index, {
      source: { type: 'image', fileName: file.name, imagePath: '', imageUrl: URL.createObjectURL(file) },
    })
  }

  function addMaterial() {
    const id = `material-${Date.now()}`
    const material = {
      id,
      name: 'Nouveau matériau',
      code: '',
      manufacturer: '',
      category: 'decor',
      active: true,
      priceAdjustment: 0,
      color: '#000000',
      source: { type: 'image', fileName: '', imagePath: '', imageUrl: '' },
    }
    setMaterials((current) => {
      const next = [...current, material]
      persistConfigurationPatch({ materials: next })
      return next
    })
    setSaveStatus('Nouveau matériau enregistré automatiquement')
  }

  function updateMaterial(index, patch) {
    setMaterials((current) => {
      const next = current.map((material, i) => (i === index ? { ...material, ...patch } : material))
      persistConfigurationPatch({ materials: next })
      return next
    })
    setSaveStatus('')
  }

  function removeMaterial(index) {
    const nextMaterials = materials.filter((_, i) => i !== index)
    setMaterials(nextMaterials)
    setSaveStatus('Suppression du matériau…')
    persistMaterialLibrary(nextMaterials)
      .then(() => setSaveStatus('Matériau supprimé durablement ✓'))
      .catch((error) => setSaveStatus(error instanceof Error ? error.message : 'Suppression impossible.'))
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

  async function publishGroups(nextGroups) {
    const session = loadAdminSession()
    if (!session?.access_token) return
    try {
      const existing = await fetch(
        `${SUPABASE_PROJECT_URL}/rest/v1/configurator_publications?product_id=eq.${encodeURIComponent(product.id)}&select=model_path,model_name,configuration&limit=1`,
        { headers: supabaseHeaders(session.access_token) },
      )
      if (!existing.ok) return
      const rows = await existing.json()
      const current = rows?.[0]
      if (!current?.model_path) return
      const configuration = { ...(current.configuration ?? {}), materialGroups: nextGroups }
      await fetch(
        `${SUPABASE_PROJECT_URL}/rest/v1/configurator_publications?on_conflict=product_id`,
        {
          method: 'POST',
          headers: {
            ...supabaseHeaders(session.access_token),
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify({
            product_id: product.id,
            model_path: current.model_path,
            model_name: current.model_name ?? modelName.trim(),
            configuration,
            updated_at: new Date().toISOString(),
            updated_by: session.user?.id ?? null,
          }),
        },
      )
    } catch (error) {
      console.warn('Unable to publish groups immediately', error)
    }
  }

  function persistGroups(nextGroups) {
    setMaterialGroups(nextGroups)
    publishGroups(nextGroups)
  }

  async function persistConfigurationPatch(patch) {
    const session = loadAdminSession()
    if (!session?.access_token) return
    try {
      const response = await fetch(
        `${SUPABASE_PROJECT_URL}/rest/v1/configurator_publications?product_id=eq.${encodeURIComponent(product.id)}&select=model_path,model_name,configuration&limit=1`,
        { headers: supabaseHeaders(session.access_token) },
      )
      if (!response.ok) return
      const rows = await response.json()
      const current = rows?.[0]
      if (!current?.model_path) return
      const configuration = { ...(current.configuration ?? {}), ...patch }
      await fetch(
        `${SUPABASE_PROJECT_URL}/rest/v1/configurator_publications?on_conflict=product_id`,
        {
          method: 'POST',
          headers: { ...supabaseHeaders(session.access_token), Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            product_id: product.id,
            model_path: current.model_path,
            model_name: current.model_name ?? modelName.trim(),
            configuration,
            updated_at: new Date().toISOString(),
            updated_by: session.user?.id ?? null,
          }),
        },
      )
    } catch (error) {
      console.warn('Unable to persist back-office change', error)
    }
  }

  function addGroup() {
    const nextGroups = [
      ...materialGroups,
      { id: `group-${Date.now()}`, name: 'Nouveau groupe', materialId: '', role: 'modifiable' },
    ]
    persistGroups(nextGroups)
    setSaveStatus('')
  }

  function updateGroup(index, patch) {
    const nextGroups = materialGroups.map((group, i) => (i === index ? { ...group, ...patch } : group))
    persistGroups(nextGroups)
    setSaveStatus('')
  }

  function removeGroup(index) {
    const groupId = materialGroups[index]?.id
    persistGroups(materialGroups.filter((_, i) => i !== index))
    if (groupId) {
      setParts((current) => current.map((part) =>
        part.group === groupId ? { ...part, group: null, materialEditable: false } : part
      ))
    }
    setSaveStatus('')
  }

  function updatePart(index, patch) {
    setParts((current) => {
      const next = current.map((part, i) => (i === index ? { ...part, ...patch } : part))
      const persisted = toProductParts({ parts: next })
      persistConfigurationPatch({ parts: persisted })
      return next
    })
    setSaveStatus('')
  }

  async function publishConfiguration() {
    const session = loadAdminSession()
    if (!session?.access_token) {
      setSaveStatus('Session expirée. Reconnecte-toi au back-office.')
      return
    }

    setSaveStatus('Publication en cours…')

    try {
      let modelPath = null

      if (uploadedModelFile) {
        const safeName = uploadedModelFile.name.replace(/[^a-zA-Z0-9._-]+/g, '-')
        modelPath = `${product.id}/current-${Date.now()}-${safeName}`
        const upload = await fetch(
          `${SUPABASE_PROJECT_URL}/storage/v1/object/models/${encodeURI(modelPath)}`,
          {
            method: 'POST',
            headers: {
              ...supabaseHeaders(session.access_token, uploadedModelFile.type || 'model/gltf-binary'),
              'x-upsert': 'true',
            },
            body: uploadedModelFile,
          },
        )
        if (!upload.ok) {
          const detail = await upload.text()
          throw new Error(`Upload GLB impossible: ${detail}`)
        }
      } else {
        const existing = await fetch(
          `${SUPABASE_PROJECT_URL}/rest/v1/configurator_publications?product_id=eq.${encodeURIComponent(product.id)}&select=model_path&limit=1`,
          { headers: supabaseHeaders(session.access_token) },
        )
        if (existing.ok) {
          const rows = await existing.json()
          modelPath = rows?.[0]?.model_path ?? null
        }
      }

      if (!modelPath) throw new Error('Choisis d’abord le GLB à publier.')

      const uploadedImagePaths = {}
      for (const material of materials) {
        const imageFile = materialImageFiles[material.id]
        if (!imageFile) continue
        const extension = imageFile.name.toLowerCase().endsWith('.png') ? 'png' : 'jpg'
        const safeId = material.id.replace(/[^a-zA-Z0-9._-]+/g, '-')
        const imagePath = `${product.id}/materials/${safeId}-${Date.now()}.${extension}`
        const uploadImage = await fetch(
          `${SUPABASE_PROJECT_URL}/storage/v1/object/models/${encodeURI(imagePath)}`,
          {
            method: 'POST',
            headers: {
              ...supabaseHeaders(session.access_token, imageFile.type || (extension === 'png' ? 'image/png' : 'image/jpeg')),
              'x-upsert': 'true',
            },
            body: imageFile,
          },
        )
        if (!uploadImage.ok) {
          const detail = await uploadImage.text()
          throw new Error(`Upload texture impossible (${material.name}): ${detail}`)
        }
        uploadedImagePaths[material.id] = imagePath
      }

      const payload = buildDraftPayload()
      payload.materials = payload.materials.map((material) => {
        const imagePath = uploadedImagePaths[material.id] || material.source?.imagePath
        if (!imagePath) return material
        return {
          ...material,
          source: {
            type: 'image',
            fileName: material.source?.fileName ?? '',
            imagePath,
            imageUrl: `${SUPABASE_PROJECT_URL}/storage/v1/object/public/models/${imagePath.split('/').map(encodeURIComponent).join('/')}`,
          },
        }
      })
      payload.animations = product.animations
      const publication = {
        product_id: product.id,
        model_path: modelPath,
        model_name: uploadedModelName || modelName.trim(),
        configuration: payload,
        updated_at: new Date().toISOString(),
        updated_by: session.user?.id ?? null,
      }

      if (!publication.updated_by) {
        const userResponse = await fetch(`${SUPABASE_PROJECT_URL}/auth/v1/user`, {
          headers: supabaseHeaders(session.access_token),
        })
        if (!userResponse.ok) throw new Error('Impossible d’identifier le compte administrateur.')
        const user = await userResponse.json()
        publication.updated_by = user.id
      }

      const response = await fetch(
        `${SUPABASE_PROJECT_URL}/rest/v1/configurator_publications?on_conflict=product_id`,
        {
          method: 'POST',
          headers: {
            ...supabaseHeaders(session.access_token),
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify(publication),
        },
      )
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(`Publication impossible: ${detail}`)
      }
      setUploadedModelFile(null)
      setUploadedModelName('')
      setMaterialImageFiles({})
      setSaveStatus('Publié ✓ Le site client utilise maintenant ce GLB.')
    } catch (error) {
      console.error(error)
      setSaveStatus(error instanceof Error ? error.message : 'Publication impossible.')
    }
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
          <p>{draft.scan.partCount ?? draft.scan.meshCount} pièces détectées automatiquement.</p>
        </div>
        <div className="admin__header-actions"><a className="admin__link" href="./">Retour au configurateur</a><button type="button" className="admin__signout" onClick={onSignOut}>Déconnexion</button></div>
      </header>

      <nav className="admin__tabs" aria-label="Sections du back-office">
        {[
          ['model', 'Meuble & pièces'],
          ['materials', 'Matériaux'],
          ['modules', 'Options'],
          ['rules', 'Règles'],
          ['pricing', 'Prix'],
          ['scene', 'Scène'],
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
            onChange={(event) => {
              const name = event.target.value
              setModelName(name)
            }}
            onBlur={(event) => {
              const name = event.target.value.trim()
              setModelName(name)
              persistConfigurationPatch({ name })
              setSaveStatus('Nom du meuble enregistré automatiquement')
            }}
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
          <strong>Configurateur connecté</strong>
          <small>Les modifications sont enregistrées directement dans Supabase.</small>
          {saveStatus && <span className="admin__save-status">{saveStatus}</span>}
        </div>
        <div className="admin__draft-actions">
          <button type="button" className="admin__publish" disabled={!publishReady} onClick={publishConfiguration}>
            Publier le GLB
          </button>
        </div>
      </section>

      {activeSection === 'model' && <section className="admin__card admin__groups-card">
        <div className="admin__pricing-title">
          <div><strong>Groupes</strong><small>Créez les groupes utilisés pour classer les pièces du meuble.</small></div>
          <button type="button" onClick={addGroup}>+ Ajouter un groupe</button>
        </div>
        <div className="admin__groups-head"><span>Nom du groupe</span><span>Matériau</span><span>Rôle</span><span></span></div>
        {materialGroups.map((group, index) => (
          <div className="admin__group-row" key={group.id}>
            <input value={group.name} onChange={(e) => updateGroup(index, { name: e.target.value })} />
            <select value={group.materialId} onChange={(e) => updateGroup(index, { materialId: e.target.value })}>
              <option value="">Choisir un matériau…</option>
              {materials.filter((material) => material.active !== false).map((material) => (
                <option key={material.id} value={material.id}>{material.name}{material.code ? ` · ${material.code}` : ''}</option>
              ))}
            </select>
            <select value={group.role} onChange={(e) => updateGroup(index, { role: e.target.value })}>
              <option value="fixed">Fixe</option>
              <option value="modifiable">Modifiable</option>
            </select>
            <button type="button" className="admin__remove admin__group-remove" onClick={() => removeGroup(index)} aria-label={`Supprimer le groupe ${group.name}`}>×</button>
          </div>
        ))}
      </section>}

      {activeSection === 'model' && <section className="admin__card">
        <div className="admin__table-head">
          <span>Pièce du meuble</span>
          <span>Groupe</span>
        </div>

        {parts.map((part, index) => (
          <div className="admin__row" key={part.nodePath || part.node}>
            <div className="admin__part">
              <strong>{part.node || 'Sans nom'}{part.sourceMaterial ? ` · ${part.sourceMaterial}` : ''}</strong>
              <small>{part.meshPath || part.nodePath || 'Pièce GLB'}</small>
            </div>

            <select
              value={part.group ?? ''}
              onChange={(event) =>
                updatePart(index, {
                  group: event.target.value || null,
                  materialEditable: Boolean(event.target.value),
                  initialMaterialId: null,
                })
              }
            >
              <option value="">Choisir…</option>
              {groupIds.map((groupId) => (
                <option value={groupId} key={groupId}>
                  {materialGroups.find((group) => group.id === groupId)?.name ?? product.materialGroups?.[groupId]?.label ?? groupId}
                </option>
              ))}
            </select>


          </div>
        ))}
      </section>}
    </main>
  )
}
