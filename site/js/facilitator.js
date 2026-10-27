// Page d'animation (equipe.html) : créer une séance, inviter, suivre la vue d'équipe en direct, gérer la séance.
// L'adresse d'animation porte la clé dans le fragment (#cle=…), jamais envoyé au serveur.

import { MOTIVATORS, UI } from './i18n.js?v=__VERSION__';
import {
  $, $$, esc, stackMQ, initialLang, rememberLang, toast, copyText, card, lanesBoard, levelLabelsFor, setupTheme, qrSvg,
  showCardDetail, refreshCardDetail, today,
  actionRowHtml, applyActionInput, formatDate, printActionsHtml, actionsNotesLines, slugify, downloadJson,
} from './shared.js?v=__VERSION__';
import { newAction, sanitizeActions } from './core.js?v=__VERSION__';
import {
  isSessionId, isKey, readMeta, readParticipants, aggregate, teamInsights, formatAvg, teamExport, readTeamExport,
} from './team-core.js?v=__VERSION__';

const HOSTED_KEY = 'moving-motivators.hosted';
const main = $('#main');

let lang = initialLang();
const t = () => UI[lang];
const m = (id) => MOTIVATORS[id][lang];

const params = new URLSearchParams(location.search);
const sid = isSessionId(params.get('seance')) ? params.get('seance') : null;
const hashKey = new URLSearchParams(location.hash.slice(1)).get('cle');

const ARCHIVE_KEY = 'moving-motivators.team-archive';
const archiveMode = params.get('fichier') === '1';

let store = null;
let view = sid ? 'connecting' : 'home'; // home | connecting | session | archive | denied | offline
let meta = null;
let people = [];
const openBoards = new Set();
// Débrief d'équipe (actions, notes) : gardé dans ce navigateur, jamais dans la base partagée.
let debrief = { actions: [], notes: '' };
let archive = null; // séance relue depuis un fichier : { exportedAt }

const debriefKey = () => `moving-motivators.team-debrief.${sid}`;
function loadDebrief() {
  try {
    const raw = JSON.parse(localStorage.getItem(debriefKey()) || 'null');
    if (raw) debrief = { actions: sanitizeActions(raw.actions), notes: typeof raw.notes === 'string' ? raw.notes : '' };
  } catch { /* rien d'enregistré */ }
}
function saveDebrief() {
  try {
    if (view === 'archive') {
      const file = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || 'null');
      if (file) localStorage.setItem(ARCHIVE_KEY, JSON.stringify({ ...file, actions: debrief.actions, notes: debrief.notes }));
    } else {
      localStorage.setItem(debriefKey(), JSON.stringify(debrief));
    }
  } catch { /* non mémorisé */ }
  fillPrint();
}

/* ---------- Mes séances (dans ce navigateur) ---------- */

function hosted() {
  try {
    const list = JSON.parse(localStorage.getItem(HOSTED_KEY) || '[]');
    return Array.isArray(list) ? list.filter((s) => isSessionId(s.sid) && isKey(s.key)) : [];
  } catch { return []; }
}
function remember(entry) {
  const list = hosted().filter((s) => s.sid !== entry.sid);
  list.unshift(entry);
  try { localStorage.setItem(HOSTED_KEY, JSON.stringify(list.slice(0, 30))); } catch { /* non mémorisé */ }
}
function forget(id) {
  try { localStorage.setItem(HOSTED_KEY, JSON.stringify(hosted().filter((s) => s.sid !== id))); } catch { /* non mémorisé */ }
}

const participantUrl = (id) => new URL(`./?seance=${id}`, location.href).href;
const adminUrl = (id, key) => new URL(`./equipe.html?seance=${id}#cle=${key}`, location.href).href;
const keyFor = (id) => (isKey(hashKey) ? hashKey : hosted().find((s) => s.sid === id)?.key);

/* ---------- Accueil : créer une séance, retrouver les siennes ---------- */

function renderHome() {
  const tx = t();
  const mine = hosted();
  return `
  <div class="intro">
    <p class="hint"><a class="back-link" href="./?accueil=1">${esc(tx.fBackHome)}</a></p>
    <h1 tabindex="-1">${esc(tx.fTitle)}</h1>
    <p class="lede">${esc(tx.fLede)}</p>
    <p class="resume">${esc(tx.fResumeLead)} <button type="button" class="link-btn" id="open-team-json" aria-describedby="team-resume-hint">${esc(tx.fResumeAction)}</button>
      <span class="resume-hint" id="team-resume-hint">${esc(tx.fResumeHint)}</span></p>
  </div>
  <form class="setup" id="create" autocomplete="off" novalidate>
    <h2>${esc(tx.fCreateTitle)}</h2>
    <label class="field-wrap">
      <span class="field-label">${esc(tx.fNameLabel)}</span>
      <input class="field" name="title" maxlength="80" required placeholder="${esc(tx.fNamePlaceholder)}">
    </label>
    <div class="setup-grid setup-grid--even">
      <fieldset class="modes modes--stack">
        <legend class="field-label">${esc(tx.modeLabel)}</legend>
        ${['today', 'change'].map((mode, i) => `
          <label class="mode"><input type="radio" name="mode" value="${mode}" ${i === 0 ? 'checked' : ''}>
            <span><strong>${esc(mode === 'today' ? tx.modeToday : tx.modeChange)}</strong>
            <small>${esc(mode === 'today' ? tx.modeTodayHint : tx.modeChangeHint)}</small></span></label>`).join('')}
        <label class="field-wrap change-wrap" hidden>
          <span class="field-label">${esc(tx.changeLabel)}</span>
          <input class="field" name="change" maxlength="200" placeholder="${esc(tx.changePlaceholder)}">
        </label>
      </fieldset>
      <fieldset class="modes modes--stack">
        <legend class="field-label">${esc(tx.fNamedLabel)}</legend>
        <label class="mode"><input type="radio" name="named" value="yes" checked>
          <span><strong>${esc(tx.fNamed)}</strong><small>${esc(tx.fNamedHint)}</small></span></label>
        <label class="mode"><input type="radio" name="named" value="no">
          <span><strong>${esc(tx.fAnon)}</strong><small>${esc(tx.fAnonHint)}</small></span></label>
      </fieldset>
    </div>
    <div><button class="btn btn-primary" type="submit">${esc(tx.fCreate)}</button></div>
    <p class="hint">${esc(tx.fRetention)}</p>
  </form>
  ${mine.length ? `<section class="panel" aria-labelledby="mine-title">
    <h2 id="mine-title">${esc(tx.fMine)}</h2>
    <p class="panel-hint">${esc(tx.fMineHint)}</p>
    <ul class="mine">${mine.map((s) => `<li>
      <a href="${esc(adminUrl(s.sid, s.key))}">${esc(s.title || s.sid)}</a>
      <span class="mine-date">${s.createdAt ? esc(new Date(s.createdAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR')) : ''}</span>
      <button type="button" class="icon-btn" data-forget="${s.sid}" aria-label="${esc(tx.fForget(s.title || s.sid))}" title="${esc(tx.fForget(s.title || s.sid))}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
    </li>`).join('')}</ul>
  </section>` : ''}`;
}

function bindHomeForm() {
  const form = $('#create');
  form.addEventListener('change', (e) => {
    if (e.target.name === 'mode') $('.change-wrap', form).hidden = e.target.value !== 'change';
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    if (!title) { toast(t().fNameRequired); form.title.focus(); return; }
    const submit = $('button[type="submit"]', form);
    submit.disabled = true;
    try {
      await ensureStore();
      const fields = { title, mode: data.get('mode'), change: data.get('change'), named: data.get('named') === 'yes' };
      const { sid: newSid, key } = await store.createSession(fields);
      remember({ sid: newSid, key, title, createdAt: Date.now() });
      location.href = adminUrl(newSid, key);
    } catch {
      submit.disabled = false;
      toast(t().fCreateFailed);
    }
  });
}

/* ---------- Séance : tableau d'équipe ---------- */

function dots(n, hue) {
  const shown = Math.min(n, 8);
  return `${'<i></i>'.repeat(shown)}${n > shown ? `<b>+${n - shown}</b>` : ''}`.replace(/<i><\/i>/g, `<i style="--h:${hue}"></i>`);
}

function teamBoard(rows) {
  const tx = t();
  const labels = levelLabelsFor(lang, meta.mode);
  const levels = [2, 1, 0, -1, -2];
  return `
  <div class="table teamboard">
    <div class="tlegend" aria-hidden="true">
      <div class="tlane-head"></div>
      <div class="dist">${levels.map((l) => `<div class="cell ${l === 0 ? 'is-zero' : ''}"><span>${esc(labels[String(l)])}</span></div>`).join('')}</div>
    </div>
    <ol class="tlanes">
      ${rows.map((r) => `<li class="tlane">
        <div class="tlane-head">${card(r.id, lang, 'mcard--board')}<p class="tlane-avg">${esc(tx.fAvg(formatAvg(r.avgRank, lang)))}</p></div>
        <div class="dist" style="--avg:${(r.avgLevel - -2).toFixed(3)}">
          ${levels.map((l) => `<div class="cell ${l === 0 ? 'is-zero' : ''}" role="img" aria-label="${esc(tx.fCellLabel(m(r.id).name, labels[String(l)], r.counts[String(l)]))}">${dots(r.counts[String(l)], MOTIVATORS[r.id].hue)}</div>`).join('')}
          <span class="avg-mark" aria-hidden="true"></span>
        </div>
      </li>`).join('')}
    </ol>
    <div class="axis axis--under" aria-hidden="true"><span>${esc(tx.less)}</span><i></i><span>${esc(tx.more)}</span></div>
  </div>`;
}

function insightList(items, meta2) {
  if (!items.length) return `<p class="empty">${esc(t().fNothing)}</p>`;
  return `<ul class="insights">${items.map((r) => `<li class="insight" style="--h:${MOTIVATORS[r.id].hue}">
    <div class="insight-head">${card(r.id, lang, 'mcard--mini')}<div><h4>${esc(m(r.id).name)}</h4><p class="insight-meta">${esc(meta2(r))}</p></div></div>
  </li>`).join('')}</ul>`;
}

function summaryText(rows) {
  const tx = t();
  const colon = lang === 'en' ? ':' : ' :';
  const { tensions } = teamInsights(rows, people.length);
  const lines = [tx.fSummaryTitle(meta.title), tx.fSummaryCount(people.length), '', `${tx.fSummaryRanking}${colon}`];
  [...rows].reverse().forEach((r, i) => {
    const lvl = `${r.avgLevel > 0 ? '+' : ''}${formatAvg(r.avgLevel, lang)}`;
    lines.push(`${i + 1}. ${m(r.id).name}${colon} ${formatAvg(r.avgRank, lang)}/10, ${lvl}`);
  });
  lines.push('', `${tx.fTensions}${colon} ${tensions.length ? tensions.map((r) => `${m(r.id).name} (${tx.fPeopleCount(r.priority, people.length)})`).join(', ') : tx.reportNone}`);
  lines.push(...actionsNotesLines(debrief.actions, debrief.notes, lang));
  return lines.join('\n');
}

const subjectOf = () => (meta.mode === 'change' ? `${t().modeChange}${meta.change ? ` : ${meta.change}` : ''}` : t().modeToday);

/** En-tête vivant : compteur de tableaux, séance fermée, ou mention du fichier relu. */
function liveHeadHtml() {
  const tx = t();
  const n = people.length;
  if (view === 'archive') {
    return `<p class="count-pill has-boards">${esc(tx.fCount(n))}</p>
      <p class="archive-note">${esc(tx.fArchiveNote(archive?.exportedAt ? formatDate(archive.exportedAt, lang) : ''))}</p>`;
  }
  return `<p class="count-pill ${n ? 'has-boards' : ''}" aria-live="polite">${esc(tx.fCount(n))}</p>
    ${meta.closed ? `<p class="closed-note">${esc(tx.fClosedNote)}</p>` : ''}`;
}

/** Tableau d'équipe, questions et lecture : redessinés à chaque tableau partagé. */
function liveBoardHtml() {
  const tx = t();
  const n = people.length;
  const rows = aggregate(people);
  const { top, tensions, strengths } = teamInsights(rows, n);
  return `
  <section class="debrief-board" aria-labelledby="tb-title">
    <h2 id="tb-title">${esc(tx.fTeamBoard)}</h2>
    ${n ? `<p class="panel-hint">${esc(tx.fTeamBoardHint)}</p>${teamBoard(rows)}` : `<p class="empty waiting">${esc(tx.fWaiting)}</p>`}
  </section>

  ${n ? `<section class="panel panel--discussion" aria-labelledby="q-title">
    <h2 id="q-title">${esc(tx.fQuestionsTitle)}</h2>
    <ol class="discussion">${tx.fQuestions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
  </section>

  <div class="team-grid">
    <section class="panel" aria-labelledby="top-title"><h2 id="top-title">${esc(tx.fTop)}</h2><p class="panel-hint">${esc(tx.fTopHint)}</p>
      ${insightList(top, (r) => tx.fAvg(formatAvg(r.avgRank, lang)))}</section>
    <section class="panel panel--attention" aria-labelledby="ten-title"><h2 id="ten-title">${esc(tx.fTensions)}</h2><p class="panel-hint">${esc(tx.fTensionsHint)}</p>
      ${insightList(tensions, (r) => tx.fPeopleCount(r.priority, n))}</section>
    <section class="panel" aria-labelledby="str-title"><h2 id="str-title">${esc(tx.fStrengths)}</h2><p class="panel-hint">${esc(tx.fStrengthsHint)}</p>
      ${insightList(strengths, (r) => tx.fAvg(formatAvg(r.avgRank, lang)))}</section>
  </div>` : ''}`;
}

/** Tableaux individuels (séance nominative). */
function livePeopleHtml() {
  const tx = t();
  if (!people.length) return '';
  return `<section class="panel" aria-labelledby="people-title">
    <h2 id="people-title">${esc(tx.fPeople)}</h2>
    ${meta.named ? `<ul class="people">${people.map((p) => `<li>
      <details data-uid="${esc(p.uid)}" ${openBoards.has(p.uid) ? 'open' : ''}>
        <summary><span class="person">${esc(p.name)}</span></summary>
        ${lanesBoard({ order: p.order, levels: p.levels, mode: meta.mode, lang, readOnly: true })}
      </details>
      ${view === 'archive' ? '' : `<button type="button" class="icon-btn" data-remove-person="${esc(p.uid)}" data-name="${esc(p.name)}" aria-label="${esc(tx.fRemove(p.name))}" title="${esc(tx.fRemove(p.name))}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>`}
    </li>`).join('')}</ul>` : `<p class="empty">${esc(tx.fAnonNote)}</p>`}
  </section>`;
}

function manageHtml() {
  const tx = t();
  const n = people.length;
  const live = view === 'session';
  return `<h2 id="manage-title">${esc(live ? tx.fManage : tx.exportTitle)}</h2>
    <div class="export-row">
      ${n ? `<button type="button" class="btn btn-primary" data-act="summary">${esc(tx.fCopySummary)}</button>
        <button type="button" class="btn btn-quiet" data-act="print">${esc(tx.print)}</button>
        <button type="button" class="btn btn-quiet" data-act="save">${esc(tx.fSaveJson)}</button>` : ''}
      ${live ? `<button type="button" class="btn btn-quiet" data-act="toggle-closed">${esc(meta.closed ? tx.fReopen : tx.fClose)}</button>
        <button type="button" class="btn btn-danger" data-act="delete">${esc(tx.fDelete)}</button>`
        : `<button type="button" class="btn btn-quiet" data-act="close-archive">${esc(tx.fCloseArchive)}</button>`}
    </div>
    ${live ? `<p class="hint">${esc(tx.fRetention)}</p>` : ''}`;
}

function printHeadHtml() {
  const tx = t();
  const date = view === 'archive' ? archive?.exportedAt : today();
  return `<h1>${esc(meta.title)}</h1>
    <p>${esc(subjectOf())} · ${esc(tx.fCount(people.length))}${date ? ` · ${esc(formatDate(date, lang))}` : ''}</p>`;
}

function printReportHtml() {
  const tx = t();
  const n = people.length;
  const { top, tensions, strengths } = teamInsights(aggregate(people), n);
  const names = (items) => (items.length ? items.map((r) => esc(m(r.id).name)).join(', ') : esc(tx.reportNone));
  return `
    <dl class="print-read">
      <dt>${esc(tx.fTop)}</dt><dd>${names(top)}</dd>
      <dt>${esc(tx.fTensions)}</dt><dd>${tensions.length ? tensions.map((r) => `${esc(m(r.id).name)} (${esc(tx.fPeopleCount(r.priority, n))})`).join(', ') : esc(tx.reportNone)}</dd>
      <dt>${esc(tx.fStrengths)}</dt><dd>${names(strengths)}</dd>
    </dl>
    <h2>${esc(tx.actionsTitle)}</h2>
    ${printActionsHtml(debrief.actions, lang)}
    ${debrief.notes.trim() ? `<h2>${esc(tx.notesTitle)}</h2><p class="print-notes">${esc(debrief.notes.trim())}</p>` : ''}`;
}

function fillPrint() {
  if (!meta) return;
  const head = $('#print-head');
  const report = $('#print-report');
  if (head) head.innerHTML = printHeadHtml();
  if (report) report.innerHTML = printReportHtml();
}

/** Après un changement des tableaux partagés : on redessine tout sauf les actions et les notes en cours de saisie. */
function refreshLive() {
  if (!$('#live-board')) { render(); return; }
  $('#live-head').innerHTML = liveHeadHtml();
  $('#live-board').innerHTML = liveBoardHtml();
  $('#live-people').innerHTML = livePeopleHtml();
  $('#manage').innerHTML = manageHtml();
  $('#team-debrief').hidden = !people.length;
  fillPrint();
}

function renderSession() {
  const tx = t();
  const live = view === 'session';
  const pUrl = live ? participantUrl(sid) : '';
  return `
  <header class="print-only print-head" id="print-head">${printHeadHtml()}</header>
  <div class="intro">
    <p class="hint"><a href="./equipe.html">${esc(tx.fAllSessions)}</a></p>
    <h1 tabindex="-1">${esc(meta.title)}</h1>
    <p class="lede">${esc(subjectOf())} · ${esc(meta.named ? tx.fNamed : tx.fAnon)}</p>
    <div id="live-head">${liveHeadHtml()}</div>
  </div>

  ${live ? `<section class="panel invite" aria-labelledby="invite-title">
    <div class="invite-text">
      <h2 id="invite-title">${esc(tx.fInvite)}</h2>
      <p class="panel-hint">${esc(tx.fInviteHint)}</p>
      <p class="invite-url">${esc(pUrl.replace(/^https?:\/\//, ''))}</p>
      <div class="export-row">
        <button type="button" class="btn btn-primary" data-copy="participant">${esc(tx.fCopyLink)}</button>
        <button type="button" class="btn btn-quiet" data-copy="admin">${esc(tx.fCopyAdmin)}</button>
      </div>
      <p class="hint">${esc(tx.fAdminHint)}</p>
    </div>
    <div class="qr">${qrSvg(pUrl, tx.fQrAlt)}</div>
  </section>` : ''}

  <div id="live-board" class="stack">${liveBoardHtml()}</div>

  <div id="team-debrief" class="stack" ${people.length ? '' : 'hidden'}>
    <section class="panel panel--actions" aria-labelledby="act-title">
      <h2 id="act-title">${esc(tx.actionsTitle)}</h2>
      <p class="panel-hint">${esc(tx.fActionsHint)}</p>
      <ol class="actions" id="actions">${debrief.actions.map((a) => actionRowHtml(a, lang)).join('')}</ol>
      <p class="empty" id="actions-empty" ${debrief.actions.length ? 'hidden' : ''}>${esc(tx.actionsEmpty)}</p>
      <button type="button" class="btn btn-quiet" data-add-action>${esc(tx.addAction)}</button>
    </section>
    <section class="panel" aria-labelledby="notes-title">
      <h2 id="notes-title"><label for="notes">${esc(tx.notesTitle)}</label></h2>
      <textarea class="field notes" id="notes" rows="4" maxlength="2000" placeholder="${esc(tx.notesPlaceholder)}">${esc(debrief.notes)}</textarea>
    </section>
  </div>

  <div id="live-people">${livePeopleHtml()}</div>

  <section class="panel panel--export" id="manage" aria-labelledby="manage-title">${manageHtml()}</section>

  <section class="print-only print-report" id="print-report">${printReportHtml()}</section>`;
}

function exportFile() {
  const exportedAt = view === 'archive' && archive?.exportedAt ? archive.exportedAt : today();
  const file = teamExport({ meta, people, actions: debrief.actions, notes: debrief.notes, exportedAt });
  downloadJson(file, `moving-motivators-equipe-${slugify(meta.title, 'seance')}-${exportedAt}.json`);
}

function openArchive(raw) {
  const data = readTeamExport(raw, sanitizeActions);
  try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(raw)); } catch { /* lecture seule pour cette fois */ }
  meta = data.meta;
  people = data.people;
  debrief = { actions: data.actions, notes: data.notes };
  archive = { exportedAt: data.exportedAt };
  view = 'archive';
  const url = new URL(location.href);
  url.search = '?fichier=1';
  url.hash = '';
  history.replaceState(null, '', url);
  render();
}

function bindMain() {
  main.addEventListener('input', (e) => {
    if (view !== 'session' && view !== 'archive') return;
    if (e.target.id === 'notes') { debrief.notes = e.target.value.slice(0, 2000); saveDebrief(); return; }
    if (applyActionInput(e, debrief.actions, lang)) saveDebrief();
  });
  main.addEventListener('change', (e) => {
    if ((view === 'session' || view === 'archive') && applyActionInput(e, debrief.actions, lang)) saveDebrief();
  });
  main.addEventListener('toggle', (e) => {
    const d = e.target;
    if (d.tagName !== 'DETAILS') return;
    if (d.open) openBoards.add(d.dataset.uid); else openBoards.delete(d.dataset.uid);
  }, true);
  main.addEventListener('click', async (e) => {
    const cardEl = e.target.closest('.mcard[data-id]');
    if (cardEl) { showCardDetail(cardEl.dataset.id, lang); return; }
    const forgetBtn = e.target.closest('[data-forget]');
    if (forgetBtn) { forget(forgetBtn.dataset.forget); render(); return; }
    if (e.target.closest('#open-team-json')) { $('#team-file').click(); return; }
    if (view !== 'session' && view !== 'archive') return;
    const tx = t();
    if (e.target.closest('[data-add-action]')) {
      const a = newAction();
      debrief.actions.push(a);
      saveDebrief();
      $('#actions').insertAdjacentHTML('beforeend', actionRowHtml(a, lang));
      $('#actions-empty').hidden = true;
      $(`.action[data-action="${a.id}"] textarea`).focus();
      return;
    }
    const removeAction = e.target.closest('[data-remove]');
    if (removeAction) {
      const row = removeAction.closest('.action');
      debrief.actions = debrief.actions.filter((a) => a.id !== row.dataset.action);
      saveDebrief();
      row.remove();
      $('#actions-empty').hidden = debrief.actions.length > 0;
      return;
    }
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      const url = copyBtn.dataset.copy === 'admin' ? adminUrl(sid, keyFor(sid)) : participantUrl(sid);
      toast(await copyText(url) ? tx.fLinkCopied : tx.copyFailed);
      return;
    }
    const removeBtn = e.target.closest('[data-remove-person]');
    if (removeBtn) {
      if (!window.confirm(tx.fRemoveConfirm(removeBtn.dataset.name))) return;
      store.removeParticipant(sid, removeBtn.dataset.removePerson).catch(() => toast(tx.fFailed));
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'summary') toast(await copyText(summaryText(aggregate(people))) ? tx.copied : tx.copyFailed);
    if (act === 'print') { fillPrint(); requestAnimationFrame(() => setTimeout(() => window.print(), 50)); }
    if (act === 'save') exportFile();
    if (act === 'close-archive') {
      try { localStorage.removeItem(ARCHIVE_KEY); } catch { /* rien à effacer */ }
      location.href = './equipe.html';
    }
    if (view !== 'session') return;
    if (act === 'toggle-closed') store.setClosed(sid, !meta.closed).catch(() => toast(tx.fFailed));
    if (act === 'delete' && window.confirm(tx.fDeleteConfirm)) {
      try {
        await store.deleteSession(sid);
        forget(sid);
        toast(tx.fDeleted);
        setTimeout(() => { location.href = './equipe.html'; }, 800);
      } catch { toast(tx.fFailed); }
    }
  });
}

/* ---------- Connexion ---------- */

async function ensureStore() {
  if (store) return store;
  // Firebase n'est chargé qu'au besoin : relire un fichier fonctionne même sans accès à la base (VPN).
  const { createTeamStore } = await import('./team-store.js?v=__VERSION__');
  store = createTeamStore();
  await store.start();
  return store;
}

async function openSession() {
  const key = keyFor(sid);
  if (!isKey(key)) { view = 'denied'; render(); return; }
  try {
    await ensureStore();
  } catch { view = 'offline'; render(); return; }
  try {
    await store.claimOwner(sid, key);
  } catch { view = 'denied'; render(); return; }
  // La clé ne reste pas affichée dans la barre d'adresse : elle est gardée dans ce navigateur.
  remember({ sid, key, title: hosted().find((s) => s.sid === sid)?.title ?? '', createdAt: hosted().find((s) => s.sid === sid)?.createdAt ?? Date.now() });
  if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`);
  loadDebrief();
  store.onMeta(sid, (raw) => {
    meta = readMeta(raw);
    if (!meta) { view = 'denied'; render(); return; }
    remember({ sid, key, title: meta.title, createdAt: meta.createdAt ?? Date.now() });
    if (view === 'session') { refreshLive(); return; }
    view = 'session';
    render();
  }, () => { view = 'denied'; render(); });
  store.onParticipants(sid, (raw) => {
    people = readParticipants(raw);
    if (view === 'session') refreshLive();
  }, () => {});
}

/* ---------- Rendu ---------- */

function render() {
  const tx = t();
  document.documentElement.lang = tx.htmlLang;
  document.title = `${meta?.title ? `${meta.title} · ` : ''}${tx.fTitle} · Moving Motivators`;
  $('#host-tag').textContent = tx.fTitle;
  $('#footer-text').textContent = tx.footer;
  $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  updateTheme?.();
  refreshCardDetail(lang);
  if (view === 'home') {
    main.innerHTML = renderHome();
    bindHomeForm();
  } else if (view === 'session' || view === 'archive') {
    main.innerHTML = renderSession();
  } else {
    const message = { connecting: tx.fConnecting, denied: tx.fNoAccess, offline: tx.fOffline }[view];
    main.innerHTML = `<div class="intro"><p class="hint"><a class="back-link" href="./?accueil=1">${esc(tx.fBackHome)}</a></p><h1 tabindex="-1">${esc(tx.fTitle)}</h1><p class="lede">${esc(message)}</p>
      ${view !== 'connecting' ? `<p><a class="btn btn-quiet" href="./equipe.html">${esc(tx.fAllSessions)}</a></p>` : ''}</div>`;
  }
}

$$('.lang button').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang;
  rememberLang(lang);
  render();
}));
// Pendant l'impression, la largeur de page change : on ne redessine pas (le contenu imprimé doit rester en place).
let printing = false;
window.addEventListener('beforeprint', () => { printing = true; fillPrint(); });
window.addEventListener('afterprint', () => { printing = false; if (view === 'session' || view === 'archive') render(); });
stackMQ.addEventListener('change', () => { if (!printing && (view === 'session' || view === 'archive')) render(); });

$('#team-file').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    openArchive(JSON.parse(await file.text()));
  } catch {
    toast(t().fOpenFailed);
  }
});

let updateTheme = null;
updateTheme = setupTheme($('#theme-toggle'), t);

bindMain();
if (!sid && archiveMode) {
  // Rechargement d'une séance relue depuis un fichier : on la reprend dans ce navigateur.
  try { openArchive(JSON.parse(localStorage.getItem(ARCHIVE_KEY) || 'null')); } catch { render(); }
} else {
  render();
}
if (sid) openSession();
