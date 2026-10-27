import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDS } from '../site/js/core.js';
import {
  newId, isSessionId, isKey, metaFor, readMeta, sharePayload, readParticipant, readParticipants, aggregate, teamInsights, formatAvg,
} from '../site/js/team-core.js';

test('identifiants de séance et clés d\'animation', () => {
  const id = newId(12);
  const key = newId(24);
  assert.ok(isSessionId(id));
  assert.ok(isKey(key));
  assert.ok(!isSessionId(key));
  assert.ok(!isSessionId('ABCDEFGHIJKL'));
  assert.notEqual(newId(12), newId(12));
});

test('metaFor normalise la fiche de séance', () => {
  assert.deepEqual(metaFor({ title: '  Équipe A ', mode: 'today', change: 'ignoré', named: 1 }), { title: 'Équipe A', mode: 'today', change: '', named: true, closed: false });
  assert.equal(metaFor({ title: 'x', mode: 'change', change: ' Réorg ' }).change, 'Réorg');
  assert.equal(metaFor({ title: 'x', mode: 'bizarre' }).mode, 'today');
  assert.equal(readMeta(null), null);
  assert.equal(readMeta({ title: 'A', mode: 'change', named: true, closed: true, createdAt: 3 }).closed, true);
});

test('sharePayload : le prénom n\'est envoyé que dans une séance nominative', () => {
  const board = { name: ' Léa ', order: [...IDS], levels: { goal: 9, status: -1 } };
  const named = sharePayload(board, true);
  assert.equal(named.name, 'Léa');
  assert.equal(named.order, IDS.join(','));
  assert.equal(named.levels.goal, 2);
  assert.equal(named.levels.curiosity, 0);
  assert.equal(Object.keys(named.levels).length, 10);
  assert.equal(sharePayload(board, false).name, '');
});

test('l\'ordre partagé respecte le motif des règles Firebase', () => {
  const pattern = new RegExp(`^((${IDS.join('|')}),){9}(${IDS.join('|')})$`);
  assert.match(sharePayload({ order: [...IDS].reverse(), levels: {} }, false).order, pattern);
});

test('readParticipant rejette un tableau incomplet ou en double', () => {
  assert.equal(readParticipant('u', { order: IDS.slice(1).join(','), levels: {} }), null);
  assert.equal(readParticipant('u', { order: [...IDS.slice(1), 'goal'].join(','), levels: {} }), null);
  const p = readParticipant('u', { name: 'Ana', order: IDS.join(','), levels: { goal: -2 }, updatedAt: 5 });
  assert.equal(p.levels.goal, -2);
  assert.equal(p.levels.status, 0);
  const list = readParticipants({ b: { name: 'Zoé', order: IDS.join(',') }, a: { name: 'Ana', order: IDS.join(',') }, bad: { order: 'x' } });
  assert.deepEqual(list.map((x) => x.name), ['Ana', 'Zoé']);
});

test('aggregate calcule importance moyenne, positions et tensions', () => {
  const asc = [...IDS]; // status la plus importante (10), curiosity la moins (1)
  const desc = [...IDS].reverse(); // curiosity la plus importante
  const people = [
    { order: asc, levels: { status: -2, curiosity: 2 } },
    { order: desc, levels: { status: 1, curiosity: -1 } },
    { order: asc, levels: { status: -1, curiosity: 0 } },
  ];
  const rows = aggregate(people);
  assert.equal(rows.length, 10);
  const status = rows.find((r) => r.id === 'status');
  assert.equal(status.avgRank, (10 + 1 + 10) / 3);
  assert.equal(status.priority, 2, 'importante et en manque pour deux personnes');
  assert.equal(status.counts['-2'], 1);
  assert.equal(status.counts['1'], 1);
  const curiosity = rows.find((r) => r.id === 'curiosity');
  assert.equal(curiosity.priority, 1);
  assert.ok(rows[rows.length - 1].avgRank >= rows[0].avgRank, 'triées de la moins à la plus importante');
  const { top, tensions } = teamInsights(rows, people.length);
  assert.equal(top[0].id, 'status');
  assert.equal(tensions[0].id, 'status');
  assert.deepEqual(teamInsights(aggregate([]), 0), { top: [], tensions: [], strengths: [] });
});

test('formatAvg suit la langue', () => {
  assert.equal(formatAvg(7.36, 'fr'), '7,4');
  assert.equal(formatAvg(7.36, 'en'), '7.4');
});

test('fichier de séance d\'équipe : export puis relecture', async () => {
  const { teamExport, readTeamExport } = await import('../site/js/team-core.js');
  const { sanitizeActions, newAction } = await import('../site/js/core.js');
  const meta = { title: 'Équipe A', mode: 'change', change: 'Réorg', named: false, closed: false, createdAt: 5 };
  const people = [readParticipant('u1', { name: 'Léa', order: IDS.join(','), levels: { goal: -2 } })];
  const file = teamExport({ meta, people, actions: [{ ...newAction('goal'), what: 'Clarifier le but', when: '2026-11-30' }], notes: 'Bonne séance', exportedAt: '2026-10-27' });
  assert.equal(file.participants[0].name, '', 'séance anonyme : pas de prénom dans le fichier');
  const back = readTeamExport(JSON.parse(JSON.stringify(file)), sanitizeActions);
  assert.equal(back.meta.title, 'Équipe A');
  assert.equal(back.meta.change, 'Réorg');
  assert.equal(back.people.length, 1);
  assert.equal(back.people[0].levels.goal, -2);
  assert.equal(back.actions[0].what, 'Clarifier le but');
  assert.equal(back.notes, 'Bonne séance');
  assert.equal(back.exportedAt, '2026-10-27');
  assert.throws(() => readTeamExport({ format: 'moving-motivators' }, sanitizeActions));
  const named = readTeamExport({ ...file, named: true, participants: [{ name: 'Marc', order: IDS, levels: {} }, { name: 'X', order: ['goal'] }] }, sanitizeActions);
  assert.deepEqual(named.people.map((p) => p.name), ['Marc'], 'tableau incomplet ignoré');
});
