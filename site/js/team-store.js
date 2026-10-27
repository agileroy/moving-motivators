// Seul module qui parle à Firebase (séances d'équipe). Connexion anonyme ; les règles de sécurité
// (database.rules.json, branche movingMotivators) appliquent les mêmes contraintes côté base :
// - chaque participant n'écrit et ne lit que son propre tableau ;
// - seuls les animateurs (navigateurs qui présentent la clé d'animation) lisent tous les tableaux.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getDatabase, ref, onValue, get, set, update, remove, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';
import { firebaseConfig } from './firebase-config.js?v=__VERSION__';
import { newId, metaFor, sharePayload } from './team-core.js?v=__VERSION__';

/** Branche de la base réservée à cet outil (la base est partagée avec le poker planning). */
const ROOT = 'movingMotivators';

export function createTeamStore() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);
  const at = (path) => ref(db, `${ROOT}/${path}`);
  let uid = null;

  /** Connexion : reprend la session anonyme du navigateur, sinon en ouvre une. Échoue après 12 s. */
  function start() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 12000);
      const stop = onAuthStateChanged(auth, (user) => {
        if (user) {
          clearTimeout(timer);
          stop();
          uid = user.uid;
          resolve(uid);
        } else {
          signInAnonymously(auth).catch((e) => { clearTimeout(timer); reject(e); });
        }
      }, reject);
    });
  }

  /** Crée une séance ; ce navigateur en devient l'animateur. Renvoie { sid, key }. */
  async function createSession(fields) {
    const sid = newId(12);
    const key = newId(24);
    await update(ref(db, ROOT), {
      [`keys/${sid}`]: key,
      [`sessions/${sid}/meta`]: { ...metaFor(fields), createdAt: serverTimestamp() },
      [`sessions/${sid}/owners/${uid}`]: key,
    });
    return { sid, key };
  }

  /** Rejoint une séance comme animateur avec sa clé (sans effet si c'est déjà le cas). */
  const claimOwner = (sid, key) => set(at(`sessions/${sid}/owners/${uid}`), key);

  const getMeta = (sid) => get(at(`sessions/${sid}/meta`)).then((s) => s.val());
  const onMeta = (sid, cb, onError) => onValue(at(`sessions/${sid}/meta`), (s) => cb(s.val()), onError);
  const setClosed = (sid, closed) => set(at(`sessions/${sid}/meta/closed`), closed);

  /** Tous les tableaux partagés (animateur seulement). */
  const onParticipants = (sid, cb, onError) => onValue(at(`sessions/${sid}/participants`), (s) => cb(s.val() ?? {}), onError);
  const removeParticipant = (sid, participantUid) => remove(at(`sessions/${sid}/participants/${participantUid}`));

  /** Supprime la séance, ses tableaux et sa clé. */
  const deleteSession = (sid) => update(ref(db, ROOT), { [`keys/${sid}`]: null, [`sessions/${sid}`]: null });

  // ---- Côté participant
  const onMyBoard = (sid, cb, onError) => onValue(at(`sessions/${sid}/participants/${uid}`), (s) => cb(s.val()), onError);
  const shareBoard = (sid, board, named) => set(at(`sessions/${sid}/participants/${uid}`), { ...sharePayload(board, named), updatedAt: serverTimestamp() });
  const withdrawBoard = (sid) => remove(at(`sessions/${sid}/participants/${uid}`));

  return {
    start, createSession, claimOwner, getMeta, onMeta, setClosed,
    onParticipants, removeParticipant, deleteSession,
    onMyBoard, shareBoard, withdrawBoard,
    get uid() { return uid; },
  };
}
