// Datos de demostración de la carta inteligente.
//
// Todo lo que hay aquí es información SIMULADA sobre los productos reales de la
// carta: alérgenos de ejemplo, etiquetas gastronómicas, popularidad inventada,
// variantes, extras y reglas de recomendación. No hay datos reales de cocina ni
// de comportamiento de clientes.
//
// Las claves son los `legacyId` (slug legible) que main.js asigna a cada
// producto a partir de `legacyProductIds`.

// Los 14 alérgenos de declaración obligatoria en la UE.
export const ALLERGENS = [
  { id: 'gluten', label: 'Gluten' },
  { id: 'crustaceos', label: 'Crustáceos' },
  { id: 'huevo', label: 'Huevo' },
  { id: 'pescado', label: 'Pescado' },
  { id: 'cacahuetes', label: 'Cacahuetes' },
  { id: 'soja', label: 'Soja' },
  { id: 'lacteos', label: 'Lácteos' },
  { id: 'frutos-secos', label: 'Frutos secos' },
  { id: 'apio', label: 'Apio' },
  { id: 'mostaza', label: 'Mostaza' },
  { id: 'sesamo', label: 'Sésamo' },
  { id: 'sulfitos', label: 'Sulfitos' },
  { id: 'altramuces', label: 'Altramuces' },
  { id: 'moluscos', label: 'Moluscos' }
];

export const allergenLabelById = new Map(ALLERGENS.map((item) => [item.id, item.label]));
const allergenIdByLabel = new Map(ALLERGENS.map((item) => [item.label.toLowerCase(), item.id]));

export function allergenIdFromLabel(label) {
  return allergenIdByLabel.get(String(label).toLowerCase()) || null;
}

// Cómo viene la mesa. Una sola respuesta, tres tarjetas grandes: marca el
// tamaño del pedido sin preguntar por categorías.
export const APPETITES = [
  {
    id: 'picar',
    icon: '🍻',
    label: 'Vamos a picar',
    hint: 'Algo suelto para acompañar',
    tags: ['compartir', 'ligero']
  },
  {
    id: 'comer',
    icon: '🍽️',
    label: 'Queremos comer',
    hint: 'Una comida en condiciones',
    tags: []
  },
  {
    id: 'hambre',
    icon: '🔥',
    label: 'Venimos con mucha hambre',
    hint: 'Que no falte de nada',
    tags: ['contundente', 'compartir']
  }
];

// Preferencias del onboarding: solo tres, de selección múltiple. Con esto basta
// para personalizar las recomendaciones sin convertirlo en un formulario.
export const PREFERENCES = [
  { id: 'carne', icon: '🥩', label: 'Carne', hint: 'Ibéricos, costillas, bocadillos', tags: ['carne'] },
  { id: 'pescado', icon: '🐟', label: 'Pescado y mar', hint: 'Pulpo, salmón, mejillones', tags: ['pescado'] },
  { id: 'ligero', icon: '🥗', label: 'Algo ligero', hint: 'Ensaladas y fresquito', tags: ['ligero'] }
];

// Nombre legible de cada etiqueta gastronómica, también de las que ya no se
// preguntan directamente pero se siguen usando en fichas y recomendaciones.
export const TAG_LABELS = {
  carne: 'Carne',
  pescado: 'Pescado y mar',
  ligero: 'Algo ligero',
  contundente: 'Contundente',
  compartir: 'Para compartir',
  vegetariano: 'Vegetariano',
  dulce: 'Dulce y frío'
};

// Familias gastronómicas usadas por el motor de recomendaciones cruzadas.
// entrante | principal | acompanamiento | dulce | bebida
const KIND_BY_GROUP = {
  desayuno: 'principal',
  picar: 'entrante',
  tapas: 'entrante',
  bocadillos: 'principal',
  pizzas: 'principal',
  platos: 'principal',
  refrescos: 'bebida',
  cafes: 'bebida',
  cerveza: 'bebida',
  'vermouth-copas': 'bebida',
  'vinos-blancos': 'bebida',
  'vinos-tintos': 'bebida',
  'vinos-rosados': 'bebida',
  'cavas-espumosos': 'bebida',
  'cocteles-clasicos': 'bebida',
  'sangrias-carta': 'bebida',
  'granizados-smoothies-frappes': 'dulce'
};

// Productos que no siguen la familia por defecto de su grupo.
const KIND_OVERRIDES = {
  papas: 'acompanamiento',
  aceitunas: 'acompanamiento',
  'frutos-secos': 'acompanamiento',
  'servicio-pan': 'acompanamiento',
  'servicio-picos-pan-adicional': 'acompanamiento',
  'salsas-adicionales': 'acompanamiento'
};

export function getProductKind(legacyId, groupId) {
  return KIND_OVERRIDES[legacyId] || KIND_BY_GROUP[groupId] || 'bebida';
}

// ---------------------------------------------------------------------------
// Alérgenos de ejemplo
// ---------------------------------------------------------------------------
// `contains` -> el producto lleva ese alérgeno (rojo si coincide con la mesa).
// `traces`   -> trazas o contaminación cruzada posible (ámbar).
// `note`     -> aviso adicional que se muestra en la ficha de alérgenos.
// `entries`  -> desglose por elementos cuando el producto agrupa varias cosas.

const NO_DECLARED = { contains: [], traces: [], note: 'Sin alérgenos de declaración obligatoria.' };
const ONLY_SULFITOS = { contains: ['Sulfitos'], traces: [] };

export const allergenCatalog = {
  // --- Refrescos -----------------------------------------------------------
  agua: NO_DECLARED,
  'agua-gas': NO_DECLARED,
  pepsi: NO_DECLARED,
  'pepsi-zero': NO_DECLARED,
  'schweppes-naranja': NO_DECLARED,
  'schweppes-limon': NO_DECLARED,
  sevenup: NO_DECLARED,
  'tonica-schweppes': NO_DECLARED,
  'aquarade-limon': NO_DECLARED,
  'aquarade-naranja': NO_DECLARED,
  'lipton-limon': NO_DECLARED,
  redbull: NO_DECLARED,
  zumos: { contains: [], traces: ['Sulfitos'], note: 'Según el zumo elegido. Consulta al personal.' },

  // --- Cafés ---------------------------------------------------------------
  'cafe-solo': NO_DECLARED,
  americano: NO_DECLARED,
  'infusiones-tes': NO_DECLARED,
  cortado: { contains: ['Lácteos'], traces: [] },
  bombon: { contains: ['Lácteos'], traces: [] },
  'cafe-con-leche': { contains: ['Lácteos'], traces: [] },
  carajillo: {
    contains: [],
    traces: ['Sulfitos', 'Lácteos'],
    note: 'Depende del licor elegido. Consulta al personal antes de pedirlo.'
  },

  // --- Cerveza -------------------------------------------------------------
  'aguila-dorada': { contains: ['Gluten'], traces: [] },
  radler: { contains: ['Gluten'], traces: [] },
  'cerveza-00': { contains: ['Gluten'], traces: [] },
  'cerveza-sin-gluten': {
    contains: [],
    traces: [],
    note: 'Elaborada sin gluten. Se sirve en botella cerrada con vaso aparte.'
  },
  'amstel-oro-lata': { contains: ['Gluten'], traces: [] },

  // --- Vermouth y copas ----------------------------------------------------
  vermouth: ONLY_SULFITOS,
  combinados: {
    contains: [],
    traces: ['Sulfitos'],
    note: 'Según el destilado y el refresco elegidos. Consulta al personal.'
  },
  'premium-desde': {
    contains: [],
    traces: ['Sulfitos'],
    note: 'Según el destilado y el refresco elegidos. Consulta al personal.'
  },
  chupitos: { contains: [], traces: ['Sulfitos', 'Lácteos'], note: 'Consulta al personal según el chupito.' },
  'chupitos-premium': { contains: [], traces: ['Sulfitos', 'Lácteos'], note: 'Consulta al personal según el chupito.' },
  licores: {
    contains: [],
    traces: ['Lácteos', 'Frutos secos', 'Gluten'],
    note: 'Cada licor es distinto. Consulta al personal antes de pedirlo.'
  },

  // --- Vinos, cavas y espumosos --------------------------------------------
  'ceremonia-sauvignon-blanc': ONLY_SULFITOS,
  'ramon-bilbao-verdejo': ONLY_SULFITOS,
  'paco-lola-albarino': ONLY_SULFITOS,
  'ceremonia-cabernet-sauvignon': ONLY_SULFITOS,
  'ramon-bilbao-crianza-rioja': ONLY_SULFITOS,
  'ceramic-monastrell-vicente-gandia': ONLY_SULFITOS,
  'ceremonia-bobal-rose': ONLY_SULFITOS,
  'cava-patacona-brut': ONLY_SULFITOS,
  'cava-lola': ONLY_SULFITOS,
  'moet-chandon': ONLY_SULFITOS,
  'moet-chandon-rose': ONLY_SULFITOS,
  'moet-chandon-ice': ONLY_SULFITOS,

  // --- Cócteles ------------------------------------------------------------
  'mojito-normal': { contains: [], traces: ['Sulfitos'] },
  'mojito-sabores': { contains: [], traces: ['Sulfitos'] },
  'daikiri-frozen': { contains: [], traces: ['Sulfitos'] },
  'daiquiri-sabores': { contains: [], traces: ['Sulfitos'] },
  'pina-colada': { contains: ['Lácteos'], traces: [], note: 'Lleva crema de coco y leche.' },
  caipirinha: { contains: [], traces: ['Sulfitos'] },
  caipiroska: { contains: [], traces: ['Sulfitos'] },
  'aperol-spritz': ONLY_SULFITOS,
  'crodino-sin-alcohol': ONLY_SULFITOS,
  'sarti-spritz': ONLY_SULFITOS,
  'mondoro-hugo-spritz': ONLY_SULFITOS,

  // --- Smoothies y frappés --------------------------------------------------
  'smoothie-pina-coco': {
    contains: [],
    traces: ['Lácteos', 'Frutos secos'],
    note: 'Se elabora en la misma batidora que bebidas con lácteos y frutos secos.'
  },
  'smoothie-melon': {
    contains: [],
    traces: ['Lácteos', 'Frutos secos'],
    note: 'Se elabora en la misma batidora que bebidas con lácteos y frutos secos.'
  },
  'smoothie-maracuya-mango': {
    contains: [],
    traces: ['Lácteos', 'Frutos secos'],
    note: 'Se elabora en la misma batidora que bebidas con lácteos y frutos secos.'
  },
  'smoothie-mango': {
    contains: [],
    traces: ['Lácteos', 'Frutos secos'],
    note: 'Se elabora en la misma batidora que bebidas con lácteos y frutos secos.'
  },
  'frappe-chocolate': { contains: ['Lácteos'], traces: ['Soja', 'Frutos secos'] },
  'frappe-vainilla': { contains: ['Lácteos'], traces: ['Frutos secos'] },
  'frappe-yogurt': { contains: ['Lácteos'], traces: ['Frutos secos'] },
  'frappe-cafe': { contains: ['Lácteos'], traces: ['Frutos secos'] },
  'frappe-cafe-bayleis': { contains: ['Lácteos'], traces: ['Gluten', 'Frutos secos'] },

  // --- Sangrías ------------------------------------------------------------
  'tinto-verano-vaso': ONLY_SULFITOS,
  'tinto-verano-jarra': ONLY_SULFITOS,
  'sangria-vino-blanco': ONLY_SULFITOS,
  'sangria-vino-tinto': ONLY_SULFITOS,
  'sangria-cava': ONLY_SULFITOS,
  'agua-valencia': ONLY_SULFITOS,

  // --- Desayuno ------------------------------------------------------------
  'desayuno-tradicional': {
    title: 'Desayuno tradicional',
    entries: [
      { name: 'Tostada aceite/tomate', contains: ['Gluten'], traces: ['Sésamo'] },
      { name: 'Tostada mantequilla', contains: ['Gluten', 'Lácteos'], traces: ['Sésamo'] },
      { name: 'Bollería', contains: ['Gluten', 'Lácteos', 'Huevo'], traces: ['Frutos secos', 'Soja'] }
    ]
  },
  'desayuno-supreme': {
    title: 'Desayuno Suprem',
    entries: [
      { name: 'Tostada salmón', contains: ['Gluten', 'Pescado'], traces: ['Lácteos'] },
      { name: 'Zumo natural', contains: [], traces: [] },
      { name: 'Café o infusión', contains: [], traces: ['Lácteos'] }
    ]
  },

  // --- Aperitivo y picar ---------------------------------------------------
  'frutos-secos': { contains: ['Frutos secos'], traces: ['Cacahuetes', 'Sésamo'] },
  papas: { contains: [], traces: ['Sulfitos'] },
  aceitunas: { contains: [], traces: ['Sulfitos'] },
  'barqueta-mini-fuets': { title: 'Mini fuets', contains: [], traces: ['Lácteos', 'Sulfitos'] },
  'papas-mejillones': { title: 'Papas + mejillones', contains: ['Moluscos'], traces: ['Sulfitos'] },
  'papas-boquerones': { title: 'Papas + boquerones', contains: ['Pescado'], traces: ['Sulfitos'] },
  'papas-limon-berberechos': {
    title: 'Papas + berberechos',
    contains: ['Moluscos'],
    traces: ['Sulfitos', 'Pescado']
  },

  // --- Tapas ---------------------------------------------------------------
  'pulpo-pimenton': {
    title: 'Pulpo al pimentón con patatas a lo pobre',
    contains: ['Moluscos'],
    traces: ['Gluten', 'Sulfitos']
  },
  'ensaladilla-rusa': {
    contains: ['Huevo', 'Pescado'],
    traces: ['Mostaza', 'Sulfitos'],
    note: 'La mayonesa se elabora en casa con huevo pasteurizado.'
  },
  'ajo-arriero': { contains: ['Pescado'], traces: ['Gluten', 'Huevo'] },
  'nachos-verano': { contains: ['Lácteos'], traces: ['Gluten', 'Soja'] },
  'nachos-tartar-salmon': {
    title: 'Nachos con tartar de salmón',
    contains: ['Huevo', 'Pescado', 'Soja'],
    traces: ['Gluten', 'Sésamo']
  },
  'tabla-jamon-iberico-duroc': { contains: [], traces: ['Gluten'], note: 'Se sirve con picos de pan aparte.' },
  'tabla-quesos-valencianos': { title: 'Quesos valencianos', contains: ['Lácteos'], traces: ['Frutos secos'] },
  'tortilla-jamon': { contains: ['Huevo'], traces: ['Sulfitos', 'Lácteos'] },
  'mejillones-vapor-limon': { contains: ['Moluscos'], traces: ['Sulfitos', 'Crustáceos'] },
  'servicio-pan': { title: 'Pan', contains: ['Gluten'], traces: ['Sésamo', 'Soja'] },
  'servicio-picos-pan-adicional': { title: 'Pan y picos', contains: ['Gluten'], traces: ['Sésamo', 'Soja'] },
  'salsas-adicionales': {
    title: 'Salsas',
    contains: ['Huevo', 'Mostaza'],
    traces: ['Lácteos', 'Soja'],
    note: 'Alioli, brava y barbacoa. Consulta al personal por cada salsa.'
  },

  // --- Bocadillos ----------------------------------------------------------
  'bocadillo-escalivada': { contains: ['Gluten'], traces: ['Sulfitos', 'Sésamo'] },
  'magro-tomate': { contains: ['Gluten'], traces: ['Sulfitos', 'Sésamo'] },
  'lomo-ajos-tiernos': { contains: ['Gluten'], traces: ['Sulfitos', 'Sésamo'] },
  'bocadillo-atun-tomate': { contains: ['Gluten', 'Pescado'], traces: ['Sésamo'] },
  'bocadillo-jamon-tomate-rucula': { contains: ['Gluten'], traces: ['Sésamo'] },
  'bocadillo-lomo-queso': { contains: ['Gluten', 'Lácteos'], traces: ['Sésamo', 'Sulfitos'] },

  // --- Pizzas --------------------------------------------------------------
  margarita: { title: 'Pizza margarita', contains: ['Gluten', 'Lácteos'], traces: ['Soja'] },
  tartufata: { title: 'Pizza tartufata', contains: ['Gluten', 'Lácteos'], traces: ['Sulfitos', 'Soja'] },
  'jamon-queso': { title: 'Pizza jamón y queso', contains: ['Gluten', 'Lácteos'], traces: ['Sulfitos', 'Soja'] },
  'cuatro-quesos': { title: 'Pizza 4 quesos', contains: ['Gluten', 'Lácteos'], traces: ['Frutos secos', 'Soja'] },
  peperoni: { title: 'Pizza peperoni', contains: ['Gluten', 'Lácteos'], traces: ['Mostaza', 'Sulfitos', 'Soja'] },
  canibal: { title: 'Pizza canibal', contains: ['Gluten', 'Lácteos'], traces: ['Mostaza', 'Sulfitos', 'Soja'] },

  // --- Platos preparados ---------------------------------------------------
  'ensalada-quinoa': { contains: ['Lácteos'], traces: ['Frutos secos', 'Sésamo', 'Mostaza'] },
  'costillas-barbacoa': {
    contains: ['Mostaza', 'Soja'],
    traces: ['Gluten', 'Sésamo', 'Sulfitos'],
    note: 'La salsa barbacoa lleva mostaza y soja.'
  },
  'salmon-teriyaki': { contains: ['Pescado', 'Soja', 'Gluten'], traces: ['Sésamo'] },
  'pollo-curry': { contains: [], traces: ['Lácteos', 'Frutos secos', 'Mostaza'] },
  'macarrones-bolonesa': { contains: ['Gluten'], traces: ['Lácteos', 'Apio', 'Sulfitos'] },
  'paella-valenciana': {
    contains: [],
    traces: ['Crustáceos', 'Moluscos', 'Pescado', 'Gluten'],
    note: 'Se cocina en la misma zona que los arroces de marisco.'
  }
};

// ---------------------------------------------------------------------------
// Etiquetas gastronómicas y popularidad simulada (0-100)
// ---------------------------------------------------------------------------

export const productTags = {
  // Aperitivo y picar
  'frutos-secos': { tags: ['compartir', 'vegetariano', 'ligero'], popularity: 48 },
  papas: { tags: ['compartir', 'vegetariano', 'ligero'], popularity: 62 },
  aceitunas: { tags: ['compartir', 'vegetariano', 'ligero'], popularity: 55 },
  'barqueta-mini-fuets': { tags: ['compartir', 'carne'], popularity: 58 },
  'papas-mejillones': { tags: ['compartir', 'pescado', 'ligero'], popularity: 71 },
  'papas-boquerones': { tags: ['compartir', 'pescado', 'ligero'], popularity: 66 },
  'papas-limon-berberechos': { tags: ['compartir', 'pescado', 'ligero'], popularity: 74 },

  // Tapas
  'pulpo-pimenton': { tags: ['compartir', 'pescado', 'contundente'], popularity: 92 },
  'ensaladilla-rusa': { tags: ['compartir', 'pescado', 'ligero'], popularity: 85 },
  'ajo-arriero': { tags: ['compartir', 'pescado'], popularity: 61 },
  'nachos-verano': { tags: ['compartir', 'vegetariano'], popularity: 79 },
  'nachos-tartar-salmon': { tags: ['compartir', 'pescado'], popularity: 83 },
  'tabla-jamon-iberico-duroc': { tags: ['compartir', 'carne'], popularity: 90 },
  'tabla-quesos-valencianos': { tags: ['compartir', 'vegetariano'], popularity: 76 },
  'tortilla-jamon': { tags: ['compartir', 'carne'], popularity: 72 },
  'mejillones-vapor-limon': { tags: ['compartir', 'pescado', 'ligero'], popularity: 69 },
  'servicio-pan': { tags: ['compartir', 'vegetariano'], popularity: 40 },
  'servicio-picos-pan-adicional': { tags: ['compartir', 'vegetariano'], popularity: 32 },
  'salsas-adicionales': { tags: ['compartir'], popularity: 30 },

  // Desayuno
  'desayuno-tradicional': { tags: ['ligero'], popularity: 64 },
  'desayuno-supreme': { tags: ['pescado', 'contundente'], popularity: 57 },

  // Bocadillos
  'bocadillo-escalivada': { tags: ['vegetariano', 'contundente'], popularity: 51 },
  'magro-tomate': { tags: ['carne', 'contundente'], popularity: 68 },
  'lomo-ajos-tiernos': { tags: ['carne', 'contundente'], popularity: 63 },
  'bocadillo-atun-tomate': { tags: ['pescado'], popularity: 59 },
  'bocadillo-jamon-tomate-rucula': { tags: ['carne'], popularity: 70 },
  'bocadillo-lomo-queso': { tags: ['carne', 'contundente'], popularity: 65 },

  // Pizzas
  margarita: { tags: ['vegetariano', 'compartir', 'contundente'], popularity: 80 },
  tartufata: { tags: ['vegetariano', 'compartir', 'contundente'], popularity: 74 },
  'jamon-queso': { tags: ['carne', 'compartir', 'contundente'], popularity: 82 },
  'cuatro-quesos': { tags: ['vegetariano', 'compartir', 'contundente'], popularity: 78 },
  peperoni: { tags: ['carne', 'compartir', 'contundente'], popularity: 88 },
  canibal: { tags: ['carne', 'compartir', 'contundente'], popularity: 86 },

  // Platos preparados
  'ensalada-quinoa': { tags: ['vegetariano', 'ligero'], popularity: 67 },
  'costillas-barbacoa': { tags: ['carne', 'contundente', 'compartir'], popularity: 89 },
  'salmon-teriyaki': { tags: ['pescado', 'ligero'], popularity: 75 },
  'pollo-curry': { tags: ['carne', 'contundente'], popularity: 70 },
  'macarrones-bolonesa': { tags: ['carne', 'contundente'], popularity: 66 },
  'paella-valenciana': { tags: ['carne', 'compartir', 'contundente'], popularity: 94 },

  // Bebidas destacadas
  'sangria-cava': { tags: ['compartir', 'dulce'], popularity: 87 },
  'sangria-vino-tinto': { tags: ['compartir'], popularity: 81 },
  'sangria-vino-blanco': { tags: ['compartir'], popularity: 73 },
  'agua-valencia': { tags: ['compartir', 'dulce'], popularity: 77 },
  'tinto-verano-jarra': { tags: ['compartir'], popularity: 84 },
  'tinto-verano-vaso': { tags: ['ligero'], popularity: 72 },
  'mojito-normal': { tags: ['dulce'], popularity: 91 },
  'aperol-spritz': { tags: ['ligero'], popularity: 88 },
  'pina-colada': { tags: ['dulce'], popularity: 76 },
  'crodino-sin-alcohol': { tags: ['ligero'], popularity: 54 },

  // Smoothies y frappés (la familia "dulce" de la carta)
  'smoothie-pina-coco': { tags: ['dulce', 'ligero', 'vegetariano'], popularity: 82 },
  'smoothie-melon': { tags: ['dulce', 'ligero', 'vegetariano'], popularity: 70 },
  'smoothie-maracuya-mango': { tags: ['dulce', 'ligero', 'vegetariano'], popularity: 78 },
  'smoothie-mango': { tags: ['dulce', 'ligero', 'vegetariano'], popularity: 74 },
  'frappe-chocolate': { tags: ['dulce', 'vegetariano'], popularity: 85 },
  'frappe-vainilla': { tags: ['dulce', 'vegetariano'], popularity: 71 },
  'frappe-yogurt': { tags: ['dulce', 'ligero', 'vegetariano'], popularity: 63 },
  'frappe-cafe': { tags: ['dulce', 'vegetariano'], popularity: 79 },
  'frappe-cafe-bayleis': { tags: ['dulce'], popularity: 68 }
};

export function getProductMeta(legacyId) {
  return productTags[legacyId] || { tags: [], popularity: 45 };
}

// ---------------------------------------------------------------------------
// Variantes y extras de ejemplo
// ---------------------------------------------------------------------------
// Una opción con `price` fija el precio base; con `delta` lo suma al base.

const PIZZA_OPTIONS = {
  variants: [
    {
      id: 'masa',
      label: 'Masa',
      options: [
        { id: 'clasica', label: 'Clásica', delta: 0 },
        { id: 'fina', label: 'Fina y crujiente', delta: 0 },
        { id: 'sin-gluten', label: 'Sin gluten', delta: 2 }
      ]
    }
  ],
  extras: [
    { id: 'extra-queso', label: 'Extra de queso', delta: 1.5 },
    { id: 'rucula', label: 'Rúcula fresca', delta: 1 },
    { id: 'huevo', label: 'Huevo', delta: 1 },
    { id: 'trufa', label: 'Aceite de trufa', delta: 1.5 }
  ]
};

const BOCADILLO_OPTIONS = {
  variants: [
    {
      id: 'pan',
      label: 'Pan',
      options: [
        { id: 'baguette', label: 'Baguette', delta: 0 },
        { id: 'chapata', label: 'Chapata', delta: 0 },
        { id: 'sin-gluten', label: 'Sin gluten', delta: 1.5 }
      ]
    }
  ],
  extras: [
    { id: 'extra-queso', label: 'Extra de queso', delta: 1 },
    { id: 'alioli', label: 'Alioli', delta: 0.8 },
    { id: 'sin-tomate', label: 'Sin tomate', delta: 0 }
  ]
};

const PLATO_OPTIONS = {
  variants: [
    {
      id: 'racion',
      label: 'Ración',
      options: [
        { id: 'individual', label: 'Individual', delta: 0 },
        { id: 'compartir', label: 'Para compartir', delta: 4 }
      ]
    }
  ],
  extras: [
    { id: 'extra-salsa', label: 'Extra de salsa', delta: 1 },
    { id: 'pan', label: 'Ración de pan', delta: 2 }
  ]
};

const TAPA_OPTIONS = {
  variants: [
    {
      id: 'tamano',
      label: 'Tamaño',
      options: [
        { id: 'tapa', label: 'Tapa', delta: 0 },
        { id: 'racion', label: 'Ración', delta: 4 }
      ]
    }
  ],
  extras: [{ id: 'pan', label: 'Con pan de acompañamiento', delta: 2 }]
};

const CAFE_OPTIONS = {
  variants: [
    {
      id: 'leche',
      label: 'Leche',
      options: [
        { id: 'entera', label: 'Entera', delta: 0 },
        { id: 'desnatada', label: 'Desnatada', delta: 0 },
        { id: 'sin-lactosa', label: 'Sin lactosa', delta: 0 },
        { id: 'avena', label: 'Bebida de avena', delta: 0.3 }
      ]
    },
    {
      id: 'intensidad',
      label: 'Intensidad',
      options: [
        { id: 'normal', label: 'Normal', delta: 0 },
        { id: 'doble', label: 'Doble', delta: 0.6 },
        { id: 'descafeinado', label: 'Descafeinado', delta: 0 }
      ]
    }
  ],
  extras: []
};

const COCTEL_OPTIONS = {
  variants: [
    {
      id: 'preparacion',
      label: 'Preparación',
      options: [
        { id: 'clasico', label: 'Clásico', delta: 0 },
        { id: 'sin-alcohol', label: 'Sin alcohol', delta: 0 }
      ]
    }
  ],
  extras: [{ id: 'extra-fruta', label: 'Extra de fruta fresca', delta: 1 }]
};

const REFRESCO_OPTIONS = {
  variants: [
    {
      id: 'hielo',
      label: 'Hielo',
      options: [
        { id: 'con', label: 'Con hielo', delta: 0 },
        { id: 'sin', label: 'Sin hielo', delta: 0 }
      ]
    }
  ],
  extras: [{ id: 'limon', label: 'Con rodaja de limón', delta: 0 }]
};

const OPTIONS_BY_GROUP = {
  pizzas: PIZZA_OPTIONS,
  bocadillos: BOCADILLO_OPTIONS,
  platos: PLATO_OPTIONS,
  tapas: TAPA_OPTIONS,
  cafes: CAFE_OPTIONS,
  'cocteles-clasicos': COCTEL_OPTIONS,
  refrescos: REFRESCO_OPTIONS
};

// Vinos, cavas y espumosos: el formato cambia el precio de forma absoluta.
const WINE_FORMATS = {
  'ceremonia-sauvignon-blanc': [4, 20],
  'ramon-bilbao-verdejo': [4.8, 22],
  'paco-lola-albarino': [4.8, 22],
  'ceremonia-cabernet-sauvignon': [4, 20],
  'ramon-bilbao-crianza-rioja': [4.8, 22],
  'ceramic-monastrell-vicente-gandia': [4.8, 22],
  'ceremonia-bobal-rose': [4, 20],
  'cava-patacona-brut': [5, 30]
};

export function getProductOptions(legacyId, groupId) {
  const formats = WINE_FORMATS[legacyId];
  if (formats) {
    return {
      variants: [
        {
          id: 'formato',
          label: 'Formato',
          options: [
            { id: 'copa', label: 'Copa', price: formats[0] },
            { id: 'botella', label: 'Botella', price: formats[1] }
          ]
        }
      ],
      extras: []
    };
  }
  return OPTIONS_BY_GROUP[groupId] || { variants: [], extras: [] };
}

// ---------------------------------------------------------------------------
// Recomendaciones cruzadas ("se suele pedir con")
// ---------------------------------------------------------------------------
// Reglas fijas y coherentes: nunca se recomienda otro plato principal cuando ya
// se ha añadido un principal.

export const pairingsByProduct = {
  // Pizzas -> acompañamientos, panes, salsas o un entrante ligero
  margarita: ['papas', 'nachos-verano', 'salsas-adicionales'],
  tartufata: ['papas', 'tabla-quesos-valencianos', 'salsas-adicionales'],
  'jamon-queso': ['papas', 'aceitunas', 'salsas-adicionales'],
  'cuatro-quesos': ['papas', 'aceitunas', 'salsas-adicionales'],
  peperoni: ['papas', 'nachos-verano', 'salsas-adicionales'],
  canibal: ['papas', 'nachos-verano', 'salsas-adicionales'],

  // Bocadillos -> acompañamientos y salsas
  'bocadillo-escalivada': ['papas', 'aceitunas', 'salsas-adicionales'],
  'magro-tomate': ['papas', 'salsas-adicionales', 'aceitunas'],
  'lomo-ajos-tiernos': ['papas', 'salsas-adicionales', 'aceitunas'],
  'bocadillo-atun-tomate': ['papas', 'aceitunas', 'salsas-adicionales'],
  'bocadillo-jamon-tomate-rucula': ['papas', 'aceitunas', 'salsas-adicionales'],
  'bocadillo-lomo-queso': ['papas', 'salsas-adicionales', 'aceitunas'],

  // Platos preparados -> pan, salsas o un entrante que pegue
  'ensalada-quinoa': ['servicio-pan', 'aceitunas', 'papas'],
  'costillas-barbacoa': ['papas', 'servicio-pan', 'salsas-adicionales'],
  'salmon-teriyaki': ['ensaladilla-rusa', 'servicio-pan', 'aceitunas'],
  'pollo-curry': ['servicio-pan', 'papas', 'salsas-adicionales'],
  'macarrones-bolonesa': ['servicio-pan', 'tabla-quesos-valencianos', 'aceitunas'],
  'paella-valenciana': ['servicio-pan', 'aceitunas', 'ensaladilla-rusa'],

  // Desayuno
  'desayuno-tradicional': ['zumos', 'cafe-con-leche', 'frutos-secos'],
  'desayuno-supreme': ['zumos', 'cafe-con-leche', 'aceitunas'],

  // Entrantes -> otros entrantes o cosas de picar
  'tabla-jamon-iberico-duroc': ['servicio-pan', 'tabla-quesos-valencianos', 'aceitunas'],
  'tabla-quesos-valencianos': ['servicio-pan', 'tabla-jamon-iberico-duroc', 'frutos-secos'],
  'ensaladilla-rusa': ['servicio-pan', 'aceitunas', 'papas-boquerones'],
  'pulpo-pimenton': ['servicio-pan', 'ensaladilla-rusa', 'aceitunas'],
  'nachos-verano': ['papas', 'aceitunas', 'salsas-adicionales'],
  'nachos-tartar-salmon': ['aceitunas', 'papas', 'servicio-pan'],
  'ajo-arriero': ['servicio-pan', 'aceitunas', 'papas'],
  'tortilla-jamon': ['servicio-pan', 'aceitunas', 'papas'],
  'mejillones-vapor-limon': ['servicio-pan', 'papas-limon-berberechos', 'aceitunas'],
  'papas-mejillones': ['aceitunas', 'frutos-secos', 'servicio-pan'],
  'papas-boquerones': ['aceitunas', 'frutos-secos', 'servicio-pan'],
  'papas-limon-berberechos': ['aceitunas', 'mejillones-vapor-limon', 'servicio-pan'],
  'barqueta-mini-fuets': ['aceitunas', 'papas', 'frutos-secos'],

  // Dulces -> otros dulces
  'frappe-chocolate': ['frappe-vainilla', 'frappe-cafe', 'smoothie-mango'],
  'frappe-vainilla': ['frappe-chocolate', 'frappe-cafe', 'smoothie-melon'],
  'frappe-cafe': ['frappe-chocolate', 'frappe-cafe-bayleis', 'frappe-vainilla'],
  'frappe-yogurt': ['smoothie-melon', 'smoothie-mango', 'frappe-vainilla'],
  'frappe-cafe-bayleis': ['frappe-cafe', 'frappe-chocolate', 'frappe-vainilla'],
  'smoothie-pina-coco': ['smoothie-mango', 'smoothie-maracuya-mango', 'frappe-yogurt'],
  'smoothie-melon': ['smoothie-mango', 'smoothie-pina-coco', 'frappe-yogurt'],
  'smoothie-mango': ['smoothie-maracuya-mango', 'smoothie-pina-coco', 'frappe-yogurt'],
  'smoothie-maracuya-mango': ['smoothie-mango', 'smoothie-pina-coco', 'frappe-yogurt'],

  // Bebidas -> algo de picar
  'sangria-cava': ['tabla-jamon-iberico-duroc', 'papas', 'aceitunas'],
  'sangria-vino-tinto': ['tabla-jamon-iberico-duroc', 'aceitunas', 'papas'],
  'sangria-vino-blanco': ['papas-limon-berberechos', 'aceitunas', 'papas'],
  'agua-valencia': ['tabla-quesos-valencianos', 'aceitunas', 'papas'],
  'tinto-verano-jarra': ['papas', 'aceitunas', 'frutos-secos'],
  'mojito-normal': ['nachos-verano', 'papas', 'frutos-secos'],
  'aperol-spritz': ['aceitunas', 'frutos-secos', 'tabla-quesos-valencianos']
};

// Cuando un producto no tiene regla propia se usa la de su familia.
export const pairingsByKind = {
  entrante: ['servicio-pan', 'aceitunas', 'papas'],
  principal: ['papas', 'servicio-pan', 'salsas-adicionales'],
  acompanamiento: ['aceitunas', 'papas', 'frutos-secos'],
  dulce: ['frappe-vainilla', 'smoothie-mango', 'frappe-cafe'],
  bebida: ['aceitunas', 'papas', 'frutos-secos']
};

// Encabezado de la sección de recomendaciones según lo que se acaba de añadir.
export const pairingHeadings = {
  entrante: 'Popular para compartir',
  principal: 'Completa tu pedido',
  acompanamiento: 'También puede interesarte',
  dulce: 'Se suele pedir con',
  bebida: 'La opción más elegida junto a este producto'
};

// Recomendaciones extra que solo tienen sentido cuando la mesa es grande.
export const groupPairings = ['tabla-jamon-iberico-duroc', 'tabla-quesos-valencianos', 'sangria-cava'];

// ---------------------------------------------------------------------------
// Combinaciones populares (no son menús ni ofertas cerradas)
// ---------------------------------------------------------------------------

export const popularCombos = [
  {
    id: 'picoteo-mediterraneo',
    name: 'Mesa de picoteo mediterránea',
    tagline: 'Lo que más se pide cuando sois varios',
    forPeople: [2, 4],
    items: ['tabla-jamon-iberico-duroc', 'papas-limon-berberechos', 'servicio-pan', 'sangria-cava']
  },
  {
    id: 'domingo-de-arroz',
    name: 'Domingo de arroz en la playa',
    tagline: 'El clásico de mediodía',
    forPeople: [2, 6],
    items: ['ensaladilla-rusa', 'paella-valenciana', 'servicio-pan', 'frappe-cafe']
  },
  {
    id: 'noche-de-pizza',
    name: 'Noche de pizza',
    tagline: 'Favorito de nuestros clientes',
    forPeople: [2, 4],
    items: ['nachos-verano', 'peperoni', 'papas', 'frappe-chocolate']
  }
];

// ---------------------------------------------------------------------------
// Ficha visual «¡Haz Click!»
// ---------------------------------------------------------------------------
// Notas cortas que se dibujan sobre la foto con una flechita, al estilo de un
// cartel hecho a mano. Solo para entrantes y principales: en las bebidas no
// aportan nada. Máximo tres por producto; el orden marca dónde se colocan.

export const productPosterNotes = {
  // --- Aperitivo y picar ---------------------------------------------------
  'frutos-secos': ['Tostados del día', 'Para abrir boca', 'Sin freír'],
  papas: ['Bolsa artesana', 'Crujientes', 'Para compartir'],
  aceitunas: ['Aliñadas en casa', 'Con su punto de hierbas', 'Sin gluten'],
  'barqueta-mini-fuets': ['Curado artesano', 'Cortado fino', 'Perfecto con cerveza'],
  'papas-mejillones': ['Mejillones en escabeche', 'Sobre papas crujientes', 'Un clásico de barra'],
  'papas-boquerones': ['Boquerones en vinagre', 'Papas al momento', 'Fresquito'],
  'papas-limon-berberechos': ['Berberechos al natural', 'Chorrito de limón', 'Lo más fresco de la casa'],

  // --- Tapas ---------------------------------------------------------------
  'pulpo-pimenton': ['Pulpo tierno', 'Pimentón de la Vera', 'Patatas a lo pobre debajo'],
  'ensaladilla-rusa': ['Mayonesa hecha en casa', 'Bonito del norte', 'Se sirve bien fría'],
  'ajo-arriero': ['Bacalao desmigado', 'Receta tradicional', 'Con pan tostado'],
  'nachos-verano': ['Queso fundido', 'Guacamole fresco', 'Para picar entre varios'],
  'nachos-tartar-salmon': ['Tartar de salmón', 'Alga wakame', 'Salsa Tavola'],
  'tabla-jamon-iberico-duroc': ['Cortado a cuchillo', 'Curación larga', 'Cunde para toda la mesa'],
  'tabla-quesos-valencianos': ['Quesos de la tierra', 'Tres variedades', 'Con su punto dulce'],
  'tortilla-jamon': ['Poco cuajada', 'Huevo de corral', 'Jamón en tacos'],
  'mejillones-vapor-limon': ['Al vapor, sin más', 'Limón recién exprimido', 'Ligero y marinero'],

  // --- Bocadillos ----------------------------------------------------------
  'bocadillo-escalivada': ['Verduras asadas', 'Pan crujiente', 'Opción vegetariana'],
  'magro-tomate': ['Magro a la plancha', 'Tomate rallado', 'El de toda la vida'],
  'lomo-ajos-tiernos': ['Lomo jugoso', 'Ajos tiernos salteados', 'Recién hecho'],
  'bocadillo-atun-tomate': ['Atún en aceite', 'Tomate natural', 'Sencillo y rico'],
  'bocadillo-jamon-tomate-rucula': ['Jamón curado', 'Rúcula fresca', 'Pan con tomate'],
  'bocadillo-lomo-queso': ['Lomo a la plancha', 'Queso fundido', 'Contundente'],

  // --- Pizzas --------------------------------------------------------------
  margarita: ['Masa madre', 'Mozzarella fresca', 'Albahaca al salir del horno'],
  tartufata: ['Crema de trufa', 'Jamón y queso', 'Horno de piedra'],
  'jamon-queso': ['Jamón York', 'Queso fundido', 'La favorita de los peques'],
  'cuatro-quesos': ['Cuatro quesos', 'Fundido lento', 'Sin carne'],
  peperoni: ['Peperoni picante', 'Borde crujiente', 'De las más pedidas'],
  canibal: ['Tres carnes', 'Para los de mucha hambre', 'Horno de piedra'],

  // --- Platos preparados ---------------------------------------------------
  'ensalada-quinoa': ['Quinoa cocida al punto', 'Verduras frescas', 'La opción ligera'],
  'costillas-barbacoa': ['Cocción lenta', 'Salsa barbacoa de la casa', 'Se despega del hueso'],
  'salmon-teriyaki': ['Salmón fresco', 'Glaseado teriyaki', 'Ligero y con sabor'],
  'pollo-curry': ['Curry suave', 'Con su arroz', 'Nada picante'],
  'macarrones-bolonesa': ['Boloñesa casera', 'Cocción lenta', 'Plato de siempre'],
  'paella-valenciana': ['Arroz en su punto', 'Receta valenciana', 'El plato estrella'],

  // --- Desayuno ------------------------------------------------------------
  'desayuno-tradicional': ['Tostada recién hecha', 'Con café o infusión', 'Para empezar el día'],
  'desayuno-supreme': ['Tostada de salmón', 'Zumo natural', 'El desayuno completo']
};
