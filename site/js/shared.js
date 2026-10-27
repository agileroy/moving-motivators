// Briques communes aux deux pages (exercice et animation) : cartes, tableau, langue, thème, petits outils.

import { MOTIVATORS, UI, LANGS } from './i18n.js?v=__VERSION__';
import { icon } from './icons.js?v=__VERSION__';
import { MIN_LEVEL, MAX_LEVEL } from './core.js?v=__VERSION__';

export const LANG_KEY = 'moving-motivators.lang';
const THEME_KEY = 'theme'; // partagé avec la boîte à outils (même origine)

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const stackMQ = window.matchMedia('(max-width: 760px)');
export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
export const isStacked = () => stackMQ.matches;
export const posOf = (level) => (level - MIN_LEVEL) / (MAX_LEVEL - MIN_LEVEL);

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function initialLang() {
  const param = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(param)) return param;
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* stockage indisponible */ }
  return 'fr';
}

export function rememberLang(lang) {
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* non mémorisé */ }
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) {
    url.searchParams.delete('lang');
    history.replaceState(null, '', url);
  }
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function announce(message) {
  const live = $('#live');
  live.textContent = '';
  requestAnimationFrame(() => { live.textContent = message; });
}

export function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 2800);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const levelLabelsFor = (lang, mode) => (mode === 'change' ? UI[lang].levelsChange : UI[lang].levelsToday);

export function card(id, lang, cls = '') {
  return `<div class="mcard ${cls}" style="--h:${MOTIVATORS[id].hue}" data-id="${id}">${icon(id)}<span class="mcard-name">${esc(MOTIVATORS[id][lang].name)}</span></div>`;
}

/** Tableau d'évaluation : une piste par carte, de la moins à la plus importante. */
export function lanesBoard({ order, levels, mode, lang, readOnly = false, id = '' }) {
  const tx = UI[lang];
  const labels = levelLabelsFor(lang, mode);
  const lineLabel = mode === 'change' ? tx.lineChange : tx.lineToday;
  return `
  <div class="table assessboard ${readOnly ? 'is-readonly' : ''}">
    <div class="scale" aria-hidden="true">
      <span class="scale-top">${esc(labels['2'])}</span>
      <span class="scale-mid">${esc(lineLabel)}</span>
      <span class="scale-bottom">${esc(labels['-2'])}</span>
    </div>
    <ol class="lanes" ${id ? `id="${id}"` : ''}>
      ${order.map((mid) => {
        const level = levels[mid] ?? 0;
        const name = MOTIVATORS[mid][lang].name;
        const a11y = readOnly
          ? `aria-label="${esc(tx.levelAnnounce(name, labels[String(level)]))}" role="img"`
          : `tabindex="0" role="slider" aria-orientation="${isStacked() ? 'horizontal' : 'vertical'}" aria-valuemin="${MIN_LEVEL}" aria-valuemax="${MAX_LEVEL}" aria-valuenow="${level}" aria-valuetext="${esc(labels[String(level)])}" aria-label="${esc(name)}"`;
        return `<li class="lane" data-id="${mid}">
          <div class="track" data-id="${mid}">
            <div class="lane-card" style="--pos:${posOf(level)}" data-level="${level}" ${a11y}>
              ${card(mid, lang, 'mcard--board')}
            </div>
          </div>
        </li>`;
      }).join('')}
    </ol>
    <div class="axis axis--under" aria-hidden="true"><span>${esc(tx.less)}</span><i></i><span>${esc(tx.more)}</span></div>
  </div>`;
}

/** Bouton de thème clair / sombre. `labels()` renvoie les textes dans la langue courante. */
export function setupTheme(button, labels) {
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const current = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');
  const update = () => {
    const label = current() === 'dark' ? labels().themeToLight : labels().themeToDark;
    button.setAttribute('aria-label', label);
    button.title = label;
  };
  button.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* non mémorisé */ }
    update();
  });
  systemDark.addEventListener('change', update);
  update();
  return update;
}

/** QR code SVG d'une adresse (bibliothèque qrcode-generator), ou chaîne vide si indisponible. */
export function qrSvg(url, alt) {
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 4, scalable: true, alt });
  } catch {
    return '';
  }
}

/* ---------- Détail d'une carte (étapes 2 à 4 et page d'animation) ---------- */

let detailId = null;

/** Contenu détaillé d'une carte : définition et exemples, comme à l'étape 1. */
export function cardDetailBody(id, lang) {
  const c = MOTIVATORS[id][lang];
  return `<p class="tagline">${esc(c.tagline)}</p>
    <p class="examples-label">${esc(UI[lang].examples)}</p>
    <ul class="examples">${c.examples.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
}

/** Affiche le panneau de détail (non modal, en bas de l'écran) ; un second clic sur la même carte le ferme. */
export function showCardDetail(id, lang, { toggle = true } = {}) {
  let panel = $('#card-detail');
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = 'card-detail';
    panel.className = 'card-detail';
    panel.setAttribute('aria-live', 'polite');
    panel.hidden = true;
    document.body.append(panel);
    panel.addEventListener('click', (e) => { if (e.target.closest('[data-close-detail]')) hideCardDetail(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) hideCardDetail(); });
  }
  if (toggle && detailId === id && !panel.hidden) { hideCardDetail(); return; }
  detailId = id;
  panel.style.setProperty('--h', MOTIVATORS[id].hue);
  panel.setAttribute('aria-label', MOTIVATORS[id][lang].name);
  panel.innerHTML = `<div class="card-detail-head">
      ${card(id, lang, 'mcard--mini')}
      <h2>${esc(MOTIVATORS[id][lang].name)}</h2>
      <button type="button" class="icon-btn" data-close-detail aria-label="${esc(UI[lang].detailClose)}" title="${esc(UI[lang].detailClose)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
    </div>
    <div class="card-detail-body">${cardDetailBody(id, lang)}</div>`;
  panel.hidden = false;
  document.body.classList.add('has-detail');
}

export function hideCardDetail() {
  const panel = $('#card-detail');
  if (panel) panel.hidden = true;
  detailId = null;
  document.body.classList.remove('has-detail');
}

/** Rafraîchit le panneau ouvert (changement de langue). */
export function refreshCardDetail(lang) {
  if (detailId && !$('#card-detail')?.hidden) showCardDetail(detailId, lang, { toggle: false });
}

/* ---------- Actions (débrief individuel et séance d'équipe) ---------- */

export function actionRowHtml(a, lang) {
  const tx = UI[lang];
  const ids = Object.keys(MOTIVATORS);
  return `<li class="action" data-action="${esc(a.id)}">
    <label class="field-wrap action-what"><span class="field-label">${esc(tx.actionWhat)}</span>
      <textarea class="field" rows="2" data-field="what" maxlength="500" placeholder="${esc(tx.actionWhatPlaceholder)}">${esc(a.what)}</textarea></label>
    <label class="field-wrap action-which"><span class="field-label">${esc(tx.actionWhich)}</span>
      <select class="field" data-field="motivator">
        <option value="">${esc(tx.actionNone)}</option>
        ${ids.map((id) => `<option value="${id}" ${a.motivator === id ? 'selected' : ''}>${esc(MOTIVATORS[id][lang].name)}</option>`).join('')}
      </select></label>
    <label class="field-wrap action-who"><span class="field-label">${esc(tx.actionWho)}</span>
      <input class="field" data-field="who" maxlength="120" value="${esc(a.who)}" placeholder="${esc(tx.actionWhoPlaceholder)}"></label>
    <label class="field-wrap action-when"><span class="field-label">${esc(tx.actionWhen)}</span>
      <input class="field" type="date" data-field="when" value="${esc(a.when)}" min="${today()}"></label>
    <button type="button" class="icon-btn" data-remove aria-label="${esc(tx.removeAction)}" title="${esc(tx.removeAction)}">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
  </li>`;
}

/**
 * Saisie dans une ligne d'action : met à jour l'action correspondante.
 * Renvoie vrai si une valeur a changé. Une échéance dans le passé est refusée.
 */
export function applyActionInput(e, actions, lang) {
  const row = e.target.closest('.action');
  const field = e.target.dataset.field;
  if (!row || !field) return false;
  const a = actions.find((x) => x.id === row.dataset.action);
  if (!a) return false;
  if (field === 'when' && e.target.value && e.target.value < today()) {
    if (e.type === 'change') {
      e.target.value = a.when && a.when >= today() ? a.when : '';
      toast(UI[lang].actionPastDate);
    }
    return false;
  }
  if (a[field] === e.target.value) return false;
  a[field] = e.target.value;
  return true;
}

export function formatDate(iso, lang) {
  if (!iso) return '';
  const [y, mo, d] = iso.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Tableau imprimable des actions (ou « aucune »). */
export function printActionsHtml(actions, lang) {
  const tx = UI[lang];
  const list = actions.filter((a) => a.what.trim() || a.who.trim() || a.when || a.motivator);
  if (!list.length) return `<p>${esc(tx.reportNone)}</p>`;
  return `<table class="print-actions">
    <thead><tr><th>${esc(tx.actionWhat)}</th><th>${esc(tx.actionWhich)}</th><th>${esc(tx.actionWho)}</th><th>${esc(tx.actionWhen)}</th></tr></thead>
    <tbody>${list.map((a) => `<tr><td>${esc(a.what.trim())}</td><td>${a.motivator ? esc(MOTIVATORS[a.motivator][lang].name) : ''}</td><td>${esc(a.who.trim())}</td><td>${esc(formatDate(a.when, lang))}</td></tr>`).join('')}</tbody>
  </table>`;
}

/** Lignes texte des actions et des notes, pour les comptes rendus copiés. */
export function actionsNotesLines(actions, notes, lang) {
  const tx = UI[lang];
  const colon = lang === 'en' ? ':' : ' :';
  const list = actions.filter((a) => a.what.trim());
  const lines = ['', `${tx.reportActions}${colon}${list.length ? '' : ` ${tx.reportNone}`}`];
  for (const a of list) {
    const meta = [a.motivator ? MOTIVATORS[a.motivator][lang].name : '', a.who.trim(), a.when].filter(Boolean).join(', ');
    lines.push(`- ${a.what.trim()}${meta ? ` (${meta})` : ''}`);
  }
  if (notes.trim()) lines.push('', `${tx.reportNotes}${colon}`, notes.trim());
  return lines;
}

/** Nom de fichier sans accents ni espaces. */
export function slugify(value, fallback) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || fallback;
}

/** Télécharge un objet en fichier .json. */
export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
