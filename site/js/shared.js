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
