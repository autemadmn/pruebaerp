# pruebaerp — prototipo de carta inteligente

Prototipo navegable de cómo sería la carta digital de **Tavola Chiringo** convertida en
una *carta inteligente*: onboarding de mesa, avisos de alérgenos, recomendaciones,
carrito y revisión del pedido.

Es una **demostración de experiencia de usuario**. No hay comandas reales, ni conexión
con cocina, ni pagos, ni usuarios, ni base de datos de pedidos. El botón final solo
muestra una confirmación visual.

> Copia independiente de `autemadmn/tavola-chiringo-pages`. El repositorio original no
> se toca: este proyecto tiene su propio remoto y su propio historial.

## Qué se conserva de la carta original

La identidad visual está intacta: tipografías (Playfair Display + Inter), paleta,
fondos, logotipo, lineart de categorías, pestañas de sección, acordeones de grupo,
ficha lateral con imagen arrastrable, lightbox, modal de alérgenos y selector de
idioma. Las funciones nuevas se han construido con los mismos tokens (`--ink`,
`--paper`, `--linen`, `--sage`, `--tomato`, radio de 8 px, papel translúcido con
desenfoque).

## Qué se ha añadido

| Función | Dónde vive |
| --- | --- |
| Onboarding (alergias → comensales → preferencias) | `src/smart-menu.js` |
| Barra de contexto de la mesa, editable en cualquier momento | `src/smart-menu.js` |
| Carrusel rotatorio de recomendaciones con el motivo de cada una | `src/smart-menu.js` |
| Combinaciones populares | `src/smart-menu.js` |
| Ficha ampliada de producto con variantes, extras, cantidad y observaciones | `src/smart-menu.js` |
| Recomendaciones cruzadas al añadir al carrito | `src/smart-menu.js` |
| Carrito y pantalla de revisión + confirmación simulada | `src/smart-menu.js` |
| Datos de demostración (alérgenos, etiquetas, popularidad, extras, maridajes) | `src/smart-data.js` |
| Estilos de la capa nueva | `public/smart.css` |
| Mapa de imágenes locales para funcionar sin Supabase | `src/product-images.js` |

`src/main.js` sigue siendo el motor de la carta original. Solo se ha conectado a la
capa nueva: resuelve las imágenes en local cuando no hay Supabase, pinta el botón de
alérgenos en todos los productos con su color de aviso, y al pulsar un producto abre
su ficha ampliada.

## Cómo funcionan los alérgenos

1. En el onboarding la mesa marca sus alergias e intolerancias (los 14 de declaración
   obligatoria en la UE).
2. **Todos los productos siguen visibles.** No se filtra ni se oculta nada.
3. Cada producto conserva su acceso a los alérgenos completos, y el botón cambia de
   estado:
   - 🔴 **Contiene** — el producto lleva un alérgeno marcado por la mesa.
   - 🟠 **Trazas** — trazas, riesgo de contaminación cruzada o hace falta preguntar al
     personal (por ejemplo, licores o combinados).
   - Sin marca — ninguna coincidencia.
4. Nunca se usa solo el color: siempre hay icono y texto.
5. Al abrir la ficha de alérgenos se ven todos los del producto, con los coincidentes
   destacados y un aviso en cabecera.
6. Los avisos se repiten en el carrito y en la pantalla de revisión.

## Cómo se recomienda

Son dos motores distintos:

- **Carrusel de arriba** — se calcula con las preferencias elegidas, el número de
  comensales, la disponibilidad y una popularidad simulada. Se limita a 3–4 opciones y
  a dos por familia gastronómica. Sin preferencias, muestra los favoritos de la casa.
  Los productos que contienen un alérgeno marcado quedan fuera.
- **Al añadir al carrito** — reglas fijas por producto y por familia, nunca aleatorias:
  - Un **entrante** sugiere otros entrantes o cosas de picar.
  - Un **plato principal** nunca sugiere otro principal: solo guarniciones, panes,
    salsas o un entrante apropiado.
  - Un **dulce** sugiere otros dulces.
  - Nunca se sugiere algo que ya está en el carrito.
  - Con una sola persona no se empujan tablas ni raciones grandes; con cuatro o más se
    añaden opciones para compartir.

## Datos de demostración

Los productos, precios, descripciones e imágenes son los **reales** de la carta
(instantánea en `src/menu-snapshot.js`). Lo que se ha inventado para poder enseñar el
flujo está todo en `src/smart-data.js` y marcado como tal:

- Alérgenos de ejemplo para los 117 productos.
- Etiquetas gastronómicas (carne, pescado, ligero, contundente, vegetariano, compartir,
  dulce).
- Popularidad simulada (0–100).
- Variantes y extras por categoría (masa de pizza, tipo de pan, ración, tipo de leche,
  formato de copa/botella en vinos…).
- Reglas de maridaje y tres combinaciones populares.

La carta no tiene sección de postres, así que la familia «dulce» la cubren los
smoothies y frappés.

## Desarrollo local

```bash
npm install
npm run dev
```

Funciona **sin credenciales**: usa la instantánea local de la carta y las imágenes de
`public/assets`. Si quieres conectarlo al Supabase real (carta en vivo y realtime),
copia `.env.example` como `.env.local` y rellena `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY`.

```bash
npm run build     # genera dist/
npm run preview   # sirve dist/
```

## Publicación

Esto es una app de Vite: **hay que compilarla**. Servir el repositorio tal cual
(GitHub Pages apuntando a la raíz de `main`) muestra la página sin estilos, porque
`style.css`, `smart.css` y `assets/` viven dentro de `public/` y `src/main.js` está sin
empaquetar.

El flujo `.github/workflows/deploy-pages.yml` compila en cada push a `main` y publica
solo `dist/`. Para que funcione, en **Settings → Pages → Build and deployment**, el
*Source* tiene que estar en **GitHub Actions** (no en «Deploy from a branch»).

`vite.config.js` fija `base: './'`, así que el mismo build vale tanto en la raíz de un
dominio (Cloudflare Pages) como en un subdirectorio (`usuario.github.io/pruebaerp/`).

## Limitaciones conocidas

- La capa de carta inteligente está **solo en español**. El selector de idioma sigue
  traduciendo la carta original (nombres, descripciones y secciones), pero los textos
  del onboarding, el carrito y la revisión no están traducidos todavía.
- El estado de la mesa y el carrito se guardan en `localStorage` del navegador, solo
  para que la demo aguante una recarga.
- No hay comandas, cocina, pagos, usuarios ni persistencia en servidor. A propósito.
