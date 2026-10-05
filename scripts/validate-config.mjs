import { readFile } from 'node:fs/promises'
import { validateProductConfig } from '../src/configurator/product/validateProductConfig.js'

const product = JSON.parse(
  await readFile(new URL('../src/data/products/product.example.json', import.meta.url), 'utf8'),
)
const materials = JSON.parse(
  await readFile(new URL('../src/data/materials/materials.json', import.meta.url), 'utf8'),
)

const result = validateProductConfig(product, materials)

result.warnings.forEach((warning) => console.warn(`warning: ${warning}`))

if (!result.valid) {
  result.errors.forEach((error) => console.error(`error: ${error}`))
  process.exitCode = 1
} else {
  console.log(
    `Configuration valide: ${product.id} · ${materials.length} matériaux · ${Object.keys(product.materialGroups ?? {}).length} groupes.`,
  )
}
