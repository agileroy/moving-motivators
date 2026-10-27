// Logique métier pure (aucun accès au DOM) : séance, classement, positions, analyse et compte rendu.
// Testée avec Node.js (tests/core.test.mjs).

export const IDS = ['curiosity', 'honor', 'acceptance', 'mastery', 'power', 'freedom', 'relatedness', 'order', 'goal', 'status'];
export const MIN_LEVEL = -2;
export const MAX_LEVEL = 2;
export const MODES = ['today', 'change'];
export const FORMAT = 'moving-motivators';
export const VERSION = 1;

const MAX_TEXT = 2000;

export function newSession() {
  return {
    format: FORMAT,
    version: VERSION,
    name: '',
    mode: 'today',
    change: '',
    order: [...IDS], // index 0 = la moins importante, index 9 = la plus importante
    levels: Object.fromEntries(IDS.map((id) => [id, 0])),
    actions: [],
    notes: '',
    step: 1,
    reached: 1,
    date: null,
  };
}

/** Déplace une carte à un index donné (borné) et renvoie un nouveau classement. */
export function moveTo(order, id, index) {
  const from = order.indexOf(id);
  if (from === -1) return order.slice();
  const target = Math.max(0, Math.min(order.length - 1, index));
  const next = order.slice();
  next.splice(from, 1);
  next.splice(target, 0, id);
  return next;
}

/** Déplace une carte de delta positions (positif = plus importante). */
export function moveBy(order, id, delta) {
  return moveTo(order, id, order.indexOf(id) + delta);
}

export function clampLevel(level) {
  const n = Math.round(Number(level));
  if (!Number.isFinite(n)) return 0;
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, n));
}

export function setLevel(levels, id, level) {
  return { ...levels, [id]: clampLevel(level) };
}

/** Importance d'une carte : 1 (la moins importante) à 10 (la plus importante). */
export function importance(order, id) {
  return order.indexOf(id) + 1;
}

/**
 * Lit le tableau :
 * - priority : moitié haute du classement et sous la ligne, la plus urgente d'abord ;
 * - strengths : moitié haute et au-dessus de la ligne ;
 * - watch : moitié basse et sous la ligne.
 */
export function analyze(session) {
  const { order, levels } = session;
  const half = order.length / 2;
  const items = order.map((id, index) => ({ id, rank: index + 1, level: levels[id] ?? 0, important: index >= half }));
  const priority = items
    .filter((i) => i.important && i.level < 0)
    .sort((a, b) => (b.rank * -b.level) - (a.rank * -a.level) || b.rank - a.rank);
  const strengths = items.filter((i) => i.important && i.level > 0).sort((a, b) => b.rank - a.rank);
  const watch = items.filter((i) => !i.important && i.level < 0).sort((a, b) => a.level - b.level || b.rank - a.rank);
  return { priority, strengths, watch };
}

export function newAction(motivator = '') {
  return { id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, what: '', motivator, who: '', when: '' };
}

function text(value, max = MAX_TEXT) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** Valide et normalise une séance lue depuis un fichier ou le stockage local. Lève une erreur si invalide. */
export function sanitize(raw) {
  if (!raw || typeof raw !== 'object' || raw.format !== FORMAT) throw new Error('format');
  const base = newSession();
  const order = Array.isArray(raw.order) ? raw.order.filter((id) => IDS.includes(id)) : [];
  if (order.length !== IDS.length || new Set(order).size !== IDS.length) throw new Error('order');
  const levels = {};
  for (const id of IDS) levels[id] = clampLevel(raw.levels?.[id] ?? 0);
  const actions = Array.isArray(raw.actions)
    ? raw.actions.slice(0, 50).filter((a) => a && typeof a === 'object').map((a) => ({
      id: text(a.id, 40) || newAction().id,
      what: text(a.what, 500),
      motivator: IDS.includes(a.motivator) ? a.motivator : '',
      who: text(a.who, 120),
      when: /^\d{4}-\d{2}-\d{2}$/.test(a.when) ? a.when : '',
    }))
    : [];
  const step = Math.max(1, Math.min(4, Math.round(Number(raw.step)) || 1));
  const reached = Math.max(step, Math.min(4, Math.round(Number(raw.reached)) || 1));
  return {
    ...base,
    name: text(raw.name, 80),
    mode: MODES.includes(raw.mode) ? raw.mode : 'today',
    change: text(raw.change, 200),
    order,
    levels,
    actions,
    notes: text(raw.notes),
    step,
    reached,
    date: typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw.date) ? raw.date.slice(0, 10) : null,
  };
}

/**
 * Compte rendu texte de la séance.
 * @param {object} session
 * @param {object} t textes de l'interface dans la langue choisie (UI[lang])
 * @param {(id: string) => string} nameOf nom d'une motivation dans la langue choisie
 */
export function buildReport(session, t, nameOf) {
  const levelLabels = session.mode === 'change' ? t.levelsChange : t.levelsToday;
  const { priority, strengths, watch } = analyze(session);
  const list = (items) => (items.length ? items.map((i) => nameOf(i.id)).join(', ') : t.reportNone);
  const lines = [t.reportTitle];
  if (session.name) lines.push(t.reportFor(session.name));
  if (session.date) lines.push(t.reportDate(session.date));
  lines.push(session.mode === 'change' ? t.reportModeChange(session.change.trim()) : t.reportModeToday);
  // Ponctuation : espace avant les deux-points en français, pas en anglais.
  const colon = t.htmlLang === 'en' ? ':' : ' :';
  lines.push('', `${t.reportRanking}${colon}`);
  [...session.order].reverse().forEach((id, i) => {
    lines.push(`${i + 1}. ${nameOf(id)}${colon} ${levelLabels[String(session.levels[id] ?? 0)]}`);
  });
  lines.push('',`${t.reportPriority}${colon} ${list(priority)}`);
  lines.push(`${t.reportStrengths}${colon} ${list(strengths)}`);
  lines.push(`${t.reportWatch}${colon} ${list(watch)}`);
  const actions = session.actions.filter((a) => a.what.trim());
  lines.push('', `${t.reportActions}${colon}${actions.length ? '' : ` ${t.reportNone}`}`);
  for (const a of actions) {
    const meta = [a.motivator ? nameOf(a.motivator) : '', a.who.trim(), a.when].filter(Boolean).join(', ');
    lines.push(`- ${a.what.trim()}${meta ? ` (${meta})` : ''}`);
  }
  if (session.notes.trim()) lines.push('', `${t.reportNotes}${colon}`, session.notes.trim());
  return lines.join('\n');
}
