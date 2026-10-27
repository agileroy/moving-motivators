// Séances d'équipe : logique pure (identifiants, données échangées avec Firebase, vue d'équipe).
// Testée avec Node.js (tests/team-core.test.mjs). Les règles de database.rules.json appliquent
// les mêmes contraintes côté base (branche movingMotivators).

import { IDS, MIN_LEVEL, MAX_LEVEL, clampLevel } from './core.js?v=__VERSION__';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function newId(length = 12) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

export const isSessionId = (v) => typeof v === 'string' && /^[a-z0-9]{12}$/.test(v);
export const isKey = (v) => typeof v === 'string' && /^[a-z0-9]{24}$/.test(v);

/** Fiche d'une séance, prête à écrire (createdAt est ajouté par le magasin). */
export function metaFor({ title, mode, change, named }) {
  return {
    title: String(title ?? '').trim().slice(0, 80),
    mode: mode === 'change' ? 'change' : 'today',
    change: mode === 'change' ? String(change ?? '').trim().slice(0, 200) : '',
    named: Boolean(named),
    closed: false,
  };
}

/** Lecture prudente d'une fiche venue de la base. */
export function readMeta(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.title !== 'string') return null;
  return {
    title: raw.title,
    mode: raw.mode === 'change' ? 'change' : 'today',
    change: typeof raw.change === 'string' ? raw.change : '',
    named: raw.named === true,
    closed: raw.closed === true,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : null,
  };
}

/** Tableau partagé par un participant (updatedAt est ajouté par le magasin). */
export function sharePayload({ name, order, levels }, named) {
  return {
    name: named ? String(name ?? '').trim().slice(0, 50) : '',
    order: order.join(','),
    levels: Object.fromEntries(IDS.map((id) => [id, clampLevel(levels[id] ?? 0)])),
  };
}

/** Lecture prudente d'un tableau partagé ; null s'il est incomplet. */
export function readParticipant(uid, raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.order !== 'string') return null;
  const order = raw.order.split(',');
  if (order.length !== IDS.length || new Set(order).size !== IDS.length || !order.every((id) => IDS.includes(id))) return null;
  const levels = {};
  for (const id of IDS) levels[id] = clampLevel(raw.levels?.[id] ?? 0);
  return {
    uid,
    name: typeof raw.name === 'string' ? raw.name : '',
    order,
    levels,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
  };
}

/** Liste des participants (objet de la base), triée par nom puis par date de partage. */
export function readParticipants(raw) {
  return Object.entries(raw ?? {})
    .map(([uid, value]) => readParticipant(uid, value))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name) || a.updatedAt - b.updatedAt);
}

/**
 * Vue d'équipe : pour chaque motivation, importance moyenne (1 à 10), position moyenne (-2 à 2),
 * répartition des positions, et nombre de personnes pour qui elle est importante et en manque.
 * Résultat trié de la moins importante à la plus importante pour l'équipe.
 */
export function aggregate(participants) {
  const n = participants.length;
  const rows = IDS.map((id) => {
    const counts = Object.fromEntries(Array.from({ length: MAX_LEVEL - MIN_LEVEL + 1 }, (_, i) => [String(MIN_LEVEL + i), 0]));
    let rankSum = 0;
    let levelSum = 0;
    let priority = 0;
    let topThree = 0;
    for (const p of participants) {
      const rank = p.order.indexOf(id) + 1;
      const level = p.levels[id] ?? 0;
      rankSum += rank;
      levelSum += level;
      counts[String(level)] += 1;
      if (rank > IDS.length / 2 && level < 0) priority += 1;
      if (rank > IDS.length - 3) topThree += 1;
    }
    return {
      id,
      avgRank: n ? rankSum / n : 0,
      avgLevel: n ? levelSum / n : 0,
      counts,
      priority,
      topThree,
    };
  });
  return rows.sort((a, b) => a.avgRank - b.avgRank || a.id.localeCompare(b.id));
}

/** Ce qui ressort pour l'équipe : ce qui compte le plus, les tensions, les points forts. */
export function teamInsights(rows, size) {
  if (!size) return { top: [], tensions: [], strengths: [] };
  const byRank = [...rows].sort((a, b) => b.avgRank - a.avgRank);
  const top = byRank.slice(0, 3);
  const tensions = rows.filter((r) => r.priority > 0).sort((a, b) => b.priority - a.priority || b.avgRank - a.avgRank);
  const strengths = byRank.filter((r) => r.avgRank > IDS.length / 2 && r.avgLevel >= 0.5);
  return { top, tensions, strengths };
}

/** Arrondi à une décimale pour l'affichage (« 7,4 » en français). */
export function formatAvg(value, lang) {
  return (Math.round(value * 10) / 10).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
