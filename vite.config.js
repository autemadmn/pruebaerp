import { defineConfig } from 'vite'

// Rutas relativas en el bundle: así el mismo build funciona tanto en la raíz de
// un dominio (Cloudflare Pages) como en un subdirectorio (GitHub Pages sirve el
// proyecto bajo /pruebaerp/).
export default defineConfig({
  base: './',
})
