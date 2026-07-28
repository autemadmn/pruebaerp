// Carta inteligente — capa de prototipo sobre la carta digital de Tavola.
//
// Todo lo que ocurre aquí es una simulación de experiencia de usuario: no hay
// comandas reales, ni cocina, ni pagos, ni base de datos. El estado vive en
// memoria y se recuerda en localStorage para que la demo aguante una recarga.

import {
  ALLERGENS,
  APPETITES,
  PREFERENCES,
  TAG_LABELS,
  allergenCatalog,
  allergenIdFromLabel,
  getProductKind,
  getProductMeta,
  getProductOptions,
  groupPairings,
  pairingHeadings,
  pairingsByKind,
  pairingsByProduct,
  popularCombos
} from './smart-data.js';
import { currentStageId, initGuidedTour, refreshTour, startGuidedTour } from './guided-tour.js';

const TABLE_STORAGE_KEY = 'tavolaSmartTable';
const CART_STORAGE_KEY = 'tavolaSmartCart';
const CAROUSEL_INTERVAL = 5500;

const priceFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatPrice(amount) {
  return `${priceFormatter.format(Number(amount) || 0)} €`;
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

const defaultTable = {
  configured: false,
  hasAllergies: null,
  allergens: [],
  people: null,
  appetite: null,
  preferences: []
};

let table = { ...defaultTable };
let cart = [];

// Puente con main.js: catálogo plano y utilidades de texto/precio de la carta.
const catalog = {
  byId: new Map(),
  byLegacyId: new Map(),
  all: []
};
let host = null;

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // El almacenamiento puede no estar disponible en navegación privada.
  }
}

function loadState() {
  const savedTable = readStorage(TABLE_STORAGE_KEY, null);
  if (savedTable && typeof savedTable === 'object') {
    table = { ...defaultTable, ...savedTable };
  }
  const savedCart = readStorage(CART_STORAGE_KEY, null);
  if (Array.isArray(savedCart)) cart = savedCart;
}

function persistTable() {
  writeStorage(TABLE_STORAGE_KEY, table);
}

function persistCart() {
  writeStorage(CART_STORAGE_KEY, cart);
}

// El estado se lee de inmediato: main.js consulta la severidad de alérgenos
// antes de que la interfaz de la carta inteligente esté montada.
loadState();

// ---------------------------------------------------------------------------
// Utilidades de catálogo
// ---------------------------------------------------------------------------

function entryFor(item) {
  if (!item) return null;
  return catalog.byId.get(item.id) || null;
}

function entryByLegacyId(legacyId) {
  return catalog.byLegacyId.get(legacyId) || null;
}

function itemTitle(item) {
  return host?.getItemText(item)?.title || '';
}

function itemDescription(item) {
  return host?.getItemText(item)?.description || '';
}

function basePrice(item) {
  const value = Number(item?.price);
  return Number.isFinite(value) ? value : 0;
}

function imageFor(item) {
  return item?.image || 'assets/comidas/genericas/pasta.webp';
}

// ---------------------------------------------------------------------------
// Alérgenos
// ---------------------------------------------------------------------------

export function getAllergenInfo(item) {
  return allergenCatalog[item?.legacyId] || null;
}

// Reúne todos los alérgenos de un producto, incluidos los desgloses por entrada.
function collectAllergens(info) {
  const contains = new Set();
  const traces = new Set();
  if (!info) return { contains, traces };

  const push = (source) => {
    (source?.contains || []).forEach((label) => contains.add(label));
    (source?.traces || []).forEach((label) => traces.add(label));
  };

  push(info);
  (info.entries || []).forEach(push);
  return { contains, traces };
}

function toIds(labels) {
  return [...labels].map(allergenIdFromLabel).filter(Boolean);
}

/**
 * Severidad de un producto respecto a los alérgenos marcados por la mesa.
 * 'alert' -> contiene alguno. 'warn' -> trazas, riesgo cruzado o hay que
 * preguntar al personal. 'none' -> ninguna coincidencia.
 */
export function getAllergenSeverity(item) {
  const info = getAllergenInfo(item);
  if (!info || !table.allergens.length) return 'none';

  const { contains, traces } = collectAllergens(info);
  const selected = new Set(table.allergens);

  if (toIds(contains).some((id) => selected.has(id))) return 'alert';
  if (toIds(traces).some((id) => selected.has(id))) return 'warn';
  // Productos que dependen de lo que elija el cliente: siempre hay que preguntar.
  if (info.note && /consulta al personal/i.test(info.note)) return 'warn';
  return 'none';
}

function matchedAllergenLabels(item) {
  const info = getAllergenInfo(item);
  if (!info) return { contains: [], traces: [] };
  const { contains, traces } = collectAllergens(info);
  const selected = new Set(table.allergens);
  const filter = (set) =>
    [...set].filter((label) => {
      const id = allergenIdFromLabel(label);
      return id && selected.has(id);
    });
  return { contains: filter(contains), traces: filter(traces) };
}

export function isSelectedAllergenLabel(label) {
  const id = allergenIdFromLabel(label);
  return Boolean(id && table.allergens.includes(id));
}

/** Aviso que main.js inyecta en la cabecera del modal de alérgenos. */
export function buildAllergenBanner(item) {
  const severity = getAllergenSeverity(item);
  if (severity === 'none') return null;

  const matched = matchedAllergenLabels(item);
  const banner = document.createElement('div');
  const title = document.createElement('strong');
  const copy = document.createElement('span');

  banner.className = severity === 'alert' ? 'smart-allergen-banner' : 'smart-allergen-banner is-warn';

  if (severity === 'alert') {
    title.textContent = '⛔ Contiene alérgenos marcados en vuestra mesa';
    copy.textContent = `Coincide con: ${matched.contains.join(', ')}.`;
  } else {
    title.textContent = '⚠️ Riesgo de trazas o contaminación cruzada';
    copy.textContent = matched.traces.length
      ? `Puede contener trazas de: ${matched.traces.join(', ')}. Consulta al personal antes de pedirlo.`
      : 'Depende de la preparación concreta. Consulta al personal antes de pedirlo.';
  }

  banner.append(title, copy);
  return banner;
}

const severityCopy = {
  alert: { label: 'Contiene', icon: '⛔' },
  warn: { label: 'Trazas', icon: '⚠️' }
};

// Línea de alérgenos escrita, con los que coinciden con la mesa destacados.
function allergenLine(label, labels, variant) {
  const line = el('div', `smart-allergen-line ${variant}`);
  line.append(el('span', 'smart-allergen-label', label));
  const list = el('span', 'smart-allergen-values');
  labels.forEach((name) => {
    const chip = el('span', 'smart-allergen-chip', name);
    if (isSelectedAllergenLabel(name)) {
      chip.classList.add('is-match');
      chip.textContent = `⛔ ${name}`;
    }
    list.append(chip);
  });
  line.append(list);
  return line;
}

function createSeverityFlag(severity, className = 'smart-item-flag') {
  const copy = severityCopy[severity];
  if (!copy) return null;
  const flag = document.createElement('span');
  flag.className = `${className} is-${severity}`;
  flag.textContent = `${copy.icon} ${copy.label}`;
  return flag;
}

/** main.js llama a esto al pintar cada botón "Ver alérgenos". */
export function decorateAllergenTrigger(button, item) {
  const severity = getAllergenSeverity(item);
  button.classList.remove('is-alert', 'is-warn');
  button.querySelector('.smart-flag')?.remove();
  if (severity === 'none') return;

  button.classList.add(`is-${severity}`);
  const flag = document.createElement('span');
  flag.className = 'smart-flag';
  flag.textContent = severity === 'alert' ? '⛔ Contiene' : '⚠️ Trazas';
  button.append(flag);
  button.setAttribute(
    'aria-label',
    `${severity === 'alert' ? 'Atención, contiene alérgenos de la mesa.' : 'Atención, posibles trazas.'} Ver alérgenos de ${itemTitle(item)}`
  );
}

// ---------------------------------------------------------------------------
// Precios de línea
// ---------------------------------------------------------------------------

function unitPrice(item, selection) {
  const options = selection.options || {};
  const extras = selection.extras || [];
  const config = getProductOptions(item.legacyId, selection.groupId);
  let price = basePrice(item);

  config.variants.forEach((variant) => {
    const chosen = variant.options.find((option) => option.id === options[variant.id]);
    if (!chosen) return;
    if (typeof chosen.price === 'number') price = chosen.price;
    if (typeof chosen.delta === 'number') price += chosen.delta;
  });

  config.extras.forEach((extra) => {
    if (extras.includes(extra.id)) price += extra.delta || 0;
  });

  return Math.max(0, price);
}

function describeSelection(item, selection) {
  const config = getProductOptions(item.legacyId, selection.groupId);
  const parts = [];

  config.variants.forEach((variant) => {
    const chosen = variant.options.find((option) => option.id === selection.options?.[variant.id]);
    if (chosen) parts.push(`${variant.label}: ${chosen.label}`);
  });

  const extraLabels = config.extras
    .filter((extra) => (selection.extras || []).includes(extra.id))
    .map((extra) => extra.label);
  if (extraLabels.length) parts.push(`Extras: ${extraLabels.join(', ')}`);

  return parts;
}

function lineKey(productId, selection) {
  const options = Object.entries(selection.options || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('|');
  const extras = [...(selection.extras || [])].sort().join('|');
  return `${productId}::${options}::${extras}`;
}

// ---------------------------------------------------------------------------
// Carrito
// ---------------------------------------------------------------------------

function cartCount() {
  return cart.reduce((total, line) => total + line.quantity, 0);
}

function cartTotal() {
  return cart.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
}

function addToCart(item, selection, quantity = 1) {
  const entry = entryFor(item);
  const key = lineKey(item.id, selection);
  const existing = cart.find((line) => line.key === key);

  if (existing) {
    existing.quantity += quantity;
    if (selection.note) existing.note = selection.note;
  } else {
    cart.push({
      key,
      productId: item.id,
      legacyId: item.legacyId,
      groupId: selection.groupId || entry?.groupId || null,
      quantity,
      unitPrice: unitPrice(item, selection),
      options: { ...(selection.options || {}) },
      extras: [...(selection.extras || [])],
      note: selection.note || '',
      // Fase del recorrido en la que se añadió: sirve para agrupar la revisión
      // y para marcar las bebidas como ya enviadas a barra.
      stage: currentStageId() || stageForEntry(entry)
    });
  }

  persistCart();
  renderCartBadge({ bump: true });
  renderCart();
  refreshTour();
}

// Cuando se pide fuera del recorrido, la fase se deduce de la familia.
function stageForEntry(entry) {
  if (!entry) return 'otros';
  if (entry.kind === 'bebida' || entry.kind === 'dulce') return 'bebidas';
  if (entry.kind === 'principal') return 'principales';
  if (entry.kind === 'entrante' || entry.kind === 'acompanamiento') return 'entrantes';
  return 'otros';
}

function defaultSelectionFor(entry) {
  const config = getProductOptions(entry.legacyId, entry.groupId);
  const selection = { groupId: entry.groupId, options: {}, extras: [], note: '' };
  config.variants.forEach((variant) => {
    selection.options[variant.id] = variant.options[0].id;
  });
  return selection;
}

function quantityOfProduct(productId) {
  return cart.reduce((total, line) => (line.productId === productId ? total + line.quantity : total), 0);
}

/** Fija la cantidad de la versión por defecto de un producto (usado por el recorrido). */
function setDefaultQuantity(entry, quantity) {
  const selection = defaultSelectionFor(entry);
  const key = lineKey(entry.item.id, selection);
  const line = cart.find((entryLine) => entryLine.key === key);

  if (quantity <= 0) {
    cart = cart.filter((entryLine) => entryLine.key !== key);
  } else if (line) {
    line.quantity = quantity;
  } else {
    cart.push({
      key,
      productId: entry.item.id,
      legacyId: entry.legacyId,
      groupId: entry.groupId,
      quantity,
      unitPrice: unitPrice(entry.item, selection),
      options: { ...selection.options },
      extras: [],
      note: '',
      stage: currentStageId() || stageForEntry(entry)
    });
  }

  persistCart();
  renderCartBadge({ bump: quantity > 0 });
  renderCart();
}

function updateQuantity(key, delta) {
  const line = cart.find((entry) => entry.key === key);
  if (!line) return;
  line.quantity += delta;
  if (line.quantity <= 0) cart = cart.filter((entry) => entry.key !== key);
  persistCart();
  renderCartBadge();
  renderCart();
  refreshTour();
}

function removeLine(key) {
  cart = cart.filter((entry) => entry.key !== key);
  persistCart();
  renderCartBadge();
  renderCart();
  refreshTour();
}

function clearCart() {
  cart = [];
  persistCart();
  renderCartBadge();
  renderCart();
  refreshTour();
}

function cartHasProduct(productId) {
  return cart.some((line) => line.productId === productId);
}

// ---------------------------------------------------------------------------
// Motor de recomendaciones
// ---------------------------------------------------------------------------

function selectedTags() {
  const tags = new Set();
  table.preferences.forEach((prefId) => {
    const preference = PREFERENCES.find((option) => option.id === prefId);
    preference?.tags.forEach((tag) => tags.add(tag));
  });
  // «Cómo venís hoy» también pesa: picar tira a compartir y ligero, mucha
  // hambre a contundente.
  APPETITES.find((option) => option.id === table.appetite)?.tags.forEach((tag) => tags.add(tag));
  return tags;
}

function peopleCount() {
  return Number(table.people) || 2;
}

/** Recomendaciones del banner inicial: preferencias + comensales + popularidad. */
function buildInitialRecommendations() {
  const tags = selectedTags();
  const people = peopleCount();
  const candidates = [];

  catalog.all.forEach((entry) => {
    // El banner solo destaca comida y dulces: las bebidas tienen su propia sección.
    if (entry.kind === 'bebida') return;
    if (!entry.item.isAvailable) return;
    if (entry.item.hasDetail === false) return;
    if (getAllergenSeverity(entry.item) === 'alert') return;

    const meta = getProductMeta(entry.legacyId);
    const matched = meta.tags.filter((tag) => tags.has(tag));
    let score = meta.popularity * 0.6;
    let reason = 'De lo más pedido';

    if (matched.length) {
      score += 45 + matched.length * 12;
      reason = `Porque os apetece ${(TAG_LABELS[matched[0]] || matched[0]).toLowerCase()}`;
    } else if (tags.size) {
      score -= 15;
    }

    if (people >= 4 && meta.tags.includes('compartir')) {
      score += 26;
      if (!matched.length) reason = `Va bien para ${people} personas`;
    }
    if (people <= 2 && meta.tags.includes('compartir') && basePrice(entry.item) >= 12) {
      score -= 18;
    }
    if (people === 1 && meta.tags.includes('ligero')) {
      score += 10;
    }
    if (getAllergenSeverity(entry.item) === 'warn') score -= 12;

    candidates.push({ entry, score, reason, kind: entry.kind });
  });

  candidates.sort((a, b) => b.score - a.score);

  // Máximo dos productos por familia para que el carrusel no repita registro.
  const perKind = new Map();
  const picked = [];
  for (const candidate of candidates) {
    const used = perKind.get(candidate.kind) || 0;
    if (used >= 2) continue;
    perKind.set(candidate.kind, used + 1);
    picked.push(candidate);
    if (picked.length === 4) break;
  }
  return picked;
}

/** Recomendaciones cruzadas al añadir un producto al carrito. */
function buildPairings(entry) {
  const people = peopleCount();
  const ids = [...(pairingsByProduct[entry.legacyId] || []), ...(pairingsByKind[entry.kind] || [])];
  if (people >= 4) ids.push(...groupPairings);

  const seen = new Set();
  const results = [];

  for (const legacyId of ids) {
    if (seen.has(legacyId)) continue;
    seen.add(legacyId);

    const candidate = entryByLegacyId(legacyId);
    if (!candidate) continue;
    if (candidate.item.id === entry.item.id) continue;
    if (!candidate.item.isAvailable) continue;
    if (cartHasProduct(candidate.item.id)) continue;
    // Regla dura: un plato principal nunca sugiere otro plato principal.
    if (entry.kind === 'principal' && candidate.kind === 'principal') continue;
    // Con una sola persona no tiene sentido empujar tablas grandes.
    if (people === 1 && getProductMeta(legacyId).tags.includes('compartir') && basePrice(candidate.item) >= 10) {
      continue;
    }
    if (getAllergenSeverity(candidate.item) === 'alert') continue;

    results.push(candidate);
    if (results.length === 3) break;
  }

  return results;
}

const KIND_LABELS = {
  entrante: 'Entrante o tapa para abrir boca.',
  principal: 'Plato principal.',
  acompanamiento: 'Acompañamiento: se pide junto a otro plato.',
  dulce: 'Dulce y frío, ideal para terminar.',
  bebida: 'Bebida.'
};

// La popularidad es un dato simulado para la demostración.
function popularityCopy(popularity) {
  if (popularity >= 85) return 'Uno de los más pedidos de la carta.';
  if (popularity >= 70) return 'Muy pedido por nuestros clientes.';
  if (popularity >= 55) return 'Una opción habitual en las mesas.';
  return 'Una elección poco habitual, para salirse de lo típico.';
}

function recommendationReasonForPairing(entry, sourceEntry) {
  if (sourceEntry.kind === 'principal' && entry.kind === 'acompanamiento') return 'Acompañamiento habitual';
  if (entry.kind === 'dulce') return 'Para terminar';
  if (getProductMeta(entry.legacyId).tags.includes('compartir')) return 'Para compartir';
  return 'Se pide junto a este plato';
}

// ---------------------------------------------------------------------------
// Construcción del DOM
// ---------------------------------------------------------------------------

const dom = {};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(className, text, onClick) {
  const node = el('button', className, text);
  node.type = 'button';
  if (onClick) node.addEventListener('click', onClick);
  return node;
}

function lockScroll(locked) {
  const anyOpen =
    dom.onboarding?.classList.contains('is-open') ||
    dom.sheet?.classList.contains('is-open') ||
    dom.cart?.classList.contains('is-open') ||
    dom.review?.classList.contains('is-open');
  document.body.classList.toggle('smart-locked', locked || anyOpen);
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

const ONBOARDING_STEPS = ['intro', 'allergies', 'allergen-pick', 'people', 'preferences'];
let onboardingStep = 'intro';
let draft = null;

function openOnboarding({ fromStart = true } = {}) {
  draft = {
    hasAllergies: table.hasAllergies,
    allergens: [...table.allergens],
    people: table.people,
    appetite: table.appetite,
    preferences: [...table.preferences]
  };
  onboardingStep = fromStart ? 'intro' : 'allergies';
  dom.onboarding.classList.add('is-open');
  lockScroll(true);
  renderOnboarding();
}

function closeOnboarding() {
  dom.onboarding.classList.remove('is-open');
  lockScroll(false);
  dom.onboarding.textContent = '';
}

function finishOnboarding() {
  table = {
    configured: true,
    hasAllergies: draft.hasAllergies,
    allergens: draft.hasAllergies ? draft.allergens : [],
    people: draft.people || 2,
    appetite: draft.appetite,
    preferences: draft.preferences
  };
  persistTable();
  closeOnboarding();
  refreshAll();
  // Al terminar las preguntas arranca el recorrido guiado.
  startGuidedTour();
}

// Tres tramos, uno por pregunta. El paso de selección de alérgenos comparte
// tramo con la pregunta de sí/no: son la misma pregunta en dos pantallas.
const STEP_COUNT = 3;

function stepIndex(step) {
  const order = { intro: 0, allergies: 0, 'allergen-pick': 0, people: 1, preferences: 2 };
  return order[step] ?? 0;
}

function renderOnboarding() {
  dom.onboarding.textContent = '';

  const panel = el('div', 'smart-onboarding-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  if (onboardingStep !== 'intro') {
    // La marca cede el protagonismo al flujo: solo el nombre sobre el paso.
    panel.append(el('p', 'smart-wordmark', 'Tavola'));
    const steps = el('div', 'smart-steps');
    steps.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < STEP_COUNT; index += 1) {
      const segment = el('span');
      if (index <= stepIndex(onboardingStep)) segment.classList.add('is-done');
      steps.append(segment);
    }
    panel.append(steps);
  }

  const body = el('div', 'smart-onboarding-body');
  const actions = el('div', 'smart-onboarding-actions');

  if (onboardingStep === 'intro') {
    panel.append(el('p', 'smart-wordmark', 'Tavola'));
    panel.append(el('p', 'smart-onboarding-eyebrow', 'Bienvenidos'));
    panel.append(el('h2', null, 'Preparamos la carta a vuestra medida'));
    panel.append(
      el(
        'p',
        'smart-onboarding-copy',
        'Tres preguntas rápidas y os enseñamos lo que mejor encaja con vuestra mesa. Podéis cambiarlo cuando queráis.'
      )
    );
    actions.append(button('smart-btn is-quiet', 'Ir directo a la carta', () => {
      table = { ...defaultTable, configured: true, people: 2 };
      persistTable();
      closeOnboarding();
      refreshAll();
    }));
    actions.append(el('span', 'smart-spacer'));
    actions.append(button('smart-btn', 'Empezar', () => {
      onboardingStep = 'allergies';
      renderOnboarding();
    }));
    panel.append(actions);
    dom.onboarding.append(panel);
    panel.querySelector('.smart-btn:last-child')?.focus({ preventScroll: true });
    return;
  }

  if (onboardingStep === 'allergies') {
    panel.append(el('p', 'smart-onboarding-eyebrow', 'Paso 1 de 3'));
    panel.append(el('h2', null, '¿Hay alergias o intolerancias en la mesa?'));
    panel.append(
      el('p', 'smart-onboarding-copy', 'Seguiréis viendo la carta completa. Solo marcaremos los platos que debáis mirar con lupa.')
    );

    const choice = el('div', 'smart-yesno');
    const yes = button('', '', () => {
      draft.hasAllergies = true;
      onboardingStep = 'allergen-pick';
      renderOnboarding();
    });
    yes.append(el('strong', null, 'Sí'), el('small', null, 'Nos avisáis de los platos con riesgo'));
    const no = button('', '', () => {
      draft.hasAllergies = false;
      draft.allergens = [];
      onboardingStep = 'people';
      renderOnboarding();
    });
    no.append(el('strong', null, 'No'), el('small', null, 'Ninguna alergia ni intolerancia'));
    choice.append(yes, no);
    body.append(choice);

    panel.append(body);
    actions.append(el('span', 'smart-spacer'));
    actions.append(button('smart-btn is-quiet', 'Saltar', () => {
      draft.hasAllergies = false;
      draft.allergens = [];
      onboardingStep = 'people';
      renderOnboarding();
    }));
    panel.append(actions);
    dom.onboarding.append(panel);
    yes.focus({ preventScroll: true });
    return;
  }

  if (onboardingStep === 'allergen-pick') {
    panel.append(el('p', 'smart-onboarding-eyebrow', 'Paso 1 de 3'));
    panel.append(el('h2', null, '¿Cuáles?'));
    panel.append(el('p', 'smart-onboarding-copy', 'Marca todas las que haya en la mesa. Puedes elegir varias.'));

    const chipset = el('div', 'smart-chipset');
    ALLERGENS.forEach((allergen) => {
      const chip = button('smart-chip', null, () => {
        const index = draft.allergens.indexOf(allergen.id);
        if (index >= 0) draft.allergens.splice(index, 1);
        else draft.allergens.push(allergen.id);
        chip.classList.toggle('is-selected');
        chip.setAttribute('aria-pressed', String(chip.classList.contains('is-selected')));
      });
      chip.setAttribute('aria-pressed', String(draft.allergens.includes(allergen.id)));
      if (draft.allergens.includes(allergen.id)) chip.classList.add('is-selected');
      chip.append(el('span', 'smart-chip-check', '✓'), el('span', null, allergen.label));
      chipset.append(chip);
    });
    body.append(chipset);

    panel.append(body);
    actions.append(button('smart-btn is-quiet', 'Atrás', () => {
      onboardingStep = 'allergies';
      renderOnboarding();
    }));
    actions.append(el('span', 'smart-spacer'));
    actions.append(button('smart-btn', 'Continuar', () => {
      onboardingStep = 'people';
      renderOnboarding();
    }));
    panel.append(actions);
    dom.onboarding.append(panel);
    return;
  }

  if (onboardingStep === 'people') {
    panel.append(el('p', 'smart-onboarding-eyebrow', 'Paso 2 de 3'));
    panel.append(el('h2', null, '¿Cuántos sois en la mesa?'));
    panel.append(el('p', 'smart-onboarding-copy', 'Nos sirve para ajustar las raciones que os recomendamos.'));

    const row = el('div', 'smart-people');
    const moreWrap = el('div', 'smart-people-more smart-hidden');
    const showMore = () => moreWrap.classList.remove('smart-hidden');

    // A partir de este número se pasa a la selección rápida ampliada.
    const MORE_FROM = 10;

    const paint = () => {
      row.querySelectorAll('button').forEach((node) => {
        const value = node.dataset.people;
        const isMore = value === 'more';
        const selected = isMore
          ? Number(draft.people) >= MORE_FROM
          : Number(value) === Number(draft.people);
        node.classList.toggle('is-selected', selected);
        node.setAttribute('aria-pressed', String(selected));
      });
      moreWrap.querySelectorAll('button').forEach((node) => {
        const selected = Number(node.dataset.people) === Number(draft.people);
        node.classList.toggle('is-selected', selected);
        node.setAttribute('aria-pressed', String(selected));
      });
    };

    [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((value) => {
      const node = button('', String(value), () => {
        draft.people = value;
        moreWrap.classList.add('smart-hidden');
        paint();
      });
      node.dataset.people = String(value);
      row.append(node);
    });

    const more = button('', '10+', () => {
      showMore();
      paint();
    });
    more.dataset.people = 'more';
    more.setAttribute('aria-label', 'Diez o más personas');
    row.append(more);

    moreWrap.append(el('p', null, '¿Cuántos exactamente?'));
    const moreRow = el('div', 'smart-people');
    [10, 11, 12, 14, 16, 18, 20, 25, 30].forEach((value) => {
      const node = button('', value === 30 ? '30+' : String(value), () => {
        draft.people = value;
        paint();
      });
      node.dataset.people = String(value);
      moreRow.append(node);
    });
    moreWrap.append(moreRow);

    if (Number(draft.people) >= MORE_FROM) showMore();
    body.append(row, moreWrap);
    paint();

    panel.append(body);
    actions.append(button('smart-btn is-quiet', 'Atrás', () => {
      onboardingStep = draft.hasAllergies ? 'allergen-pick' : 'allergies';
      renderOnboarding();
    }));
    actions.append(el('span', 'smart-spacer'));
    const next = button('smart-btn', 'Continuar', () => {
      onboardingStep = 'preferences';
      renderOnboarding();
    });
    actions.append(next);
    panel.append(actions);
    dom.onboarding.append(panel);
    return;
  }

  // preferences: dos decisiones rápidas, nada de listas largas.
  panel.append(el('p', 'smart-onboarding-eyebrow', 'Paso 3 de 3'));
  panel.append(el('h2', null, '¿Cómo venís hoy?'));

  const appetiteGrid = el('div', 'smart-appetite');
  APPETITES.forEach((option) => {
    const card = button('smart-appetite-card', null, () => {
      draft.appetite = option.id;
      appetiteGrid.querySelectorAll('.smart-appetite-card').forEach((node) => {
        const isThis = node === card;
        node.classList.toggle('is-selected', isThis);
        node.setAttribute('aria-pressed', String(isThis));
      });
    });
    const selected = draft.appetite === option.id;
    card.classList.toggle('is-selected', selected);
    card.setAttribute('aria-pressed', String(selected));
    card.append(el('span', 'smart-appetite-icon', option.icon));
    card.append(el('strong', null, option.label));
    card.append(el('small', null, option.hint));
    appetiteGrid.append(card);
  });
  body.append(appetiteGrid);

  body.append(el('p', 'smart-onboarding-sub', '¿Algo que os apetezca especialmente?'));

  const taste = el('div', 'smart-taste');
  PREFERENCES.forEach((preference) => {
    const card = button('smart-taste-card', null, () => {
      const index = draft.preferences.indexOf(preference.id);
      if (index >= 0) draft.preferences.splice(index, 1);
      else draft.preferences.push(preference.id);
      card.classList.toggle('is-selected');
      card.setAttribute('aria-pressed', String(card.classList.contains('is-selected')));
    });
    const selected = draft.preferences.includes(preference.id);
    card.classList.toggle('is-selected', selected);
    card.setAttribute('aria-pressed', String(selected));
    card.append(el('span', 'smart-taste-icon', preference.icon));
    card.append(el('strong', null, preference.label));
    taste.append(card);
  });
  body.append(taste);

  panel.append(body);
  actions.append(button('smart-btn is-quiet', 'Saltar', () => {
    draft.preferences = [];
    draft.appetite = null;
    finishOnboarding();
  }));
  actions.append(el('span', 'smart-spacer'));
  actions.append(button('smart-btn', 'Elegir bebidas', finishOnboarding));
  panel.append(actions);
  dom.onboarding.append(panel);
}

// ---------------------------------------------------------------------------
// Barra de contexto de la mesa
// ---------------------------------------------------------------------------

// Las preferencias ya no se pintan como barra de filtros sobre la carta: se
// intuyen en el motivo de cada recomendación y se editan desde el carrusel.
function renderContext() {
  if (!dom.context) return;
  dom.context.textContent = '';
  if (!table.configured) return;

  const facts = el('div', 'smart-context-facts');

  const people = el('span', 'smart-fact');
  people.append(document.createTextNode('👥 '), el('b', null, String(peopleCount())), document.createTextNode(peopleCount() === 1 ? ' persona' : ' personas'));
  facts.append(people);

  if (table.allergens.length) {
    const labels = table.allergens
      .map((id) => ALLERGENS.find((allergen) => allergen.id === id)?.label)
      .filter(Boolean);
    const allergyFact = el('span', 'smart-fact is-alert');
    allergyFact.textContent = `⛔ ${labels.join(', ')}`;
    facts.append(allergyFact);
  } else {
    facts.append(el('span', 'smart-fact', '✓ Sin alergias indicadas'));
  }

  if (table.preferences.length) {
    const labels = table.preferences
      .map((id) => PREFERENCES.find((preference) => preference.id === id)?.label)
      .filter(Boolean);
    facts.append(el('span', 'smart-fact', `🍽️ ${labels.join(' · ')}`));
  }

  dom.context.append(facts, button('smart-btn is-ghost', 'Cambiar preferencias', () => openOnboarding({ fromStart: false })));
}

// ---------------------------------------------------------------------------
// Carrusel de recomendaciones
// ---------------------------------------------------------------------------

const RECO_COLLAPSED_KEY = 'tavolaSmartRecoCollapsed';

let carouselIndex = 0;
let carouselTimer = null;
let carouselSlides = [];
let carouselTitles = [];
let recoCollapsed = readStorage(RECO_COLLAPSED_KEY, false) === true;

function stopCarousel() {
  window.clearInterval(carouselTimer);
  carouselTimer = null;
}

function startCarousel() {
  stopCarousel();
  if (carouselSlides.length < 2) return;
  carouselTimer = window.setInterval(() => goToSlide(carouselIndex + 1), CAROUSEL_INTERVAL);
}

function goToSlide(index) {
  if (!carouselSlides.length) return;
  carouselIndex = (index + carouselSlides.length) % carouselSlides.length;
  dom.recoTrack.style.transform = `translateX(-${carouselIndex * 100}%)`;
  // Cada diapositiva lleva su propio indicador, junto al precio.
  dom.reco.querySelectorAll('.smart-reco-steps').forEach((group) => {
    group.querySelectorAll('span').forEach((step, position) => {
      step.classList.toggle('is-active', position === carouselIndex);
    });
  });
  if (dom.recoMini) dom.recoMini.textContent = carouselTitles[carouselIndex] || '';
  carouselSlides.forEach((slide, position) => {
    const active = position === carouselIndex;
    slide.setAttribute('aria-hidden', String(!active));
    slide.querySelector('button')?.setAttribute('tabindex', active ? '0' : '-1');
  });
}

// Dos flechas diagonales apuntándose entre sí para plegar; hacia fuera para
// desplegar. El carrusel nunca se cierra del todo: solo se minimiza.
function collapseIcon(collapsed) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const paths = collapsed
    ? ['M15 3h6v6', 'M9 21H3v-6', 'M21 3l-7 7', 'M3 21l7-7']
    : ['M4 14h6v6', 'M20 10h-6V4', 'M14 10l7-7', 'M3 21l7-7'];

  paths.forEach((spec) => {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', spec);
    svg.append(path);
  });
  return svg;
}

function applyRecoCollapsed() {
  dom.reco.classList.toggle('is-collapsed', recoCollapsed);
  const toggle = dom.reco.querySelector('.smart-reco-toggle');
  if (toggle) {
    toggle.textContent = '';
    toggle.append(collapseIcon(recoCollapsed));
    toggle.setAttribute('aria-expanded', String(!recoCollapsed));
    toggle.setAttribute('aria-label', recoCollapsed ? 'Desplegar recomendaciones' : 'Plegar recomendaciones');
  }
  if (recoCollapsed) stopCarousel();
  else startCarousel();
}

function renderRecommendations() {
  stopCarousel();
  dom.reco.textContent = '';
  carouselSlides = [];
  carouselIndex = 0;

  carouselTitles = [];

  const picks = buildInitialRecommendations();
  if (!picks.length) {
    dom.reco.classList.add('smart-hidden');
    return;
  }
  dom.reco.classList.remove('smart-hidden');

  // Sin recuadro ni titular: el motivo que va sobre el nombre ya explica por
  // qué está ahí. Los controles viven dentro de la propia tarjeta blanca.
  const tools = el('div', 'smart-reco-tools');
  tools.append(
    button('smart-reco-tune', 'Ajustar', () => openOnboarding({ fromStart: false }))
  );
  const toggle = button('smart-reco-toggle', null, () => {
    recoCollapsed = !recoCollapsed;
    writeStorage(RECO_COLLAPSED_KEY, recoCollapsed);
    applyRecoCollapsed();
  });
  tools.append(toggle);

  const viewport = el('div', 'smart-reco-viewport');
  const track = el('div', 'smart-reco-track');
  dom.recoTrack = track;

  picks.forEach((pick) => {
    const slide = el('div', 'smart-reco-slide');
    slide.setAttribute('role', 'group');
    const card = button('smart-reco-card', null, () => openProductSheet(pick.entry.item, pick.entry.groupId));

    const image = document.createElement('img');
    image.src = imageFor(pick.entry.item);
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';

    // El motivo va sobre la foto, en la esquina, para no robar ancho al nombre.
    card.append(el('span', 'smart-reco-reason', pick.reason));

    const copy = el('div', 'smart-reco-copy');
    copy.append(el('h3', null, itemTitle(pick.entry.item)));
    const description = itemDescription(pick.entry.item);
    if (description) copy.append(el('p', null, description));

    // El indicador de deslizamiento va a la izquierda del precio, en la misma
    // línea, para no gastar una fila entera debajo.
    const meta = el('div', 'smart-reco-meta');
    const steps = el('div', 'smart-reco-steps');
    steps.setAttribute('aria-hidden', 'true');
    picks.forEach(() => steps.append(el('span')));
    meta.append(steps);
    meta.append(el('span', 'smart-reco-price', host.getItemPrice(pick.entry.item)));
    const flag = createSeverityFlag(getAllergenSeverity(pick.entry.item));
    if (flag) meta.append(flag);
    copy.append(meta);

    card.append(image, copy);
    card.setAttribute('aria-label', `Ver ${itemTitle(pick.entry.item)}. ${pick.reason}.`);
    slide.append(card);
    track.append(slide);
    carouselSlides.push(slide);
    carouselTitles.push(itemTitle(pick.entry.item));
  });

  // Barra fina que queda cuando se pliega, para saber qué hay escondido.
  const mini = el('div', 'smart-reco-mini');
  dom.recoMini = mini;

  viewport.append(track);
  dom.reco.append(viewport, mini, tools);

  // Arrastre horizontal para pasar de una recomendación a otra.
  let dragStart = null;
  viewport.addEventListener('pointerdown', (event) => {
    dragStart = event.clientX;
    stopCarousel();
  });
  viewport.addEventListener('pointerup', (event) => {
    if (dragStart == null) return;
    const delta = event.clientX - dragStart;
    dragStart = null;
    if (Math.abs(delta) > 40) goToSlide(carouselIndex + (delta < 0 ? 1 : -1));
    startCarousel();
  });
  viewport.addEventListener('pointercancel', () => {
    dragStart = null;
    startCarousel();
  });

  goToSlide(0);
  applyRecoCollapsed();
}

// ---------------------------------------------------------------------------
// Combinaciones populares
// ---------------------------------------------------------------------------

function comboEntries(combo) {
  return combo.items.map(entryByLegacyId).filter(Boolean);
}

/**
 * Las combinaciones populares son ahora una pestaña más de la carta: main.js
 * pide este bloque cuando la sección activa es «Lo más pedido junto».
 */
export function renderCombosSection() {
  const wrapper = el('div', 'smart-combos-section');
  const usable = popularCombos.filter((combo) => comboEntries(combo).length >= 2);

  if (!usable.length) {
    wrapper.append(el('p', 'smart-combos-empty', 'Todavía no hay combinaciones cargadas.'));
    return wrapper;
  }

  wrapper.append(
    el(
      'p',
      'smart-combos-lead',
      'No son menús cerrados ni ofertas: son los pedidos que más se repiten. Ábrelos, quita lo que no os apetezca y añadid el resto.'
    )
  );

  const grid = el('div', 'smart-combos-grid');
  usable.forEach((combo) => {
    const entries = comboEntries(combo);
    const total = entries.reduce((sum, entry) => sum + basePrice(entry.item), 0);
    const card = button('smart-combo-card', null, () => openComboSheet(combo));

    const thumbs = el('div', 'smart-combo-thumbs');
    entries.slice(0, 4).forEach((entry) => {
      const image = document.createElement('img');
      image.src = imageFor(entry.item);
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      thumbs.append(image);
    });

    card.append(thumbs);
    card.append(el('strong', null, combo.name));
    card.append(el('small', null, `${combo.tagline} · ${entries.map((entry) => itemTitle(entry.item)).join(' · ')}`));
    card.append(el('b', null, `${formatPrice(total)} en total`));
    card.setAttribute('aria-label', `Ver la combinación ${combo.name}`);
    grid.append(card);
  });

  wrapper.append(grid);
  return wrapper;
}

// ---------------------------------------------------------------------------
// Ficha ampliada de producto
// ---------------------------------------------------------------------------

let sheetReturnFocus = null;

function openSheet(buildContent) {
  sheetReturnFocus = document.activeElement;
  dom.sheet.textContent = '';

  const panel = el('div', 'smart-sheet-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const close = button('smart-sheet-close', '×', closeSheet);
  close.setAttribute('aria-label', 'Cerrar ficha');
  panel.append(close);

  buildContent(panel);

  dom.sheet.append(panel);
  dom.sheet.classList.add('is-open');
  lockScroll(true);
  close.focus({ preventScroll: true });
}

function closeSheet() {
  dom.sheet.classList.remove('is-open');
  dom.sheet.textContent = '';
  lockScroll(false);
  if (sheetReturnFocus?.isConnected) sheetReturnFocus.focus({ preventScroll: true });
  sheetReturnFocus = null;
}

export function openProductSheet(item, groupId) {
  const entry = entryFor(item) || { item, groupId, kind: getProductKind(item.legacyId, groupId) };
  const config = getProductOptions(item.legacyId, entry.groupId);

  const selection = {
    groupId: entry.groupId,
    options: {},
    extras: [],
    note: ''
  };
  config.variants.forEach((variant) => {
    selection.options[variant.id] = variant.options[0].id;
  });
  let quantity = 1;

  openSheet((panel) => {
    const hero = el('div', 'smart-sheet-hero');
    const image = document.createElement('img');
    image.src = imageFor(item);
    image.alt = itemTitle(item);
    image.decoding = 'async';
    hero.append(image);
    panel.append(hero);

    const body = el('div', 'smart-sheet-body');
    body.append(el('p', 'smart-sheet-eyebrow', entry.groupName || entry.sectionName || ''));
    body.append(el('h2', null, itemTitle(item)));

    const price = el('span', 'smart-sheet-price');
    body.append(price);

    const description = itemDescription(item);
    if (description) body.append(el('p', 'smart-sheet-desc', description));

    const meta = getProductMeta(item.legacyId);
    if (meta.tags.length) {
      const tags = el('div', 'smart-sheet-tags');
      meta.tags.forEach((tag) => {
        tags.append(el('span', 'smart-tag', TAG_LABELS[tag] || tag));
      });
      body.append(tags);
    }

    // Información del plato --------------------------------------------------
    const infoSection = el('div', 'smart-sheet-section');
    infoSection.append(el('h3', null, 'Información del plato'));
    const infoList = el('ul', 'smart-sheet-ingredients');
    KIND_LABELS[entry.kind] && infoList.append(el('li', null, KIND_LABELS[entry.kind]));
    if (entry.groupName) infoList.append(el('li', null, `Categoría: ${entry.groupName}`));
    infoList.append(el('li', null, popularityCopy(meta.popularity)));
    if (meta.tags.includes('vegetariano')) infoList.append(el('li', null, 'Apto para vegetarianos.'));
    if (meta.tags.includes('compartir')) {
      infoList.append(el('li', null, `Pensado para compartir: cunde bien para ${peopleCount()} en la mesa.`));
    }
    if (!item.isAvailable) infoList.append(el('li', null, 'Agotado ahora mismo.'));
    infoSection.append(infoList);
    body.append(infoSection);

    // Alérgenos ------------------------------------------------------------
    const allergenSection = el('div', 'smart-sheet-section');
    allergenSection.append(el('h3', null, 'Alérgenos e información'));
    const info = getAllergenInfo(item);
    const severity = getAllergenSeverity(item);

    if (severity !== 'none') {
      const banner = buildAllergenBanner(item);
      if (banner) allergenSection.append(banner);
    }

    // Escritos y a la vista: nada de esconderlos detrás de otro botón.
    const entries = info?.entries || [
      { name: info?.title || itemTitle(item), contains: info?.contains || [], traces: info?.traces || [] }
    ];
    let anyListed = false;

    entries.forEach((entry) => {
      const block = el('div', 'smart-allergen-block');
      if (entries.length > 1) block.append(el('h4', null, entry.name));

      const contains = entry.contains || [];
      const traces = entry.traces || [];
      if (contains.length) anyListed = true;
      if (traces.length) anyListed = true;

      if (contains.length) block.append(allergenLine('Contiene', contains, 'is-contains'));
      if (traces.length) block.append(allergenLine('Puede contener trazas de', traces, 'is-traces'));
      if (!contains.length && !traces.length && entries.length > 1) {
        block.append(el('p', 'smart-allergen-note', 'Sin alérgenos de declaración obligatoria.'));
      }
      allergenSection.append(block);
    });

    if (!anyListed && entries.length === 1) {
      allergenSection.append(
        el(
          'p',
          'smart-allergen-note',
          info
            ? 'Sin alérgenos de declaración obligatoria.'
            : 'No tenemos la ficha cargada para este producto. Consulta al personal.'
        )
      );
    }

    if (info?.note) allergenSection.append(el('p', 'smart-allergen-note', info.note));
    body.append(allergenSection);

    // Variantes y extras ---------------------------------------------------
    const updatePrice = () => {
      price.textContent = `${formatPrice(unitPrice(item, selection))} · unidad`;
    };

    if (config.variants.length || config.extras.length) {
      const optionsSection = el('div', 'smart-sheet-section');
      optionsSection.append(el('h3', null, 'Elige tu versión'));

      config.variants.forEach((variant) => {
        const block = el('div', 'smart-variant');
        block.append(el('span', null, variant.label));
        const chipset = el('div', 'smart-chipset');
        variant.options.forEach((option) => {
          const suffix =
            typeof option.price === 'number'
              ? ` · ${formatPrice(option.price)}`
              : option.delta
                ? ` · +${formatPrice(option.delta)}`
                : '';
          const chip = button('smart-chip', `${option.label}${suffix}`, () => {
            selection.options[variant.id] = option.id;
            chipset.querySelectorAll('.smart-chip').forEach((node) => {
              node.classList.toggle('is-selected', node === chip);
              node.setAttribute('aria-pressed', String(node === chip));
            });
            updatePrice();
          });
          if (selection.options[variant.id] === option.id) chip.classList.add('is-selected');
          chip.setAttribute('aria-pressed', String(selection.options[variant.id] === option.id));
          chipset.append(chip);
        });
        block.append(chipset);
        optionsSection.append(block);
      });

      if (config.extras.length) {
        const block = el('div', 'smart-variant');
        block.append(el('span', null, 'Extras'));
        const chipset = el('div', 'smart-chipset');
        config.extras.forEach((extra) => {
          const suffix = extra.delta ? ` · +${formatPrice(extra.delta)}` : '';
          const chip = button('smart-chip', null, () => {
            const index = selection.extras.indexOf(extra.id);
            if (index >= 0) selection.extras.splice(index, 1);
            else selection.extras.push(extra.id);
            chip.classList.toggle('is-selected');
            chip.setAttribute('aria-pressed', String(chip.classList.contains('is-selected')));
            updatePrice();
          });
          chip.setAttribute('aria-pressed', 'false');
          chip.append(el('span', 'smart-chip-check', '✓'), el('span', null, `${extra.label}${suffix}`));
          chipset.append(chip);
        });
        block.append(chipset);
        optionsSection.append(block);
      }

      body.append(optionsSection);
    }

    // Observaciones --------------------------------------------------------
    const noteSection = el('div', 'smart-sheet-section');
    noteSection.append(el('h3', null, 'Observaciones (opcional)'));
    const note = document.createElement('textarea');
    note.className = 'smart-note-field';
    note.placeholder = 'Sin cebolla, poco hecho, alergia leve…';
    note.addEventListener('input', () => {
      selection.note = note.value.trim();
    });
    noteSection.append(note);
    body.append(noteSection);

    // Cantidad + añadir ----------------------------------------------------
    const footer = el('div', 'smart-sheet-footer');
    const qty = el('div', 'smart-qty');
    const output = document.createElement('output');
    output.textContent = String(quantity);
    const minus = button('', '−', () => {
      quantity = Math.max(1, quantity - 1);
      output.textContent = String(quantity);
      minus.disabled = quantity === 1;
    });
    minus.disabled = true;
    minus.setAttribute('aria-label', 'Quitar una unidad');
    const plus = button('', '+', () => {
      quantity = Math.min(30, quantity + 1);
      output.textContent = String(quantity);
      minus.disabled = quantity === 1;
    });
    plus.setAttribute('aria-label', 'Añadir una unidad');
    qty.append(minus, output, plus);

    const addButton = button('smart-btn', 'Añadir al carrito', () => {
      addToCart(item, selection, quantity);
      showAddedView(panel, entry, quantity);
    });
    if (!item.isAvailable) {
      addButton.disabled = true;
      addButton.textContent = 'Agotado ahora mismo';
    }

    footer.append(qty, addButton);
    body.append(footer);
    panel.append(body);

    updatePrice();
  });
}

/** Transición dentro de la misma ficha: confirmación + recomendaciones cruzadas. */
function showAddedView(panel, entry, quantity) {
  panel.querySelector('.smart-sheet-hero')?.remove();
  const body = panel.querySelector('.smart-sheet-body');
  if (!body) return;
  body.textContent = '';

  const added = el('div', 'smart-added');
  added.append(el('strong', null, `${quantity} × ${itemTitle(entry.item)} en el pedido`));
  added.append(el('small', null, 'Puedes seguir añadiendo o revisar el pedido cuando queráis.'));
  body.append(added);

  const suggestions = buildPairings(entry);
  const chosen = new Set();

  if (suggestions.length) {
    const section = el('div', 'smart-sheet-section');
    section.append(el('h3', null, pairingHeadings[entry.kind] || 'Se suele pedir con'));

    const list = el('div', 'smart-pairing-list');
    suggestions.forEach((candidate) => {
      const row = button('smart-pairing', null, () => {
        if (chosen.has(candidate)) chosen.delete(candidate);
        else chosen.add(candidate);
        row.classList.toggle('is-selected', chosen.has(candidate));
        row.setAttribute('aria-pressed', String(chosen.has(candidate)));
        addChosen.disabled = chosen.size === 0;
        addChosen.textContent = chosen.size
          ? `Añadir ${chosen.size} ${chosen.size === 1 ? 'sugerencia' : 'sugerencias'}`
          : 'Añadir seleccionados';
      });
      row.setAttribute('aria-pressed', 'false');

      const image = document.createElement('img');
      image.src = imageFor(candidate.item);
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';

      const copy = el('div', 'smart-pairing-copy');
      copy.append(el('strong', null, itemTitle(candidate.item)));
      copy.append(el('small', null, recommendationReasonForPairing(candidate, entry)));
      copy.append(el('b', null, host.getItemPrice(candidate.item)));
      const flag = createSeverityFlag(getAllergenSeverity(candidate.item));
      if (flag) copy.append(flag);

      row.append(image, copy, el('span', 'smart-pairing-check', '✓'));
      list.append(row);
    });
    section.append(list);

    const addChosen = button('smart-btn is-block', 'Añadir seleccionados', () => {
      chosen.forEach((candidate) => {
        const config = getProductOptions(candidate.legacyId, candidate.groupId);
        const selection = { groupId: candidate.groupId, options: {}, extras: [], note: '' };
        config.variants.forEach((variant) => {
          selection.options[variant.id] = variant.options[0].id;
        });
        addToCart(candidate.item, selection, 1);
      });
      closeSheet();
      openCart();
    });
    addChosen.disabled = true;
    addChosen.style.marginTop = '12px';
    section.append(addChosen);
    body.append(section);
  }

  const footer = el('div', 'smart-sheet-footer');
  footer.append(button('smart-btn is-ghost', 'Seguir pidiendo', closeSheet));
  footer.append(
    button('smart-btn', `Ver el pedido · ${formatPrice(cartTotal())}`, () => {
      closeSheet();
      openCart();
    })
  );
  body.append(footer);
}

/** Ficha de una combinación popular: se revisa y se añade completa o en parte. */
function openComboSheet(combo) {
  const entries = comboEntries(combo);
  const chosen = new Set(entries);

  openSheet((panel) => {
    const body = el('div', 'smart-sheet-body');
    body.style.paddingTop = '24px';
    body.append(el('p', 'smart-sheet-eyebrow', 'Combinación popular'));
    body.append(el('h2', null, combo.name));
    body.append(el('p', 'smart-sheet-desc', `${combo.tagline}. No es un menú cerrado: quita lo que no os apetezca.`));

    const section = el('div', 'smart-sheet-section');
    section.append(el('h3', null, 'Qué incluye'));
    const list = el('div', 'smart-pairing-list');
    const totalRow = el('div', 'smart-combo-total');
    const totalValue = el('b');

    const refreshTotal = () => {
      const total = [...chosen].reduce((sum, entry) => sum + basePrice(entry.item), 0);
      totalValue.textContent = formatPrice(total);
      addButton.disabled = chosen.size === 0;
    };

    entries.forEach((entry) => {
      const row = button('smart-pairing is-selected', null, () => {
        if (chosen.has(entry)) chosen.delete(entry);
        else chosen.add(entry);
        row.classList.toggle('is-selected', chosen.has(entry));
        row.setAttribute('aria-pressed', String(chosen.has(entry)));
        refreshTotal();
      });
      row.setAttribute('aria-pressed', 'true');

      const image = document.createElement('img');
      image.src = imageFor(entry.item);
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';

      const copy = el('div', 'smart-pairing-copy');
      copy.append(el('strong', null, itemTitle(entry.item)));
      copy.append(el('small', null, entry.groupName || ''));
      copy.append(el('b', null, host.getItemPrice(entry.item)));
      const flag = createSeverityFlag(getAllergenSeverity(entry.item));
      if (flag) copy.append(flag);

      row.append(image, copy, el('span', 'smart-pairing-check', '✓'));
      list.append(row);
    });

    section.append(list);
    totalRow.append(el('span', null, 'Total de lo seleccionado'), totalValue);
    section.append(totalRow);
    body.append(section);

    const footer = el('div', 'smart-sheet-footer');
    footer.append(button('smart-btn is-ghost', 'Volver a la carta', closeSheet));
    const addButton = button('smart-btn', 'Añadir al carrito', () => {
      chosen.forEach((entry) => {
        const config = getProductOptions(entry.legacyId, entry.groupId);
        const selection = { groupId: entry.groupId, options: {}, extras: [], note: '' };
        config.variants.forEach((variant) => {
          selection.options[variant.id] = variant.options[0].id;
        });
        addToCart(entry.item, selection, 1);
      });
      closeSheet();
      openCart();
    });
    footer.append(addButton);
    body.append(footer);
    panel.append(body);
    refreshTotal();
  });
}

// ---------------------------------------------------------------------------
// Carrito
// ---------------------------------------------------------------------------

function renderCartBadge({ bump = false } = {}) {
  const count = cartCount();
  dom.cartCount.textContent = String(count);
  dom.cartFab.classList.toggle('is-empty', count === 0);
  dom.cartFab.setAttribute(
    'aria-label',
    count === 0 ? 'Ver el pedido, vacío' : `Ver el pedido, ${count} ${count === 1 ? 'producto' : 'productos'}`
  );

  // Al añadir algo el número entra en grande y en blanco y se encoge hasta
  // quedarse dentro del dibujo del carrito.
  if (bump) {
    dom.cartCount.classList.remove('is-popping');
    void dom.cartCount.offsetWidth;
    dom.cartCount.classList.add('is-popping');
  }
}

function openCart() {
  renderCart();
  dom.cart.classList.add('is-open');
  lockScroll(true);
  dom.cart.querySelector('.smart-cart-close')?.focus({ preventScroll: true });
}

function closeCart() {
  dom.cart.classList.remove('is-open');
  lockScroll(false);
}

function renderCart() {
  const items = dom.cart.querySelector('.smart-cart-items');
  const foot = dom.cart.querySelector('.smart-cart-foot');
  if (!items || !foot) return;

  items.textContent = '';
  foot.textContent = '';

  if (!cart.length) {
    const empty = el('div', 'smart-cart-empty');
    empty.append(el('strong', null, 'Todavía no habéis añadido nada'));
    empty.append(el('p', null, 'Abre cualquier producto de la carta y pulsa “Añadir al carrito”.'));
    empty.append(button('smart-btn', 'Volver a la carta', closeCart));
    items.append(empty);
    dom.cart.querySelector('.smart-cart-head p').textContent = 'Pedido vacío';
    return;
  }

  dom.cart.querySelector('.smart-cart-head p').textContent =
    `${cartCount()} ${cartCount() === 1 ? 'producto' : 'productos'} · mesa de ${peopleCount()}`;

  cart.forEach((line) => {
    const entry = catalog.byId.get(line.productId);
    if (!entry) return;
    const item = entry.item;

    const row = el('div', 'smart-line');
    const image = document.createElement('img');
    image.src = imageFor(item);
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';

    const bodyBlock = el('div', 'smart-line-body');
    const title = el('div', 'smart-line-title');
    title.append(el('strong', null, itemTitle(item)), el('b', null, formatPrice(line.unitPrice * line.quantity)));
    bodyBlock.append(title);

    const details = describeSelection(item, { ...line, groupId: line.groupId });
    if (details.length) bodyBlock.append(el('p', 'smart-line-detail', details.join(' · ')));

    const severity = getAllergenSeverity(item);
    if (severity !== 'none') {
      const matched = matchedAllergenLabels(item);
      const warning = el('span', `smart-item-flag is-${severity}`);
      warning.textContent =
        severity === 'alert'
          ? `⛔ Contiene ${matched.contains.join(', ')}`
          : `⚠️ Posibles trazas${matched.traces.length ? ` de ${matched.traces.join(', ')}` : ''}`;
      bodyBlock.append(warning);
    }

    if (line.note) bodyBlock.append(el('p', 'smart-line-note', `“${line.note}”`));

    const actions = el('div', 'smart-line-actions');
    const qty = el('div', 'smart-qty');
    const minus = button('', '−', () => updateQuantity(line.key, -1));
    minus.setAttribute('aria-label', `Quitar una unidad de ${itemTitle(item)}`);
    const output = document.createElement('output');
    output.textContent = String(line.quantity);
    const plus = button('', '+', () => updateQuantity(line.key, 1));
    plus.setAttribute('aria-label', `Añadir una unidad de ${itemTitle(item)}`);
    qty.append(minus, output, plus);

    const editNote = button('smart-icon-btn', line.note ? '✏️ Editar nota' : '✏️ Añadir nota', () => {
      const next = window.prompt(`Observaciones para ${itemTitle(item)}`, line.note || '');
      if (next === null) return;
      line.note = next.trim();
      persistCart();
      renderCart();
    });

    const remove = button('smart-icon-btn is-danger', '🗑 Quitar', () => removeLine(line.key));

    actions.append(qty, editNote, remove);
    bodyBlock.append(actions);
    row.append(image, bodyBlock);
    items.append(row);
  });

  const totalRow = el('div', 'smart-total-row');
  totalRow.append(el('span', null, 'Total'), el('b', null, formatPrice(cartTotal())));
  foot.append(totalRow);

  const actions = el('div', 'smart-cart-actions');
  const row = el('div', 'smart-cart-actions-row');
  row.append(button('smart-btn is-ghost', 'Volver a la carta', closeCart));
  row.append(
    button('smart-btn is-danger', 'Vaciar carrito', () => {
      if (window.confirm('¿Vaciar el carrito?')) clearCart();
    })
  );
  actions.append(row);
  actions.append(
    button('smart-btn is-block', 'Revisar el pedido', () => {
      closeCart();
      openReview();
    })
  );
  foot.append(actions);
}

// ---------------------------------------------------------------------------
// Revisión del pedido y confirmación simulada
// ---------------------------------------------------------------------------

function openReview() {
  renderReview();
  dom.review.classList.add('is-open');
  lockScroll(true);
}

function closeReview() {
  dom.review.classList.remove('is-open');
  dom.review.textContent = '';
  lockScroll(false);
}

function renderReview() {
  dom.review.textContent = '';

  const panel = el('div', 'smart-review-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  panel.append(el('p', 'smart-onboarding-eyebrow', 'Revisión del pedido'));
  panel.append(el('h2', null, 'Repasad antes de confirmar'));
  panel.append(
    el('p', 'smart-review-lead', 'Esto es una demostración: no se envía nada a cocina ni se cobra ningún importe.')
  );

  // Datos de la mesa -------------------------------------------------------
  const tableBlock = el('div', 'smart-review-block');
  tableBlock.append(el('h3', null, 'Vuestra mesa'));
  const facts = el('div', 'smart-context-facts');
  facts.append(el('span', 'smart-fact', `👥 ${peopleCount()} ${peopleCount() === 1 ? 'persona' : 'personas'}`));
  if (table.allergens.length) {
    const labels = table.allergens.map((id) => ALLERGENS.find((allergen) => allergen.id === id)?.label).filter(Boolean);
    facts.append(el('span', 'smart-fact is-alert', `⛔ ${labels.join(', ')}`));
  } else {
    facts.append(el('span', 'smart-fact', '✓ Sin alergias indicadas'));
  }
  if (table.preferences.length) {
    const labels = table.preferences
      .map((id) => PREFERENCES.find((preference) => preference.id === id)?.label)
      .filter(Boolean);
    facts.append(el('span', 'smart-fact', `🍽️ ${labels.join(' · ')}`));
  }
  tableBlock.append(facts);
  panel.append(tableBlock);

  // Advertencias -----------------------------------------------------------
  const flagged = cart
    .map((line) => ({ line, entry: catalog.byId.get(line.productId) }))
    .filter(({ entry }) => entry && getAllergenSeverity(entry.item) !== 'none');

  if (flagged.length) {
    const warnBlock = el('div', 'smart-review-block');
    warnBlock.append(el('h3', null, 'Atención con estos productos'));
    flagged.forEach(({ entry }) => {
      const severity = getAllergenSeverity(entry.item);
      const matched = matchedAllergenLabels(entry.item);
      const banner = el('div', severity === 'alert' ? 'smart-allergen-banner' : 'smart-allergen-banner is-warn');
      banner.append(el('strong', null, `${severity === 'alert' ? '⛔' : '⚠️'} ${itemTitle(entry.item)}`));
      banner.append(
        el(
          'span',
          null,
          severity === 'alert'
            ? `Contiene ${matched.contains.join(', ')}. Avisad al personal al confirmar.`
            : `Posibles trazas${matched.traces.length ? ` de ${matched.traces.join(', ')}` : ''}. Consultad al personal.`
        )
      );
      warnBlock.append(banner);
    });
    panel.append(warnBlock);
  }

  // Productos --------------------------------------------------------------
  const itemsBlock = el('div', 'smart-review-block');
  itemsBlock.append(el('h3', null, 'Resumen del pedido'));
  cart.forEach((line) => {
    const entry = catalog.byId.get(line.productId);
    if (!entry) return;
    const row = el('div', 'smart-review-row');
    row.append(el('span', 'smart-review-qty', `${line.quantity}×`));

    const name = el('div', 'smart-review-name');
    name.append(el('strong', null, itemTitle(entry.item)));
    const details = describeSelection(entry.item, { ...line, groupId: line.groupId });
    if (details.length) name.append(el('small', null, details.join(' · ')));
    if (line.note) name.append(el('em', null, `“${line.note}”`));
    row.append(name);

    row.append(el('span', 'smart-review-amount', formatPrice(line.unitPrice * line.quantity)));
    itemsBlock.append(row);
  });
  panel.append(itemsBlock);

  const total = el('div', 'smart-review-total');
  total.append(el('span', null, 'Total'), el('b', null, formatPrice(cartTotal())));
  panel.append(total);

  const actions = el('div', 'smart-review-actions');
  actions.append(
    button('smart-btn is-block', 'Confirmar pedido de prueba', () => {
      renderSuccess();
    })
  );
  actions.append(
    button('smart-btn is-ghost is-block', 'Seguir editando el pedido', () => {
      closeReview();
      openCart();
    })
  );
  panel.append(actions);
  panel.append(
    el('p', 'smart-demo-note', 'Prototipo de demostración · No se genera ninguna comanda real ni ningún cobro.')
  );

  dom.review.append(panel);
}

function renderSuccess() {
  const items = cartCount();
  const total = cartTotal();

  dom.review.textContent = '';
  const panel = el('div', 'smart-review-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const success = el('div', 'smart-success');
  success.append(el('div', 'smart-success-mark', '✓'));
  success.append(el('h2', null, 'Demostración completada'));
  success.append(
    el(
      'p',
      null,
      `Habéis simulado un pedido de ${items} ${items === 1 ? 'producto' : 'productos'} por ${formatPrice(total)}. En el producto final, aquí saldría la comanda hacia cocina y barra.`
    )
  );
  panel.append(success);

  const actions = el('div', 'smart-review-actions');
  actions.append(
    button('smart-btn is-block', 'Empezar otra demostración', () => {
      clearCart();
      closeReview();
      openOnboarding();
    })
  );
  actions.append(
    button('smart-btn is-ghost is-block', 'Volver a la carta', () => {
      clearCart();
      closeReview();
    })
  );
  panel.append(actions);
  panel.append(el('p', 'smart-demo-note', 'Ningún pedido real ha sido enviado.'));
  dom.review.append(panel);
}

// ---------------------------------------------------------------------------
// Montaje
// ---------------------------------------------------------------------------

function buildShell() {
  dom.context = document.querySelector('#smartContext');
  dom.reco = document.querySelector('#smartReco');
  dom.onboarding = document.querySelector('#smartOnboarding');
  dom.sheet = document.querySelector('#smartSheet');
  dom.cart = document.querySelector('#smartCart');
  dom.review = document.querySelector('#smartReview');
  dom.cartFab = document.querySelector('#smartCartFab');
  dom.cartCount = document.querySelector('#smartCartCount');

  dom.cartFab.addEventListener('click', openCart);

  // El carrusel se repinta muchas veces; estos listeners viven en el contenedor
  // fijo para no acumularse en cada render.
  dom.reco.addEventListener('mouseenter', stopCarousel);
  dom.reco.addEventListener('mouseleave', startCarousel);
  dom.reco.addEventListener('focusin', stopCarousel);
  dom.reco.addEventListener('focusout', startCarousel);

  // Estructura fija del panel de carrito.
  const overlayPanel = el('div', 'smart-cart-panel');
  overlayPanel.setAttribute('role', 'dialog');
  overlayPanel.setAttribute('aria-modal', 'true');
  overlayPanel.setAttribute('aria-label', 'Vuestro pedido');

  const head = el('div', 'smart-cart-head');
  const headText = el('div');
  headText.append(el('h2', null, 'Vuestro pedido'), el('p', null, ''));
  const close = button('smart-sheet-close smart-cart-close', '×', closeCart);
  close.style.position = 'static';
  close.setAttribute('aria-label', 'Cerrar el pedido');
  head.append(headText, close);

  overlayPanel.append(head, el('div', 'smart-cart-items'), el('div', 'smart-cart-foot'));
  dom.cart.append(overlayPanel);

  dom.cart.addEventListener('click', (event) => {
    if (event.target === dom.cart) closeCart();
  });
  dom.sheet.addEventListener('click', (event) => {
    if (event.target === dom.sheet) closeSheet();
  });
  dom.review.addEventListener('click', (event) => {
    if (event.target === dom.review) closeReview();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    // El modal de alérgenos y el lightbox de la carta original se cierran solos
    // desde main.js; si están abiertos, esta capa no debe cerrar nada más.
    if (document.querySelector('#allergenModal.is-open, #imageLightbox.is-open')) return;
    if (dom.sheet.classList.contains('is-open')) closeSheet();
    else if (dom.review.classList.contains('is-open')) closeReview();
    else if (dom.cart.classList.contains('is-open')) closeCart();
  });
}

/** Repinta solo las piezas de la carta inteligente, no la carta en sí. */
export function refreshSmartPanels() {
  if (!dom.reco) return;
  renderContext();
  renderRecommendations();
  renderCartBadge();
}

/** Repinta todo, incluida la carta (los avisos de alérgenos pueden cambiar). */
function refreshAll() {
  refreshSmartPanels();
  host?.rerenderMenu();
}

/**
 * main.js llama a esto cada vez que la carta se (re)construye.
 * `sections` es el array `menuSections` ya poblado con grupos y productos.
 */
export function registerCatalog(sections) {
  catalog.byId.clear();
  catalog.byLegacyId.clear();
  catalog.all = [];

  sections.forEach((section) => {
    (section.groups || []).forEach((group) => {
      group.items.forEach((item) => {
        const legacyId = item.legacyId || item.id;
        const entry = {
          item,
          legacyId,
          groupId: group.id,
          groupName: group.category || '',
          sectionId: section.id,
          sectionName: section.category || '',
          kind: getProductKind(legacyId, group.id)
        };
        catalog.byId.set(item.id, entry);
        catalog.byLegacyId.set(legacyId, entry);
        catalog.all.push(entry);
      });
    });
  });

  // Las líneas guardadas de una sesión anterior pueden apuntar a productos que
  // ya no existen en la carta.
  const before = cart.length;
  cart = cart.filter((line) => catalog.byId.has(line.productId));
  if (cart.length !== before) persistCart();
}

// Todo lo que el recorrido guiado necesita, sin duplicar estado.
function buildTourContext() {
  return {
    catalogEntries: () => catalog.all,
    entryById: (productId) => catalog.byId.get(productId) || null,
    table: () => table,
    peopleCount,
    preferenceTags: selectedTags,
    preferenceLabel: (tag) =>
      (TAG_LABELS[tag] || tag).toLowerCase(),
    productMeta: getProductMeta,
    basePrice,
    title: itemTitle,
    description: itemDescription,
    image: imageFor,
    priceLabel: (item) => host.getItemPrice(item),
    formatPrice,
    allergenSeverity: getAllergenSeverity,
    matchedAllergens: matchedAllergenLabels,
    allergenLabels: () =>
      table.allergens.map((id) => ALLERGENS.find((allergen) => allergen.id === id)?.label).filter(Boolean),
    openAllergens: (item) => host.openAllergenModal(item, document.activeElement),
    openSheet: openProductSheet,
    quantityOf: quantityOfProduct,
    setQuantity: setDefaultQuantity,
    cartLines: () => cart,
    cartTotal,
    describeLine: (item, line) => describeSelection(item, { ...line, groupId: line.groupId }),
    changeLine: (key, delta) => updateQuantity(key, delta),
    removeLine,
    clearCart,
    markSent: (productIds) => {
      const ids = new Set(productIds);
      cart.forEach((line) => {
        if (ids.has(line.productId)) {
          line.sent = true;
          line.stage = 'bebidas';
        }
      });
      persistCart();
    },
    restart: () => openOnboarding(),
    onStart: () => {
      // Durante el recorrido, la carta normal y sus pestañas se apartan para no
      // distraer. El enlace para verla entera sigue en la cabecera del paso.
      document.querySelector('.menu-layout')?.classList.add('is-tour-hidden');
      document.querySelector('#topTabs')?.classList.add('is-tour-hidden');
      document.querySelector('#bottomTabs')?.classList.add('is-tour-hidden');
      dom.reco?.classList.add('is-tour-hidden');
    },
    onExit: () => {
      document.querySelector('.menu-layout')?.classList.remove('is-tour-hidden');
      document.querySelector('#topTabs')?.classList.remove('is-tour-hidden');
      document.querySelector('#bottomTabs')?.classList.remove('is-tour-hidden');
      dom.reco?.classList.remove('is-tour-hidden');
      refreshSmartPanels();
      host?.rerenderMenu();
    }
  };
}

/**
 * Punto de entrada llamado desde main.js con el catálogo ya registrado y antes
 * de pintar la carta, para que los avisos de alérgenos salgan bien a la primera.
 */
export function initSmartMenu(bridge) {
  host = bridge;
  buildShell();
  initGuidedTour(buildTourContext());
  refreshSmartPanels();

  if (!table.configured) openOnboarding();
}

export { openCart, openOnboarding };
