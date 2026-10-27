// Côté participant d'une séance d'équipe (index.html?seance=…) : bandeau, sujet imposé par l'animateur,
// partage volontaire du tableau puis mise à jour automatique, retrait à tout moment.
// Firebase n'est chargé que dans une séance d'équipe : l'exercice seul reste entièrement local.

import { UI } from './i18n.js?v=__VERSION__';
import { $, esc, toast } from './shared.js?v=__VERSION__';
import { isSessionId, readMeta } from './team-core.js?v=__VERSION__';

let ctx = null;
let sid = null;
let store = null;
let meta = null;
let status = 'off'; // off | loading | ready | missing | offline
let shared = false;
let syncTimer = null;

const t = () => UI[ctx.getLang()];
const metaCacheKey = () => `moving-motivators.team.${sid}`;

/** Clé du stockage local : une séance d'équipe ne remplace pas l'exercice fait seul. */
export function sessionKey(id) {
  return id ? `moving-motivators.session.${id}` : 'moving-motivators.session';
}

export function initTeam(options) {
  ctx = options;
  const param = new URLSearchParams(location.search).get('seance');
  sid = isSessionId(param) ? param : null;
  if (sid) {
    status = 'loading';
    try { meta = readMeta(JSON.parse(localStorage.getItem(metaCacheKey()) || 'null')); } catch { meta = null; }
    connect();
  }
  return {
    sid,
    applyMeta(state) {
      if (!meta) return;
      state.mode = meta.mode;
      state.change = meta.change;
    },
    renderBanner,
  };
}

async function connect() {
  try {
    const { createTeamStore } = await import('./team-store.js?v=__VERSION__');
    store = createTeamStore();
    await store.start();
    store.onMeta(sid, (raw) => {
      const next = readMeta(raw);
      const before = JSON.stringify([status, meta]);
      if (next) {
        status = 'ready';
        meta = next;
        try { localStorage.setItem(metaCacheKey(), JSON.stringify(raw)); } catch { /* non mémorisé */ }
        const state = ctx.getState();
        state.mode = meta.mode;
        state.change = meta.change;
      } else {
        status = 'missing';
        meta = null;
      }
      if (JSON.stringify([status, meta]) !== before) ctx.rerender();
    }, () => { status = 'offline'; ctx.rerender(); });
    store.onMyBoard(sid, (raw) => {
      shared = Boolean(raw);
      refreshSharePanel();
    }, () => {});
  } catch {
    status = 'offline';
    ctx.rerender();
  }
}

export function renderBanner() {
  const el = $('#team-banner');
  if (!el) return;
  if (!sid) { el.hidden = true; return; }
  const tx = t();
  el.hidden = false;
  el.dataset.status = status;
  if (status === 'ready') {
    el.innerHTML = `<div class="wrap team-banner-in">
      <p><strong>${esc(tx.teamBadge(meta.title))}</strong></p>
      <p>${esc(meta.named ? tx.teamIntroNamed : tx.teamIntroAnon)}${meta.closed ? ` ${esc(tx.sessionClosed)}` : ''}</p>
    </div>`;
  } else {
    const message = { loading: tx.teamConnecting, missing: tx.teamMissing, offline: tx.teamOffline }[status] ?? '';
    el.innerHTML = `<div class="wrap team-banner-in"><p>${esc(message)}</p></div>`;
  }
}

/** Remplace le choix du sujet à l'étape 1 : c'est l'animateur qui l'a fixé. */
export function teamSetupNote() {
  const tx = t();
  const state = ctx.getState();
  const subject = state.mode === 'change'
    ? `${tx.modeChange}${state.change ? ` : ${state.change}` : ''}`
    : tx.modeToday;
  return `<div class="team-note">
    <span class="field-label">${esc(tx.modeLabel)}</span>
    <p>${esc(tx.teamModeFixed(subject))}</p>
  </div>`;
}

function sharePanelInner() {
  const tx = t();
  const state = ctx.getState();
  if (shared) {
    return `<h2 id="share-title">${esc(tx.shareTitle)}</h2>
      <p class="share-ok">${esc(tx.sharedState)}</p>
      <div><button type="button" class="btn btn-quiet" data-share="withdraw">${esc(tx.withdrawBtn)}</button></div>`;
  }
  if (meta.closed) {
    return `<h2 id="share-title">${esc(tx.shareTitle)}</h2><p class="panel-hint">${esc(tx.sessionClosed)}</p>`;
  }
  return `<h2 id="share-title">${esc(tx.shareTitle)}</h2>
    <p class="panel-hint">${esc(meta.named ? tx.teamIntroNamed : tx.teamIntroAnon)}</p>
    <div class="share-row">
      ${meta.named ? `<label class="field-wrap"><span class="field-label">${esc(tx.shareNameLabel)}</span>
        <input class="field" id="share-name" maxlength="50" value="${esc(state.name)}" autocomplete="given-name" autocapitalize="words" spellcheck="false"></label>` : ''}
      <button type="button" class="btn btn-primary" data-share="share">${esc(tx.shareBtn)}</button>
    </div>`;
}

/** Encadré de partage en tête du débrief (vide hors séance d'équipe). */
export function sharePanel() {
  if (!sid || status !== 'ready') return '';
  return `<section class="panel panel--share" id="share-panel" aria-labelledby="share-title">${sharePanelInner()}</section>`;
}

function refreshSharePanel() {
  const panel = $('#share-panel');
  if (panel) panel.innerHTML = sharePanelInner();
}

export function bindSharePanel() {
  const panel = $('#share-panel');
  if (!panel) return;
  panel.addEventListener('input', (e) => {
    if (e.target.id !== 'share-name') return;
    ctx.getState().name = e.target.value.slice(0, 50);
    ctx.save();
  });
  panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-share]');
    if (!btn || !store) return;
    const tx = t();
    const state = ctx.getState();
    if (btn.dataset.share === 'share') {
      if (meta.named && !state.name.trim()) {
        toast(tx.shareNameRequired);
        $('#share-name')?.focus();
        return;
      }
      btn.disabled = true;
      try {
        await store.shareBoard(sid, state, meta.named);
        shared = true;
        refreshSharePanel();
        toast(tx.sharedToast);
      } catch {
        btn.disabled = false;
        toast(tx.shareFailed);
      }
    } else {
      try {
        await store.withdrawBoard(sid);
        shared = false;
        refreshSharePanel();
        toast(tx.withdrawnToast);
      } catch {
        toast(tx.shareFailed);
      }
    }
  });
}

/** Après un partage, chaque changement de carte ou de prénom met à jour le tableau partagé. */
export function boardChanged() {
  if (!sid || !shared || !store || !meta) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    const state = ctx.getState();
    if (meta.named && !state.name.trim()) return;
    store.shareBoard(sid, state, meta.named).catch(() => {});
  }, 700);
}

