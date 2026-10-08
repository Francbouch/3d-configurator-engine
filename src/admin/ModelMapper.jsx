import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import product from '../data/products/product.example.json'
import {
  buildProductMappingDraft,
  toProductParts,
  validateProductMapping,
} from '../configurator/model/ProductMapping'
import { formatPrice } from '../configurator/pricing/PricingUtils'
import { resolveAssetUrl } from '../engine/assets/resolveAssetUrl'
import { clearAdminDraft, loadAdminDraft, saveAdminDraft } from './AdminDraftStore'
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
  const [ruleBlocks, setRuleBlocks] = useState([])
  const [isRuleAddMenuOpen, setIsRuleAddMenuOpen] = useState(false)
  const [ruleConnections, setRuleConnections] = useState([])
  const [ruleLayoutVersion, setRuleLayoutVersion] = useState(0)
  const [pendingRuleConnection, setPendingRuleConnection] = useState(null)
  const ruleCanvasRef = useRef(null)
  const ruleDragRef = useRef(null)
  const rulePortRefs = useRef({})
  const pendingRuleConnectionRef = useRef(null)
  const [modules, setModules] = useState(product.modules ?? [])
  const [displayPrice, setDisplayPrice] = useState(product.pricing?.displayPrice !== false)
  const [sceneSettings, setSceneSettings] = useState({ ...DEFAULT_SCENE_SETTINGS })
  const [sceneSelection, setSceneSelection] = useState({ type: 'light', id: 'shadow' })
  const [sceneTransformMode, setSceneTransformMode] = useState('translate')
  const [currentCameraView, setCurrentCameraView] = useState(null)
  const captureCameraView = useCallback((view) => setCurrentCameraView(view), [])
  useEffect(() => {
    if (activeSection !== 'rules' || ruleBlocks.length === 0) return undefined
    let frame2 = 0
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => setRuleLayoutVersion((version) => version + 1))
    })
    const handleResize = () => setRuleLayoutVersion((version) => version + 1)
    window.addEventListener('resize', handleResize)
    return () => {
      cancelAnimationFrame(frame1)
      cancelAnimationFrame(frame2)
      window.removeEventListener('resize', handleResize)
    }
  }, [activeSection, ruleBlocks.length, ruleConnections.length])

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
      ruleGraph: { blocks: ruleBlocks, connections: ruleConnections },
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
        if (!response.ok) throw new Error('Impossible de lire la configuration publiée.')
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
        const saved = loadAdminDraft(product.id)
        // Supabase is the durable source of truth. A stale local draft must never
        // hide materials that were already uploaded and stored remotely.
        const baseline = publishedConfig
          ? {
              ...(saved ?? {}),
              ...publishedConfig,
              materials: Array.isArray(publishedConfig.materials)
                ? publishedConfig.materials
                : (saved?.materials ?? []),
              pricing: publishedConfig.pricing ?? saved?.pricing,
            }
          : (saved ?? {})

        setDraft(nextDraft)
        const restoredDraft = Array.isArray(saved?.parts)
          ? buildProductMappingDraft(gltf.scene, saved.parts)
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
        const restoredRuleGraph = baseline?.ruleGraph
        setRuleBlocks(Array.isArray(restoredRuleGraph?.blocks)
          ? restoredRuleGraph.blocks.map((block) => ({
              ...block,
              materialIds: Array.isArray(block.materialIds)
                ? block.materialIds
                : (block.materialId ? [block.materialId] : []),
            }))
          : [])
        setRuleConnections(Array.isArray(restoredRuleGraph?.connections) ? restoredRuleGraph.connections : [])
        setModules(Array.isArray(baseline?.modules) ? baseline.modules : product.modules ?? [])
        setDisplayPrice(baseline?.pricing?.displayPrice ?? (product.pricing?.displayPrice !== false))
        setSceneSettings({ ...DEFAULT_SCENE_SETTINGS, ...(baseline?.scene ?? {}) })
        if (Array.isArray(baseline?.materialGroups)) setMaterialGroups(baseline.materialGroups)
        if (saved) setSaveStatus('Brouillon local restauré')
        else if (publishedConfig) setSaveStatus('Configuration publiée restaurée')
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
    const local = loadAdminDraft(product.id) ?? buildDraftPayload()
    saveAdminDraft(product.id, { ...local, materials: storedMaterials })
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
      const local = loadAdminDraft(product.id) ?? buildDraftPayload()
      saveAdminDraft(product.id, { ...local, materials: next })
      persistConfigurationPatch({ materials: next })
      return next
    })
    setSaveStatus('Nouveau matériau enregistré automatiquement')
  }

  function updateMaterial(index, patch) {
    setMaterials((current) => {
      const next = current.map((material, i) => (i === index ? { ...material, ...patch } : material))
      const local = loadAdminDraft(product.id) ?? buildDraftPayload()
      saveAdminDraft(product.id, { ...local, materials: next })
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

  function persistRuleGraph(blocks, connections) {
    const graph = { blocks, connections }
    const local = loadAdminDraft(product.id) ?? buildDraftPayload()
    saveAdminDraft(product.id, { ...local, ruleGraph: graph })
    persistConfigurationPatch({ ruleGraph: graph })
  }

  function removeRuleBlock(id) {
    const nextBlocks = ruleBlocks.filter((block) => block.id !== id)
    const nextConnections = ruleConnections.filter((connection) => connection.causeId !== id && connection.effectId !== id)
    setRuleBlocks(nextBlocks)
    setRuleConnections(nextConnections)
    delete rulePortRefs.current[id]
    if (pendingRuleConnectionRef.current?.sourceId === id) {
      pendingRuleConnectionRef.current = null
      setPendingRuleConnection(null)
    }
    persistRuleGraph(nextBlocks, nextConnections)
  }

  function addRuleBlock(type) {
    const nextBlocks = [
      ...ruleBlocks,
      {
        id: `${type}-${Date.now()}`,
        type,
        groupIds: [],
        materialIds: [],
        position: { x: 28 + (ruleBlocks.length % 3) * 350, y: 36 + Math.floor(ruleBlocks.length / 3) * 260 },
      },
    ]
    setRuleBlocks(nextBlocks)
    setIsRuleAddMenuOpen(false)
    persistRuleGraph(nextBlocks, ruleConnections)
  }

  function updateRuleBlock(id, patch, persist = true) {
    const nextBlocks = ruleBlocks.map((block) => block.id === id ? { ...block, ...patch } : block)
    setRuleBlocks(nextBlocks)
    if (persist) persistRuleGraph(nextBlocks, ruleConnections)
  }

  function toggleRuleBlockGroup(id, groupId) {
    const nextBlocks = ruleBlocks.map((block) => {
      if (block.id !== id) return block
      const selected = block.groupIds ?? []
      return {
        ...block,
        // A Cause represents one source group only. Effects may still target several groups.
        groupIds: block.type === 'cause'
          ? (selected.includes(groupId) ? [] : [groupId])
          : (selected.includes(groupId)
              ? selected.filter((value) => value !== groupId)
              : [...selected, groupId]),
      }
    })
    setRuleBlocks(nextBlocks)
    persistRuleGraph(nextBlocks, ruleConnections)
  }

  function toggleRuleBlockMaterial(id, materialId) {
    const nextBlocks = ruleBlocks.map((block) => {
      if (block.id !== id) return block
      const selected = Array.isArray(block.materialIds)
        ? block.materialIds
        : (block.materialId ? [block.materialId] : [])
      return {
        ...block,
        materialId: undefined,
        materialIds: selected.includes(materialId)
          ? selected.filter((value) => value !== materialId)
          : [...selected, materialId],
      }
    })
    setRuleBlocks(nextBlocks)
    persistRuleGraph(nextBlocks, ruleConnections)
  }

  function beginRuleBlockDrag(event, block) {
    if (event.button !== 0 || event.target.closest('input, select, button, label, .admin__relation-port')) return
    const canvas = ruleCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const position = block.position ?? { x: 20, y: 20 }
    ruleDragRef.current = {
      id: block.id,
      offsetX: event.clientX - rect.left + canvas.scrollLeft - position.x,
      offsetY: event.clientY - rect.top + canvas.scrollTop - position.y,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function moveRuleBlock(event) {
    const drag = ruleDragRef.current
    const canvas = ruleCanvasRef.current
    if (!drag || !canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.max(0, event.clientX - rect.left + canvas.scrollLeft - drag.offsetX)
    const y = Math.max(0, event.clientY - rect.top + canvas.scrollTop - drag.offsetY)
    updateRuleBlock(drag.id, { position: { x, y } }, false)
  }

  function endRuleBlockDrag() {
    if (ruleDragRef.current) persistRuleGraph(ruleBlocks, ruleConnections)
    ruleDragRef.current = null
  }

  function ruleCanvasPoint(event) {
    const canvas = ruleCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left + canvas.scrollLeft,
      y: event.clientY - rect.top + canvas.scrollTop,
    }
  }

  function beginRuleConnection(event, block) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const point = ruleCanvasPoint(event)
    const pending = {
      sourceId: block.id,
      sourceType: block.type,
      pointer: point,
      pointerId: event.pointerId,
    }
    pendingRuleConnectionRef.current = pending
    setPendingRuleConnection(pending)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function moveRuleConnection(event) {
    const current = pendingRuleConnectionRef.current
    if (!current) return
    const next = { ...current, pointer: ruleCanvasPoint(event) }
    pendingRuleConnectionRef.current = next
    setPendingRuleConnection(next)
  }

  function finishRuleConnection(event, explicitTarget = null) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    const current = pendingRuleConnectionRef.current
    if (!current) return

    const clientX = event?.clientX
    const clientY = event?.clientY
    let targetBlock = explicitTarget

    if (!targetBlock && Number.isFinite(clientX) && Number.isFinite(clientY)) {
      targetBlock = ruleBlocks.find((block) => {
        if (block.id === current.sourceId || block.type === current.sourceType) return false
        const port = rulePortRefs.current[block.id]
        if (!port) return false
        const rect = port.getBoundingClientRect()
        const padding = 22
        return clientX >= rect.left - padding && clientX <= rect.right + padding
          && clientY >= rect.top - padding && clientY <= rect.bottom + padding
      }) ?? null
    }

    if (targetBlock && current.sourceId !== targetBlock.id && current.sourceType !== targetBlock.type) {
      const causeId = current.sourceType === 'cause' ? current.sourceId : targetBlock.id
      const effectId = current.sourceType === 'effect' ? current.sourceId : targetBlock.id
      setRuleConnections((connections) => {
        if (connections.some((connection) => connection.causeId === causeId && connection.effectId === effectId)) return connections
        const nextConnections = [...connections, { id: `${causeId}->${effectId}`, causeId, effectId }]
        persistRuleGraph(ruleBlocks, nextConnections)
        return nextConnections
      })
    }

    pendingRuleConnectionRef.current = null
    setPendingRuleConnection(null)
  }

  function rulePortCenter(block) {
    const canvas = ruleCanvasRef.current
    const port = rulePortRefs.current[block?.id]
    if (canvas && port) {
      const canvasRect = canvas.getBoundingClientRect()
      const portRect = port.getBoundingClientRect()
      return {
        x: portRect.left + portRect.width / 2 - canvasRect.left + canvas.scrollLeft,
        y: portRect.top + portRect.height / 2 - canvasRect.top + canvas.scrollTop,
      }
    }
    const position = block?.position ?? { x: 0, y: 0 }
    return {
      x: position.x + (block?.type === 'cause' ? 320 : 0),
      y: position.y + 110,
    }
  }

  function ruleConnectionPath(from, to) {
    const direction = to.x >= from.x ? 1 : -1
    const bend = Math.max(70, Math.abs(to.x - from.x) * 0.45)
    return `M ${from.x} ${from.y} C ${from.x + bend * direction} ${from.y}, ${to.x - bend * direction} ${to.y}, ${to.x} ${to.y}`
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
    if (!session?.access_token) throw new Error('Session administrateur expirée.')
    try {
      const existing = await fetch(
        `${SUPABASE_PROJECT_URL}/rest/v1/configurator_publications?product_id=eq.${encodeURIComponent(product.id)}&select=model_path,model_name,configuration&limit=1`,
        { headers: supabaseHeaders(session.access_token) },
      )
      if (!existing.ok) return
      const rows = await existing.json()
      const current = rows?.[0]
      if (!current?.model_path) throw new Error('Aucun modèle publié à mettre à jour.')
      const configuration = { ...(current.configuration ?? {}), materialGroups: nextGroups }
      const saveResponse = await fetch(
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
    const current = loadAdminDraft(product.id) ?? buildDraftPayload()
    saveAdminDraft(product.id, { ...current, materialGroups: nextGroups })
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
      if (!saveResponse.ok) throw new Error('Impossible d’enregistrer la configuration publiée.')
      return configuration
    } catch (error) {
      console.warn('Unable to persist back-office change', error)
      throw error
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
      const local = loadAdminDraft(product.id) ?? buildDraftPayload()
      saveAdminDraft(product.id, { ...local, parts: persisted })
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

      saveAdminDraft(product.id, payload)
      setUploadedModelFile(null)
      setUploadedModelName('')
      setMaterialImageFiles({})
      setSaveStatus('Publié ✓ Le site client utilise maintenant ce GLB.')
    } catch (error) {
      console.error(error)
      setSaveStatus(error instanceof Error ? error.message : 'Publication impossible.')
    }
  }

  function saveDraft() {
    const ok = saveAdminDraft(product.id, {
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
    })

    setSaveStatus(ok ? 'Brouillon enregistré sur cet appareil' : 'Échec de l’enregistrement')
  }

  function resetDraft() {
    clearAdminDraft(product.id)
    const source = draft
    if (source) {
      setDraft(source)
      setParts(source.parts ?? [])
    }
    setModelName(product.name)
    setUploadedModelName('')
    setUploadedModelFile(null)
    setBasePrice(product.pricing?.basePrice ?? 0)
    setAdjustments(product.pricing?.adjustments ?? [])
    setMaterials(publishedMaterials)
    setRules(product.rules ?? [])
    setModules(product.modules ?? [])
    setDisplayPrice(product.pricing?.displayPrice !== false)
    setMaterialGroups(Object.entries(product.materialGroups ?? {}).map(([id, group]) => ({ id, name: group.label ?? id, materialId: group.defaultMaterialId ?? '', role: 'modifiable' })))
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
              const local = loadAdminDraft(product.id) ?? buildDraftPayload()
              saveAdminDraft(product.id, { ...local, name })
            }}
            onBlur={(event) => {
              const name = event.target.value.trim()
              setModelName(name)
              const local = loadAdminDraft(product.id) ?? buildDraftPayload()
              saveAdminDraft(product.id, { ...local, name })
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
            onClick={publishConfiguration}
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
          <div
            className={isTextureDragOver ? 'admin__texture-drop is-dragging' : 'admin__texture-drop'}
            onDragOver={(event) => { event.preventDefault(); setIsTextureDragOver(true) }}
            onDragLeave={() => setIsTextureDragOver(false)}
            onDrop={handleTextureDrop}
          >
            <strong>Importer des textures</strong>
            <span>Glissez-déposez plusieurs images PNG ou JPEG ici. Une image = un nouveau matériau.</span>
            <label className="admin__upload"><input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" multiple onChange={(event) => { addTextureFiles(event.target.files); event.target.value = '' }} /><span>Choisir des images</span></label>
          </div>
          <div className="admin__pricing-title">
            <div>
              <strong>Bibliothèque de matériaux</strong>
              <small>Matériaux disponibles pour les groupes du configurateur.</small>
            </div>
            <button type="button" onClick={addMaterial}>+ Ajouter un matériau</button>
          </div>
          <div className="admin__materials-head">
            <span>Nom</span><span>Code</span><span>Fabricant</span><span>Source</span><span>Prix</span><span>Actif</span><span>Actions</span>
          </div>
          {materials.map((material, index) => (
            <div className="admin__material-row" key={material.id}>
              <input value={material.name ?? ''} onChange={(e) => updateMaterial(index, { name: e.target.value })} />
              <input placeholder="L000K" value={material.code ?? ''} onChange={(e) => updateMaterial(index, { code: e.target.value })} />
              <input placeholder="Fabricant" value={material.manufacturer ?? ''} onChange={(e) => updateMaterial(index, { manufacturer: e.target.value })} />
              <div className="admin__material-source">
                <input className="admin__color-source" aria-label={`Couleur du matériau ${material.name}`} type="color" value={material.color || '#000000'} onChange={(e) => updateMaterial(index, { color: e.target.value })} />
                <label className="admin__source-image">
                  {material.source?.imageUrl ? <img src={material.source.imageUrl} alt="" /> : <span>Image</span>}
                  <input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(e) => { replaceMaterialImage(index, e.target.files?.[0]); e.target.value = '' }} />
                  <small>{material.source?.fileName || 'Ajouter'}</small>
                </label>

              </div>
              <div className="admin__money"><input aria-label={`Prix du matériau ${material.name}`} type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={material.priceAdjustment ?? ''} onChange={(e) => updateMaterial(index, { priceAdjustment: e.target.value === '' ? '' : e.target.value })} onBlur={(e) => updateMaterial(index, { priceAdjustment: e.target.value === '' ? '' : Number(e.target.value).toFixed(2) })} /><span>$</span></div>
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
        <section className="admin__relation-workspace">
          <div className="admin__relation-header">
            <div>
              <strong>Relation cause à effet</strong>
              <small>Créez les causes et les effets. Les connexions entre les blocs seront ajoutées à l’étape suivante.</small>
            </div>
            <div className="admin__relation-add">
              <button
                type="button"
                className="admin__relation-plus"
                aria-label="Ajouter un bloc"
                onClick={() => setIsRuleAddMenuOpen((open) => !open)}
              >+</button>
              {isRuleAddMenuOpen && (
                <div className="admin__relation-menu">
                  <button type="button" onClick={() => addRuleBlock('cause')}>Ajouter une cause</button>
                  <button type="button" onClick={() => addRuleBlock('effect')}>Ajouter un effet</button>
                </div>
              )}
            </div>
          </div>

          <div
            className="admin__relation-canvas"
            ref={ruleCanvasRef}
            onPointerMove={(event) => {
              moveRuleBlock(event)
              moveRuleConnection(event)
            }}
            onPointerUp={(event) => {
              endRuleBlockDrag()
              if (pendingRuleConnectionRef.current) finishRuleConnection(event)
            }}
            onPointerCancel={(event) => {
              endRuleBlockDrag()
              if (pendingRuleConnectionRef.current) finishRuleConnection(event)
            }}
          >
            {ruleBlocks.length === 0 && (
              <div className="admin__relation-empty">
                Utilisez le bouton + pour ajouter une cause ou un effet.
              </div>
            )}

            <svg className="admin__relation-lines" aria-hidden="true" data-layout-version={ruleLayoutVersion}>
              {ruleConnections.map((connection) => {
                const cause = ruleBlocks.find((block) => block.id === connection.causeId)
                const effect = ruleBlocks.find((block) => block.id === connection.effectId)
                if (!cause || !effect) return null
                const from = rulePortCenter(cause)
                const to = rulePortCenter(effect)
                return (
                  <path
                    key={connection.id}
                    d={ruleConnectionPath(from, to)}
                  />
                )
              })}
              {pendingRuleConnection && (() => {
                const source = ruleBlocks.find((block) => block.id === pendingRuleConnection.sourceId)
                if (!source) return null
                const from = rulePortCenter(source)
                return <path className="is-drawing" d={ruleConnectionPath(from, pendingRuleConnection.pointer)} />
              })()}
            </svg>

            {ruleBlocks.map((block) => (
              <article
                className={`admin__relation-node admin__relation-node--${block.type}`}
                key={block.id}
                style={{ left: block.position?.x ?? 20, top: block.position?.y ?? 20 }}
                onPointerDown={(event) => beginRuleBlockDrag(event, block)}
              >
                <div className="admin__relation-node-title">
                  <strong>{block.type === 'cause' ? 'Cause' : 'Effet'}</strong>
                  <div className="admin__relation-node-actions">
                    <small>Glisser pour déplacer</small>
                    <button
                      type="button"
                      className="admin__relation-delete"
                      aria-label="Supprimer ce bloc"
                      title="Supprimer le bloc"
                      onClick={(event) => {
                        event.stopPropagation()
                        removeRuleBlock(block.id)
                      }}
                    >×</button>
                  </div>
                </div>

                <div className="admin__relation-field">
                  <span>Groupes</span>
                  <div className="admin__relation-groups">
                    {materialGroups.map((group) => {
                      const selected = (block.groupIds ?? []).includes(group.id)
                      return (
                        <label className={selected ? 'is-selected' : ''} key={group.id}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleRuleBlockGroup(block.id, group.id)}
                          />
                          <span>{group.name || group.id}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="admin__relation-field">
                  <span>Matériaux</span>
                  <div className="admin__relation-materials">
                    {[
                      ...(block.type === 'effect'
                        ? [{
                            id: '__cause_material__',
                            name: 'Cause',
                            color: '#f2f2f2',
                            isCauseMaterialOption: true,
                          }]
                        : []),
                      ...materials.filter((material) => material.active !== false),
                    ].map((material) => {
                      const selectedIds = Array.isArray(block.materialIds)
                        ? block.materialIds
                        : (block.materialId ? [block.materialId] : [])
                      const selected = selectedIds.includes(material.id)
                      return (
                        <button
                          type="button"
                          className={`admin__relation-material ${selected ? 'is-selected' : ''}`}
                          key={material.id}
                          onClick={() => toggleRuleBlockMaterial(block.id, material.id)}
                          aria-pressed={selected}
                        >
                          <span className="admin__relation-material-preview">
                            {material.isCauseMaterialOption
                              ? <span className="admin__relation-cause-material-preview">C</span>
                              : material.source?.imageUrl
                                ? <img src={material.source.imageUrl} alt="" />
                                : <span style={{ background: material.color || '#000000' }} />}
                          </span>
                          <span className="admin__relation-material-name">{material.name || material.id}</span>
                          <span className="admin__relation-material-check">{selected ? '✓' : ''}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  ref={(element) => {
                    if (element) rulePortRefs.current[block.id] = element
                    else delete rulePortRefs.current[block.id]
                  }}
                  className={`admin__relation-port ${pendingRuleConnection?.sourceId === block.id ? 'is-pending' : ''}`}
                  aria-label={`Connecter le bloc ${block.type === 'cause' ? 'cause' : 'effet'}`}
                  title="Glisser vers le node d’un autre bloc"
                  onPointerDown={(event) => beginRuleConnection(event, block)}
                  onPointerUp={(event) => finishRuleConnection(event)}
                />
              </article>
            ))}          </div>
        </section>
      )}

      {activeSection === 'scene' && (
        <section className="admin__scene-editor">
          <div className="admin__scene-preview">
            <ConfiguratorScene
              matchPublishedView
              liveEditorPreview
              sceneOverride={sceneSettings}
              onCameraViewChange={captureCameraView}
            />
          </div>
          <div className="admin__card">
            <div className="admin__pricing-title">
              <div>
                <strong>Éclairage du configurateur</strong>
                <small>Les curseurs modifient l’aperçu immédiatement. Clique sur Enregistrer l’éclairage pour appliquer les réglages au site client.</small>
              </div>
              <button type="button" onClick={() => {
                setSaveStatus('Enregistrement de l’éclairage…')
                persistConfigurationPatch({ scene: sceneSettings })
                  .then(() => setSaveStatus('Éclairage enregistré ✓ — recharge le configurateur'))
                  .catch((error) => setSaveStatus(error instanceof Error ? error.message : 'Enregistrement impossible.'))
              }}>Enregistrer l’éclairage</button>
            </div>
            <div style={{ display: 'grid', gap: 14, paddingTop: 16 }}>
              {[
                ['exposure', 'Exposition', 0.35, 1.5, 0.01, 0.78],
                ['studioEnvironment', 'Environnement HDR', 0, 1.5, 0.01, 0.48],
                ['studioDirectional', 'Lumière principale (ombres)', 0, 4, 0.05, 1.45],
                ['studioKey', 'Softbox principale', 0, 5, 0.05, 2.35],
                ['studioFill', 'Softbox de remplissage', 0, 5, 0.05, 1.6],
                ['studioBack', 'Softbox arrière', 0, 5, 0.05, 2.1],
                ['studioRim', 'Softbox de contour', 0, 5, 0.05, 1.75],
                ['studioTop', 'Softbox supérieure', 0, 4, 0.05, 1.15],
                ['studioHemisphere', 'Lumière ambiante du ciel', 0, 2, 0.05, 0.7],
                ['studioAmbient', 'Lumière ambiante générale', 0, 1, 0.01, 0.16],
              ].map(([key, label, min, max, step, fallback]) => (
                <label key={key} style={{ display: 'grid', gap: 6 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span>{label}</span>
                    <strong>{Number(sceneSettings[key] ?? fallback).toFixed(2)}</strong>
                  </span>
                  <input type="range" min={min} max={max} step={step}
                    value={sceneSettings[key] ?? fallback}
                    onChange={(event) => setSceneSettings((current) => ({ ...current, [key]: Number(event.target.value) }))} />
                </label>
              ))}
            </div>
          </div>
          <div className="admin__card">
            <div className="admin__pricing-title">
              <div>
                <strong>Vue initiale du configurateur</strong>
                <small>Place la caméra comme désiré dans l’aperçu, puis enregistre cette vue. Seule la caméra initiale du configurateur sera modifiée.</small>
              </div>
              <button type="button" onClick={() => {
                if (!currentCameraView) {
                  setSaveStatus('Déplace légèrement la vue 3D, puis réessaie.')
                  return
                }
                const cameraView = {
                  position: currentCameraView.position.map(Number),
                  target: currentCameraView.target.map(Number),
                  fov: Number(currentCameraView.fov || 34),
                  aspect: Number(currentCameraView.aspect || 1),
                }
                setSaveStatus('Enregistrement de la vue…')
                const nextScene = { ...(sceneSettings ?? {}), cameraView }
                setSceneSettings(nextScene)
                persistConfigurationPatch({ scene: nextScene })
                  .then(() => setSaveStatus('Vue initiale du configurateur enregistrée ✓ — recharge le configurateur'))
                  .catch((error) => setSaveStatus(error instanceof Error ? error.message : 'Enregistrement impossible.'))
              }}>Enregistrer la vue</button>
            </div>
          </div>
        </section>
      )}

      {activeSection === 'pricing' && <>
<section className="admin__pricing">
        <div>
          <strong>Prix de base</strong>
          <small>Le moteur ajoutera ensuite les suppléments selon la configuration.</small>
        </div>
        <label className="admin__toggle">
          <input
            type="checkbox"
            checked={displayPrice}
            onChange={(event) => {
              const nextDisplayPrice = event.target.checked
              setDisplayPrice(nextDisplayPrice)
              const pricing = {
                currency: product.pricing?.currency ?? 'CAD',
                basePrice,
                adjustments,
                displayPrice: nextDisplayPrice,
              }
              const local = loadAdminDraft(product.id) ?? buildDraftPayload()
              saveAdminDraft(product.id, { ...local, pricing })
              persistConfigurationPatch({ pricing })
              setSaveStatus(nextDisplayPrice ? 'Prix visible enregistré' : 'Prix masqué enregistré')
            }}
          />
          <span>{displayPrice ? 'Prix visible sur le site' : 'Prix masqué sur le site'}</span>
        </label>
        <label>
          <input
            type="number"
            min="0"
            step="1"
            value={basePrice}
            onChange={(event) => {
              const nextPrice = Number(event.target.value)
              setBasePrice(nextPrice)
              const pricing = {
                currency: product.pricing?.currency ?? 'CAD',
                basePrice: nextPrice,
                adjustments,
                displayPrice,
              }
              const local = loadAdminDraft(product.id) ?? buildDraftPayload()
              saveAdminDraft(product.id, { ...local, pricing })
              persistConfigurationPatch({ pricing })
              setSaveStatus('Prix enregistré automatiquement')
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
