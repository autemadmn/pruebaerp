import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

let localEnv = {}
try {
  const envText = await readFile(new URL('../.env.local', import.meta.url), 'utf8')
  localEnv = Object.fromEntries(
    envText
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator), line.slice(separator + 1)]
      }),
  )
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || localEnv.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || localEnv.VITE_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseAnonKey) {
  // El prototipo se construye sin credenciales: se conserva la instantánea que
  // ya está commiteada en src/menu-snapshot.js.
  console.warn('Sin VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY: se mantiene la instantánea existente.')
  process.exit(0)
}

const select = `
  id,
  slug,
  name,
  default_locale,
  locales,
  sold_out_behavior,
  categories!categories_restaurant_id_fkey(
    id,
    name,
    position,
    section,
    is_active,
    products!products_category_restaurant_fkey(
      id,
      restaurant_id,
      category_id,
      name,
      description,
      price,
      price_display,
      price_note,
      image_path,
      is_available,
      is_active,
      position,
      name_size
    )
  )
`.replace(/\s+/g, '')
const search = new URLSearchParams({
  select,
  slug: 'eq.tavola',
  'categories.is_active': 'eq.true',
  'categories.products.is_active': 'eq.true',
  'categories.order': 'position.asc',
  'categories.products.order': 'position.asc',
})
const response = await fetch(`${supabaseUrl}/rest/v1/restaurants?${search}`, {
  headers: {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    Accept: 'application/vnd.pgrst.object+json',
  },
})

if (!response.ok) throw new Error(`No se pudo crear la instantánea (${response.status}).`)
const snapshot = await response.json()
const output = fileURLToPath(new URL('../src/menu-snapshot.js', import.meta.url))
await writeFile(
  output,
  `// Generado con npm run snapshot:menu. Datos públicos de respaldo para la primera pintura.\nexport const initialMenuSnapshot = ${JSON.stringify(snapshot)};\n`,
)

console.log(`Instantánea actualizada: ${snapshot.categories?.length ?? 0} categorías.`)
