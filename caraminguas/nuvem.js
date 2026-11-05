/* Caraminguás — Firebase (projeto faturas-e-extratos). Login Google + Firestore em caraminguas/banco. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, doc, collection, getDoc, getDocs, onSnapshot, query, orderBy, limit, where, runTransaction, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { SLOTS, genese, aplicar, empacotar, desempacotar, auditar } from './core.js';

const ADMIN = 'nicholas.s.steiner@gmail.com';
const app = initializeApp({
  apiKey: 'AIzaSyD1X4SsLtWWKTX_O7OzWEpIzA0E8Bm1CBw',
  authDomain: 'faturas-e-extratos.firebaseapp.com',
  projectId: 'faturas-e-extratos',
  storageBucket: 'faturas-e-extratos.firebasestorage.app',
  messagingSenderId: '461188792473',
  appId: '1:461188792473:web:f09bae1f7ddc5698dab808',
}, 'caraminguas');
const auth = getAuth(app), db = getFirestore(app);
const banco = doc(db, 'caraminguas', 'banco');
const sub = (nome, id) => id ? doc(banco, nome, id) : collection(banco, nome);
const paraDoc = e => ({ seq: e.seq, lastro: e.lastro, saldos: e.saldos, moedas: empacotar(e), atualizado: serverTimestamp() });

export function criar() {
  let cancelar = [], sessao = null;
  const dados = { e: null, contas: {}, txs: [], saques: [], convites: [] };
  const erroLeitura = err => console.error('[caraminguas]', err);

  async function fundar(user) {
    const b = writeBatch(db);
    b.set(banco, paraDoc(genese()));
    SLOTS.forEach((s, i) => b.set(sub('contas', s), {
      nome: i ? `Amigo ${i + 1}` : (user.displayName || 'Administrador').slice(0, 24), uid: i ? null : user.uid,
    }));
    b.set(sub('membros', user.uid), { slot: 's1' });
    await b.commit();
  }

  async function reivindicar(user, token) {
    const c = await getDoc(sub('convites', token));
    if (!c.exists()) throw new Error('Esse convite não existe mais. Peça outro ao administrador.');
    const slot = c.data().slot, conta = await getDoc(sub('contas', slot));
    if (conta.data().uid) throw new Error('Esse convite já foi usado.');
    const b = writeBatch(db);
    b.update(sub('contas', slot), { uid: user.uid, nome: (user.displayName || conta.data().nome).slice(0, 24), convite: token });
    b.set(sub('membros', user.uid), { slot });
    await b.commit();
    return slot;
  }

  function assinar(avisar, admin) {
    cancelar.push(onSnapshot(banco, s => { dados.e = desempacotar(s.data()); avisar(); }, erroLeitura));
    cancelar.push(onSnapshot(sub('contas'), s => { s.forEach(d => { dados.contas[d.id] = d.data(); }); avisar(); }, erroLeitura));
    cancelar.push(onSnapshot(query(sub('transacoes'), orderBy('seq', 'desc'), limit(100)), s => { dados.txs = s.docs.map(d => d.data()); avisar(); }, erroLeitura));
    cancelar.push(onSnapshot(sub('saques'), s => {
      dados.saques = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.em?.seconds || 0) - (a.em?.seconds || 0));
      avisar();
    }, erroLeitura));
    if (admin) cancelar.push(onSnapshot(sub('convites'), s => { dados.convites = s.docs.map(d => ({ token: d.id, ...d.data() })); avisar(); }, erroLeitura));
  }

  async function executar(tx, extra) {
    await runTransaction(db, async t => {
      const snap = await t.get(banco), novo = aplicar(desempacotar(snap.data()), tx);
      t.update(banco, paraDoc(novo));
      const reg = { ...tx, seq: novo.seq, por: auth.currentUser.uid, em: serverTimestamp() };
      if (tx.tipo === 'saque') reg.valor = novo.valorSaque;
      t.set(sub('transacoes', String(novo.seq)), reg);
      if (extra) extra(t, novo);
    });
  }

  return {
    dados,
    iniciar(aoMudarSessao, avisar) {
      onAuthStateChanged(auth, async user => {
        cancelar.forEach(f => f()); cancelar = [];
        if (!user) return aoMudarSessao(sessao = { fase: 'fora' });
        const admin = user.email === ADMIN && user.emailVerified;
        try {
          if (admin && !(await getDoc(banco)).exists()) await fundar(user);
          const m = await getDoc(sub('membros', user.uid));
          const token = new URLSearchParams(location.search).get('convite');
          let slot = m.exists() ? m.data().slot : null;
          if (!slot && token) {
            slot = await reivindicar(user, token);
            history.replaceState(null, '', location.pathname);
          }
          if (!slot) return aoMudarSessao(sessao = { fase: 'sem-convite', email: user.email });
          sessao = { fase: 'dentro', slot, admin, email: user.email };
          assinar(avisar, admin);
          aoMudarSessao(sessao);
        } catch (err) {
          console.error('[caraminguas]', err);
          aoMudarSessao(sessao = { fase: 'erro', msg: err.code === 'permission-denied' ? 'O banco recusou o acesso.' : err.message });
        }
      });
    },
    async entrar() {
      const p = new GoogleAuthProvider();
      p.setCustomParameters({ prompt: 'select_account' });
      try { await signInWithPopup(auth, p); }
      catch (err) {
        if (err.code === 'auth/popup-blocked') return signInWithRedirect(auth, p);
        if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') throw err;
      }
    },
    sair: () => signOut(auth),
    executar: tx => executar(tx),
    pedirSaque: qtd => writeBatch(db).set(doc(sub('saques')), { slot: sessao.slot, qtd, status: 'pendente', em: serverTimestamp() }).commit(),
    pagarSaque: s => executar({ tipo: 'saque', de: s.slot, qtd: s.qtd }, (t, novo) => t.update(sub('saques', s.id), { status: 'pago', valor: novo.valorSaque })),
    recusarSaque: s => writeBatch(db).update(sub('saques', s.id), { status: 'recusado' }).commit(),
    renomear: (slot, nome) => writeBatch(db).update(sub('contas', slot), { nome }).commit(),
    async gerarConvite(slot) {
      const token = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
      await writeBatch(db).set(sub('convites', token), { slot }).commit();
      return token;
    },
    async desvincular(slot) {
      const uid = dados.contas[slot].uid, b = writeBatch(db);
      (await getDocs(query(sub('convites'), where('slot', '==', slot)))).forEach(d => b.delete(d.ref));
      b.update(sub('contas', slot), { uid: null, convite: null });
      b.delete(sub('membros', uid));
      await b.commit();
    },
    async auditar() {
      const txs = (await getDocs(query(sub('transacoes'), orderBy('seq')))).docs.map(d => d.data());
      return auditar((await getDoc(banco)).data(), txs);
    },
  };
}
