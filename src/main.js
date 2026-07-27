import { initialMenuSnapshot } from './menu-snapshot.js';
import { localProductImages } from './product-images.js';
import {
  buildAllergenBanner,
  decorateAllergenTrigger,
  getAllergenInfo as getSmartAllergenInfo,
  initSmartMenu,
  isSelectedAllergenLabel,
  openProductSheet,
  refreshSmartPanels,
  registerCatalog,
  renderCombosSection
} from './smart-menu.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
let realtimeClient = null;
let realtimeClientPromise = null;

let foodGroups = [];
let beverageGroups = [];
let granizadosSmoothiesGroups = [];
let cocktailGroups = [];
let activeRestaurant = null;
let menuChannel = null;
let realtimeReconnectTimer = null;
let realtimeRefreshTimer = null;
let realtimeReconnectAttempt = 0;
let isPageClosing = false;
let initialMenuRequest = null;

async function getRealtimeClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (realtimeClient) return realtimeClient;

  if (!realtimeClientPromise) {
    realtimeClientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) => {
        realtimeClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });
        return realtimeClient;
      })
      .catch((error) => {
        realtimeClientPromise = null;
        throw error;
      });
  }

  return realtimeClientPromise;
}

const categoryLayout = {
  "10000000-0000-4000-8000-000000000001": {
    "id": "refrescos",
    "target": "beverageGroups"
  },
  "10000000-0000-4000-8000-000000000002": {
    "id": "cafes",
    "target": "beverageGroups"
  },
  "10000000-0000-4000-8000-000000000003": {
    "id": "cerveza",
    "target": "beverageGroups"
  },
  "10000000-0000-4000-8000-000000000004": {
    "id": "vermouth-copas",
    "target": "beverageGroups"
  },
  "10000000-0000-4000-8000-000000000005": {
    "id": "vinos-blancos",
    "target": "beverageGroups"
  },
  "10000000-0000-4000-8000-000000000006": {
    "id": "vinos-tintos",
    "target": "beverageGroups"
  },
  "10000000-0000-4000-8000-000000000007": {
    "id": "vinos-rosados",
    "target": "beverageGroups"
  },
  "10000000-0000-4000-8000-000000000008": {
    "id": "cavas-espumosos",
    "target": "beverageGroups"
  },
  "10000000-0000-4000-8000-000000000009": {
    "id": "cocteles-clasicos",
    "target": "cocktailGroups"
  },
  "10000000-0000-4000-8000-000000000010": {
    "id": "granizados-smoothies-frappes",
    "target": "granizadosSmoothiesGroups"
  },
  "10000000-0000-4000-8000-000000000011": {
    "id": "sangrias-carta",
    // Las sangrías van dentro de Bebidas para dejar sitio en la barra de
    // pestañas a las combinaciones populares.
    "target": "beverageGroups"
  },
  "10000000-0000-4000-8000-000000000012": {
    "id": "desayuno",
    "target": "foodGroups"
  },
  "10000000-0000-4000-8000-000000000013": {
    "id": "picar",
    "target": "foodGroups"
  },
  "10000000-0000-4000-8000-000000000014": {
    "id": "tapas",
    "target": "foodGroups"
  },
  "10000000-0000-4000-8000-000000000015": {
    "id": "bocadillos",
    "target": "foodGroups"
  },
  "10000000-0000-4000-8000-000000000016": {
    "id": "pizzas",
    "target": "foodGroups"
  },
  "10000000-0000-4000-8000-000000000017": {
    "id": "platos",
    "target": "foodGroups"
  }
};
const legacyProductIds = {
  "8e63a2a1-fbb9-5ea6-ad1c-884780854e12": "agua",
  "9b7ac17d-66e2-5edb-b337-ddece63a1c3f": "agua-gas",
  "303891b6-9c76-50e4-a9ae-0e00f0800e9b": "pepsi",
  "8e84e1af-e57c-5d99-92da-d2a7802791e6": "pepsi-zero",
  "e52efe74-fbc9-59c3-81d5-eb8dae3c12d8": "schweppes-naranja",
  "ee6ad39f-4158-5c85-b390-231ce50ce992": "schweppes-limon",
  "3cef03da-2134-5edf-9076-22b82753f2ce": "sevenup",
  "977935a3-902a-56d3-9244-2ac464b844d5": "tonica-schweppes",
  "11b281fe-4a59-57b9-8dbf-9788af0e95ba": "aquarade-limon",
  "dbb2fd14-546b-5f2b-b5a2-d8271d1b881c": "aquarade-naranja",
  "3f83d2ca-9c1f-59bc-9cd7-f116851b971c": "lipton-limon",
  "f3c9e2f7-f1d1-5db5-bca2-c4c1cbc439c9": "redbull",
  "a73d8327-ca5b-5369-9852-7d431119a645": "zumos",
  "80218a87-6148-5eef-9193-82540597adc6": "cafe-solo",
  "26bb8b86-15e1-567e-a924-23b6bb3959fe": "cortado",
  "43419824-bc31-5bff-a2ec-e4873beeb93a": "bombon",
  "78c3ba96-6734-5e69-bb5d-119896c3a6ba": "cafe-con-leche",
  "1351012e-14d2-5ed2-80eb-866c725e6979": "americano",
  "50a8cf2a-f0b7-5555-a432-23d763cbaad3": "infusiones-tes",
  "3dd2b048-606a-51e9-a26a-8bb657982843": "carajillo",
  "18afd703-033d-5b0c-b081-49f3a666bc14": "aguila-dorada",
  "5908d16e-d9fb-544d-95d5-7fd9eebf41a7": "radler",
  "160f79bd-ed0e-5337-991f-78923a3e2dd8": "cerveza-00",
  "451b53c6-9488-576d-ba41-04a4762cab4d": "cerveza-sin-gluten",
  "93ba9747-7d7e-5aa5-9b34-78b292bf117c": "amstel-oro-lata",
  "25e3100c-ada3-5f70-96f4-fbb4bbe58e61": "vermouth",
  "808f73c3-e484-5cc1-ab61-741b2ee2abb8": "combinados",
  "6293d5e1-9812-5ec1-b463-a1db5df939bf": "premium-desde",
  "ff9a6966-9c00-507c-86a4-1d31acc19251": "chupitos",
  "60b47bb8-ac0f-5ddd-a10e-01c6ec00325e": "chupitos-premium",
  "010ef780-e377-5496-b52f-e26d8498a802": "licores",
  "9d13a4cc-5c39-58ab-a3e2-5b93807f5342": "ceremonia-sauvignon-blanc",
  "ffe95e3d-ad1e-5496-b6c5-351617bf2261": "ramon-bilbao-verdejo",
  "4204ddb9-25ff-5cba-9a2c-e925f1fb146d": "paco-lola-albarino",
  "4995138f-77c3-5456-9143-9572697185c2": "ceremonia-cabernet-sauvignon",
  "c7fb9a70-d627-56f2-b8ec-ab3c7f43759a": "ramon-bilbao-crianza-rioja",
  "9ce68fe4-cef7-512f-88f8-081077c5bf10": "ceramic-monastrell-vicente-gandia",
  "5e8e57ac-b5f4-5279-bd4e-663a5f310e84": "ceremonia-bobal-rose",
  "cb0d55fc-8a4a-5731-a08f-5dfc7dabeaab": "cava-patacona-brut",
  "cd4bb3e6-b843-59a5-b168-763476fca235": "cava-lola",
  "2f2f36e4-a5b0-5613-81bb-4d4ed4a76f13": "moet-chandon",
  "44e737e1-af0c-5258-873a-a87d2b2f8728": "moet-chandon-rose",
  "84bb17d5-5dc6-5f12-99d5-a3fc0e8cb20e": "moet-chandon-ice",
  "59d14b09-c193-5a2c-a982-6288dc4d5e09": "mojito-normal",
  "64cf7e85-65e3-5ec6-b2fc-cde20d02d3ee": "mojito-sabores",
  "cb6a491f-96b5-5d02-bd53-0408d5a14d31": "daikiri-frozen",
  "45b43d3f-acbb-5819-af2a-8d27d0eb0c39": "daiquiri-sabores",
  "b84708e2-de7f-5318-8e00-703015379909": "pina-colada",
  "6ca2e169-933c-5984-92a0-04b949d36bf5": "caipirinha",
  "8cbc3b32-f357-54b4-a3de-e67a947ce2e4": "caipiroska",
  "87f9ba15-a068-5645-ae06-8031c498bae8": "aperol-spritz",
  "355f716e-9277-5822-b667-2e0e55916c4c": "crodino-sin-alcohol",
  "4aee2a73-556a-5ee2-a9fc-3cdf9e8c5d15": "sarti-spritz",
  "4b6aa302-8ed3-5366-bfaa-b942d917d1f2": "mondoro-hugo-spritz",
  "920bf713-e591-5994-b3a6-aacd5dd82ea1": "smoothie-pina-coco",
  "365fe36c-57d6-5527-b25b-c6ee8074215e": "smoothie-melon",
  "50a6c6d9-d8c2-5a21-80a7-0e102df9aea1": "smoothie-maracuya-mango",
  "670d8ab4-7f9c-5ea4-aca8-d635b73dc08f": "smoothie-mango",
  "b255b324-d405-5e19-bfb4-4bc351774dc8": "frappe-chocolate",
  "df777c72-7473-5dda-9e54-96e723c4c844": "frappe-vainilla",
  "18cf781a-d001-5d20-a746-6cf2b632e5a2": "frappe-yogurt",
  "d9245d1c-0414-5260-a2c3-0f3f7c88665b": "frappe-cafe",
  "31394140-8903-52e9-a49f-29c2c9778b47": "frappe-cafe-bayleis",
  "c906c0eb-2450-5b80-87c1-6f8d4f712ab5": "tinto-verano-vaso",
  "97956288-d35a-5ac0-8158-9f8a92dcc19b": "tinto-verano-jarra",
  "7a179e53-27b0-580e-8432-8735caa2c1ea": "sangria-vino-blanco",
  "caa23607-0ad6-57c0-b462-7ff42be473f2": "sangria-vino-tinto",
  "77940dc0-46c8-5082-a3eb-9f4a6708e93a": "sangria-cava",
  "bcddeb7d-73e9-594f-80d9-db3f21b95575": "agua-valencia",
  "04092f52-a70d-511e-b10a-f2577cb50522": "desayuno-tradicional",
  "addcb6ff-dc62-5751-8c6c-c60f249569a4": "desayuno-supreme",
  "a4beac16-cd8b-5377-a315-b8730cc032aa": "frutos-secos",
  "6ee59111-cf67-5b68-ae67-cb2d2a770302": "papas",
  "c0867767-46f4-5c59-b805-04b6ae0b3b1c": "aceitunas",
  "bdb2c62b-110b-5843-aec8-f51512e09e87": "barqueta-mini-fuets",
  "d135531f-3c37-5dc7-ad64-1fc174a2ae0f": "papas-mejillones",
  "370488e8-9351-532a-93bf-e265d975452e": "papas-boquerones",
  "2f13b7ba-08ac-5694-8b3c-0e399575243d": "papas-limon-berberechos",
  "2e5d5fd1-bb60-5d0f-975d-774df0890f07": "pulpo-pimenton",
  "1672bb71-be09-578c-84ed-9f797eab4843": "ensaladilla-rusa",
  "2981816f-886e-5b1f-9fa4-d2e77d0eaa3b": "ajo-arriero",
  "ea79ad82-739c-5b98-8eb0-2f795d6d949a": "nachos-verano",
  "b092e092-0320-5a44-bc8a-0ee4b0754800": "nachos-tartar-salmon",
  "c8701768-9a4c-59f6-b7af-72c505a3ce6d": "tabla-jamon-iberico-duroc",
  "a2531ea5-adb4-5bbc-8051-76c2fae98d7a": "tabla-quesos-valencianos",
  "fc0449a9-0563-58d1-aaf0-e0553d1f51f8": "tortilla-jamon",
  "171c4241-5d1f-5e9c-94a2-2d5008aecaee": "mejillones-vapor-limon",
  "7121e815-7ab2-5007-8a17-cf84d9a5d2b1": "servicio-pan",
  "906d9ad5-808c-539d-aa17-494c29588388": "servicio-picos-pan-adicional",
  "a0810607-0062-5083-910e-75e05e2876a3": "salsas-adicionales",
  "b5df5716-c764-5af2-9c71-23342de26668": "bocadillo-escalivada",
  "f9e573c4-c991-5440-a886-ae3856857767": "magro-tomate",
  "d5240c22-7291-5a3b-a56c-85424db714c3": "lomo-ajos-tiernos",
  "d5dd4e0e-8370-5aa9-833d-3b1911730300": "bocadillo-atun-tomate",
  "0b6e8c6a-2f3a-53d7-9182-c1e9019286a7": "bocadillo-jamon-tomate-rucula",
  "49d69989-d3fa-58c7-9505-1fd25ff99c60": "bocadillo-lomo-queso",
  "c3281db6-4ec3-5b2f-8b7f-b9e6883fdf83": "margarita",
  "31681f36-2b96-58f9-a5cc-eb30fc9e6b51": "tartufata",
  "0f0ab3f6-b018-5948-84cb-4b8006026714": "jamon-queso",
  "34232044-1d87-5d70-a566-9b03215f1575": "cuatro-quesos",
  "3320197a-ed40-5754-9d7d-4ce1b107a2e3": "peperoni",
  "a7a24525-44fe-5408-9784-5793574dfcf3": "canibal",
  "8ca60397-5597-59af-b435-c401fb9a7647": "ensalada-quinoa",
  "852cf0f3-3446-5256-9e90-25c26b4e369b": "costillas-barbacoa",
  "cab21c37-3da8-533f-a487-c5f3e5d14e7d": "salmon-teriyaki",
  "aa4ba563-3671-553e-b909-8b730b96f646": "pollo-curry",
  "c03bc11e-00ca-5c1d-a24d-1f67c8385513": "macarrones-bolonesa",
  "22ef56d3-060b-5106-b0e6-d8fed74838c9": "paella-valenciana"
};
const nameSizeClasses = {
  small: 'text-base',
  normal: 'text-lg',
  large: 'text-2xl'
};
const nameSizeClassList = Object.values(nameSizeClasses);
const fallbackProductImage = 'assets/comidas/genericas/pasta.webp';

// Extras de servicio (pan, picos, salsas): son texto informativo, sin foto ni
// ficha ampliada. Se pintan como items estáticos, no clicables.
const nonInteractiveLegacyIds = new Set([
  'servicio-pan',
  'servicio-picos-pan-adicional',
  'salsas-adicionales'
]);

export function t(field, locale, defaultLocale = 'es') {
  if (!field || typeof field !== 'object' || Array.isArray(field)) return '';
  const requested = typeof field[locale] === 'string' ? field[locale].trim() : '';
  if (requested) return requested;
  const fallback = typeof field[defaultLocale] === 'string' ? field[defaultLocale].trim() : '';
  if (fallback) return fallback;
  return Object.values(field).find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function formatNumericPrice(price) {
  const amount = Number(price);
  if (!Number.isFinite(amount)) return '';
  return `${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} €`;
}

// El prototipo se sirve con las imágenes locales de /public para poder
// funcionar sin credenciales de Supabase. Si hay proyecto configurado, manda el
// Storage remoto, que es el que refleja los cambios del panel de administración.
function getProductImageUrl(imagePath, productId) {
  if (supabaseUrl && imagePath) {
    const encodedPath = imagePath.split('/').map(encodeURIComponent).join('/');
    return `${supabaseUrl}/storage/v1/object/public/product-images/${encodedPath}`;
  }
  return localProductImages[productId] || fallbackProductImage;
}

export async function getMenu(slug) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
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
  `.replace(/\s+/g, '');
  const search = new URLSearchParams({
    select,
    slug: `eq.${slug}`,
    'categories.is_active': 'eq.true',
    'categories.products.is_active': 'eq.true',
    'categories.order': 'position.asc',
    'categories.products.order': 'position.asc'
  });
  const response = await fetch(`${supabaseUrl}/rest/v1/restaurants?${search}`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Accept: 'application/vnd.pgrst.object+json'
    }
  });
  if (!response.ok) {
    throw new Error(`No se pudo cargar la carta (${response.status}).`);
  }
  const data = await response.json();

  const categories = (data.categories || []).map((category) => ({
    ...category,
    products: (category.products || []).filter(
      (product) => data.sold_out_behavior !== 'hide' || product.is_available
    )
  }));

  return { ...data, categories };
}

// Empieza la consulta mientras el resto de la interfaz termina de inicializarse.
// La misma promesa se consume en la primera carga visual para no duplicar la petición.
// Sin credenciales el prototipo funciona íntegramente con el snapshot local.
const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);
if (hasSupabase) initialMenuRequest = getMenu('tavola');

function productToLegacyShape(product) {
  const legacyId = legacyProductIds[product.id] || null;
  return {
    id: product.id,
    legacyId,
    name: product.name,
    description: product.description,
    priceNote: product.price_note,
    price: product.price,
    priceDisplay: product.price_display,
    image: getProductImageUrl(product.image_path, product.id),
    isAvailable: product.is_available,
    nameSize: product.name_size || 'normal',
    hasDetail: !nonInteractiveLegacyIds.has(legacyId)
  };
}

function applyMenuData(menu) {
  activeRestaurant = menu;
  foodGroups = [];
  beverageGroups = [];
  granizadosSmoothiesGroups = [];
  cocktailGroups = [];

  const targets = {
    foodGroups,
    beverageGroups,
    granizadosSmoothiesGroups,
    cocktailGroups
  };

  menu.categories.forEach((category) => {
    const layout = categoryLayout[category.id] || {
      id: category.id,
      target: category.section === 'bebidas' ? 'beverageGroups' : 'foodGroups'
    };
    targets[layout.target].push({
      id: layout.id,
      name: category.name,
      category: t(category.name, 'es', menu.default_locale),
      shortLabel: t(category.name, 'es', menu.default_locale),
      items: category.products.map(productToLegacyShape)
    });
  });

  const sectionGroups = {
    bebidas: beverageGroups,
    cocteles: cocktailGroups,
    'granizados-smoothies': granizadosSmoothiesGroups,
    comidas: foodGroups
  };
  menuSections.forEach((section) => {
    if (sectionGroups[section.id]) section.groups = sectionGroups[section.id];
  });

  registerCatalog(menuSections);
}

function renderLoadingSkeleton() {
  const ui = getUiCopy();
  menuList.innerHTML = `
    <div class="menu-loading" role="status" aria-live="polite">
      <p class="sr-only">${ui.loading}</p>
      <span class="menu-skeleton menu-skeleton-title"></span>
      <span class="menu-skeleton"></span>
      <span class="menu-skeleton"></span>
      <span class="menu-skeleton"></span>
      <span class="menu-skeleton"></span>
    </div>`;
}

function renderMenuError() {
  const ui = getUiCopy();
  menuList.textContent = '';
  const errorBox = document.createElement('div');
  const title = document.createElement('h2');
  const copy = document.createElement('p');
  const retry = document.createElement('button');
  errorBox.className = 'menu-error';
  title.textContent = ui.loadErrorTitle;
  copy.textContent = ui.loadErrorBody;
  retry.type = 'button';
  retry.textContent = ui.retry;
  retry.addEventListener('click', () => refreshMenu({ showLoading: true }));
  errorBox.append(title, copy, retry);
  menuList.append(errorBox);
}

async function refreshMenu({ showLoading = false } = {}) {
  if (!hasSupabase) return null;
  if (showLoading) renderLoadingSkeleton();
  try {
    const request = initialMenuRequest || getMenu('tavola');
    initialMenuRequest = null;
    const menu = await request;
    applyMenuData(menu);
    renderTabs();
    renderActiveSection();
    updateActiveTabs();
    refreshSmartPanels();
    return menu;
  } catch (error) {
    console.error('No se pudo cargar la carta de Tavola:', error);
    if (!activeRestaurant) renderMenuError();
    return null;
  }
}

function scheduleRealtimeRefresh() {
  window.clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer = window.setTimeout(() => refreshMenu(), 180);
}

function scheduleRealtimeReconnect(restaurantId) {
  if (isPageClosing || realtimeReconnectTimer) return;
  const delay = Math.min(1000 * 2 ** realtimeReconnectAttempt, 15000);
  realtimeReconnectAttempt += 1;
  realtimeReconnectTimer = window.setTimeout(async () => {
    realtimeReconnectTimer = null;
    await subscribeToMenu(restaurantId);
  }, delay);
}

async function subscribeToMenu(restaurantId) {
  if (isPageClosing) return;
  const supabase = await getRealtimeClient();
  if (!supabase || isPageClosing) return;
  if (menuChannel) {
    await supabase.removeChannel(menuChannel);
    menuChannel = null;
  }

  menuChannel = supabase
    .channel(`public-menu-${restaurantId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products', filter: `restaurant_id=eq.${restaurantId}` },
      scheduleRealtimeRefresh
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'categories', filter: `restaurant_id=eq.${restaurantId}` },
      scheduleRealtimeRefresh
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        realtimeReconnectAttempt = 0;
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        scheduleRealtimeReconnect(restaurantId);
      }
    });
}

async function initializeMenu() {
  setupLanguageSwitcher();
  updateStaticText();
  if (initialMenuSnapshot?.categories?.length) {
    applyMenuData(initialMenuSnapshot);
    // La carta inteligente se monta con el catálogo ya cargado y antes del
    // primer pintado, para que los avisos de alérgenos salgan a la primera.
    initSmartMenu(smartBridge);
    renderTabs();
    renderActiveSection();
    updateActiveTabs();
  } else {
    initSmartMenu(smartBridge);
    renderTabs();
    renderLoadingSkeleton();
  }
  const menu = await refreshMenu();
  if (menu) await subscribeToMenu(menu.id);
}

window.addEventListener('beforeunload', () => {
  isPageClosing = true;
  window.clearTimeout(realtimeReconnectTimer);
  window.clearTimeout(realtimeRefreshTimer);
  if (menuChannel && realtimeClient) realtimeClient.removeChannel(menuChannel);
});

const hamacaTariffs = [
  {
    id: "todo-dia",
    icon: "full-day",
    name: "Todo el día",
    schedule: "10:00h a 20:00h",
    price: "45€"
  },
  {
    id: "mananas",
    icon: "morning",
    name: "Turno mañanas",
    schedule: "10:00h a 15:00h",
    price: "25€"
  },
  {
    id: "tardes",
    icon: "afternoon",
    name: "Turno tardes",
    schedule: "15:00h a 20:00h",
    price: "25€"
  }
];

const hamacaRules = [
  "Máximo 3 personas por sombrilla.",
  "Obligatorio 2 sombrillas cuando son 4 personas.",
  "La empresa se reserva el derecho de admisión a niños hasta 14 años.",
  "No se permite acceder a la zona de hamacas con bebida ni comida del exterior que no sea adquirida en El Tavola Chiringo.",
  "Se desalojará la sombrilla y las hamacas 15 minutos antes de terminar el turno de la mañana con el fin de limpiar y acondicionar para el siguiente cliente.",
  "No se permite acceder con perros a la zona de hamacas.",
  "Cualquier conducta inapropiada que moleste al resto de clientes será expulsada de la zona del beach club."
];

const hamacaBenefits = [
  "Puedes pedir directamente desde el código QR de tu sombrilla.",
  "Puedes pedir directamente a nuestro personal de la zona de hamacas."
];

const hamacaLanguageCopy = {
  es: {
    tariffs: {
      mananas: "Turno mañanas",
      tardes: "Turno tardes",
      "todo-dia": "Todo el día"
    },
    rules: hamacaRules,
    benefits: hamacaBenefits
  },
  en: {
    tariffs: {
      mananas: "Morning session",
      tardes: "Afternoon session",
      "todo-dia": "Full day"
    },
    rules: [
      "Maximum 3 people per umbrella.",
      "2 umbrellas are required for 4 people.",
      "The company reserves the right of admission for children up to 14 years old.",
      "Access to the sunbed area with outside food or drinks not purchased at El Tavola Chiringo is not allowed.",
      "The umbrella and sunbeds must be vacated 15 minutes before the morning session ends so the area can be cleaned and prepared for the next guest.",
      "Dogs are not allowed in the sunbed area.",
      "Any inappropriate behaviour that disturbs other guests will result in removal from the beach club area."
    ],
    benefits: [
      "You can order directly from the QR code on your umbrella.",
      "You can order directly from our staff in the sunbed area."
    ]
  },
  de: {
    tariffs: {
      mananas: "Vormittag",
      tardes: "Nachmittag",
      "todo-dia": "Ganzer Tag"
    },
    rules: [
      "Maximal 3 Personen pro Sonnenschirm.",
      "Bei 4 Personen sind 2 Sonnenschirme verpflichtend.",
      "Das Unternehmen behält sich das Recht vor, Kindern bis 14 Jahre den Zutritt zu verweigern.",
      "Der Zugang zum Liegebereich mit Speisen oder Getränken von außerhalb, die nicht im El Tavola Chiringo gekauft wurden, ist nicht erlaubt.",
      "Sonnenschirm und Liegen müssen 15 Minuten vor Ende des Vormittagsturnus geräumt werden, damit der Bereich gereinigt und für den nächsten Gast vorbereitet werden kann.",
      "Hunde sind im Liegebereich nicht erlaubt.",
      "Jedes unangemessene Verhalten, das andere Gäste stört, führt zum Ausschluss aus dem Beach-Club-Bereich."
    ],
    benefits: [
      "Du kannst direkt über den QR-Code an deinem Sonnenschirm bestellen.",
      "Du kannst direkt bei unserem Personal im Liegebereich bestellen."
    ]
  }
};

const menuSections = [
  {
    id: "bebidas",
    category: "Bebidas",
    shortLabel: "Bebidas",
    groups: beverageGroups
  },
  {
    id: "cocteles",
    category: "Cócteles y Spritz",
    shortLabel: "Cócteles y Spritz",
    groups: cocktailGroups
  },
  {
    id: "granizados-smoothies",
    category: "Smoothies y Frappés",
    shortLabel: "Smoothies y Frappés",
    groups: granizadosSmoothiesGroups
  },
  {
    id: "comidas",
    category: "Comida",
    shortLabel: "Comida",
    groups: foodGroups
  },
  {
    id: "combinaciones",
    category: "Lo más pedido junto",
    shortLabel: "Lo más pedido junto",
    groups: []
  },
  {
    id: "tarifas-hamacas",
    category: "Zona Beach Club",
    shortLabel: "Zona Beach Club",
    groups: []
  }
];

const translations = {
  "es": {
    "ui": {
      "documentTitle": "Tavola Chiringo | Il dolce far niente è tutto",
      "subtitle": "Il dolce far niente è tutto",
      "languageLabel": "Idioma",
      "topTabsLabel": "Categorías de la carta",
      "bottomTabsLabel": "Cambiar sección de la carta",
      "menuLayoutLabel": "Carta interactiva",
      "menuListLabel": "Productos de la categoría seleccionada",
      "imageFrameLabel": "Ampliar imagen del plato",
      "lightboxLabel": "Imagen ampliada",
      "closeLightboxLabel": "Cerrar imagen ampliada",
      "viewSection": "Ver sección",
      "sectionEyebrow": "Sección",
      "productSingular": "producto",
      "productPlural": "productos",
      "pending": "Pendiente",
      "pendingTitle": "Sección pendiente",
      "pendingCopy": "Todavía no hay productos cargados en {section}.",
      "dishSelected": "Plato seleccionado",
      "tariffPlural": "tarifas",
      "scheduleLabel": "Horario",
      "includesTitle": "Incluye 2 bebidas",
      "drinksList": "Cerveza, tinto verano, café, refresco, vino o vermut",
      "reserveLabel": "Reservar",
      "rulesTitle": "Normas Beach Club",
      "infoTitle": "Información adicional",
      "selectTurnLabel": "Selecciona turno",
      "priceLabel": "Precio por sombrilla y hamacas",
      "soldOut": "Agotado",
      "loading": "Cargando la carta…",
      "loadErrorTitle": "No hemos podido cargar la carta",
      "loadErrorBody": "Comprueba tu conexión e inténtalo de nuevo en unos segundos.",
      "retry": "Reintentar"
    },
    "sections": {
      "bebidas": {
        "category": "Bebidas",
        "shortLabel": "Bebidas"
      },
      "cocteles": {
        "category": "Cócteles y Spritz",
        "shortLabel": "Cócteles y Spritz"
      },
      "granizados-smoothies": {
        "category": "Smoothies y Frappés",
        "shortLabel": "Smoothies y Frappés"
      },
      "comidas": {
        "category": "Comida",
        "shortLabel": "Comida"
      },
      "combinaciones": {
        "category": "Lo más pedido junto",
        "shortLabel": "Lo más pedido junto"
      },
      "tarifas-hamacas": {
        "category": "Zona Beach Club",
        "shortLabel": "Zona Beach Club"
      }
    },
    "groups": {
      "desayuno": {
        "category": "Desayuno",
        "shortLabel": "Desayuno"
      },
      "picar": {
        "category": "Aperitivo y picar",
        "shortLabel": "Picar"
      },
      "tapas": {
        "category": "Tapas",
        "shortLabel": "Tapas"
      },
      "bocadillos": {
        "category": "Bocadillos",
        "shortLabel": "Bocatas"
      },
      "pizzas": {
        "category": "Pizzas al horno de piedra",
        "shortLabel": "Pizzas"
      },
      "platos": {
        "category": "Platos preparados",
        "shortLabel": "Platos"
      },
      "refrescos": {
        "category": "Refrescos",
        "shortLabel": "Refrescos"
      },
      "cafes": {
        "category": "Cafés",
        "shortLabel": "Cafés"
      },
      "cerveza": {
        "category": "Cerveza",
        "shortLabel": "Cerveza"
      },
      "vermouth-copas": {
        "category": "Vermouth y copas",
        "shortLabel": "Vermouth"
      },
      "vinos-blancos": {
        "category": "Vinos blancos",
        "shortLabel": "Blancos"
      },
      "vinos-tintos": {
        "category": "Vinos tintos",
        "shortLabel": "Tintos"
      },
      "vinos-rosados": {
        "category": "Vinos rosados",
        "shortLabel": "Rosados"
      },
      "cavas-espumosos": {
        "category": "Cavas y espumosos",
        "shortLabel": "Cavas"
      },
      "granizados-smoothies-frappes": {
        "category": "Smoothies y Frappés",
        "shortLabel": "Smoothies"
      },
      "cocteles-clasicos": {
        "category": "Cócteles",
        "shortLabel": "Cócteles"
      },
      "sangrias-carta": {
        "category": "Sangrías",
        "shortLabel": "Sangrías"
      }
    },
    "items": {}
  },
  "en": {
    "ui": {
      "documentTitle": "Tavola Chiringo | Il dolce far niente è tutto",
      "subtitle": "Il dolce far niente è tutto",
      "languageLabel": "Language",
      "topTabsLabel": "Menu categories",
      "bottomTabsLabel": "Change menu section",
      "menuLayoutLabel": "Interactive menu",
      "menuListLabel": "Products in the selected category",
      "imageFrameLabel": "Enlarge dish image",
      "lightboxLabel": "Enlarged image",
      "closeLightboxLabel": "Close enlarged image",
      "viewSection": "View section",
      "sectionEyebrow": "Section",
      "productSingular": "product",
      "productPlural": "products",
      "pending": "Pending",
      "pendingTitle": "Section pending",
      "pendingCopy": "There are no products loaded in {section} yet.",
      "dishSelected": "Selected dish",
      "tariffPlural": "rates",
      "scheduleLabel": "Time",
      "includesTitle": "Includes 2 drinks",
      "drinksList": "Beer, tinto de verano, coffee, soft drink, wine, or vermouth",
      "reserveLabel": "Book",
      "rulesTitle": "Beach Club Rules",
      "infoTitle": "Additional information",
      "selectTurnLabel": "Select session",
      "priceLabel": "Price per umbrella and sunbeds",
      "soldOut": "Sold out",
      "loading": "Loading the menu…",
      "loadErrorTitle": "We could not load the menu",
      "loadErrorBody": "Check your connection and try again in a few seconds.",
      "retry": "Try again"
    },
    "sections": {
      "bebidas": {
        "category": "Drinks",
        "shortLabel": "Drinks"
      },
      "cocteles": {
        "category": "Cocktails",
        "shortLabel": "Cocktails"
      },
      "granizados-smoothies": {
        "category": "Smoothies & Frappés",
        "shortLabel": "Smoothies & Frappés"
      },
      "comidas": {
        "category": "Food",
        "shortLabel": "Food"
      },
      "combinaciones": {
        "category": "Most ordered together",
        "shortLabel": "Most ordered together"
      },
      "tarifas-hamacas": {
        "category": "Beach Club Zone",
        "shortLabel": "Beach Club"
      }
    },
    "groups": {
      "desayuno": {
        "category": "Breakfast",
        "shortLabel": "Breakfast"
      },
      "picar": {
        "category": "Snacks & nibbles",
        "shortLabel": "Snacks"
      },
      "tapas": {
        "category": "Tapas",
        "shortLabel": "Tapas"
      },
      "bocadillos": {
        "category": "Sandwiches",
        "shortLabel": "Sandwiches"
      },
      "pizzas": {
        "category": "Stone oven pizzas",
        "shortLabel": "Pizzas"
      },
      "platos": {
        "category": "Prepared dishes",
        "shortLabel": "Dishes"
      },
      "refrescos": {
        "category": "Soft drinks",
        "shortLabel": "Soft drinks"
      },
      "cafes": {
        "category": "Coffee",
        "shortLabel": "Coffee"
      },
      "cerveza": {
        "category": "Beer",
        "shortLabel": "Beer"
      },
      "vermouth-copas": {
        "category": "Vermouth & spirits",
        "shortLabel": "Vermouth"
      },
      "vinos-blancos": {
        "category": "White wines",
        "shortLabel": "Whites"
      },
      "vinos-tintos": {
        "category": "Red wines",
        "shortLabel": "Reds"
      },
      "vinos-rosados": {
        "category": "Rosé wines",
        "shortLabel": "Rosés"
      },
      "cavas-espumosos": {
        "category": "Cavas & sparkling wines",
        "shortLabel": "Cavas"
      },
      "granizados-smoothies-frappes": {
        "category": "Smoothies & Frappés",
        "shortLabel": "Smoothies"
      },
      "cocteles-clasicos": {
        "category": "Cocktails",
        "shortLabel": "Cocktails"
      },
      "sangrias-carta": {
        "category": "Sangrias",
        "shortLabel": "Sangrias"
      }
    },
    "items": {}
  },
  "de": {
    "ui": {
      "documentTitle": "Tavola Chiringo | Il dolce far niente è tutto",
      "subtitle": "Il dolce far niente è tutto",
      "languageLabel": "Sprache",
      "topTabsLabel": "Kategorien der Karte",
      "bottomTabsLabel": "Bereich der Karte wechseln",
      "menuLayoutLabel": "Interaktive Speisekarte",
      "menuListLabel": "Produkte der ausgewählten Kategorie",
      "imageFrameLabel": "Bild des Gerichts vergrößern",
      "lightboxLabel": "Vergrößertes Bild",
      "closeLightboxLabel": "Vergrößertes Bild schließen",
      "viewSection": "Bereich anzeigen",
      "sectionEyebrow": "Bereich",
      "productSingular": "Produkt",
      "productPlural": "Produkte",
      "pending": "Ausstehend",
      "pendingTitle": "Bereich ausstehend",
      "pendingCopy": "In {section} sind noch keine Produkte eingetragen.",
      "dishSelected": "Ausgewähltes Gericht",
      "tariffPlural": "Tarife",
      "scheduleLabel": "Uhrzeit",
      "includesTitle": "Inklusive 2 Getränke",
      "drinksList": "Bier, Tinto de verano, Kaffee, Softdrink, Wein oder Wermut",
      "reserveLabel": "Reservieren",
      "rulesTitle": "Beach Club Regeln",
      "infoTitle": "Zusätzliche Informationen",
      "selectTurnLabel": "Turnus auswählen",
      "priceLabel": "Preis pro Sonnenschirm und Liegen",
      "soldOut": "Ausverkauft",
      "loading": "Speisekarte wird geladen…",
      "loadErrorTitle": "Die Speisekarte konnte nicht geladen werden",
      "loadErrorBody": "Prüfe deine Verbindung und versuche es in einigen Sekunden erneut.",
      "retry": "Erneut versuchen"
    },
    "sections": {
      "bebidas": {
        "category": "Getränke",
        "shortLabel": "Getränke"
      },
      "cocteles": {
        "category": "Cocktails",
        "shortLabel": "Cocktails"
      },
      "granizados-smoothies": {
        "category": "Smoothies & Frappés",
        "shortLabel": "Smoothies & Frappés"
      },
      "comidas": {
        "category": "Speisen",
        "shortLabel": "Speisen"
      },
      "combinaciones": {
        "category": "Am liebsten zusammen",
        "shortLabel": "Am liebsten zusammen"
      },
      "tarifas-hamacas": {
        "category": "Beach Club Bereich",
        "shortLabel": "Beach Club"
      }
    },
    "groups": {
      "desayuno": {
        "category": "Frühstück",
        "shortLabel": "Frühstück"
      },
      "picar": {
        "category": "Aperitif & Snacks",
        "shortLabel": "Snacks"
      },
      "tapas": {
        "category": "Tapas",
        "shortLabel": "Tapas"
      },
      "bocadillos": {
        "category": "Sandwiches",
        "shortLabel": "Sandwiches"
      },
      "pizzas": {
        "category": "Pizzen aus dem Steinofen",
        "shortLabel": "Pizzen"
      },
      "platos": {
        "category": "Zubereitete Gerichte",
        "shortLabel": "Gerichte"
      },
      "refrescos": {
        "category": "Erfrischungsgetränke",
        "shortLabel": "Softdrinks"
      },
      "cafes": {
        "category": "Kaffee",
        "shortLabel": "Kaffee"
      },
      "cerveza": {
        "category": "Bier",
        "shortLabel": "Bier"
      },
      "vermouth-copas": {
        "category": "Wermut & Longdrinks",
        "shortLabel": "Wermut"
      },
      "vinos-blancos": {
        "category": "Weißweine",
        "shortLabel": "Weißweine"
      },
      "vinos-tintos": {
        "category": "Rotweine",
        "shortLabel": "Rotweine"
      },
      "vinos-rosados": {
        "category": "Roséweine",
        "shortLabel": "Rosé"
      },
      "cavas-espumosos": {
        "category": "Cavas & Schaumweine",
        "shortLabel": "Cavas"
      },
      "granizados-smoothies-frappes": {
        "category": "Smoothies & Frappés",
        "shortLabel": "Smoothies"
      },
      "cocteles-clasicos": {
        "category": "Cocktails",
        "shortLabel": "Cocktails"
      },
      "sangrias-carta": {
        "category": "Sangrias",
        "shortLabel": "Sangrias"
      }
    },
    "items": {}
  }
};

const languageNames = {
  es: "Español",
  en: "English",
  de: "Deutsch"
};

const groupLinearts = {
  refrescos: "assets/linearts/bebidas/refrescoart.webp",
  cafes: "assets/linearts/bebidas/cafesart.webp",
  cerveza: "assets/linearts/bebidas/cervezaart.webp",
  "vermouth-copas": "assets/linearts/bebidas/vermouthycopasart.webp",
  "vinos-blancos": "assets/linearts/bebidas/vinosblancosart.webp",
  "vinos-tintos": "assets/linearts/bebidas/vinostintosart.webp",
  "vinos-rosados": "assets/linearts/bebidas/vinosrosadosart.webp",
  "cavas-espumosos": "assets/linearts/bebidas/cavasyespumososart.webp",
  desayuno: "assets/linearts/comidas/desayunoart.webp",
  picar: "assets/linearts/comidas/aperitivoypicarart.webp",
  tapas: "assets/linearts/comidas/tapasart.webp",
  bocadillos: "assets/linearts/comidas/bocadillosart.webp",
  pizzas: "assets/linearts/comidas/pizzaart.webp",
  platos: "assets/linearts/comidas/platospreparadosart.webp"
};

const topTabs = document.querySelector("#topTabs");
const bottomTabs = document.querySelector("#bottomTabs");
const languageSwitcher = document.querySelector("#languageSwitcher");
const introCopy = document.querySelector("#introCopy");
const menuLayout = document.querySelector(".menu-layout");
const menuList = document.querySelector("#menuList");
const allergenModal = document.querySelector("#allergenModal");
const allergenModalClose = document.querySelector("#allergenModalClose");
const allergenTitle = document.querySelector("#allergenTitle");
const allergenModalContent = document.querySelector("#allergenModalContent");

let activeSectionId = "bebidas";
let activeHamacaTurnId = "todo-dia";
let currentLanguage = getSavedLanguage();
let lastFocusedElement = null;

function getSavedLanguage() {
  try {
    const savedLanguage = localStorage.getItem("tavolaLanguage");
    return translations[savedLanguage] ? savedLanguage : "es";
  } catch (error) {
    return "es";
  }
}

function saveLanguage(language) {
  try {
    localStorage.setItem("tavolaLanguage", language);
  } catch (error) {
    // Local storage can be unavailable in some private browsing modes.
  }
}

function getCopy() {
  return translations[currentLanguage] || translations.es;
}

function getUiCopy() {
  return getCopy().ui;
}

function getSectionText(section) {
  return getCopy().sections[section.id] || translations.es.sections[section.id] || section;
}

function getGroupText(group) {
  if (group.name) {
    const category = t(group.name, currentLanguage, activeRestaurant?.default_locale || 'es');
    return { category, shortLabel: category };
  }
  return getCopy().groups[group.id] || translations.es.groups[group.id] || group;
}

function getItemText(item) {
  if (item.name) {
    const defaultLocale = activeRestaurant?.default_locale || 'es';
    return {
      title: t(item.name, currentLanguage, defaultLocale),
      description: t(item.description, currentLanguage, defaultLocale),
      note: t(item.priceNote, currentLanguage, defaultLocale)
    };
  }
  return getCopy().items[item.id] || translations.es.items[item.id] || item;
}

function getItemPrice(item) {
  return item.priceDisplay || formatNumericPrice(item.price);
}

function formatProductCount(count) {
  const ui = getUiCopy();
  const label = count === 1 ? ui.productSingular : ui.productPlural;

  return `${count} ${label}`;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getScrollBehavior() {
  return prefersReducedMotion() ? "auto" : "smooth";
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 820px)").matches;
}

function scrollElementNearTop(element, offset = 12) {
  if (!element) return;

  const top = Math.max(0, window.scrollY + element.getBoundingClientRect().top - offset);

  window.scrollTo({
    top,
    behavior: getScrollBehavior()
  });
}

function scheduleScrollToMainPanel() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollElementNearTop(menuLayout, isMobileLayout() ? 10 : 24);
    });
  });
}

function scheduleScrollToGroupStart(groupBlock) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // El carrusel de recomendaciones queda fijo arriba: se deja su altura de
      // margen para que la cabecera del grupo no se meta debajo.
      const reco = document.querySelector("#smartReco");
      const offset = (reco?.getBoundingClientRect().height || 0) + 14;

      scrollElementNearTop(groupBlock, offset);
    });
  });
}

function getActiveSection() {
  return menuSections.find((section) => section.id === activeSectionId) || menuSections[0];
}

function createTab(section, placement) {
  const button = document.createElement("button");
  const sectionText = getSectionText(section);
  button.className = placement === "bottom" ? "tab-button category-chip" : "tab-button";
  button.type = "button";
  button.dataset.category = section.id;
  button.setAttribute("aria-controls", "menuList");
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-label", `${getUiCopy().viewSection} ${sectionText.category}`);

  if (placement === "bottom") {
    const label = document.createElement("span");

    label.className = "category-label";
    label.textContent = sectionText.shortLabel;
    button.append(label);
  } else {
    button.textContent = sectionText.category;
  }

  button.addEventListener("click", () => setActiveSection(section.id));

  return button;
}

function renderTabs() {
  const topFragment = document.createDocumentFragment();
  const bottomFragment = document.createDocumentFragment();

  topTabs.textContent = "";
  bottomTabs.textContent = "";

  menuSections.forEach((section) => {
    topFragment.append(createTab(section, "top"));
    bottomFragment.append(createTab(section, "bottom"));
  });

  topTabs.append(topFragment);
  bottomTabs.append(bottomFragment);
}

function getAllergenInfo(item) {
  return getSmartAllergenInfo(item);
}

function createAllergenButton(item, itemText) {
  const button = document.createElement("button");
  const icon = document.createElement("img");
  const label = document.createElement("span");

  button.className = "allergen-trigger";
  button.type = "button";
  button.setAttribute("aria-label", `Ver alérgenos de ${itemText.title}`);
  icon.src = "assets/ui/icons/precaucion1.webp";
  icon.alt = "";
  icon.loading = "lazy";
  icon.decoding = "async";
  icon.setAttribute("aria-hidden", "true");
  label.textContent = "Ver alérgenos";
  button.append(icon, label);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    openAllergenModal(item, button);
  });

  // Rojo si contiene un alérgeno marcado por la mesa, ámbar si hay trazas o
  // riesgo cruzado. Nunca solo color: también se añade icono y texto.
  decorateAllergenTrigger(button, item);

  return button;
}

// Miniatura que aparece con un fundido cuando la imagen termina de cargar, en
// lugar de la ficha lateral grande que ocupaba un tercio de la pantalla.
function createDishThumb(item, itemText) {
  const frame = document.createElement("span");
  const image = document.createElement("img");

  frame.className = "dish-thumb";
  image.src = item.image;
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.setAttribute("aria-hidden", "true");

  if (image.complete && image.naturalWidth > 0) {
    image.classList.add("is-loaded");
  } else {
    image.addEventListener("load", () => image.classList.add("is-loaded"), { once: true });
    image.addEventListener("error", () => frame.classList.add("is-empty"), { once: true });
  }

  frame.append(image);
  return frame;
}

function createDishButton(item, sectionName, groupId) {
  const card = document.createElement("article");
  const isInteractive = item.hasDetail !== false;
  const button = document.createElement(isInteractive ? "button" : "div");
  const itemText = getItemText(item);
  const itemPrice = getItemPrice(item, itemText);

  card.className = "dish";
  card.dataset.dish = item.id;
  card.classList.toggle("is-static", !isInteractive);
  card.classList.toggle("is-sold-out", !item.isAvailable);

  button.className = isInteractive ? "dish-select" : "dish-select is-static";

  if (isInteractive) {
    button.type = "button";
    button.setAttribute("aria-label", `Ver ${itemText.title}, ${sectionName}, ${itemPrice}`);
  }

  const text = document.createElement("span");
  const title = document.createElement("strong");
  const description = document.createElement("small");
  const price = document.createElement("b");

  text.className = "dish-copy";
  title.textContent = itemText.title;
  title.classList.add(nameSizeClasses[item.nameSize] || nameSizeClasses.normal);
  description.textContent = itemText.description;
  price.textContent = itemPrice;

  text.append(title, description);

  if (itemText.note) {
    const note = document.createElement("em");
    note.className = "dish-note-inline";
    note.textContent = itemText.note;
    text.append(note);
  }

  if (isInteractive) button.append(createDishThumb(item, itemText));
  button.append(text, price);

  if (!item.isAvailable) {
    const soldOut = document.createElement('span');
    soldOut.className = 'sold-out-badge';
    soldOut.textContent = getUiCopy().soldOut;
    button.append(soldOut);
  }

  // Pulsar un producto nunca lo añade al pedido: primero se abre su ficha.
  if (isInteractive) {
    button.addEventListener("click", () => openProductSheet(item, groupId));
  }

  card.append(button);

  const foot = document.createElement("div");
  foot.className = "dish-foot";
  foot.append(createAllergenButton(item, itemText));

  if (isInteractive) {
    // Señuelo: no añade nada por sí solo, abre la ficha para que el cliente
    // descubra variantes, extras y observaciones antes de confirmar.
    const add = document.createElement("button");
    add.className = "dish-add";
    add.type = "button";
    add.textContent = "+ carrito";
    add.setAttribute("aria-label", `Abrir ${itemText.title} para añadirlo al pedido`);
    add.addEventListener("click", (event) => {
      event.stopPropagation();
      openProductSheet(item, groupId);
    });
    foot.append(add);
  }

  card.append(foot);

  return card;
}

function getSectionItemCount(section) {
  return section.groups.reduce((total, group) => total + group.items.length, 0);
}

function createEmptySection(section) {
  const emptyState = document.createElement("div");
  const title = document.createElement("strong");
  const copy = document.createElement("p");
  const ui = getUiCopy();
  const sectionText = getSectionText(section);

  emptyState.className = "empty-section";
  title.textContent = ui.pendingTitle;
  copy.textContent = ui.pendingCopy.replace("{section}", sectionText.category);

  emptyState.append(title, copy);
  return emptyState;
}

function getHamacaCopy() {
  return hamacaLanguageCopy[currentLanguage] || hamacaLanguageCopy.es;
}

function getActiveHamacaTariff() {
  return hamacaTariffs.find((tariff) => tariff.id === activeHamacaTurnId) || hamacaTariffs[0];
}

function createHamacaIcon(type) {
  const icon = document.createElement("span");
  const icons = {
    morning: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4"></circle>
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"></path>
      </svg>`,
    afternoon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 18h16"></path>
        <path d="M7 18a5 5 0 0 1 10 0"></path>
        <path d="M12 5v3M5.6 8.6l2.1 2.1M18.4 8.6l-2.1 2.1"></path>
      </svg>`,
    "full-day": `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="10" r="3.5"></circle>
        <path d="M12 2v2.5M12 15.5V18M4 10h2.5M17.5 10H20M6.3 4.3l1.8 1.8M15.9 13.9l1.8 1.8M17.7 4.3l-1.8 1.8M8.1 13.9l-1.8 1.8M5 21h14"></path>
      </svg>`,
    beach: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19c3-2 5-2 8 0s5 2 8 0"></path>
        <path d="M5 12a7 7 0 0 1 14 0"></path>
        <path d="M12 12v7"></path>
        <path d="M7 12h10"></path>
      </svg>`,
    drink: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3h10l-1 8a4 4 0 0 1-8 0L7 3Z"></path>
        <path d="M12 15v5"></path>
        <path d="M9 20h6"></path>
        <path d="M9 7h6"></path>
      </svg>`
  };

  icon.className = `hamaca-icon hamaca-icon-${type}`;
  icon.innerHTML = icons[type] || icons.morning;
  return icon;
}

function createHamacaRules() {
  const ui = getUiCopy();
  const hamacaCopy = getHamacaCopy();
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  const list = document.createElement("ul");

  details.className = "hamaca-accordion";
  summary.textContent = ui.rulesTitle;

  hamacaCopy.rules.forEach((rule) => {
    const item = document.createElement("li");

    item.textContent = rule;
    list.append(item);
  });

  details.append(summary, list);
  return details;
}

function createHamacaBenefits() {
  const ui = getUiCopy();
  const hamacaCopy = getHamacaCopy();
  const block = document.createElement("section");
  const title = document.createElement("h3");
  const grid = document.createElement("div");

  block.className = "hamaca-benefits";
  title.textContent = ui.infoTitle;
  grid.className = "hamaca-benefit-grid";

  hamacaCopy.benefits.forEach((benefit, index) => {
    const item = document.createElement("div");
    const mark = document.createElement("span");
    const copy = document.createElement("p");

    item.className = "hamaca-benefit";
    mark.className = "hamaca-benefit-mark";
    mark.textContent = index === 0 ? "QR" : "TAV";
    copy.textContent = benefit;
    item.append(mark, copy);
    grid.append(item);
  });

  block.append(title, grid);
  return block;
}

function createHamacaTurnSelector(activeTariff) {
  const ui = getUiCopy();
  const hamacaCopy = getHamacaCopy();
  const block = document.createElement("section");
  const title = document.createElement("h3");
  const options = document.createElement("div");

  block.className = "hamaca-selector hamaca-turns";
  title.textContent = ui.selectTurnLabel;
  options.className = "hamaca-turn-grid";

  hamacaTariffs.forEach((tariff) => {
    const button = document.createElement("button");
    const text = document.createElement("span");
    const label = document.createElement("strong");
    const schedule = document.createElement("small");
    const isActive = tariff.id === activeTariff.id;

    button.className = "hamaca-choice hamaca-turn-choice";
    button.type = "button";
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    label.textContent = hamacaCopy.tariffs[tariff.id] || tariff.name;
    schedule.textContent = tariff.schedule;
    text.append(label, schedule);
    button.append(createHamacaIcon(tariff.icon), text);
    button.addEventListener("click", () => {
      activeHamacaTurnId = tariff.id;
      renderActiveSection();
    });

    options.append(button);
  });

  block.append(title, options);
  return block;
}

function createHamacaHeroCard(activeTariff) {
  const ui = getUiCopy();
  const hamacaCopy = getHamacaCopy();
  const card = document.createElement("article");
  const imageWrap = document.createElement("div");
  const image = document.createElement("img");
  const overlay = document.createElement("div");
  const turn = document.createElement("span");
  const schedule = document.createElement("strong");
  const info = document.createElement("div");
  const priceBlock = document.createElement("div");
  const priceLabel = document.createElement("span");
  const price = document.createElement("strong");
  const drinksBlock = document.createElement("div");
  const drinksCopy = document.createElement("div");
  const drinksTitle = document.createElement("strong");
  const drinksText = document.createElement("p");

  card.className = "hamaca-visual-card";
  imageWrap.className = "hamaca-visual-image";
  overlay.className = "hamaca-visual-overlay";
  info.className = "hamaca-visual-info";
  priceBlock.className = "hamaca-price-block";
  priceLabel.className = "hamaca-price-label";
  drinksBlock.className = "hamaca-drinks-block";

  image.src = "assets/hamacas/hamaca1.webp";
  image.alt = "Hamacas frente al mar en Tavola Chiringo";
  image.loading = "lazy";
  image.decoding = "async";
  turn.textContent = hamacaCopy.tariffs[activeTariff.id] || activeTariff.name;
  schedule.textContent = activeTariff.schedule;
  priceLabel.textContent = ui.priceLabel;
  price.textContent = activeTariff.price;
  drinksTitle.textContent = ui.includesTitle;
  drinksText.textContent = ui.drinksList;

  overlay.append(turn, schedule);
  imageWrap.append(image, overlay);
  priceBlock.append(priceLabel, price);
  drinksCopy.append(drinksTitle, drinksText);
  drinksBlock.append(createHamacaIcon("drink"), drinksCopy);
  info.append(priceBlock, drinksBlock);
  card.append(imageWrap, info);
  return card;
}

function createHamacaReserveButton() {
  const ui = getUiCopy();
  const link = document.createElement("a");

  link.className = "hamaca-reserve-button";
  link.href = "https://restaurante.covermanager.com/tavola-chiringo-valencia/";
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = ui.reserveLabel;
  return link;
}

function createHamacasSection() {
  const wrapper = document.createElement("div");
  const activeTariff = getActiveHamacaTariff();

  wrapper.className = "hamacas-section";
  wrapper.append(
    createHamacaTurnSelector(activeTariff),
    createHamacaHeroCard(activeTariff),
    createHamacaReserveButton(),
    createHamacaRules(),
    createHamacaBenefits()
  );
  return wrapper;
}

function createFoodGroup(group, isExpanded) {
  const groupBlock = document.createElement("section");
  const toggle = document.createElement("button");
  const titleWrap = document.createElement("span");
  const label = document.createElement("span");
  const title = document.createElement("strong");
  const count = document.createElement("small");
  const indicator = document.createElement("span");
  const panel = document.createElement("div");
  const groupText = getGroupText(group);
  const lineartSrc = groupLinearts[group.id];

  groupBlock.className = "food-group";
  groupBlock.dataset.group = group.id;
  toggle.className = "food-group-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-controls", `food-group-${group.id}`);
  toggle.setAttribute("aria-expanded", String(isExpanded));

  titleWrap.className = "food-group-title-wrap";
  label.className = "food-group-label";
  title.textContent = groupText.category;
  count.textContent = formatProductCount(group.items.length);
  label.append(title, count);

  if (lineartSrc) {
    const lineart = document.createElement("img");

    lineart.className = "food-group-lineart";
    if (group.id === "cavas-espumosos") {
      lineart.classList.add("food-group-lineart--cavas");
    }
    lineart.src = lineartSrc;
    lineart.alt = "";
    lineart.loading = "eager";
    lineart.decoding = "async";
    lineart.setAttribute("aria-hidden", "true");
    titleWrap.append(lineart);
  }

  titleWrap.append(label);

  indicator.className = "food-group-indicator";
  indicator.setAttribute("aria-hidden", "true");
  indicator.textContent = isExpanded ? "−" : "+";

  panel.className = "food-group-panel";
  panel.id = `food-group-${group.id}`;
  panel.hidden = !isExpanded;

  if (isExpanded) {
    groupBlock.classList.add("is-open");
  }

  group.items.forEach((item) => {
    panel.append(createDishButton(item, groupText.category, group.id));
  });

  toggle.append(titleWrap, indicator);
  toggle.addEventListener("click", () => toggleFoodGroup(groupBlock, panel, toggle, indicator, group));
  groupBlock.append(toggle, panel);

  return groupBlock;
}

function toggleFoodGroup(groupBlock, panel, toggle, indicator, group) {
  const shouldOpen = !groupBlock.classList.contains("is-open");

  document.querySelectorAll(".food-group.is-open").forEach((openGroup) => {
    if (openGroup === groupBlock) return;

    const openPanel = openGroup.querySelector(".food-group-panel");
    const openToggle = openGroup.querySelector(".food-group-toggle");
    const openIndicator = openGroup.querySelector(".food-group-indicator");

    openGroup.classList.remove("is-open");
    openPanel.hidden = true;
    openToggle.setAttribute("aria-expanded", "false");
    openIndicator.textContent = "+";
  });

  groupBlock.classList.toggle("is-open", shouldOpen);
  panel.hidden = !shouldOpen;
  toggle.setAttribute("aria-expanded", String(shouldOpen));
  indicator.textContent = shouldOpen ? "−" : "+";

  if (shouldOpen && group.items[0]) {
    scheduleScrollToGroupStart(groupBlock, panel);
  }
}

function renderActiveSection() {
  const section = getActiveSection();
  const sectionText = getSectionText(section);
  const ui = getUiCopy();
  const sectionBlock = document.createElement("div");
  const heading = document.createElement("div");
  const eyebrow = document.createElement("p");
  const title = document.createElement("h2");
  const count = document.createElement("span");
  const itemCount = getSectionItemCount(section);

  menuList.textContent = "";
  menuLayout.classList.toggle("is-hamacas-section", section.id === "tarifas-hamacas");
  menuList.classList.toggle("is-hamacas-list", section.id === "tarifas-hamacas");
  menuList.classList.toggle("is-combos-list", section.id === "combinaciones");
  sectionBlock.className = "menu-section active-section";
  heading.className = "section-heading";
  eyebrow.className = "section-eyebrow";
  title.id = "activeCategoryTitle";
  count.className = "section-count";

  eyebrow.textContent = ui.sectionEyebrow;
  title.textContent = sectionText.category;
  count.textContent = itemCount > 0 ? formatProductCount(itemCount) : ui.pending;

  heading.append(eyebrow, title, count);
  sectionBlock.append(heading);

  if (section.id === "tarifas-hamacas") {
    sectionBlock.textContent = "";
    sectionBlock.classList.add("hamacas-active-section");
    sectionBlock.append(createHamacasSection());
    menuList.append(sectionBlock);
    menuList.setAttribute("aria-label", sectionText.category);
    return;
  }

  // Las combinaciones populares son una pestaña más de la carta.
  if (section.id === "combinaciones") {
    count.textContent = "";
    sectionBlock.append(renderCombosSection());
    menuList.append(sectionBlock);
    menuList.setAttribute("aria-labelledby", "activeCategoryTitle");
    return;
  }

  if (itemCount === 0) {
    sectionBlock.append(createEmptySection(section));
    menuList.append(sectionBlock);
    menuList.setAttribute("aria-labelledby", "activeCategoryTitle");
    return;
  }

  if (section.id === "comidas" || section.id === "bebidas") {
    section.groups.forEach((group) => {
      sectionBlock.append(createFoodGroup(group, false));
    });

    menuList.append(sectionBlock);
    menuList.setAttribute("aria-labelledby", "activeCategoryTitle");
    return;
  }

  section.groups.forEach((group) => {
    group.items.forEach((item) => {
      sectionBlock.append(createDishButton(item, sectionText.category, group.id));
    });
  });

  menuList.append(sectionBlock);
  menuList.setAttribute("aria-labelledby", "activeCategoryTitle");
}

function updateActiveTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    const isSelected = button.dataset.category === activeSectionId;

    button.classList.toggle("is-active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function setActiveSection(sectionId) {
  if (sectionId === activeSectionId) return;

  activeSectionId = sectionId;
  renderActiveSection();
  updateActiveTabs();
  scheduleScrollToMainPanel();
}

function updateStaticText() {
  const ui = getUiCopy();

  document.documentElement.lang = currentLanguage;
  document.title = ui.documentTitle;
  introCopy.setAttribute("aria-label", ui.subtitle);
  languageSwitcher.setAttribute("aria-label", ui.languageLabel);
  topTabs.setAttribute("aria-label", ui.topTabsLabel);
  bottomTabs.setAttribute("aria-label", ui.bottomTabsLabel);
  menuLayout.setAttribute("aria-label", ui.menuLayoutLabel);
  menuList.setAttribute("aria-label", ui.menuListLabel);

  languageSwitcher.querySelectorAll(".language-button").forEach((button) => {
    const isActive = button.dataset.lang === currentLanguage;
    const languageName = languageNames[button.dataset.lang] || button.dataset.lang;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.setAttribute("aria-label", `${ui.languageLabel}: ${languageName}`);
  });
}

function setLanguage(language) {
  if (!translations[language] || language === currentLanguage) return;

  currentLanguage = language;
  saveLanguage(language);
  updateStaticText();
  renderTabs();
  renderActiveSection();
  updateActiveTabs();
}

function setupLanguageSwitcher() {
  languageSwitcher.querySelectorAll(".language-button").forEach((button) => {
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => setLanguage(button.dataset.lang));
  });
}

function createAllergenGroup(label, allergens, className) {
  if (!allergens?.length) return null;

  const group = document.createElement("div");
  const title = document.createElement("strong");
  const list = document.createElement("div");

  group.className = `allergen-group ${className}`;
  title.textContent = label;
  list.className = "allergen-chip-list";

  allergens.forEach((allergen) => {
    const chip = document.createElement("span");

    chip.textContent = allergen;
    // Los que coinciden con la selección de la mesa se destacan.
    if (isSelectedAllergenLabel(allergen)) {
      chip.classList.add("is-match");
      chip.textContent = `⛔ ${allergen}`;
    }
    list.append(chip);
  });

  group.append(title, list);
  return group;
}

function createAllergenEntry(entry, { showTitle = true } = {}) {
  const card = document.createElement("article");
  const contains = createAllergenGroup("Contiene", entry.contains, "contains");
  const traces = createAllergenGroup("Puede contener trazas", entry.traces, "traces");

  card.className = "allergen-entry";

  if (showTitle) {
    const title = document.createElement("h3");

    title.textContent = entry.name;
    card.append(title);
  }

  if (contains) {
    card.append(contains);
  }

  if (traces) {
    card.append(traces);
  }

  return card;
}

function openAllergenModal(item, sourceElement) {
  const itemText = getItemText(item);
  const info = getAllergenInfo(item);

  const entries = info?.entries || [
    {
      name: info?.title || itemText.title,
      contains: info?.contains || [],
      traces: info?.traces || []
    }
  ];

  lastFocusedElement = sourceElement || document.activeElement;
  allergenTitle.textContent = info?.title || itemText.title;
  allergenModalContent.textContent = "";

  // Aviso destacado cuando el producto choca con la selección de la mesa.
  const banner = buildAllergenBanner(item);
  if (banner) allergenModalContent.append(banner);

  entries.forEach((entry) => {
    allergenModalContent.append(createAllergenEntry(entry, { showTitle: entries.length > 1 }));
  });

  const hasAny = entries.some((entry) => entry.contains?.length || entry.traces?.length);
  if (!hasAny) {
    const empty = document.createElement("p");
    empty.className = "smart-allergen-note";
    empty.textContent = info
      ? "Sin alérgenos de declaración obligatoria."
      : "No tenemos la ficha de alérgenos cargada para este producto. Consulta al personal.";
    allergenModalContent.append(empty);
  }

  if (info?.note) {
    const note = document.createElement("p");
    note.className = "smart-allergen-note";
    note.textContent = info.note;
    allergenModalContent.append(note);
  }

  allergenModal.classList.add("is-open");
  allergenModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("allergen-open");
  allergenModalClose.focus({ preventScroll: true });
}

function closeAllergenModal() {
  allergenModal.classList.remove("is-open");
  allergenModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("allergen-open");

  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus({ preventScroll: true });
  }
}

// Puente hacia la capa de carta inteligente: le damos acceso a los textos, los
// precios y el modal de alérgenos que ya sabe pintar la carta original.
const smartBridge = {
  getItemText,
  getItemPrice,
  openAllergenModal,
  rerenderMenu() {
    renderActiveSection();
    updateActiveTabs();
  }
};

initializeMenu();

allergenModalClose.addEventListener("click", closeAllergenModal);

allergenModal.addEventListener("click", (event) => {
  if (event.target === allergenModal) {
    closeAllergenModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && allergenModal.classList.contains("is-open")) {
    closeAllergenModal();
  }
});
