import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDS, newSession, moveTo, moveBy, setLevel, clampLevel, analyze, sanitize, buildReport, newAction, shuffle, placeTop, reorderPlaced, resetRanking, rankingDone } from '../site/js/core.js';
import { MOTIVATORS, UI, LANGS } from '../site/js/i18n.js';

test('chaque motivation a son contenu complet en FR et en EN', () => {
  assert.deepEqual(Object.keys(MOTIVATORS).sort(), [...IDS].sort());
  for (const id of IDS) {
    for (const lang of LANGS) {
      const c = MOTIVATORS[id][lang];
      assert.ok(c.name && c.tagline, `${id}/${lang}`);
      assert.ok(c.examples.length >= 2, `${id}/${lang} : au moins 2 exemples`);
      assert.ok(c.questions.length >= 2, `${id}/${lang} : au moins 2 questions`);
    }
  }
});

test('les textes de l\'interface ont les mêmes clés en FR et en EN', () => {
  assert.deepEqual(Object.keys(UI.fr).sort(), Object.keys(UI.en).sort());
  for (const lang of LANGS) {
    for (const lv of ['-2', '-1', '0', '1', '2']) {
      assert.ok(UI[lang].levelsToday[lv] && UI[lang].levelsChange[lv]);
    }
  }
});

test('moveTo et moveBy déplacent une carte sans en perdre', () => {
  const order = [...IDS];
  const a = moveTo(order, 'curiosity', 9);
  assert.equal(a[9], 'curiosity');
  assert.equal(a.length, 10);
  assert.equal(new Set(a).size, 10);
  assert.deepEqual(order, IDS, 'pas de mutation');
  assert.equal(moveBy(a, 'curiosity', 5)[9], 'curiosity', 'borné en haut');
  assert.equal(moveBy(order, 'curiosity', -3)[0], 'curiosity', 'borné en bas');
  assert.equal(moveBy(order, 'honor', 2).indexOf('honor'), 3);
});

test('les positions sont bornées entre -2 et 2', () => {
  assert.equal(clampLevel(5), 2);
  assert.equal(clampLevel(-9), -2);
  assert.equal(clampLevel(0.6), 1);
  assert.equal(clampLevel('abc'), 0);
  assert.equal(setLevel({}, 'goal', -3).goal, -2);
});

test('analyze trie priorités, points d\'appui et points à surveiller', () => {
  const s = newSession();
  // order : index 9 = la plus importante (status), 8 = goal, 7 = order, 6 = relatedness, 5 = freedom
  s.levels = { ...s.levels, status: -1, goal: -2, order: 2, freedom: 1, curiosity: -2, honor: 0 };
  const { priority, strengths, watch } = analyze(s);
  assert.deepEqual(priority.map((i) => i.id), ['goal', 'status'], 'goal : 9 × 2 = 18 > status : 10 × 1');
  assert.deepEqual(strengths.map((i) => i.id), ['order', 'freedom']);
  assert.deepEqual(watch.map((i) => i.id), ['curiosity']);
});

test('sanitize accepte une séance valide et rejette le reste', () => {
  const s = newSession();
  s.name = 'Camille';
  s.actions = [{ ...newAction('goal'), what: 'Clarifier le Sprint Goal', when: '2026-11-15' }];
  const back = sanitize(JSON.parse(JSON.stringify(s)));
  assert.equal(back.name, 'Camille');
  assert.equal(back.actions[0].motivator, 'goal');
  assert.throws(() => sanitize({ format: 'autre' }));
  assert.throws(() => sanitize({ ...s, order: IDS.slice(1) }));
  assert.throws(() => sanitize({ ...s, order: [...IDS.slice(1), 'goal'] }), 'doublon');
  const messy = sanitize({ ...s, levels: { goal: 9 }, mode: 'x', step: 12, actions: [{ motivator: 'nope', when: 'demain' }] });
  assert.equal(messy.levels.goal, 2);
  assert.equal(messy.mode, 'today');
  assert.equal(messy.step, 2, 'pioche non vide : pas au-delà du classement');
  const ranked = sanitize({ ...s, placed: undefined, pile: undefined, step: 12 });
  assert.equal(ranked.step, 4, 'séance ancienne sans pioche : considérée classée');
  assert.deepEqual(ranked.placed, IDS);
  assert.equal(messy.actions[0].motivator, '');
  assert.equal(messy.actions[0].when, '');
});

test('buildReport liste le classement du plus au moins important, dans la langue choisie', () => {
  const s = newSession();
  s.name = 'Sam';
  s.mode = 'change';
  s.change = 'nouvelle équipe';
  s.levels.status = -2;
  s.actions = [{ ...newAction('status'), what: 'Présenter en Review', who: 'Sam' }, newAction()];
  const fr = buildReport(s, UI.fr, (id) => MOTIVATORS[id].fr.name);
  assert.match(fr, /Séance de Sam/);
  assert.match(fr, /« nouvelle équipe »/);
  assert.match(fr, /1\. Statut : Nettement affaiblie/);
  assert.match(fr, /10\. Curiosité : Inchangée/);
  assert.match(fr, /- Présenter en Review \(Statut, Sam\)/);
  assert.ok(!fr.includes('- \n'), 'les actions vides sont ignorées');
  const en = buildReport(s, UI.en, (id) => MOTIVATORS[id].en.name);
  assert.match(en, /1\. Status: Much weaker/);
  assert.match(en, /Work on these first: Status/);
});

test('la pioche : mélangée, posée carte par carte, puis classement final', () => {
  let s = newSession(() => 0);
  assert.equal(s.pile.length, 10);
  assert.deepEqual([...s.pile].sort(), [...IDS].sort());
  assert.deepEqual(s.placed, []);
  assert.ok(!rankingDone(s));
  const first = s.pile[0];
  s = placeTop(s, 0);
  assert.deepEqual(s.placed, [first]);
  const second = s.pile[0];
  s = placeTop(s, 0); // posée avant la première : moins importante
  assert.deepEqual(s.placed, [second, first]);
  while (s.pile.length) s = placeTop(s, s.placed.length);
  assert.ok(rankingDone(s));
  assert.deepEqual(s.order, s.placed, 'classement final = cartes posées');
  s = reorderPlaced(s, moveTo(s.placed, first, 9));
  assert.equal(s.order[9], first);
  const back = sanitize(JSON.parse(JSON.stringify({ ...s, step: 4, reached: 4 })));
  assert.equal(back.step, 4);
  const reset = resetRanking({ ...s, step: 4, reached: 4 });
  assert.equal(reset.pile.length, 10);
  assert.equal(reset.reached, 2);
  assert.equal(reset.step, 2);
});

test('sanitize répare une pioche incohérente', () => {
  const s = newSession();
  const bad = sanitize({ ...s, placed: ['goal'], pile: ['goal', 'status'] });
  assert.equal(bad.pile.length, 0);
  assert.equal(bad.placed.length, 10);
});

test('shuffle garde toutes les cartes', () => {
  const out = shuffle(IDS);
  assert.deepEqual([...out].sort(), [...IDS].sort());
});
