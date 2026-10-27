// Interface : rendu des quatre étapes, glisser-déposer (souris, tactile, clavier), langue, thème, export.

import { MOTIVATORS, UI } from './i18n.js?v=__VERSION__';
import {
  newSession, moveTo, moveBy, setLevel, clampLevel, analyze, newAction, sanitize, buildReport,
  MIN_LEVEL, MAX_LEVEL,
} from './core.js?v=__VERSION__';
import {
  $, $$, esc, stackMQ, reduceMotion, isStacked, posOf, initialLang, rememberLang, today, announce, toast,
  copyText, card as cardFor, lanesBoard as lanesBoardFor, levelLabelsFor, setupTheme,
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
    return `<li><button type="button" data-step="${n}" ${n > state.reached ? 'disabled' : ''} ${current ? 'aria-current="step"' : ''} aria-label="${esc(`${tx.stepOf(n)} : ${label}`)}"><span class="step-n">${n}</span><span class="step-label">${esc(label)}</span></button></li>`;
  }).join('');
  $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  $('.lang').setAttribute('aria-label', tx.langLabel);
  $('#footer-text').textContent = tx.footer;
  $('#host-link').textContent = tx.hostLink;
  team.renderBanner();
  updateThemeButton();
}

function goTo(step) {
  state.step = Math.max(1, Math.min(4, step));
  state.reached = Math.max(state.reached, state.step);
  if (state.step === 4 && !state.date) state.date = today();
  save();
  render();
  window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  $('#main h1')?.focus({ preventScroll: true });
}

function navButtons(nextLabel) {
  return `<div class="stepnav">
    ${state.step > 1 ? `<button type="button" class="btn btn-quiet" data-go="${state.step - 1}">${esc(t().back)}</button>` : '<span></span>'}
    ${nextLabel ? `<button type="button" class="btn btn-primary" data-go="${state.step + 1}">${esc(nextLabel)}</button>` : ''}
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
  <ul class="deck">
    ${deck.map((id) => `
      <li class="motive">
        ${card(id, 'mcard--full')}
        <div class="motive-text">
          <h3>${esc(m(id).name)}</h3>
          <p class="tagline">${esc(m(id).tagline)}</p>
          <p class="examples-label">${esc(tx.examples)}</p>
          <ul class="examples">${m(id).examples.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
        </div>
      </li>`).join('')}
  </ul>
  ${navButtons(tx.s1Next)}`;
}

function bindStep1() {
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

/* ---------- Étape 2 : classer ---------- */

function rankItem(id) {
  const tx = t();
  const pos = state.order.indexOf(id) + 1;
  return `<li class="rank-item" data-id="${id}" tabindex="0" aria-label="${esc(tx.rankAnnounce(m(id).name, pos))}">
    ${card(id, 'mcard--board')}
    <span class="rank-moves">
      <button type="button" class="nudge" data-nudge="-1" aria-label="${esc(tx.moveLess(m(id).name))}" ${pos === 1 ? 'disabled' : ''}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg></button>
      <button type="button" class="nudge" data-nudge="1" aria-label="${esc(tx.moveMore(m(id).name))}" ${pos === 10 ? 'disabled' : ''}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg></button>
    </span>
  </li>`;
}

function renderStep2() {
  const tx = t();
  return `
  <div class="intro">
    <h1 tabindex="-1">${esc(tx.s2Title)}</h1>
    <p class="lede">${esc(stacked() ? tx.s2LedeStack : tx.s2Lede)}</p>
    <p class="hint">${esc(tx.s2Keys)}</p>
  </div>
  <div class="table rankboard">
    <div class="axis" aria-hidden="true"><span>${esc(tx.less)}</span><i></i><span>${esc(tx.more)}</span></div>
    <ol class="rankrow" id="rankrow">${state.order.map(rankItem).join('')}</ol>
  </div>
  ${navButtons(tx.s2Next)}`;
}

function commitOrder(order, focusId) {
  state.order = order;
  save();
  $('#rankrow').innerHTML = state.order.map(rankItem).join('');
  if (focusId) {
    $(`.rank-item[data-id="${focusId}"]`)?.focus();
    announce(t().rankAnnounce(m(focusId).name, state.order.indexOf(focusId) + 1));
  }
}

function bindStep2() {
  const row = $('#rankrow');

  row.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-nudge]');
    if (!btn) return;
    const id = btn.closest('.rank-item').dataset.id;
    commitOrder(moveBy(state.order, id, Number(btn.dataset.nudge)), id);
  });

  row.addEventListener('keydown', (e) => {
    const item = e.target.closest('.rank-item');
    if (!item || e.target !== item) return;
    const keys = stacked()
      ? { ArrowUp: 1, ArrowDown: -1, ArrowRight: 1, ArrowLeft: -1 }
      : { ArrowRight: 1, ArrowLeft: -1, ArrowUp: 1, ArrowDown: -1 };
    let next = null;
    if (e.key in keys) next = moveBy(state.order, item.dataset.id, keys[e.key]);
    if (e.key === 'Home') next = moveTo(state.order, item.dataset.id, 0);
    if (e.key === 'End') next = moveTo(state.order, item.dataset.id, 9);
    if (next) {
      e.preventDefault();
      commitOrder(next, item.dataset.id);
    }
  });

  let drag = null;

  row.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('.rank-item');
    if (!item || e.button !== 0 || e.target.closest('button')) return;
    const rect = item.getBoundingClientRect();
    drag = { item, startX: e.clientX, startY: e.clientY, offX: e.clientX - rect.left, offY: e.clientY - rect.top, rect, active: false, pointerId: e.pointerId };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });

  function begin() {
    const { item, rect } = drag;
    drag.active = true;
    drag.placeholder = document.createElement('li');
    drag.placeholder.className = 'rank-placeholder';
    drag.placeholder.style.width = `${rect.width}px`;
    drag.placeholder.style.height = `${rect.height}px`;
    item.before(drag.placeholder);
    item.classList.add('is-dragging');
    Object.assign(item.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, zIndex: 50 });
    document.body.classList.add('is-grabbing');
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
      begin();
    }
    e.preventDefault();
    const { item, placeholder } = drag;
    item.style.left = `${e.clientX - drag.offX}px`;
    item.style.top = `${e.clientY - drag.offY}px`;

    const siblings = [...row.children].filter((c) => c !== item && c !== placeholder);
    const before = siblings.filter((c) => {
      const r = c.getBoundingClientRect();
      return stacked() ? r.top + r.height / 2 > e.clientY : r.left + r.width / 2 < e.clientX;
    }).length;
    const ref = siblings[before] ?? null;
    let after = placeholder.nextElementSibling;
    if (after === item) after = item.nextElementSibling;
    if (after === ref) return;
    // Animation FLIP des cartes qui se décalent.
    const first = new Map(siblings.map((c) => [c, c.getBoundingClientRect()]));
    row.insertBefore(placeholder, ref);
    if (reduceMotion.matches) return;
    for (const c of siblings) {
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
    const { item, placeholder, active } = drag;
    drag = null;
    document.body.classList.remove('is-grabbing');
    if (!active) return;
    placeholder.replaceWith(item);
    item.removeAttribute('style');
    item.classList.remove('is-dragging');
    commitOrder([...row.children].map((c) => c.dataset.id), item.dataset.id);
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
    <p class="hint">${esc(tx.s3Keys)}</p>
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
    holder.setPointerCapture(e.pointerId);
    holder.classList.add('is-dragging');
    holder.focus({ preventScroll: true });
    if (!onCard) holder.style.setProperty('--pos', posFromPointer(track, holder, e, grabOffset));
    const move = (ev) => {
      ev.preventDefault();
      holder.style.setProperty('--pos', posFromPointer(track, holder, ev, grabOffset));
    };
    const up = (ev) => {
      holder.removeEventListener('pointermove', move);
      holder.removeEventListener('pointerup', up);
      holder.removeEventListener('pointercancel', up);
      holder.classList.remove('is-dragging');
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
    <label class="field-wrap"><span class="field-label">${esc(tx.actionWhich)}</span>
      <select class="field" data-field="motivator">
        <option value="">${esc(tx.actionNone)}</option>
        ${ids.map((id) => `<option value="${id}" ${a.motivator === id ? 'selected' : ''}>${esc(m(id).name)}</option>`).join('')}
      </select></label>
    <label class="field-wrap"><span class="field-label">${esc(tx.actionWho)}</span>
      <input class="field" data-field="who" maxlength="120" value="${esc(a.who)}" placeholder="${esc(tx.actionWhoPlaceholder)}"></label>
    <label class="field-wrap"><span class="field-label">${esc(tx.actionWhen)}</span>
      <input class="field" type="date" data-field="when" value="${esc(a.when)}"></label>
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
  ${sharePanel()}

  <section class="debrief-board" aria-labelledby="board-title">
    <h2 id="board-title">${esc(tx.boardTitle)}${state.name ? ` · ${esc(state.name)}` : ''}</h2>
    ${lanesBoard({ readOnly: true })}
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
      <section class="panel" aria-labelledby="gen-title">
        <h2 id="gen-title">${esc(tx.generalTitle)}</h2>
        <ul class="questions">${tx.generalQuestions.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>
      </section>
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

  <section class="print-report" aria-hidden="true"><pre id="print-text"></pre></section>
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
  main.addEventListener('click', onStep4Click);
  const actions = $('#actions');
  const update = (e) => {
    const row = e.target.closest('.action');
    const field = e.target.dataset.field;
    if (!row || !field) return;
    const a = state.actions.find((x) => x.id === row.dataset.action);
    if (a) { a[field] = e.target.value; save(); }
  };
  actions.addEventListener('input', update);
  actions.addEventListener('change', update);
  $('#notes').addEventListener('input', (e) => { state.notes = e.target.value; save(); });
}

function onStep4Click(e) {
  if (state.step !== 4) return;
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
  if (e.target.closest('#print')) { $('#print-text').textContent = report(); window.print(); }
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

function render() {
  renderChrome();
  main.removeEventListener('click', onStep4Click);
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
