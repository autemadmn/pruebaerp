// Recorrido de pedido guiado.
//
// Acompaña a la mesa paso a paso —bebidas, entrantes, principales, revisión y
// envío— con un título grande por fase, una instrucción corta y una única
// acción principal en pantalla. Se monta encima de la carta que ya existe: no
// sustituye nada, solo la conduce.
//
// Todas las dependencias (carrito, catálogo, alérgenos, ficha de producto)
// llegan inyectadas desde smart-menu.js para no duplicar estado.

let ctx = null;

const PHASES = [
  {
    id: 'bebidas',
    title: 'Elige tus bebidas',
    hint: 'Pulsa las bebidas que queráis pedir.',
    groups: [
      'refrescos',
      'cafes',
      'cerveza',
      'vermouth-copas',
      'vinos-blancos',
      'vinos-tintos',
      'vinos-rosados',
      'cavas-espumosos',
      'sangrias-carta',
      'cocteles-clasicos',
      'granizados-smoothies-frappes'
    ],
    cta: 'Pedir bebidas',
    skip: 'Seguir sin bebidas',
    highlight: false
  },
  {
    id: 'entrantes',
    title: 'Elige los entrantes',
    hint: 'Pulsa los entrantes que queráis pedir.',
    groups: ['picar', 'tapas'],
    cta: 'Continuar a principales',
    skip: 'Continuar sin entrantes',
    highlight: true
  },
  {
    id: 'principales',
    title: 'Elige los platos principales',
    hint: 'Pulsa los platos que queráis pedir.',
    groups: ['desayuno', 'bocadillos', 'pizzas', 'platos'],
    cta: 'Revisar pedido',
    skip: 'Continuar sin principales',
    highlight: true
  }
];

// bebidas -> entrantes -> principales -> revision -> populares -> final
let stepIndex = 0;
let step = null;
let active = false;
let splashTimer = null;

// ---------------------------------------------------------------------------
// Utilidades de DOM
// ---------------------------------------------------------------------------

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

function stage() {
  return document.querySelector('#tourStage');
}

// ---------------------------------------------------------------------------
// Selección de productos de la fase
// ---------------------------------------------------------------------------

function phaseEntries(phase) {
  return ctx.catalogEntries().filter(
    (entry) => phase.groups.includes(entry.groupId) && entry.item.hasDetail !== false
  );
}

function selectedInPhase(phase) {
  return phaseEntries(phase).filter((entry) => ctx.quantityOf(entry.item.id) > 0);
}

function countInPhase(phase) {
  return selectedInPhase(phase).reduce((total, entry) => total + ctx.quantityOf(entry.item.id), 0);
}

/**
 * Producto destacado al abrir la fase: preferencias del onboarding, número de
 * comensales, alérgenos de la mesa y características del producto. Es distinto
 * de las sugerencias que salen al añadir algo, que miran al producto añadido.
 */
function phasePick(phase) {
  const table = ctx.table();
  const people = ctx.peopleCount();
  const tags = ctx.preferenceTags();
  let best = null;

  phaseEntries(phase).forEach((entry) => {
    if (!entry.item.isAvailable) return;
    if (ctx.quantityOf(entry.item.id) > 0) return;
    if (ctx.allergenSeverity(entry.item) === 'alert') return;

    const meta = ctx.productMeta(entry.legacyId);
    const matched = meta.tags.filter((tag) => tags.has(tag));
    let score = meta.popularity * 0.6;
    let reason = 'De lo más pedido de la carta';

    if (matched.length) {
      score += 45 + matched.length * 12;
      reason = `Encaja con lo que os apetece: ${ctx.preferenceLabel(matched[0])}`;
    } else if (tags.size) {
      score -= 12;
    }

    if (people >= 4 && meta.tags.includes('compartir')) {
      score += 24;
      if (!matched.length) reason = `Cunde bien para ${people} personas`;
    }
    if (people <= 2 && meta.tags.includes('compartir') && ctx.basePrice(entry.item) >= 12) score -= 16;
    if (ctx.allergenSeverity(entry.item) === 'warn') score -= 14;
    if (table.allergens.length && ctx.allergenSeverity(entry.item) === 'none') score += 10;

    if (!best || score > best.score) best = { entry, score, reason };
  });

  return best;
}

// ---------------------------------------------------------------------------
// Pantalla de fase
// ---------------------------------------------------------------------------

function showSplash(title, onDone) {
  const splash = el('div', 'tour-splash');
  splash.setAttribute('aria-hidden', 'true');
  splash.append(el('h2', null, title));
  document.body.append(splash);

  window.clearTimeout(splashTimer);
  splashTimer = window.setTimeout(() => {
    splash.remove();
    onDone?.();
  }, 1900);

  // Pulsar salta la animación: nunca se obliga a esperar.
  splash.addEventListener('click', () => {
    window.clearTimeout(splashTimer);
    splash.remove();
    onDone?.();
  });
}

function renderHeader(phase, { withStep = true } = {}) {
  const head = el('header', 'tour-head');

  if (withStep) {
    const progress = el('div', 'tour-progress');
    progress.setAttribute('aria-hidden', 'true');
    PHASES.forEach((_, index) => {
      const dot = el('span');
      if (index < stepIndex) dot.classList.add('is-done');
      if (index === stepIndex) dot.classList.add('is-current');
      progress.append(dot);
    });
    head.append(progress);
  }

  head.append(el('h2', 'tour-title', phase.title));
  head.append(el('p', 'tour-hint', phase.hint));

  const tools = el('div', 'tour-head-tools');
  if (stepIndex > 0 || step !== 'phase') {
    tools.append(button('tour-link', '← Atrás', goBack));
  }
  tools.append(el('span', 'tour-spacer'));
  tools.append(button('tour-link is-quiet', 'Ver la carta completa', exitTour));
  head.append(tools);

  return head;
}

function renderQuantityRow(entry) {
  const row = el('div', 'tour-qty');
  const quantity = ctx.quantityOf(entry.item.id);

  const minus = button('', '−', (event) => {
    event.stopPropagation();
    ctx.setQuantity(entry, Math.max(0, ctx.quantityOf(entry.item.id) - 1));
    renderPhase();
  });
  minus.setAttribute('aria-label', `Quitar una unidad de ${ctx.title(entry.item)}`);

  const output = document.createElement('output');
  output.textContent = String(quantity);

  const plus = button('', '+', (event) => {
    event.stopPropagation();
    ctx.setQuantity(entry, ctx.quantityOf(entry.item.id) + 1);
    renderPhase();
  });
  plus.setAttribute('aria-label', `Añadir una unidad de ${ctx.title(entry.item)}`);

  row.append(minus, output, plus);
  return row;
}

function renderItem(entry, phase, { featured = false, reason = '' } = {}) {
  const quantity = ctx.quantityOf(entry.item.id);
  const card = el('article', 'tour-item');
  card.classList.toggle('is-selected', quantity > 0);
  card.classList.toggle('is-featured', featured);

  if (featured) {
    card.append(el('p', 'tour-featured-label', 'El que mejor encaja con vuestra mesa'));
  }

  // Pulsar el producto lo selecciona. La ficha se abre aparte, para que abrirla
  // nunca añada nada por sí sola.
  const pick = button('tour-pick', null, () => {
    ctx.setQuantity(entry, ctx.quantityOf(entry.item.id) + 1);
    renderPhase();
  });
  pick.setAttribute(
    'aria-label',
    `Añadir ${ctx.title(entry.item)}, ${ctx.priceLabel(entry.item)}`
  );

  const thumb = el('span', 'tour-thumb');
  const image = document.createElement('img');
  image.src = ctx.image(entry.item);
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.addEventListener('load', () => image.classList.add('is-loaded'), { once: true });
  if (image.complete && image.naturalWidth > 0) image.classList.add('is-loaded');
  thumb.append(image);

  const copy = el('span', 'tour-copy');
  copy.append(el('strong', null, ctx.title(entry.item)));
  const description = ctx.description(entry.item);
  if (description) copy.append(el('small', null, description));
  if (featured && reason) copy.append(el('em', 'tour-reason', reason));

  pick.append(thumb, copy, el('b', null, ctx.priceLabel(entry.item)));

  if (quantity > 0) {
    const mark = el('span', 'tour-check', '✓');
    mark.setAttribute('aria-hidden', 'true');
    pick.append(mark);
  }

  card.append(pick);

  const foot = el('div', 'tour-item-foot');
  const severity = ctx.allergenSeverity(entry.item);
  const allergens = button(`tour-chip is-allergen is-${severity}`, null, () =>
    ctx.openAllergens(entry.item)
  );
  allergens.append(
    el('span', null, severity === 'alert' ? '⛔ Contiene alérgenos' : severity === 'warn' ? '⚠️ Posibles trazas' : 'Ver alérgenos')
  );
  foot.append(allergens);

  foot.append(
    button('tour-chip', 'Ver ficha', () => ctx.openSheet(entry.item, entry.groupId))
  );

  foot.append(el('span', 'tour-spacer'));

  if (quantity > 0) {
    foot.append(renderQuantityRow(entry));
  } else {
    const add = button('tour-chip is-add', '+ Añadir', () => {
      ctx.setQuantity(entry, 1);
      renderPhase();
    });
    foot.append(add);
  }

  card.append(foot);
  return card;
}

function renderPhase() {
  const phase = PHASES[stepIndex];
  const host = stage();
  if (!host) return;

  const scroll = host.scrollTop;
  host.textContent = '';
  host.className = 'tour-stage';
  host.append(renderHeader(phase));

  const body = el('div', 'tour-body');

  const chosen = selectedInPhase(phase);
  const featured = phase.highlight ? phasePick(phase) : null;

  if (featured) {
    body.append(renderItem(featured.entry, phase, { featured: true, reason: featured.reason }));
  }

  const list = el('div', 'tour-list');
  phaseEntries(phase).forEach((entry) => {
    if (featured && entry.item.id === featured.entry.item.id) return;
    list.append(renderItem(entry, phase));
  });
  body.append(list);
  host.append(body);

  // Barra fija: una sola acción principal, siempre visible.
  const bar = el('div', 'tour-bar');
  const count = countInPhase(phase);

  if (count === 0) {
    bar.append(button('tour-btn is-ghost', phase.skip, () => advance({ skipped: true })));
  } else {
    bar.append(
      button('tour-btn is-ghost tour-btn-narrow', 'Saltar', () => advance({ skipped: true }))
    );
  }

  const cta = button('tour-btn', null, () => advance({}));
  cta.append(el('span', null, phase.cta));
  if (count > 0) cta.append(el('span', 'tour-badge', String(count)));
  cta.disabled = false;
  bar.append(cta);

  host.append(bar);
  host.scrollTop = scroll;
}

// ---------------------------------------------------------------------------
// Avisos orientativos de cantidad (nunca bloquean)
// ---------------------------------------------------------------------------

function openDialog(build) {
  const overlay = el('div', 'tour-dialog is-open');
  const panel = el('div', 'tour-dialog-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  build(panel, () => overlay.remove());
  overlay.append(panel);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.remove();
  });
  document.body.append(overlay);
  panel.querySelector('button')?.focus({ preventScroll: true });
  return overlay;
}

/**
 * Cuánta gente cubre un entrante. Una tabla grande da de comer a varios; una
 * bolsa de frutos secos no, aunque también sea «para compartir». Se usa el
 * precio como señal del tamaño de la ración.
 */
function servingWeight(entry) {
  const meta = ctx.productMeta(entry.legacyId);
  if (!meta.tags.includes('compartir')) return 1;
  const price = ctx.basePrice(entry.item);
  if (price >= 12) return 3;
  if (price >= 8) return 2;
  return 1;
}

function starterWarning(phase) {
  const people = ctx.peopleCount();
  const chosen = selectedInPhase(phase);
  if (!chosen.length) return null;

  const coverage = chosen.reduce(
    (total, entry) => total + servingWeight(entry) * ctx.quantityOf(entry.item.id),
    0
  );
  const expected = Math.ceil(people / 2);
  if (coverage >= expected) return null;

  const units = chosen.reduce((total, entry) => total + ctx.quantityOf(entry.item.id), 0);
  return {
    title: 'Una comprobación rápida',
    body: `Sois ${people} ${people === 1 ? 'persona' : 'personas'} y habéis elegido ${units} ${units === 1 ? 'entrante' : 'entrantes'}. Una mesa de ${people} suele elegir alguno más. ¿Queréis continuar?`,
    ok: 'Sí, continuar',
    more: 'Ver más entrantes'
  };
}

function mainWarning(phase) {
  const people = ctx.peopleCount();
  const units = countInPhase(phase);
  if (!units || units >= people) return null;

  return {
    title: 'Una comprobación rápida',
    body: `Hay ${units} ${units === 1 ? 'plato principal' : 'platos principales'} para ${people} ${people === 1 ? 'persona' : 'personas'}. ¿Es correcto o queréis añadir otro?`,
    ok: 'Está bien',
    more: 'Añadir otro principal'
  };
}

function askWarning(warning, onContinue) {
  openDialog((panel, close) => {
    panel.append(el('h3', null, warning.title));
    panel.append(el('p', null, warning.body));
    const actions = el('div', 'tour-dialog-actions');
    actions.append(
      button('tour-btn is-ghost', warning.more, () => {
        close();
      })
    );
    actions.append(
      button('tour-btn', warning.ok, () => {
        close();
        onContinue();
      })
    );
    panel.append(actions);
  });
}

// ---------------------------------------------------------------------------
// Confirmación de bebidas
// ---------------------------------------------------------------------------

function confirmDrinks(onDone) {
  const phase = PHASES[0];
  const chosen = selectedInPhase(phase);

  openDialog((panel, close) => {
    panel.append(el('h3', null, '¿Enviamos estas bebidas?'));
    panel.append(el('p', null, 'Las bebidas salen antes que la comida, para que no esperéis.'));

    const list = el('div', 'tour-summary');
    chosen.forEach((entry) => {
      const row = el('div', 'tour-summary-row');
      row.append(el('span', 'tour-summary-qty', `${ctx.quantityOf(entry.item.id)}×`));
      row.append(el('span', 'tour-summary-name', ctx.title(entry.item)));
      row.append(
        el(
          'span',
          'tour-summary-amount',
          ctx.formatPrice(ctx.basePrice(entry.item) * ctx.quantityOf(entry.item.id))
        )
      );
      list.append(row);
    });
    panel.append(list);

    const actions = el('div', 'tour-dialog-actions');
    actions.append(button('tour-btn is-ghost', 'Cambiar algo', close));
    actions.append(
      button('tour-btn', 'Enviar a barra', () => {
        close();
        ctx.markSent(chosen.map((entry) => entry.item.id));
        showSentToast(onDone);
      })
    );
    panel.append(actions);
  });
}

function showSentToast(onDone) {
  const overlay = el('div', 'tour-sent');
  const mark = el('div', 'tour-sent-mark', '✓');
  overlay.append(mark, el('h2', null, 'Bebidas enviadas a barra'));
  overlay.append(el('p', null, 'Seguimos con la comida.'));
  document.body.append(overlay);
  window.setTimeout(() => {
    overlay.remove();
    onDone();
  }, 1700);
}

// ---------------------------------------------------------------------------
// Revisión, favoritos y envío
// ---------------------------------------------------------------------------

function renderReviewStep() {
  const host = stage();
  host.textContent = '';
  host.className = 'tour-stage';

  const head = el('header', 'tour-head');
  head.append(el('h2', 'tour-title', 'Revisad el pedido'));
  head.append(el('p', 'tour-hint', 'Cambiad cantidades o quitad lo que no queráis.'));
  const tools = el('div', 'tour-head-tools');
  tools.append(button('tour-link', '← Atrás', goBack));
  tools.append(el('span', 'tour-spacer'));
  tools.append(button('tour-link is-quiet', 'Ver la carta completa', exitTour));
  head.append(tools);
  host.append(head);

  const body = el('div', 'tour-body');
  const lines = ctx.cartLines();

  if (!lines.length) {
    body.append(el('p', 'tour-empty', 'Todavía no habéis elegido nada.'));
  }

  const groups = [
    { id: 'bebidas', label: 'Bebidas · ya enviadas a barra', sent: true },
    { id: 'entrantes', label: 'Entrantes', sent: false },
    { id: 'principales', label: 'Platos principales', sent: false },
    { id: 'otros', label: 'Otros productos', sent: false }
  ];

  groups.forEach((group) => {
    const groupLines = lines.filter((line) => (line.stage || 'otros') === group.id);
    if (!groupLines.length) return;

    const block = el('section', 'tour-review-block');
    if (group.sent) block.classList.add('is-sent');
    block.append(el('h3', null, group.label));

    groupLines.forEach((line) => {
      const entry = ctx.entryById(line.productId);
      if (!entry) return;
      const row = el('div', 'tour-review-row');

      const image = document.createElement('img');
      image.src = ctx.image(entry.item);
      image.alt = '';
      image.loading = 'lazy';
      row.append(image);

      const copy = el('div', 'tour-review-copy');
      copy.append(el('strong', null, ctx.title(entry.item)));
      const details = ctx.describeLine(entry.item, line);
      if (details.length) copy.append(el('small', null, details.join(' · ')));
      if (line.note) copy.append(el('em', null, `“${line.note}”`));

      const severity = ctx.allergenSeverity(entry.item);
      if (severity !== 'none') {
        const matched = ctx.matchedAllergens(entry.item);
        copy.append(
          el(
            'span',
            `tour-flag is-${severity}`,
            severity === 'alert'
              ? `⛔ Contiene ${matched.contains.join(', ')}`
              : `⚠️ Posibles trazas${matched.traces.length ? ` de ${matched.traces.join(', ')}` : ''}`
          )
        );
      }
      row.append(copy);

      const side = el('div', 'tour-review-side');
      side.append(el('b', null, ctx.formatPrice(line.unitPrice * line.quantity)));

      if (group.sent) {
        side.append(el('span', 'tour-sent-tag', `${line.quantity}× enviada`));
      } else {
        const qty = el('div', 'tour-qty');
        const minus = button('', '−', () => {
          ctx.changeLine(line.key, -1);
          renderReviewStep();
        });
        minus.setAttribute('aria-label', `Quitar una unidad de ${ctx.title(entry.item)}`);
        const output = document.createElement('output');
        output.textContent = String(line.quantity);
        const plus = button('', '+', () => {
          ctx.changeLine(line.key, 1);
          renderReviewStep();
        });
        plus.setAttribute('aria-label', `Añadir una unidad de ${ctx.title(entry.item)}`);
        qty.append(minus, output, plus);
        side.append(qty);

        const remove = button('tour-chip is-remove', 'Quitar', () => {
          ctx.removeLine(line.key);
          renderReviewStep();
        });
        side.append(remove);
      }

      row.append(side);
      block.append(row);
    });

    body.append(block);
  });

  const facts = el('div', 'tour-review-facts');
  const people = ctx.peopleCount();
  facts.append(el('span', 'tour-fact', `👥 ${people} ${people === 1 ? 'persona' : 'personas'}`));
  const allergens = ctx.allergenLabels();
  facts.append(
    el('span', allergens.length ? 'tour-fact is-alert' : 'tour-fact', allergens.length ? `⛔ ${allergens.join(', ')}` : '✓ Sin alergias indicadas')
  );
  body.append(facts);

  const total = el('div', 'tour-total');
  total.append(el('span', null, 'Total'), el('b', null, ctx.formatPrice(ctx.cartTotal())));
  body.append(total);

  host.append(body);

  const bar = el('div', 'tour-bar');
  bar.append(button('tour-btn is-ghost tour-btn-narrow', 'Añadir más', () => {
    stepIndex = PHASES.length - 1;
    step = 'phase';
    renderPhase();
  }));
  bar.append(button('tour-btn', 'Continuar', () => {
    step = 'populares';
    renderPopular();
  }));
  host.append(bar);
}

function popularPicks() {
  const inCart = new Set(ctx.cartLines().map((line) => line.productId));
  return ctx
    .catalogEntries()
    .filter((entry) => {
      if (entry.item.hasDetail === false) return false;
      if (!entry.item.isAvailable) return false;
      if (inCart.has(entry.item.id)) return false;
      if (ctx.allergenSeverity(entry.item) === 'alert') return false;
      return true;
    })
    .map((entry) => ({ entry, popularity: ctx.productMeta(entry.legacyId).popularity }))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 3);
}

function renderPopular() {
  const host = stage();
  host.textContent = '';
  host.className = 'tour-stage';

  const head = el('header', 'tour-head');
  head.append(el('h2', 'tour-title', 'Los favoritos de otras mesas'));
  head.append(el('p', 'tour-hint', 'Añadid algo si os apetece. También podéis seguir sin añadir nada.'));
  const tools = el('div', 'tour-head-tools');
  tools.append(button('tour-link', '← Atrás', () => {
    step = 'revision';
    renderReviewStep();
  }));
  tools.append(el('span', 'tour-spacer'));
  tools.append(button('tour-link is-quiet', 'Ver la carta completa', exitTour));
  head.append(tools);
  host.append(head);

  const body = el('div', 'tour-body');
  const list = el('div', 'tour-list');

  popularPicks().forEach((pick, index) => {
    const entry = pick.entry;
    const card = el('article', 'tour-item is-popular');
    const quantity = ctx.quantityOf(entry.item.id);
    card.classList.toggle('is-selected', quantity > 0);

    const rank = el('span', 'tour-rank', `Nº${index + 1} en pedidos`);
    card.append(rank);

    const pickButton = button('tour-pick', null, () => {
      ctx.setQuantity(entry, ctx.quantityOf(entry.item.id) + 1);
      renderPopular();
    });
    pickButton.setAttribute('aria-label', `Añadir ${ctx.title(entry.item)}`);

    const thumb = el('span', 'tour-thumb');
    const image = document.createElement('img');
    image.src = ctx.image(entry.item);
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('load', () => image.classList.add('is-loaded'), { once: true });
    if (image.complete && image.naturalWidth > 0) image.classList.add('is-loaded');
    thumb.append(image);

    const copy = el('span', 'tour-copy');
    copy.append(el('strong', null, ctx.title(entry.item)));
    const description = ctx.description(entry.item);
    if (description) copy.append(el('small', null, description));

    pickButton.append(thumb, copy, el('b', null, ctx.priceLabel(entry.item)));
    card.append(pickButton);

    const foot = el('div', 'tour-item-foot');
    foot.append(button('tour-chip', 'Ver ficha', () => ctx.openSheet(entry.item, entry.groupId)));
    foot.append(el('span', 'tour-spacer'));
    if (quantity > 0) foot.append(renderQuantityRow(entry));
    else foot.append(button('tour-chip is-add', '+ Añadir', () => {
      ctx.setQuantity(entry, 1);
      renderPopular();
    }));
    card.append(foot);

    list.append(card);
  });

  body.append(list);
  host.append(body);

  const bar = el('div', 'tour-bar');
  bar.append(button('tour-btn is-ghost tour-btn-narrow', 'Seguir sin añadir', () => {
    step = 'final';
    renderFinal();
  }));
  bar.append(button('tour-btn', 'Ir a enviar el pedido', () => {
    step = 'final';
    renderFinal();
  }));
  host.append(bar);
}

function renderFinal() {
  const host = stage();
  host.textContent = '';
  host.className = 'tour-stage';

  const head = el('header', 'tour-head');
  head.append(el('h2', 'tour-title', 'Todo listo'));
  head.append(el('p', 'tour-hint', 'Este es vuestro pedido completo.'));
  const tools = el('div', 'tour-head-tools');
  tools.append(button('tour-link', '← Atrás', () => {
    step = 'populares';
    renderPopular();
  }));
  tools.append(el('span', 'tour-spacer'));
  tools.append(button('tour-link is-quiet', 'Ver la carta completa', exitTour));
  head.append(tools);
  host.append(head);

  const body = el('div', 'tour-body');
  const block = el('section', 'tour-review-block');
  ctx.cartLines().forEach((line) => {
    const entry = ctx.entryById(line.productId);
    if (!entry) return;
    const row = el('div', 'tour-summary-row');
    row.append(el('span', 'tour-summary-qty', `${line.quantity}×`));
    const name = el('span', 'tour-summary-name');
    name.append(el('span', null, ctx.title(entry.item)));
    if (line.stage === 'bebidas') name.append(el('span', 'tour-sent-tag', 'ya en barra'));
    row.append(name);
    row.append(el('span', 'tour-summary-amount', ctx.formatPrice(line.unitPrice * line.quantity)));
    block.append(row);
  });
  body.append(block);

  const total = el('div', 'tour-total');
  total.append(el('span', null, 'Total'), el('b', null, ctx.formatPrice(ctx.cartTotal())));
  body.append(total);
  host.append(body);

  const bar = el('div', 'tour-bar');
  const send = button('tour-btn is-wide', 'Enviar pedido', () => renderSent());
  send.disabled = ctx.cartLines().length === 0;
  bar.append(send);
  host.append(bar);
}

function renderSent() {
  const host = stage();
  host.textContent = '';
  host.className = 'tour-stage is-done';

  const done = el('div', 'tour-done');
  done.append(el('div', 'tour-sent-mark', '✓'));
  done.append(el('h2', null, 'Pedido enviado'));
  done.append(el('p', null, 'La cocina ha recibido vuestra selección.'));
  done.append(el('p', 'tour-note', 'Demostración: no se ha enviado ningún pedido real.'));

  const actions = el('div', 'tour-done-actions');
  actions.append(button('tour-btn is-ghost', 'Ver la carta', exitTour));
  actions.append(button('tour-btn', 'Empezar otra demostración', () => {
    ctx.clearCart();
    exitTour();
    ctx.restart();
  }));
  done.append(actions);
  host.append(done);
}

// ---------------------------------------------------------------------------
// Navegación
// ---------------------------------------------------------------------------

function advance({ skipped = false } = {}) {
  const phase = PHASES[stepIndex];

  if (phase.id === 'bebidas') {
    if (skipped || countInPhase(phase) === 0) {
      goToPhase(1);
      return;
    }
    confirmDrinks(() => goToPhase(1));
    return;
  }

  const warning = skipped
    ? null
    : phase.id === 'entrantes'
      ? starterWarning(phase)
      : mainWarning(phase);

  const next = () => {
    if (stepIndex + 1 < PHASES.length) goToPhase(stepIndex + 1);
    else {
      step = 'revision';
      renderReviewStep();
    }
  };

  if (warning) askWarning(warning, next);
  else next();
}

function goBack() {
  if (step === 'phase' && stepIndex > 0) {
    goToPhase(stepIndex - 1, { splash: false });
    return;
  }
  if (step === 'revision') {
    goToPhase(PHASES.length - 1, { splash: false });
  }
}

function goToPhase(index, { splash = true } = {}) {
  stepIndex = index;
  step = 'phase';
  const phase = PHASES[index];
  stage().scrollTop = 0;
  window.scrollTo({ top: 0, behavior: 'auto' });

  if (splash) {
    stage().textContent = '';
    showSplash(phase.title, renderPhase);
  } else {
    renderPhase();
  }
}

// ---------------------------------------------------------------------------
// Entrada y salida
// ---------------------------------------------------------------------------

export function isTourActive() {
  return active;
}

/** El paso actual, para etiquetar las líneas que se añaden desde la ficha. */
export function currentStageId() {
  if (!active || step !== 'phase') return null;
  return PHASES[stepIndex]?.id || null;
}

/** La ficha de producto puede añadir cosas: hay que repintar el paso. */
export function refreshTour() {
  if (!active) return;
  if (step === 'phase') renderPhase();
  else if (step === 'revision') renderReviewStep();
  else if (step === 'populares') renderPopular();
  else if (step === 'final') renderFinal();
}

export function exitTour() {
  if (!active) return;
  active = false;
  step = null;
  window.clearTimeout(splashTimer);
  document.body.classList.remove('tour-on');
  document.querySelector('.tour-splash')?.remove();
  const host = stage();
  if (host) {
    host.textContent = '';
    host.className = 'tour-stage is-hidden';
  }
  ctx.onExit();
}

export function startGuidedTour() {
  if (!ctx) return;
  active = true;
  document.body.classList.add('tour-on');
  const host = stage();
  host.className = 'tour-stage';
  ctx.onStart();
  goToPhase(0);
}

export function initGuidedTour(api) {
  ctx = api;
}
