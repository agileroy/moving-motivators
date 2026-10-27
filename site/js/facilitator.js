// Page d'animation (equipe.html) : créer une séance, inviter, suivre la vue d'équipe en direct, gérer la séance.
// L'adresse d'animation porte la clé dans le fragment (#cle=…), jamais envoyé au serveur.

import { MOTIVATORS, UI } from './i18n.js?v=__VERSION__';
import {
  $, $$, esc, stackMQ, posOf, initialLang, rememberLang, toast, copyText, card, lanesBoard, levelLabelsFor, setupTheme, qrSvg,
} from './shared.js?v=__VERSION__';
import { isSessionId, isKey, readMeta, readParticipants, aggregate, teamInsights, formatAvg } from './team-core.js?v=__VERSION__';
import { createTeamStore } from './team-store.js?v=__VERSION__';

const HOSTED_KEY = 'moving-motivators.hosted';
const main = $('#main');

let lang = initialLang();
const t = () => UI[lang];
const m = (id) => MOTIVATORS[id][lang];

const params = new URLSearchParams(location.search);
const sid = isSessionId(params.get('seance')) ? params.get('seance') : null;
const hashKey = new URLSearchParams(location.hash.slice(1)).get('cle');

let store = null;
let view = sid ? 'connecting' : 'home'; // home | connecting | session | denied | offline
let meta = null;
let people = [];
const openBoards = new Set();

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
    <h1 tabindex="-1">${esc(tx.fTitle)}</h1>
    <p class="lede">${esc(tx.fLede)}</p>
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
  return lines.join('\n');
}

function renderSession() {
  const tx = t();
  const n = people.length;
  const rows = aggregate(people);
  const { top, tensions, strengths } = teamInsights(rows, n);
  const pUrl = participantUrl(sid);
  const subject = meta.mode === 'change' ? `${tx.modeChange}${meta.change ? ` : ${meta.change}` : ''}` : tx.modeToday;
  return `
  <div class="intro">
    <p class="hint"><a href="./equipe.html">${esc(tx.fAllSessions)}</a></p>
    <h1 tabindex="-1">${esc(meta.title)}</h1>
    <p class="lede">${esc(subject)} · ${esc(meta.named ? tx.fNamed : tx.fAnon)}</p>
    <p class="count-pill ${n ? 'has-boards' : ''}" aria-live="polite">${esc(tx.fCount(n))}</p>
    ${meta.closed ? `<p class="closed-note">${esc(tx.fClosedNote)}</p>` : ''}
  </div>

  <section class="panel invite" aria-labelledby="invite-title">
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
  </section>

  <section class="debrief-board" aria-labelledby="tb-title">
    <h2 id="tb-title">${esc(tx.fTeamBoard)}</h2>
    ${n ? `<p class="panel-hint">${esc(tx.fTeamBoardHint)}</p>${teamBoard(rows)}` : `<p class="empty waiting">${esc(tx.fWaiting)}</p>`}
  </section>

  ${n ? `<div class="team-grid">
    <section class="panel" aria-labelledby="top-title"><h2 id="top-title">${esc(tx.fTop)}</h2><p class="panel-hint">${esc(tx.fTopHint)}</p>
      ${insightList(top, (r) => tx.fAvg(formatAvg(r.avgRank, lang)))}</section>
    <section class="panel panel--priority" aria-labelledby="ten-title"><h2 id="ten-title">${esc(tx.fTensions)}</h2><p class="panel-hint">${esc(tx.fTensionsHint)}</p>
      ${insightList(tensions, (r) => tx.fPeopleCount(r.priority, n))}</section>
    <section class="panel" aria-labelledby="str-title"><h2 id="str-title">${esc(tx.fStrengths)}</h2><p class="panel-hint">${esc(tx.fStrengthsHint)}</p>
      ${insightList(strengths, (r) => tx.fAvg(formatAvg(r.avgRank, lang)))}</section>
  </div>

  <section class="panel" aria-labelledby="q-title">
    <h2 id="q-title">${esc(tx.fQuestionsTitle)}</h2>
    <ul class="questions">${tx.fQuestions.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>
  </section>

  <section class="panel" aria-labelledby="people-title">
    <h2 id="people-title">${esc(tx.fPeople)}</h2>
    ${meta.named ? `<ul class="people">${people.map((p) => `<li>
      <details data-uid="${esc(p.uid)}" ${openBoards.has(p.uid) ? 'open' : ''}>
        <summary><span class="person">${esc(p.name)}</span></summary>
        ${lanesBoard({ order: p.order, levels: p.levels, mode: meta.mode, lang, readOnly: true })}
      </details>
      <button type="button" class="icon-btn" data-remove-person="${esc(p.uid)}" data-name="${esc(p.name)}" aria-label="${esc(tx.fRemove(p.name))}" title="${esc(tx.fRemove(p.name))}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
    </li>`).join('')}</ul>` : `<p class="empty">${esc(tx.fAnonNote)}</p>`}
  </section>` : ''}

  <section class="panel panel--export" aria-labelledby="manage-title">
    <h2 id="manage-title">${esc(tx.fManage)}</h2>
    <div class="export-row">
      ${n ? `<button type="button" class="btn btn-quiet" data-act="summary">${esc(tx.fCopySummary)}</button>` : ''}
      <button type="button" class="btn btn-quiet" data-act="toggle-closed">${esc(meta.closed ? tx.fReopen : tx.fClose)}</button>
      <button type="button" class="btn btn-danger" data-act="delete">${esc(tx.fDelete)}</button>
    </div>
    <p class="hint">${esc(tx.fRetention)}</p>
  </section>`;
}

function bindMain() {
  main.addEventListener('toggle', (e) => {
    const d = e.target;
    if (d.tagName !== 'DETAILS') return;
    if (d.open) openBoards.add(d.dataset.uid); else openBoards.delete(d.dataset.uid);
  }, true);
  main.addEventListener('click', async (e) => {
    const forgetBtn = e.target.closest('[data-forget]');
    if (forgetBtn) { forget(forgetBtn.dataset.forget); render(); return; }
    if (view !== 'session') return;
    const tx = t();
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
  store.onMeta(sid, (raw) => {
    meta = readMeta(raw);
    if (!meta) { view = 'denied'; render(); return; }
    remember({ sid, key, title: meta.title, createdAt: meta.createdAt ?? Date.now() });
    view = 'session';
    render();
  }, () => { view = 'denied'; render(); });
  store.onParticipants(sid, (raw) => {
    people = readParticipants(raw);
    if (view === 'session') render();
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
  if (view === 'home') {
    main.innerHTML = renderHome();
    bindHomeForm();
  } else if (view === 'session') {
    main.innerHTML = renderSession();
  } else {
    const message = { connecting: tx.fConnecting, denied: tx.fNoAccess, offline: tx.fOffline }[view];
    main.innerHTML = `<div class="intro"><h1 tabindex="-1">${esc(tx.fTitle)}</h1><p class="lede">${esc(message)}</p>
      ${view !== 'connecting' ? `<p><a class="btn btn-quiet" href="./equipe.html">${esc(tx.fAllSessions)}</a></p>` : ''}</div>`;
  }
}

$$('.lang button').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang;
  rememberLang(lang);
  render();
}));
stackMQ.addEventListener('change', () => { if (view === 'session') render(); });

let updateTheme = null;
updateTheme = setupTheme($('#theme-toggle'), t);

bindMain();
render();
if (sid) openSession();
