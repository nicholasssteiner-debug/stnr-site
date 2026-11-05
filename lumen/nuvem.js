/* Lúmen — Firebase (projeto faturas-e-extratos). Login Google + Firestore em caraminguas/lumen. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, doc, collection, getDoc, getDocs, onSnapshot, query, orderBy, limit, where, runTransaction, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { genese, contas, proximaConta, aplicar, empacotar, desempacotar, auditar } from './core.js';

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
const banco = doc(db, 'caraminguas', 'lumen'), antigo = doc(db, 'caraminguas', 'banco');
const sub = (nome, id) => id ? doc(banco, nome, id) : collection(banco, nome);
const paraDoc = e => ({ seq: e.seq, lastro: e.lastro, saldos: e.saldos, cartoes: e.cartoes, aplic: e.aplic, moedas: empacotar(e), atualizado: serverTimestamp() });

export function criar() {
  let cancelar = [], sessao = null;
  const dados = { e: null, contas: {}, txs: [], cheques: [], cobrancas: [], convites: [] };
  const erroLeitura = err => console.error('[lumen]', err);
  const porData = (a, b) => (b.em?.seconds || 0) - (a.em?.seconds || 0);

  /* Primeira abertura pelo administrador: cria o banco e traz as contas e convites da versão anterior. */
  async function fundar(user) {
    const velhas = {}, b = writeBatch(db), e = genese();
    (await getDocs(collection(antigo, 'contas'))).forEach(d => { velhas[d.id] = d.data(); });
    const convites = await getDocs(collection(antigo, 'convites'));
    b.set(banco, paraDoc(e));
    contas(e).forEach((s, i) => {
      const v = velhas[s] || {};
      b.set(sub('contas', s), { nome: v.nome || (i ? `Amigo ${i + 1}` : (user.displayName || 'Administrador').slice(0, 24)), uid: i ? (v.uid || null) : user.uid });
      if (i && v.uid) b.set(sub('membros', v.uid), { slot: s });
    });
    b.set(sub('membros', user.uid), { slot: 's1' });
    convites.forEach(c => { if (!velhas[c.data().slot]?.uid) b.set(sub('convites', c.id), { slot: c.data().slot, por: user.uid }); });
    await b.commit();
  }

  async function reivindicar(user, token) {
    const c = await getDoc(sub('convites', token));
    if (!c.exists()) throw new Error('Esse convite não existe mais. Peça outro.');
    const slot = c.data().slot, conta = await getDoc(sub('contas', slot));
    if (conta.data().uid) throw new Error('Esse convite já foi usado.');
    const b = writeBatch(db);
    b.update(sub('contas', slot), { uid: user.uid, nome: (user.displayName || conta.data().nome).slice(0, 24), convite: token });
    b.set(sub('membros', user.uid), { slot });
    await b.commit();
    return slot;
  }

  function assinar(avisar, admin, uid) {
    const ouvir = (alvo, fn) => cancelar.push(onSnapshot(alvo, s => { fn(s); avisar(); }, erroLeitura));
    ouvir(banco, s => { dados.e = desempacotar(s.data()); pendencias(); });
    ouvir(sub('contas'), s => s.forEach(d => { dados.contas[d.id] = d.data(); }));
    ouvir(query(sub('transacoes'), orderBy('seq', 'desc'), limit(100)), s => { dados.txs = s.docs.map(d => d.data()); });
    ouvir(sub('cheques'), s => { dados.cheques = s.docs.map(d => ({ id: d.id, ...d.data() })).sort(porData); });
    ouvir(sub('cobrancas'), s => { dados.cobrancas = s.docs.map(d => ({ id: d.id, ...d.data() })).sort(porData); });
    ouvir(admin ? sub('convites') : query(sub('convites'), where('por', '==', uid)), s => { dados.convites = s.docs.map(d => ({ token: d.id, ...d.data() })); });
  }

  async function executar(tx, extra) {
    let novo;
    const t0 = { ...tx, quando: Date.now() };
    await runTransaction(db, async t => {
      const snap = await t.get(banco);
      novo = aplicar(desempacotar(snap.data()), t0);
      t.update(banco, paraDoc(novo));
      t.set(sub('transacoes', String(novo.seq)), { ...t0, seq: novo.seq, por: auth.currentUser.uid, em: serverTimestamp(), ...(novo.cashback ? { cashback: novo.cashback } : {}) });
      if (extra) extra(t, novo);
    });
    return novo;
  }

  /* Sem servidor: fatura vencida e rendimento rodam quando o dono (ou o administrador) abre o app. */
  let rodando = false;
  async function pendencias() {
    if (rodando || !sessao?.slot || !dados.e) return;
    rodando = true;
    try {
      const e = dados.e, t = Date.now(), alvos = sessao.admin ? contas(e) : [sessao.slot];
      for (const s of alvos) {
        if (e.cartoes[s].venc && t >= e.cartoes[s].venc) await executar({ tipo: 'debito', de: s });
        if (e.aplic[s].prox && t >= e.aplic[s].prox) await executar({ tipo: 'rendimento', de: s });
      }
    } catch (err) { console.error('[lumen]', err); }
    rodando = false;
  }

  return {
    dados, executar,
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
          assinar(avisar, admin, user.uid);
          aoMudarSessao(sessao);
        } catch (err) {
          console.error('[lumen]', err);
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
    async criarConta(nome) {
      const slot = proximaConta(dados.e);
      await executar({ tipo: 'conta', slot }, t => t.set(sub('contas', slot), { nome, uid: null, criador: auth.currentUser.uid }));
      return slot;
    },
    renomear: (slot, nome) => writeBatch(db).update(sub('contas', slot), { nome }).commit(),
    async gerarConvite(slot) {
      const token = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
      await writeBatch(db).set(sub('convites', token), { slot, por: auth.currentUser.uid }).commit();
      return token;
    },
    async desvincular(slot) {
      const uid = dados.contas[slot].uid, b = writeBatch(db);
      (await getDocs(query(sub('convites'), where('slot', '==', slot)))).forEach(d => b.delete(d.ref));
      b.update(sub('contas', slot), { uid: null, convite: null });
      b.delete(sub('membros', uid));
      await b.commit();
    },
    async emitirCheque(qtd, valor) {
      const numero = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000), ref = doc(sub('cheques'));
      const c = { numero, slot: sessao.slot, qtd, valor, status: 'emitido', em: serverTimestamp() };
      await writeBatch(db).set(ref, c).commit();
      return { id: ref.id, ...c, em: { seconds: Date.now() / 1000 } };
    },
    compensar: c => executar({ tipo: 'saque', de: c.slot, qtd: c.qtd, valor: c.valor }, t => t.update(sub('cheques', c.id), { status: 'compensado' })),
    devolver: c => writeBatch(db).update(sub('cheques', c.id), { status: 'devolvido' }).commit(),
    cobrar: (para, qtd, msg) => writeBatch(db).set(doc(sub('cobrancas')), { de: sessao.slot, para, qtd, msg, status: 'aberta', em: serverTimestamp() }).commit(),
    pagarCobranca: (c, tipo) => executar({ tipo, de: sessao.slot, para: c.de, qtd: c.qtd, ...(c.msg ? { msg: c.msg } : {}) }, t => t.update(sub('cobrancas', c.id), { status: 'paga' })),
    fecharCobranca: (c, status) => writeBatch(db).update(sub('cobrancas', c.id), { status }).commit(),
    async auditar() {
      const txs = (await getDocs(query(sub('transacoes'), orderBy('seq')))).docs.map(d => d.data());
      return auditar((await getDoc(banco)).data(), txs);
    },
  };
}
