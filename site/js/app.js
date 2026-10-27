// Interface : rendu des quatre étapes, glisser-déposer (souris, tactile, clavier), langue, thème, export.

import { MOTIVATORS, UI } from './i18n.js?v=__VERSION__';
import {
  newSession, moveTo, moveBy, setLevel, clampLevel, analyze, newAction, sanitize, buildReport,
  rankingDone, placeTop, reorderPlaced, resetRanking, MIN_LEVEL, MAX_LEVEL,
} from './core.js?v=__VERSION__';
import {
  $, $$, esc, stackMQ, reduceMotion, isStacked, posOf, initialLang, rememberLang, today, announce, toast,
  copyText, card as cardFor, lanesBoard as lanesBoardFor, levelLabelsFor, setupTheme,
  cardDetailBody, showCardDetail, hideCardDetail, refreshCardDetail,
} from './shared.js?v=__VERSION__';
import { initTeam, teamSetupNote, sharePanel, bindSharePanel, boardChanged, sessionKey } from './team-participant.js?v=__VERSION__';

const main = $('#main');

let lang = initialLang();
const team = initTeam({ getLang: () => lang, getState: () => state, rerender: () => render(), save: () => save() });
const STORE_KEY = sessionKey(team.sid);
let state = loadSession();
if (team.sid) team.applyMeta(state);

/* ---------- Stockage ---------- */

function loadSession() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch { /* séance absente ou illisible : on repart de zéro */ }
  return newSession();
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* non mémorisé */ }
  boardChanged();
}

/* ---------- Aides ---------- */

const t = () => UI[lang];
const m = (id) => MOTIVATORS[id][lang];
const stacked = isStacked;
const levelLabels = () => levelLabelsFor(lang, state.mode);
const card = (id, cls = '') => cardFor(id, lang, cls);

/* ---------- Cadre : en-tête, étapes, langue, thème ---------- */

function renderChrome() {
  const tx = t();
  document.documentElement.lang = tx.htmlLang;
  document.title = `${tx.title} · ${tx.steps[state.step - 1]}`;
  $('#stepper').innerHTML = tx.steps.map((label, i) => {
    const n = i + 1;
    const current = n === state.step;
    return `<li><button type="button" data-step="${n}" ${n > state.reached || (n > 2 && !rankingDone(state)) ? 'disabled' : ''} ${current ? 'aria-current="step"' : ''} aria-label="${esc(`${tx.stepOf(n)} : ${label}`)}"><span class="step-n">${n}</span><span class="step-label">${esc(label)}</span></button></li>`;
  }).join('');
  $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  $('.lang').setAttribute('aria-label', tx.langLabel);
  $('#footer-text').textContent = tx.footer;
  $('#host-link').textContent = tx.hostLink;
  team.renderBanner();
  updateThemeButton();
}

function goTo(step) {
  state.step = Math.max(1, Math.min(rankingDone(state) ? 4 : 2, step));
  hideCardDetail();
  state.reached = Math.max(state.reached, state.step);
  if (state.step === 4 && !state.date) state.date = today();
  save();
  render();
  window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  $('#main h1')?.focus({ preventScroll: true });
}

function navButtons(nextLabel, blockedReason = null) {
  return `<div class="stepnav">
    ${state.step > 1 ? `<button type="button" class="btn btn-quiet" data-go="${state.step - 1}">${esc(t().back)}</button>` : '<span></span>'}
    ${nextLabel ? `<span class="next-wrap">${blockedReason ? `<span class="hint">${esc(blockedReason)}</span>` : ''}<button type="button" class="btn btn-primary" data-go="${state.step + 1}" ${blockedReason ? 'disabled' : ''}>${esc(nextLabel)}</button></span>` : ''}
  </div>`;
}

/* ---------- Étape 1 : découvrir ---------- */

function renderStep1() {
  const tx = t();
  const deck = Object.keys(MOTIVATORS);
  return `
  <div class="intro">
    <h1 tabindex="-1">${esc(tx.s1Title)}</h1>
    <p class="lede">${esc(tx.s1Lede)}</p>
  </div>
  <ul class="deck-strip" aria-label="${esc(tx.s1DeckLabel)}">
    ${deck.map((id) => `<li><button type="button" class="deck-card" data-detail="${id}" aria-label="${esc(m(id).name)}">${card(id, 'mcard--board')}</button></li>`).join('')}
  </ul>
  <p class="hint deck-hint">${esc(tx.s1DeckHint)}</p>
  <form class="setup" id="setup" autocomplete="off">
    <h2>${esc(tx.setupTitle)}</h2>
    <div class="setup-grid">
      <label class="field-wrap">
        <span class="field-label">${esc(tx.nameLabel)}</span>
        <input class="field" name="name" maxlength="80" value="${esc(state.name)}" placeholder="${esc(tx.namePlaceholder)}" autocapitalize="words" spellcheck="false">
      </label>
      ${team.sid ? teamSetupNote() : `<fieldset class="modes">
        <legend class="field-label">${esc(tx.modeLabel)}</legend>
        ${['today', 'change'].map((mode) => `
          <label class="mode">
            <input type="radio" name="mode" value="${mode}" ${state.mode === mode ? 'checked' : ''}>
            <span><strong>${esc(mode === 'today' ? tx.modeToday : tx.modeChange)}</strong>
            <small>${esc(mode === 'today' ? tx.modeTodayHint : tx.modeChangeHint)}</small></span>
          </label>`).join('')}
      </fieldset>
      <label class="field-wrap change-wrap" ${state.mode === 'change' ? '' : 'hidden'}>
        <span class="field-label">${esc(tx.changeLabel)}</span>
        <input class="field" name="change" maxlength="200" value="${esc(state.change)}" placeholder="${esc(tx.changePlaceholder)}">
      </label>`}
    </div>
  </form>
  ${navButtons(tx.s1Next)}`;
}

function bindStep1() {
  main.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-detail]');
    if (btn) showCardDetail(btn.dataset.detail, lang);
  }, { signal: stepSignal() });
  const form = $('#setup');
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('input', (e) => {
    const { name, value } = e.target;
    if (name === 'name') state.name = value.slice(0, 80);
    if (name === 'change') state.change = value.slice(0, 200);
    if (name === 'mode') {
      state.mode = value;
      $('.change-wrap', form).hidden = value !== 'change';
    }
    save();
  });
}

/* ---------- Étape 2 : classer (pioche, puis tableau) ---------- */

const PLUS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>';

function rankItem(id) {
  const tx = t();
  const total = state.placed.length;
  const pos = state.placed.indexOf(id) + 1;
  return `<li class="rank-item" data-id="${id}" tabindex="0" aria-label="${esc(tx.rankAnnounce(m(id).name, pos, total))}">
    ${card(id, 'mcard--board')}
    <span class="rank-moves">
      <button type="button" class="nudge" data-nudge="-1" aria-label="${esc(tx.moveLess(m(id).name))}" ${pos === 1 ? 'disabled' : ''}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg></button>
      <button type="button" class="nudge" data-nudge="1" aria-label="${esc(tx.moveMore(m(id).name))}" ${pos === total ? 'disabled' : ''}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg></button>
    </span>
  </li>`;
}

function slot(index) {
  const tx = t();
  const top = state.pile[0];
  const total = state.placed.length + 1;
  const empty = state.placed.length === 0;
  return `<li class="slot-item"><button type="button" class="slot" data-slot="${index}" aria-label="${esc(tx.placeHere(m(top).name, index + 1, total))}">
    ${PLUS}${empty ? `<span>${esc(tx.placeFirst)}</span>` : ''}</button></li>`;
}

function rowHtml() {
  if (rankingDone(state)) return state.placed.map(rankItem).join('');
  const parts = [slot(0)];
  state.placed.forEach((id, i) => { parts.push(rankItem(id), slot(i + 1)); });
  return parts.join('');
}

function pileHtml() {
  const tx = t();
  if (rankingDone(state)) {
    return `<div class="pile pile--done">
      <p>${esc(tx.pileDone)}</p>
      <button type="button" class="btn btn-quiet btn-small" id="pile-reset">${esc(tx.pileReset)}</button>
    </div>`;
  }
  const top = state.pile[0];
  const k = state.placed.length + 1;
  return `<div class="pile">
    <div class="pile-stack" style="--left:${state.pile.length - 1}" aria-hidden="true">
      ${state.pile.length > 2 ? '<span class="pile-back pile-back--2"></span>' : ''}
      ${state.pile.length > 1 ? '<span class="pile-back pile-back--1"></span>' : ''}
      <div class="pile-top" id="pile-top" data-id="${top}">${card(top, 'mcard--full')}</div>
    </div>
    <div class="pile-text">
      <p class="pile-count">${esc(tx.pileCount(k))}</p>
      <h2>${esc(m(top).name)}</h2>
      ${cardDetailBody(top, lang)}
      <p class="hint pile-hint">${esc(tx.pileHint)}</p>
    </div>
  </div>`;
}

function renderStep2() {
  const tx = t();
  const done = rankingDone(state);
  return `
  <div class="intro">
    <h1 tabindex="-1">${esc(tx.s2Title)}</h1>
    <p class="lede">${esc(stacked() ? tx.s2LedeStack : tx.s2Lede)}</p>
    <p class="hint">${esc(tx.s2Keys)} ${esc(tx.detailHint)}</p>
  </div>
  <div id="pile-area">${pileHtml()}</div>
  <div class="table rankboard">
    <div class="axis" aria-hidden="true"><span>${esc(tx.less)}</span><i></i><span>${esc(tx.more)}</span></div>
    <ol class="rankrow ${done ? 'is-done' : 'is-placing'} ${state.placed.length ? '' : 'is-empty'}" id="rankrow">${rowHtml()}</ol>
  </div>
  ${navButtons(tx.s2Next, done ? null : tx.s2NotDone)}`;
}

/** Redessine la pioche, le tableau et la navigation après un changement. */
function refreshStep2(focus) {
  const done = rankingDone(state);
  $('#pile-area').innerHTML = pileHtml();
  const row = $('#rankrow');
  row.className = `rankrow ${done ? 'is-done' : 'is-placing'} ${state.placed.length ? '' : 'is-empty'}`;
  row.innerHTML = rowHtml();
  $('.stepnav').outerHTML = navButtons(t().s2Next, done ? null : t().s2NotDone);
  renderChrome();
  if (focus?.id) {
    $(`.rank-item[data-id="${focus.id}"]`)?.focus({ preventScroll: true });
  } else if (focus?.slot !== undefined) {
    ($(`.slot[data-slot="${focus.slot}"]`) ?? $('.slot'))?.focus({ preventScroll: true });
  }
}

function placeAt(index) {
  const id = state.pile[0];
  state = placeTop(state, index);
  save();
  const pos = state.placed.indexOf(id) + 1;
  refreshStep2(rankingDone(state) ? { id } : { slot: pos });
  announce(t().placedAnnounce(m(id).name, pos, state.placed.length));
}

function commitOrder(order, focusId) {
  state = reorderPlaced(state, order);
  save();
  refreshStep2(focusId ? { id: focusId } : null);
  if (focusId) announce(t().rankAnnounce(m(focusId).name, state.placed.indexOf(focusId) + 1, state.placed.length));
}

function bindStep2() {
  const row = $('#rankrow');

  main.addEventListener('click', onStep2Click, { signal: stepSignal() });

  row.addEventListener('keydown', (e) => {
    const item = e.target.closest('.rank-item');
    if (!item || e.target !== item) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      showCardDetail(item.dataset.id, lang);
      return;
    }
    const keys = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: 1, ArrowDown: -1 };
    let next = null;
    if (e.key in keys) next = moveBy(state.placed, item.dataset.id, keys[e.key]);
    if (e.key === 'Home') next = moveTo(state.placed, item.dataset.id, 0);
    if (e.key === 'End') next = moveTo(state.placed, item.dataset.id, state.placed.length - 1);
    if (next) {
      e.preventDefault();
      commitOrder(next, item.dataset.id);
    }
  });

  let drag = null;

  // Glisser : une carte du tableau (réordonner) ou la carte de la pioche (poser).
  main.addEventListener('pointerdown', onStep2Down, { signal: stepSignal() });

  function onStep2Down(e) {
    if (state.step !== 2 || e.button !== 0 || e.target.closest('button')) return;
    const item = e.target.closest('.rank-item');
    const top = e.target.closest('#pile-top');
    if (!item && !top) return;
    const source = item ?? top;
    const rect = source.getBoundingClientRect();
    drag = { item, top, source, startX: e.clientX, startY: e.clientY, offX: e.clientX - rect.left, offY: e.clientY - rect.top, rect, active: false, pointerId: e.pointerId };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function begin() {
    const r = $('#rankrow');
    drag.active = true;
    hideCardDetail();
    r.classList.add('is-dragging');
    // Taille d'une carte du tableau, pour l'emplacement fantôme.
    const sample = r.querySelector('.rank-item') ?? null;
    const sr = drag.item ? drag.rect : sample?.getBoundingClientRect();
    drag.placeholder = document.createElement('li');
    drag.placeholder.className = 'rank-placeholder';
    if (sr) {
      drag.placeholder.style.width = `${sr.width}px`;
      drag.placeholder.style.height = `${sr.height}px`;
    }
    if (drag.item) {
      drag.item.before(drag.placeholder);
      drag.ghost = drag.item;
    } else {
      // La carte de la pioche : on déplace une copie, l'originale reste en place, estompée.
      drag.ghost = drag.top.cloneNode(true);
      drag.ghost.removeAttribute('id');
      drag.ghost.classList.add('pile-ghost');
      document.body.append(drag.ghost);
      drag.top.classList.add('is-lifted');
    }
    drag.ghost.classList.add('is-dragging');
    Object.assign(drag.ghost.style, { position: 'fixed', left: `${drag.rect.left}px`, top: `${drag.rect.top}px`, width: `${drag.rect.width}px`, height: `${drag.rect.height}px`, zIndex: 50, margin: 0 });
    document.body.classList.add('is-grabbing');
  }

  function overBoard(e) {
    const b = $('.rankboard').getBoundingClientRect();
    const pad = 40;
    return e.clientX > b.left - pad && e.clientX < b.right + pad && e.clientY > b.top - pad && e.clientY < b.bottom + pad;
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
      begin();
    }
    e.preventDefault();
    const r = $('#rankrow');
    const { ghost, placeholder } = drag;
    ghost.style.left = `${e.clientX - drag.offX}px`;
    ghost.style.top = `${e.clientY - drag.offY}px`;

    if (!drag.item && !overBoard(e)) {
      placeholder.remove();
      drag.index = null;
      return;
    }
    const items = [...r.querySelectorAll('.rank-item')].filter((c) => c !== drag.item);
    const before = items.filter((c) => {
      const b = c.getBoundingClientRect();
      return stacked() ? b.top + b.height / 2 > e.clientY : b.left + b.width / 2 < e.clientX;
    }).length;
    if (drag.index === before && placeholder.isConnected) return;
    drag.index = before;
    const first = new Map(items.map((c) => [c, c.getBoundingClientRect()]));
    const ref = items[before] ?? null;
    if (ref) r.insertBefore(placeholder, ref.previousElementSibling?.classList.contains('slot-item') ? ref.previousElementSibling : ref);
    else r.append(placeholder);
    if (reduceMotion.matches) return;
    for (const c of items) {
      const a = first.get(c);
      const b = c.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (!dx && !dy) continue;
      c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 160, easing: 'ease-out' });
    }
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    const d = drag;
    drag = null;
    document.body.classList.remove('is-grabbing');
    if (!d.active) {
      // Simple clic sur une carte du tableau : détail de la carte.
      if (d.item) showCardDetail(d.item.dataset.id, lang);
      return;
    }
    $('#rankrow')?.classList.remove('is-dragging');
    d.placeholder.remove();
    if (d.item) {
      d.item.removeAttribute('style');
      d.item.classList.remove('is-dragging');
      const order = state.placed.filter((id) => id !== d.item.dataset.id);
      order.splice(d.index ?? state.placed.indexOf(d.item.dataset.id), 0, d.item.dataset.id);
      commitOrder(order, d.item.dataset.id);
    } else {
      d.ghost.remove();
      d.top.classList.remove('is-lifted');
      if (d.index === null || d.index === undefined) return;
      placeAt(d.index);
    }
  }
}

function onStep2Click(e) {
  if (state.step !== 2) return;
  const slotBtn = e.target.closest('[data-slot]');
  if (slotBtn) { placeAt(Number(slotBtn.dataset.slot)); return; }
  const nudge = e.target.closest('[data-nudge]');
  if (nudge) {
    const id = nudge.closest('.rank-item').dataset.id;
    commitOrder(moveBy(state.placed, id, Number(nudge.dataset.nudge)), id);
    return;
  }
  if (e.target.closest('#pile-reset') && window.confirm(t().pileResetConfirm)) {
    state = resetRanking(state);
    save();
    refreshStep2({ slot: 0 });
  }
}

/* ---------- Étape 3 : évaluer (et tableau en lecture seule du débrief) ---------- */

function lanesBoard({ readOnly = false } = {}) {
  return lanesBoardFor({ order: state.order, levels: state.levels, mode: state.mode, lang, readOnly, id: readOnly ? '' : 'lanes' });
}

function renderStep3() {
  const tx = t();
  const c = state.change.trim();
  const lede = state.mode === 'change'
    ? (stacked() ? tx.s3LedeStackChange(c) : tx.s3LedeChange(c))
    : (stacked() ? tx.s3LedeStackToday : tx.s3LedeToday);
  return `
  <div class="intro">
    <h1 tabindex="-1">${esc(tx.s3Title)}</h1>
    <p class="lede">${esc(lede)}</p>
    <p class="hint">${esc(tx.s3Keys)} ${esc(tx.detailHint)}</p>
  </div>
  ${lanesBoard()}
  ${navButtons(tx.s3Next)}`;
}

function applyLevel(holder, id, level, announceIt) {
  const lvl = clampLevel(level);
  state.levels = setLevel(state.levels, id, lvl);
  save();
  holder.style.setProperty('--pos', posOf(lvl));
  holder.dataset.level = lvl;
  holder.setAttribute('aria-valuenow', lvl);
  holder.setAttribute('aria-valuetext', levelLabels()[String(lvl)]);
  if (announceIt) announce(t().levelAnnounce(m(id).name, levelLabels()[String(lvl)]));
}

function posFromPointer(track, holder, e, grabOffset) {
  const r = track.getBoundingClientRect();
  if (stacked()) {
    const w = holder.offsetWidth;
    return Math.max(0, Math.min(1, (e.clientX - grabOffset - r.left) / Math.max(1, r.width - w)));
  }
  const h = holder.offsetHeight;
  return Math.max(0, Math.min(1, 1 - (e.clientY - grabOffset - r.top) / Math.max(1, r.height - h)));
}

function bindStep3() {
  const lanes = $('#lanes');

  lanes.addEventListener('keydown', (e) => {
    const holder = e.target.closest('.lane-card');
    if (!holder) return;
    const id = holder.closest('.lane').dataset.id;
    const current = state.levels[id] ?? 0;
    const map = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 };
    let next = null;
    if (e.key in map) next = current + map[e.key];
    if (e.key === 'Home' || e.key === 'PageDown') next = MIN_LEVEL;
    if (e.key === 'End' || e.key === 'PageUp') next = MAX_LEVEL;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      showCardDetail(id, lang);
      return;
    }
    if (next === null) return;
    e.preventDefault();
    applyLevel(holder, id, next, true);
  });

  lanes.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const track = e.target.closest('.track');
    if (!track) return;
    const holder = $('.lane-card', track);
    const id = track.dataset.id;
    const onCard = holder.contains(e.target);
    const hr = holder.getBoundingClientRect();
    // Prise sur la carte : on garde le point de saisie ; clic sur la piste : la carte se centre sous le pointeur.
    const grabOffset = onCard
      ? (stacked() ? e.clientX - hr.left : e.clientY - hr.top)
      : (stacked() ? hr.width / 2 : hr.height / 2);
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    holder.setPointerCapture(e.pointerId);
    holder.classList.add('is-dragging');
    holder.focus({ preventScroll: true });
    if (!onCard) holder.style.setProperty('--pos', posFromPointer(track, holder, e, grabOffset));
    const move = (ev) => {
      ev.preventDefault();
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
      moved = true;
      holder.style.setProperty('--pos', posFromPointer(track, holder, ev, grabOffset));
    };
    const up = (ev) => {
      holder.removeEventListener('pointermove', move);
      holder.removeEventListener('pointerup', up);
      holder.removeEventListener('pointercancel', up);
      holder.classList.remove('is-dragging');
      // Simple clic sur la carte : elle ne bouge pas, on affiche son détail.
      if (onCard && !moved) {
        showCardDetail(id, lang);
        return;
      }
      const pos = posFromPointer(track, holder, ev, grabOffset);
      applyLevel(holder, id, Math.round(pos * (MAX_LEVEL - MIN_LEVEL)) + MIN_LEVEL, true);
    };
    holder.addEventListener('pointermove', move);
    holder.addEventListener('pointerup', up);
    holder.addEventListener('pointercancel', up);
    e.preventDefault();
  });
}

/* ---------- Étape 4 : débriefer ---------- */

function actionRow(a) {
  const tx = t();
  const ids = Object.keys(MOTIVATORS);
  return `<li class="action" data-action="${esc(a.id)}">
    <label class="field-wrap action-what"><span class="field-label">${esc(tx.actionWhat)}</span>
      <textarea class="field" rows="2" data-field="what" maxlength="500" placeholder="${esc(tx.actionWhatPlaceholder)}">${esc(a.what)}</textarea></label>
    <label class="field-wrap action-which"><span class="field-label">${esc(tx.actionWhich)}</span>
      <select class="field" data-field="motivator">
        <option value="">${esc(tx.actionNone)}</option>
        ${ids.map((id) => `<option value="${id}" ${a.motivator === id ? 'selected' : ''}>${esc(m(id).name)}</option>`).join('')}
      </select></label>
    <label class="field-wrap action-who"><span class="field-label">${esc(tx.actionWho)}</span>
      <input class="field" data-field="who" maxlength="120" value="${esc(a.who)}" placeholder="${esc(tx.actionWhoPlaceholder)}"></label>
    <label class="field-wrap action-when"><span class="field-label">${esc(tx.actionWhen)}</span>
      <input class="field" type="date" data-field="when" value="${esc(a.when)}" min="${today()}"></label>
    <button type="button" class="icon-btn" data-remove aria-label="${esc(tx.removeAction)}" title="${esc(tx.removeAction)}">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
  </li>`;
}

function insight(item, withQuestions) {
  const tx = t();
  const labels = levelLabels();
  return `<li class="insight" style="--h:${MOTIVATORS[item.id].hue}">
    <div class="insight-head">
      ${card(item.id, 'mcard--mini')}
      <div>
        <h4>${esc(m(item.id).name)}</h4>
        <p class="insight-meta">${item.rank}/10 · ${esc(labels[String(item.level)])}</p>
      </div>
    </div>
    ${withQuestions === 'questions' ? `<ul class="questions">${m(item.id).questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>
      <button type="button" class="btn btn-quiet btn-small" data-add-action="${item.id}">${esc(tx.addActionFor(m(item.id).name))}</button>` : ''}
    ${withQuestions === 'keep' ? `<ul class="questions"><li>${esc(tx.strengthQuestion)}</li></ul>` : ''}
  </li>`;
}

function renderStep4() {
  const tx = t();
  const { priority, strengths, watch } = analyze(state);
  return `
  <div class="intro">
    <h1 tabindex="-1">${esc(tx.s4Title)}</h1>
    <p class="lede">${esc(tx.s4Lede)}</p>
  </div>
  <header class="print-report print-head" id="print-head" aria-hidden="true"></header>
  ${sharePanel()}

  <section class="debrief-board" aria-labelledby="board-title">
    <h2 id="board-title">${esc(tx.boardTitle)}${state.name ? ` · ${esc(state.name)}` : ''}</h2>
    <p class="hint">${esc(tx.detailHint)}</p>
    ${lanesBoard({ readOnly: true })}
  </section>

  <section class="panel panel--discussion" aria-labelledby="gen-title">
    <h2 id="gen-title">${esc(tx.generalTitle)}</h2>
    <ol class="discussion">${tx.generalQuestions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
  </section>

  <div class="debrief-grid">
    <section class="panel panel--priority" aria-labelledby="prio-title">
      <h2 id="prio-title">${esc(tx.priorityTitle)}</h2>
      <p class="panel-hint">${esc(state.mode === 'change' ? tx.priorityHintChange : tx.priorityHint)}</p>
      ${priority.length ? `<ul class="insights">${priority.map((i) => insight(i, 'questions')).join('')}</ul>` : `<p class="empty">${esc(tx.priorityEmpty)}</p>`}
    </section>

    <div class="debrief-side">
      <section class="panel" aria-labelledby="str-title">
        <h2 id="str-title">${esc(tx.strengthTitle)}</h2>
        <p class="panel-hint">${esc(tx.strengthHint)}</p>
        ${strengths.length ? `<ul class="insights">${strengths.map((i) => insight(i, 'keep')).join('')}</ul>` : `<p class="empty">${esc(tx.strengthEmpty)}</p>`}
      </section>
      ${watch.length ? `<section class="panel" aria-labelledby="watch-title">
        <h2 id="watch-title">${esc(tx.watchTitle)}</h2>
        <p class="panel-hint">${esc(tx.watchHint)}</p>
        <ul class="insights">${watch.map((i) => insight(i, 'questions')).join('')}</ul>
      </section>` : ''}
    </div>
  </div>

  <section class="panel panel--actions" aria-labelledby="act-title">
    <h2 id="act-title">${esc(tx.actionsTitle)}</h2>
    <ol class="actions" id="actions">${state.actions.map(actionRow).join('')}</ol>
    <p class="empty" id="actions-empty" ${state.actions.length ? 'hidden' : ''}>${esc(tx.actionsEmpty)}</p>
    <button type="button" class="btn btn-quiet" data-add-action="">${esc(tx.addAction)}</button>
  </section>

  <section class="panel" aria-labelledby="notes-title">
    <h2 id="notes-title"><label for="notes">${esc(tx.notesTitle)}</label></h2>
    <textarea class="field notes" id="notes" rows="4" maxlength="2000" placeholder="${esc(tx.notesPlaceholder)}">${esc(state.notes)}</textarea>
  </section>

  <section class="panel panel--export" aria-labelledby="exp-title">
    <h2 id="exp-title">${esc(tx.exportTitle)}</h2>
    <div class="export-row">
      <button type="button" class="btn btn-primary" id="copy-report">${esc(tx.copyReport)}</button>
      <button type="button" class="btn btn-quiet" id="print">${esc(tx.print)}</button>
      <button type="button" class="btn btn-quiet" id="save-json">${esc(tx.saveJson)}</button>
      <button type="button" class="btn btn-quiet" id="open-json">${esc(tx.openJson)}</button>
      <button type="button" class="btn btn-danger" id="reset">${esc(tx.reset)}</button>
    </div>
    <p class="hint">${esc(tx.privacy)}</p>
  </section>

  <section class="print-report" id="print-report" aria-hidden="true"></section>
  ${navButtons(null)}`;
}

function addAction(motivator) {
  const a = newAction(motivator);
  state.actions.push(a);
  save();
  $('#actions').insertAdjacentHTML('beforeend', actionRow(a));
  $('#actions-empty').hidden = true;
  $(`.action[data-action="${a.id}"] textarea`).focus();
}

function bindStep4() {
  bindSharePanel();
  main.addEventListener('click', onStep4Click, { signal: stepSignal() });
  const actions = $('#actions');
  const update = (e) => {
    const row = e.target.closest('.action');
    const field = e.target.dataset.field;
    if (!row || !field) return;
    const a = state.actions.find((x) => x.id === row.dataset.action);
    if (!a) return;
    // Une échéance ne peut pas être dans le passé.
    if (field === 'when' && e.target.value && e.target.value < today()) {
      if (e.type === 'change') {
        e.target.value = a.when && a.when >= today() ? a.when : '';
        toast(t().actionPastDate);
      }
      return;
    }
    a[field] = e.target.value;
    save();
  };
  actions.addEventListener('input', update);
  actions.addEventListener('change', update);
  $('#notes').addEventListener('input', (e) => { state.notes = e.target.value; save(); });
}

function onStep4Click(e) {
  if (state.step !== 4) return;
  const cardEl = e.target.closest('.mcard[data-id]');
  if (cardEl) { showCardDetail(cardEl.dataset.id, lang); return; }
  const add = e.target.closest('[data-add-action]');
  if (add) { addAction(add.dataset.addAction); return; }
  const remove = e.target.closest('[data-remove]');
  if (remove) {
    const row = remove.closest('.action');
    state.actions = state.actions.filter((a) => a.id !== row.dataset.action);
    save();
    row.remove();
    $('#actions-empty').hidden = state.actions.length > 0;
    return;
  }
  if (e.target.closest('#copy-report')) copyReport();
  if (e.target.closest('#print')) { fillPrint(); window.print(); }
  if (e.target.closest('#save-json')) saveJson();
  if (e.target.closest('#open-json')) $('#file-input').click();
  if (e.target.closest('#reset') && window.confirm(t().resetConfirm)) {
    state = newSession();
    if (team.sid) team.applyMeta(state);
    save();
    goTo(1);
  }
}

const report = () => buildReport(state, t(), (id) => m(id).name);

function formatDate(iso) {
  if (!iso) return '';
  const [y, mo, d] = iso.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Version imprimable du débrief (tableau affiché au-dessus) : sujet, lecture, actions et notes. */
function fillPrint() {
  const el = $('#print-report');
  if (!el) return;
  const tx = t();
  const { priority, strengths, watch } = analyze(state);
  const names = (items) => (items.length ? items.map((i) => esc(m(i.id).name)).join(', ') : esc(tx.reportNone));
  const subject = state.mode === 'change' ? tx.reportModeChange(state.change.trim()) : tx.reportModeToday;
  const actions = state.actions.filter((a) => a.what.trim() || a.who.trim() || a.when || a.motivator);
  $('#print-head').innerHTML = `<h1>${esc(tx.reportTitle)}${state.name ? ` · ${esc(state.name)}` : ''}</h1>
    <p>${esc(subject)}${state.date ? ` · ${esc(formatDate(state.date))}` : ''}</p>`;
  el.innerHTML = `
    <dl class="print-read">
      <dt>${esc(tx.reportPriority)}</dt><dd>${names(priority)}</dd>
      <dt>${esc(tx.reportStrengths)}</dt><dd>${names(strengths)}</dd>
      <dt>${esc(tx.reportWatch)}</dt><dd>${names(watch)}</dd>
    </dl>
    <h2>${esc(tx.actionsTitle)}</h2>
    ${actions.length ? `<table class="print-actions">
      <thead><tr><th>${esc(tx.actionWhat)}</th><th>${esc(tx.actionWhich)}</th><th>${esc(tx.actionWho)}</th><th>${esc(tx.actionWhen)}</th></tr></thead>
      <tbody>${actions.map((a) => `<tr><td>${esc(a.what.trim())}</td><td>${a.motivator ? esc(m(a.motivator).name) : ''}</td><td>${esc(a.who.trim())}</td><td>${esc(formatDate(a.when))}</td></tr>`).join('')}</tbody>
    </table>` : `<p>${esc(tx.reportNone)}</p>`}
    ${state.notes.trim() ? `<h2>${esc(tx.notesTitle)}</h2><p class="print-notes">${esc(state.notes.trim())}</p>` : ''}`;
}

// Impression lancée depuis le navigateur (Ctrl+P / Cmd+P) : même contenu que le bouton.
window.addEventListener('beforeprint', () => { if (state.step === 4) fillPrint(); });

async function copyReport() {
  toast(await copyText(report()) ? t().copied : t().copyFailed);
}

function saveJson() {
  const slug = (state.name || 'seance').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'seance';
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `moving-motivators-${slug}-${state.date || today()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#file-input').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    state = sanitize(JSON.parse(await file.text()));
    if (team.sid) team.applyMeta(state);
    state.reached = 4;
    save();
    goTo(4);
    toast(t().opened);
  } catch {
    toast(t().openFailed);
  }
});

/* ---------- Rendu ---------- */

const STEPS = {
  1: [renderStep1, bindStep1],
  2: [renderStep2, bindStep2],
  3: [renderStep3, bindStep3],
  4: [renderStep4, bindStep4],
};

let stepAbort = null;
/** Écouteurs posés sur <main> pour l'étape affichée ; retirés au rendu suivant. */
const stepSignal = () => stepAbort.signal;

function render() {
  renderChrome();
  stepAbort?.abort();
  stepAbort = new AbortController();
  refreshCardDetail(lang);
  const [draw, bind] = STEPS[state.step];
  main.dataset.step = state.step;
  main.innerHTML = draw();
  bind();
}

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go], #stepper [data-step]');
  if (!go || go.disabled) return;
  goTo(Number(go.dataset.go ?? go.dataset.step));
});

$$('.lang button').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang;
  rememberLang(lang);
  render();
}));

// Le passage mobile / bureau change la disposition (pile ou rangée) : on redessine l'étape.
stackMQ.addEventListener('change', () => render());

/* ---------- Thème ---------- */

const updateThemeButton = setupTheme($('#theme-toggle'), t);

render();
