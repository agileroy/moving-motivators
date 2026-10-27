import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDS } from '../site/js/core.js';
import { metaFor, sharePayload } from '../site/js/team-core.js';

const rules = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;
const branch = rules.movingMotivators;

test('le fichier de règles garde les branches des autres outils', () => {
  assert.ok(rules.room, 'poker planning');
  assert.ok(rules.skillMatrix, 'matrice de compétences');
  assert.ok(rules.wheelOfChance, 'roue de la chance');
  assert.equal(rules['.read'], false);
  assert.equal(rules['.write'], false);
});

test('rien n\'est lisible en bloc : ni les clés, ni la liste des séances', () => {
  assert.equal(branch['.read'], undefined);
  assert.equal(branch.keys['.read'], undefined);
  assert.equal(branch.keys.$sid['.read'], undefined);
  assert.equal(branch.sessions['.read'], undefined);
  assert.equal(branch.sessions.$sid['.read'], undefined);
});

test('un participant ne lit que son tableau ; l\'animateur lit tous les tableaux', () => {
  const participants = branch.sessions.$sid.participants;
  assert.match(participants['.read'], /owners'\)\.child\(auth\.uid\)\.exists\(\)/);
  assert.equal(participants.$uid['.read'], 'auth != null && auth.uid === $uid');
  assert.match(participants.$uid['.write'], /auth\.uid === \$uid/);
  assert.match(participants.$uid['.write'], /meta\/closed'\)\.val\(\) === false/, 'séance fermée : plus de partage');
});

test('devenir animateur exige la clé de la séance', () => {
  const owner = branch.sessions.$sid.owners.$uid;
  assert.equal(owner['.write'], 'auth != null && auth.uid === $uid && newData.exists()');
  assert.match(owner['.validate'], /child\('keys'\)\.child\(\$sid\)\.val\(\)/);
});

test('chaque champ écrit par l\'application a sa règle de validation', () => {
  const meta = branch.sessions.$sid.meta;
  for (const field of Object.keys(metaFor({ title: 'x', mode: 'change', change: 'y', named: true }))) {
    assert.ok(meta[field]?.['.validate'], `meta/${field}`);
  }
  assert.ok(meta.createdAt['.validate']);
  const p = branch.sessions.$sid.participants.$uid;
  for (const field of Object.keys(sharePayload({ order: IDS, levels: {} }, true))) {
    assert.ok(p[field]?.['.validate'], `participants/${field}`);
  }
  assert.ok(p.updatedAt['.validate']);
  assert.equal(p.$other['.validate'], false);
  assert.equal(meta.$other['.validate'], false);
});

test('les identifiants de motivation des règles sont ceux de l\'outil', () => {
  const p = branch.sessions.$sid.participants.$uid;
  for (const id of IDS) {
    assert.ok(p.order['.validate'].includes(id), `order : ${id}`);
    assert.ok(p.levels['.validate'].includes(`'${id}'`), `levels : ${id}`);
  }
});

test('les règles n\'utilisent ni ternaire ni modulo (non pris en charge partout)', () => {
  const text = JSON.stringify(branch);
  assert.ok(!/ \? /.test(text));
  assert.ok(!/ % /.test(text));
});
