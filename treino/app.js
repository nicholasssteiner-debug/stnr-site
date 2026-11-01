/* Protocolo V — app de treino (stnr.com.br/treino). Firebase Auth + Firestore (projeto level-up-c3f9b). */
import { WORKOUTS, CODES, TIPS, ARMSTRONG, GUIDE, FOODS, GROUPS, SWAP_BY_PROTEIN, MEALS, ALTS, videoUrl } from './data.js?v=9';
// Os ids taco_N e prep_N gravados nos cardápios apontam para a posição na lista: não reordene essas tabelas
import { TACO, TACO_CATS, PREPARADOS, MEDIDAS } from './taco.js?v=9';

const FB_CFG = {
  apiKey: 'AIzaSyCKCIsfFUfPUPTBKwVuYQrVHVgolc2CtsA',
  authDomain: 'level-up-c3f9b.firebaseapp.com',
  projectId: 'level-up-c3f9b',
  storageBucket: 'level-up-c3f9b.firebasestorage.app',
  messagingSenderId: '162788989046',
  appId: '1:162788989046:web:8ab0d9ae8c3197a1352757',
  measurementId: 'G-FYNXYRLGBD'
};
const SDK = 'https://www.gstatic.com/firebasejs/11.0.2/';
const COL = 'protocolo-v';
// Modo de teste local, sem login: http://localhost:PORT/treino/?demo
const DEMO = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('demo');

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const clone = o => JSON.parse(JSON.stringify(o ?? null));
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);
const todayKey = () => keyOf(new Date());
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const fmtShort = k => { const d = parseKey(k); return `${WD[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };
const fmtLong = k => { const d = parseKey(k); return `${WD[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`; };
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const range = (a, b) => { const out = []; for (let k = a; k <= b; k = addDays(k, 1)) out.push(k); return out; };
const ROT = ['A', 'B', 'C'];

function setPath(obj, path, val) {
  const parts = path.split('.'); let o = obj;
  for (let i = 0; i < parts.length - 1; i++) { if (typeof o[parts[i]] !== 'object' || o[parts[i]] === null) o[parts[i]] = {}; o = o[parts[i]]; }
  o[parts.at(-1)] = val;
}
function deepMerge(a, b) {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) deepMerge(a[k], v);
    else a[k] = clone(v);
  }
  return a;
}
const nest = fields => { const o = {}; for (const [p, v] of Object.entries(fields)) setPath(o, p, v); return o; };

/* ---------- estado ---------- */
const S = {
  user: null, profile: null, days: {}, view: 'hoje', dayKey: todayKey(),
  sync: 'ok', swapFrom: null, permErr: false, pendingRender: false, installEvt: null, loginMode: 'in'
};

function rotation(sched, from, end, rest, startIdx) {
  let i = startIdx;
  for (const k of range(from, end)) {
    if (k === end) sched[k] = 'AL';
    else if (rest.includes(parseKey(k).getDay())) sched[k] = 'R';
    else sched[k] = ROT[i++ % 3];
  }
  return sched;
}
function defaultProfile() {
  const t = todayKey();
  const start = t <= '2026-11-15' ? '2026-11-01' : t;
  const end = addDays(start, 14);
  const rest = [6];
  return {
    settings: { start, end, rest, mode: 'gym', kcal: 2750, prot: 120, wheyG: 32, wheyP: 23, wheyK: 125 },
    schedule: rotation({}, start, end, rest, 0),
    status: {}, measures: { [start]: { peso: 63 } }, customFoods: {}, mealTemplate: null,
    criado: new Date().toISOString()
  };
}

/* ---------- armazenamento (Firestore ou demo local) ---------- */
let store = null;

function demoStore() {
  const KEY = 'pv-demo';
  let data; try { data = JSON.parse(localStorage.getItem(KEY)); } catch { }
  if (!data) data = { profile: defaultProfile(), days: {} };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { } S.profile = clone(data.profile); S.days = clone(data.days); render(); };
  S.profile = clone(data.profile); S.days = clone(data.days);
  return {
    email: 'demo@local',
    setFields(fields) { for (const [p, v] of Object.entries(fields)) setPath(data.profile, p, clone(v)); persist(); },
    saveDay(k, fields) { data.days[k] = deepMerge(data.days[k] || {}, nest(fields)); persist(); },
    signOut() { localStorage.removeItem(KEY); location.href = location.pathname; }
  };
}

async function firebaseStart() {
  const [appM, authM, fsM] = await Promise.all([
    import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')
  ]);
  // App com nome próprio: sessão separada das outras páginas do stnr.com.br que entram anônimas no mesmo projeto
  const app = appM.initializeApp(FB_CFG, 'protocolo-v');
  // Persistência com reservas: navegadores internos (WhatsApp, Instagram) e modo privado às vezes bloqueiam o IndexedDB
  let auth;
  try { auth = authM.initializeAuth(app, { persistence: [authM.indexedDBLocalPersistence, authM.browserLocalPersistence, authM.inMemoryPersistence] }); }
  catch { auth = authM.getAuth(app); }
  // Se o Firebase demorar para dizer se há sessão, mostra o login mesmo assim
  setTimeout(() => { if (!$('#boot').hidden && $('#app').hidden) showLogin(); }, 6000);
  auth.languageCode = 'pt';
  let db;
  try { db = fsM.initializeFirestore(app, { localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }) }); }
  catch { db = fsM.getFirestore(app); }

  bindLogin(authM, auth);
  let unsub = [];
  authM.onAuthStateChanged(auth, user => {
    unsub.forEach(f => f()); unsub = [];
    S.user = user;
    if (!user || user.isAnonymous) { S.profile = null; S.days = {}; store = null; showLogin(); return; }
    const profRef = fsM.doc(db, COL, user.uid);
    const daysCol = fsM.collection(db, COL, user.uid, 'dias');
    const onErr = e => { console.error(e); if (e.code === 'permission-denied') S.permErr = true; setSync('err'); render(); if (!S.profile) { S.profile = defaultProfile(); showApp(); } };
    store = {
      email: user.email,
      account: { uid: user.uid, verified: user.emailVerified, created: user.metadata?.creationTime, last: user.metadata?.lastSignInTime },
      resetPassword() { return authM.sendPasswordResetEmail(auth, user.email); },
      setFields(fields) { setSync('saving'); fsM.updateDoc(profRef, fields).catch(onErr); },
      saveDay(k, fields) { setSync('saving'); fsM.setDoc(fsM.doc(daysCol, k), nest(fields), { merge: true }).catch(onErr); },
      signOut() { authM.signOut(auth); }
    };
    unsub.push(fsM.onSnapshot(profRef, { includeMetadataChanges: true }, snap => {
      setSync(snap.metadata.hasPendingWrites ? 'saving' : snap.metadata.fromCache ? 'offline' : 'ok');
      if (!snap.exists()) {
        if (snap.metadata.fromCache && !S.profile) S.profile = defaultProfile();
        if (!snap.metadata.fromCache) fsM.setDoc(profRef, defaultProfile()).catch(onErr);
        if (S.profile) showApp();
        return;
      }
      S.profile = snap.data();
      showApp();
    }, onErr));
    unsub.push(fsM.onSnapshot(daysCol, snap => {
      S.days = Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
      if (S.profile) render();
    }, onErr));
  });
}

function setSync(s) {
  if (!navigator.onLine && s === 'ok') s = 'offline';
  S.sync = s;
  const txt = { ok: 'Sincronizado', saving: 'Salvando…', offline: 'Offline — salva ao reconectar', err: 'Erro ao salvar' }[s];
  for (const el of [$('#sync-state'), $('#sync-state-m')]) { if (!el) continue; el.textContent = el.id === 'sync-state-m' ? '' : txt; el.title = txt; el.className = 'sync' + (s === 'offline' || s === 'saving' ? ' off' : s === 'err' ? ' err' : ''); }
}
addEventListener('online', () => setSync('ok'));
addEventListener('offline', () => setSync('offline'));

/* ---------- login ---------- */
const AUTH_ERR = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.', 'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'Não existe conta com esse e-mail.', 'auth/email-already-in-use': 'Esse e-mail já tem conta. Use Entrar.',
  'auth/weak-password': 'A senha precisa de pelo menos 6 caracteres.', 'auth/invalid-email': 'E-mail inválido.',
  'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente de novo.', 'auth/network-request-failed': 'Sem conexão com a internet.',
  'auth/operation-not-allowed': 'Login por e-mail e senha não está ativado no Firebase.', 'auth/missing-email': 'Digite o e-mail.'
};
function bindLogin(authM, auth) {
  const form = $('#login-form'), msg = $('#lg-msg'), btn = $('#lg-submit'), toggle = $('#lg-toggle');
  const say = (t, ok) => { msg.textContent = t; msg.className = 'form-msg' + (ok ? ' ok' : ''); };
  toggle.onclick = () => {
    S.loginMode = S.loginMode === 'in' ? 'up' : 'in';
    btn.textContent = S.loginMode === 'in' ? 'Entrar' : 'Criar conta';
    toggle.textContent = S.loginMode === 'in' ? 'Criar conta' : 'Já tenho conta';
    $('#lg-pass').autocomplete = S.loginMode === 'in' ? 'current-password' : 'new-password';
    say('');
  };
  $('#lg-reset').onclick = async () => {
    const email = $('#lg-email').value.trim();
    if (!email) return say('Digite o e-mail acima e toque de novo em "Esqueci a senha".');
    try { await authM.sendPasswordResetEmail(auth, email); say('Enviamos um link de redefinição para ' + email + '.', true); }
    catch (e) { say(AUTH_ERR[e.code] || e.message); }
  };
  form.onsubmit = async ev => {
    ev.preventDefault(); say(''); btn.disabled = true;
    const email = $('#lg-email').value.trim(), pass = $('#lg-pass').value;
    try {
      if (S.loginMode === 'in') await authM.signInWithEmailAndPassword(auth, email, pass);
      else await authM.createUserWithEmailAndPassword(auth, email, pass);
    } catch (e) { say(AUTH_ERR[e.code] || e.message); }
    btn.disabled = false;
  };
}
function showLogin() { $('#boot').hidden = true; $('#app').hidden = true; $('#login').hidden = false; }
function showApp() {
  $('#boot').hidden = true; $('#login').hidden = true; $('#app').hidden = false;
  render();
}

/* ---------- regras do plano ---------- */
const P = () => S.profile;
const ST = () => S.profile.settings;
const codeOf = k => P().schedule?.[k] || null;
const dayIdx = k => diffDays(ST().start, k) + 1;
const planLen = () => diffDays(ST().start, ST().end) + 1;
const dayOf = k => S.days[k] || {};

function exercisesOf(code, k) {
  if (code === 'A' || code === 'B' || code === 'C') return WORKOUTS[code].ex;
  if (code === 'AL') return WORKOUTS.A.ex.map(e => ({ ...e, s: Math.max(1, Math.ceil(e.s / 2)) }));
  if (code === 'ARM') {
    const n = armNum(k);
    return [
      { id: 'arm_flex', n: 'Flexão — série máxima (manhã)', s: 3, r: 'máx', home: 'Flexão', rest: 90 },
      { id: 'arm_barra', n: 'Barra — ' + ARMSTRONG[n].replace(/^Dia \d — /, ''), s: n === 2 ? 9 : 5, r: n === 0 ? 'máx' : 'fixo', home: 'Barra de porta', rest: 90, tip: 'puxada' }
    ];
  }
  return [];
}
// Exercícios do dia com as trocas aplicadas (só hoje > sempre > original). A troca muda o id, então cada exercício guarda seu próprio histórico de cargas.
function exercisesFor(k) {
  const code = codeOf(k);
  if (!code) return [];
  const day = dayOf(k), perm = P().exSwap || {}, home = (day.mode || ST().mode) === 'home';
  return exercisesOf(code, k).map(e => {
    // Sem academia é outro exercício: histórico próprio, para a progressão comparar igual com igual
    if (home) return { ...e, id: e.id + '__casa', slot: e.id };
    const alts = ALTS[e.id];
    if (!alts) return { ...e, slot: e.id };
    const today = day.swap?.[e.id], key = today ?? perm[e.id];
    const alt = key && key !== 'orig' ? alts.find(a => a.k === key) : null;
    if (!alt) return { ...e, slot: e.id };
    return { ...e, id: e.id + '__' + alt.k, slot: e.id, n: alt.n, orig: e.n, swapped: today ? 'só hoje' : 'sempre' };
  });
}

/* ---------- progressão ---------- */
// Faixa de repetições do plano: "8–12" → {lo: 8, hi: 12}; "15" → {lo: 15, hi: 15}
function repRange(r) {
  const m = String(r).match(/(\d+)\s*[–-]\s*(\d+)/), one = String(r).match(/\d+/);
  if (m) return { lo: +m[1], hi: +m[2] };
  return one ? { lo: +one[0], hi: +one[0] } : null;
}
// Degrau de carga: halteres e isoladores sobem devagar; básicos com barra e máquinas, mais
function loadStep(name) {
  const n = norm(name);
  if (/leg press/.test(n)) return 5;
  if (/elevacao|rosca|crucifixo|face pull|triceps|pullover|panturrilha|y-raise|frances/.test(n)) return 1;
  if (/halter/.test(n)) return 2;
  return 2.5;
}
const e1rm = (w, r) => w > 0 ? w * (1 + r / 30) : r; // Epley; sem carga, conta as repetições
// Sessões anteriores a k de um exercício: [{d, sets, best}] da mais antiga para a mais nova
function sessionsOf(id, k = '9999') {
  return Object.keys(S.days).filter(d => d < k).sort().map(d => {
    const sets = (S.days[d].sets?.[id] || []).filter(x => x && +x.r > 0).map(x => ({ w: +x.w || 0, r: +x.r }));
    if (!sets.length) return null;
    return { d, sets, best: Math.max(...sets.map(x => e1rm(x.w, x.r))) };
  }).filter(Boolean);
}
// Meta de hoje (dupla progressão): bateu o topo da faixa em todas as séries → sobe a carga e volta ao início da faixa
function nextTarget(e, k) {
  const rr = repRange(e.r), hist = sessionsOf(e.id, k), last = hist.at(-1);
  if (!rr || /máx|fixo/.test(e.r)) return null;
  if (!last) return { w: null, r: rr.lo, kind: 'novo', txt: `Primeira vez: escolha uma carga em que a última repetição fique difícil entre ${rr.lo} e ${rr.hi}.` };
  const top = Math.max(...last.sets.map(x => x.w)), atTop = last.sets.filter(x => x.w === top), minR = Math.min(...atTop.map(x => x.r));
  const enough = last.sets.length >= Math.min(e.s, 2);
  if (top === 0) {
    if (enough && minR >= rr.hi) return { w: 0, r: rr.hi, kind: 'up', txt: `Você bateu ${rr.hi} repetições: acrescente carga (mochila ou cinto) ou desça em 4 s.` };
    return { w: 0, r: Math.min(rr.hi, minR + 1), kind: 'rep', txt: `Meta: ${Math.min(rr.hi, minR + 1)} repetições por série.` };
  }
  if (enough && minR >= rr.hi) {
    const w = top + loadStep(e.n);
    return { w, r: rr.lo, kind: 'up', txt: `Subir a carga: ${fmt(w, 1)} kg × ${rr.lo}–${rr.hi} (você fez ${rr.hi}+ em todas com ${fmt(top, 1)} kg).` };
  }
  if (minR < rr.lo - 1) {
    const w = Math.max(0, Math.round(top * 0.9 / 0.5) * 0.5);
    return { w, r: rr.lo, kind: 'down', txt: `Carga pesada demais (${minR} repetições): ${fmt(w, 1)} kg e busque ${rr.lo}–${rr.hi}.` };
  }
  const r = Math.min(rr.hi, Math.max(rr.lo, minR + 1));
  return { w: top, r, kind: 'rep', txt: `Mesma carga, +1 repetição: ${fmt(top, 1)} kg × ${r}.` };
}
// Situação do exercício: estagnado = 3 sessões seguidas sem superar o melhor de antes
function exStatus(id, k) {
  const h = sessionsOf(id, k);
  if (h.length < 2) return { kind: 'novo', h };
  const bestBefore = n => Math.max(...h.slice(0, -n).map(x => x.best));
  if (h.length >= 4 && Math.max(...h.slice(-3).map(x => x.best)) <= bestBefore(3)) return { kind: 'estagnado', h };
  if (h.at(-1).best < bestBefore(1) * 0.93) return { kind: 'caiu', h };
  return { kind: h.at(-1).best > bestBefore(1) ? 'subiu' : 'manteve', h };
}

// Nome legível de um id de histórico: "a4", "a4__maq" (troca) ou "a4__casa" (sem academia)
const PLAN_EX = () => ['A', 'B', 'C'].flatMap(c => WORKOUTS[c].ex.map(e => ({ ...e, w: c })));
function exInfo(id) {
  const [slot, alt] = id.split('__'), base = PLAN_EX().find(e => e.id === slot);
  if (!base) return null;
  const a = alt && alt !== 'casa' ? ALTS[slot]?.find(x => x.k === alt) : null;
  return { ...base, id, slot, n: alt === 'casa' ? base.home + ' (sem academia)' : a ? a.n : base.n };
}

/* ---------- balança ---------- */
// Ganho de massa magra aos 63 kg: +0,2 a +0,5 kg por semana. A 1ª semana não conta: a creatina segura 1–2 kg de água.
function weightTrend() {
  const st = ST(), M = P().measures || {}, t = todayKey();
  const all = Object.keys(M).filter(d => +M[d]?.peso > 0).sort();
  const day1 = M[st.start]?.peso ? +M[st.start].peso : (all[0] ? +M[all[0]].peso : null);
  const after = all.filter(d => d >= addDays(st.start, 7));
  // Regra do plano: no dia 8, peso sem subir → shake extra
  if (day1 && after.length && t <= addDays(st.start, 13)) {
    const w8 = +M[after[0]].peso;
    if (w8 <= day1) return { kind: 'low', delta: 450, shake: true, txt: `No dia 8 o peso não subiu (${fmt(day1, 1)} → ${fmt(w8, 1)} kg). Pelo plano: acrescente um shake extra de leite em pó, aveia e pasta de amendoim (~450 kcal).` };
    return { kind: 'ok', txt: `Peso subiu ${fmt(w8 - day1, 1)} kg até o dia 8 — a creatina e a dieta estão funcionando.` };
  }
  const pts = after.map(d => [diffDays(st.start, d), +M[d].peso]);
  if (pts.length < 2 || pts.at(-1)[0] - pts[0][0] < 6) return { kind: 'pouco', txt: 'Pese-se em Medidas no dia 8 e depois uma vez por semana, de manhã e em jejum: o app usa a balança para ajustar as calorias.' };
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const perWeek = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0) * 7;
  if (perWeek < 0.15) return { kind: 'low', perWeek, delta: 200, txt: `O peso está parado (${fmt(perWeek, 2)} kg por semana). Para ganhar músculo, suba cerca de 200 kcal por dia.` };
  if (perWeek > 0.6) return { kind: 'high', perWeek, delta: -150, txt: `O peso sobe rápido (${fmt(perWeek, 2)} kg por semana): parte vira gordura na cintura. Reduza cerca de 150 kcal por dia.` };
  return { kind: 'ok', perWeek, txt: `Ritmo bom: ${fmt(perWeek, 2)} kg por semana (meta: 0,2 a 0,5).` };
}
function weightCard() {
  const w = weightTrend(), st = ST();
  const btns = w.delta ? `<div class="actions ${w.shake ? 'two' : ''}" style="margin-top:10px">
      ${w.shake ? '<button class="btn btn-primary" data-act="addshake">Pôr o shake no cardápio padrão</button>' : ''}
      <button class="btn ${w.shake ? '' : 'btn-primary'}" data-act="applykcal" data-v="${st.kcal + w.delta}">Meta de calorias: ${fmt(st.kcal)} → ${fmt(st.kcal + w.delta)} kcal</button></div>` : '';
  return `<div class="card"><h3>Balança</h3><p class="small" style="color:var(--text-2);margin:6px 0 0">${w.kind === 'ok' ? '✓ ' : ''}${esc(w.txt)}</p>${btns}</div>`;
}

/* ----- Evolução ----- */
function viewEvolucao() {
  const t = todayKey(), st = ST();
  const ids = [...new Set(Object.values(S.days).flatMap(d => Object.keys(d.sets || {})))].map(exInfo).filter(Boolean);
  const rows = ids.map(x => ({ x, s: exStatus(x.id, '9999'), tg: nextTarget(x, addDays(t, 1)) })).filter(r => r.s.h.length);
  const count = k => rows.filter(r => r.s.kind === k).length;
  const label = { subiu: ['Evoluindo', 'w-c'], manteve: ['Mantendo', 'w-livre'], estagnado: ['Estagnado', 'w-b'], caiu: ['Caiu', 'w-b'], novo: ['1º registro', 'w-r'] };
  const spark = h => { if (h.length < 2) return ''; const v = h.map(s => s.best), lo = Math.min(...v), hi = Math.max(...v), sp = hi - lo || 1; return `<svg viewBox="0 0 80 24" class="spark"><polyline points="${v.map((b, i) => `${i / (v.length - 1) * 78 + 1},${22 - (b - lo) / sp * 20}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/></svg>`; };
  const card = c => {
    const list = rows.filter(r => r.x.w === c);
    if (!list.length) return '';
    return `<div class="card"><h3>${WORKOUTS[c].name} — ${esc(WORKOUTS[c].title)}</h3><div class="evo-list">${list.map(({ x, s, tg }) => {
      const last = s.h.at(-1), top = last.sets.reduce((a, b) => (b.w > a.w || (b.w === a.w && b.r > a.r) ? b : a));
      const cur = P().exSwap?.[x.slot], nextAlt = ALTS[x.slot]?.find(a => a.k !== cur && x.id !== x.slot + '__' + a.k);
      return `<div class="evo-row"><div class="grow" style="min-width:0"><b class="small">${esc(x.n)}</b>
          <div class="muted small">${s.h.length} ${s.h.length === 1 ? 'treino' : 'treinos'} · último: ${top.w ? fmt(top.w, 1) + ' kg × ' : ''}${top.r} reps (${esc(fmtShort(last.d))})</div>
          ${tg ? `<div class="target t-${tg.kind}">${esc(tg.txt)}</div>` : ''}
          ${s.kind === 'estagnado' && nextAlt && !x.id.endsWith('__casa') ? `<button class="btn btn-sm" style="margin-top:6px" data-act="evoswap" data-slot="${x.slot}" data-k="${nextAlt.k}">Trocar por ${esc(nextAlt.n)}</button>` : ''}</div>
        <div class="evo-side"><span class="chip ${label[s.kind][1]}">${label[s.kind][0]}</span>${spark(s.h)}</div></div>`;
    }).join('')}</div></div>`;
  };
  const ended = t > st.end;
  return `<div class="view-head"><div class="grow"><h2>Evolução</h2><div class="muted small">O app compara cada treino com os anteriores e ajusta a meta: sobe a carga quando você bate o topo da faixa de repetições, pede +1 repetição quando ainda não bateu e reduz quando a carga passou do ponto.</div></div></div>
    <div class="grid two"><div class="grid">
      ${rows.length ? `<div class="card"><div class="stats" style="margin-top:0"><div class="stat"><b>${count('subiu')}</b><span>Evoluindo</span></div><div class="stat"><b>${count('manteve') + count('novo')}</b><span>Mantendo</span></div><div class="stat"><b>${count('estagnado') + count('caiu')}</b><span>Atenção</span></div></div></div>` : '<div class="card"><div class="empty-state">Registre carga e repetições nos treinos (aba Hoje) para a evolução aparecer aqui.</div></div>'}
      ${card('A')}${card('B')}${card('C')}
    </div><div class="grid">
      ${weightCard()}
      <div class="card"><h3>${ended ? 'Bloco encerrado' : 'Próximo bloco'}</h3>
        <p class="small" style="color:var(--text-2);margin:6px 0 0">${ended ? `O plano terminou em ${esc(fmtShort(st.end))}.` : `O bloco atual vai até ${esc(fmtShort(st.end))}.`} Repetir os mesmos exercícios por muito tempo trava a evolução: o novo bloco começa hoje, mantém as cargas e troca por uma variação os exercícios estagnados.</p>
        <button class="btn ${ended ? 'btn-primary' : ''} btn-block" style="margin-top:10px" data-act="newblock">Começar novo bloco de ${planLen()} dias hoje</button></div>
      <div class="card"><h3>Regras</h3><ul class="small" style="padding-left:18px;color:var(--text-2);margin-bottom:0">
        <li><b>Dupla progressão:</b> fez o topo da faixa em todas as séries → sobe ${'1 kg'} (isoladores), 2 kg (halteres) ou 2,5 kg (barra e máquina) e volta ao início da faixa.</li>
        <li><b>Estagnado:</b> 3 treinos seguidos sem superar o melhor anterior (carga × repetições).</li>
        <li><b>Balança:</b> meta de +0,2 a +0,5 kg por semana depois da 1ª semana; fora disso, o app sugere ajustar as calorias.</li></ul></div>
    </div></div>`;
}
function armNum(k) { return Object.entries(P().schedule).filter(([d, c]) => c === 'ARM' && d < k).length % 5; }
function creatinaDoses(k) { const i = dayIdx(k); return i >= 1 && i <= 7 ? 4 : 1; }
function gtgSize() { const m = P().measures?.[ST().start]?.barras; return m ? Math.max(1, Math.floor(m / 2)) : null; }

function eventsOf(k) {
  const st = ST(), ev = [], code = codeOf(k), i = dayIdx(k);
  if (k === st.start) ev.push(['Medições + fotos; testar máximo de barras', 'medidas']);
  if (i === 8) ev.push(['Pesar (só para conferir a dieta)', 'medidas']);
  if (i <= 7 && i >= 1) ev.push(['Creatina: fase de carga, 4 × 5 g', null]);
  if (i === 8) ev.push(['Creatina: a partir de hoje, 5 g por dia', null]);
  if (k === addDays(st.end, -1)) ev.push(['Refeição livre no almoço, não à noite', 'dieta']);
  if (k === st.end) ev.push(['Medições + fotos de manhã; foto extra após o treino', 'medidas']);
  if (code === 'B' || code === 'C') ev.push(['Barra GTG ao longo do dia' + (gtgSize() ? ` (séries de ${gtgSize()})` : ''), null]);
  if (code === 'R') ev.push(['Caminhada leve', null]);
  return ev;
}

function lastSets(id, k) {
  const keys = Object.keys(S.days).filter(d => d < k).sort().reverse();
  for (const d of keys) { const s = S.days[d].sets?.[id]; if (s && s.some(x => x && (x.w || x.r))) return { date: d, sets: s }; }
  return null;
}

/* ---------- dieta ---------- */
function food(f) {
  if (f === 'whey') {
    const st = ST(), r = (+st.wheyK || FOODS.whey.k) / FOODS.whey.k;
    return { ...FOODS.whey, u: `1 dose (${st.wheyG} g)`, k: +st.wheyK, p: +st.wheyP, c: FOODS.whey.c * r, f: FOODS.whey.f * r };
  }
  if (f.startsWith('taco_')) { const r = TACO[+f.slice(5)]; if (r) return { n: r[0], u: '100 g', k: r[2], p: r[3], c: r[4], f: r[5], g: 'ext', per100: true, src: 'TACO · ' + TACO_CATS[r[1]] }; }
  if (f.startsWith('prep_')) { const r = PREPARADOS[+f.slice(5)]; if (r) return { n: r[0], u: '100 g', k: r[1], p: r[2], c: r[3], f: r[4], g: 'ext', per100: true, med: r[5], src: 'prato pronto (estimativa)' }; }
  return FOODS[f] || P().customFoods?.[f] || { n: 'Alimento removido', u: '', k: 0, p: 0, c: 0, f: 0, g: 'ext' };
}
function templateMeals() {
  const t = P().mealTemplate;
  if (t) return clone(t);
  return MEALS.map(m => ({ id: m.id, n: m.n, h: m.h, items: m.items.map(([f, q]) => ({ f, q })) }));
}
const mealsOf = k => dayOf(k).meals ? clone(dayOf(k).meals) : templateMeals();
function totals(meals, onlyEaten) {
  const t = { k: 0, p: 0, c: 0, f: 0 };
  for (const m of meals) for (const it of m.items) {
    if (onlyEaten && !it.ok) continue;
    const x = food(it.f);
    for (const n of ['k', 'p', 'c', 'f']) t[n] += (+x[n] || 0) * it.q;
  }
  return t;
}
const roundHalf = x => Math.max(0.5, Math.round(x * 2) / 2);

/* ---------- navegação ---------- */
const ICONS = {
  hoje: '<path d="M4 12h3l2-6 4 12 2-6h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  agenda: '<rect x="3.5" y="5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  dieta: '<path d="M7 3v8a3 3 0 0 0 3 3v7M7 3v5M10 3v5M13 3v5M17 3c-1.5 0-3 2-3 6s1.5 5 3 5v7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  medidas: '<path d="M4 17 17 4l3 3L7 20zM8 13l2 2M11 10l2 2M14 7l2 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>',
  fichas: '<path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  guia: '<path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 9h6M9 13h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  ajustes: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  mais: '<circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/>'
};
ICONS.conta = '<circle cx="12" cy="8.5" r="3.8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
ICONS.evolucao = '<path d="M4 19h16M6 15l4-4 3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h4v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
const TITLES = { hoje: 'Hoje', agenda: 'Agenda', dieta: 'Dieta', medidas: 'Medidas', evolucao: 'Evolução', fichas: 'Fichas', guia: 'Guia', ajustes: 'Ajustes', conta: 'Conta', mais: 'Mais' };
const SIDE = ['hoje', 'agenda', 'dieta', 'medidas', 'evolucao', 'fichas', 'guia', 'ajustes', 'conta'];
const TABS = ['hoje', 'agenda', 'dieta', 'medidas', 'mais'];
const svg = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

function go(view) { if (!TITLES[view]) view = 'hoje'; S.view = view; if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view); render(); scrollTo(0, 0); }
addEventListener('hashchange', () => go(location.hash.slice(1)));
S.view = TITLES[location.hash.slice(1)] ? location.hash.slice(1) : 'hoje';

/* ---------- render ---------- */
function inputFocused() { const a = document.activeElement; return a && a.closest && a.closest('#view') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); }
// Identidade estável de um controle, para devolver o foco depois de redesenhar a tela
function focusKey(el) {
  if (!el?.closest?.('#view') || !el.dataset || (!el.dataset.act && !el.dataset.ch)) return null;
  return ['act', 'ch', 'id', 'i', 'f', 'm', 'h', 'k', 'd', 'v', 's'].map(x => el.dataset[x] ?? '').join('|');
}
let renderT = 0;
function render() { clearTimeout(renderT); renderT = setTimeout(renderNow, 0); }
function renderNow() {
  if (!S.profile || $('#app').hidden) return;
  if (inputFocused()) { S.pendingRender = true; return; }
  S.pendingRender = false;
  const fk = focusKey(document.activeElement);
  const v = S.view;
  $('#side-nav').innerHTML = SIDE.map(n => `<button class="${v === n ? 'on' : ''}" data-act="go" data-v="${n}">${svg(n)}${TITLES[n]}</button>`).join('');
  const inMais = ['evolucao', 'fichas', 'guia', 'ajustes', 'conta', 'mais'].includes(v);
  const who = store?.email || 'Modo de teste';
  $('#side-account').innerHTML = `<button class="acct" data-act="go" data-v="conta" title="Conta conectada">${svg('conta')}<span><small>Conectado como</small>${esc(who)}</span></button>`;
  $('#top-account').innerHTML = `<button class="icon-btn" data-act="go" data-v="conta" aria-label="Conta: ${esc(who)}" title="${esc(who)}">${esc(who[0].toUpperCase())}</button>`;
  $('#tabbar').innerHTML = TABS.map(n => `<button class="${v === n || (n === 'mais' && inMais) ? 'on' : ''}" data-act="go" data-v="${n}">${svg(n)}${TITLES[n]}</button>`).join('');
  $('#view-title').textContent = TITLES[v];
  const done = Object.values(P().status || {}).filter(s => s === 'done').length;
  const trainDays = Object.values(P().schedule).filter(c => c !== 'R').length;
  $('#side-progress').innerHTML = `<div class="meter"><div class="row between small"><span class="muted">Treinos feitos</span><b>${done}/${trainDays}</b></div><div class="bar"><i style="width:${Math.min(100, done / Math.max(1, trainDays) * 100)}%"></i></div></div>`;
  const views = { hoje: viewHoje, agenda: viewAgenda, dieta: viewDieta, medidas: viewMedidas, evolucao: viewEvolucao, fichas: viewFichas, guia: viewGuia, ajustes: viewAjustes, conta: viewConta, mais: viewMais };
  $('#view').innerHTML = (S.permErr ? permBanner() : '') + views[v]();
  if (fk) [...document.querySelectorAll('#view [data-act], #view [data-ch]')].find(el => focusKey(el) === fk)?.focus({ preventScroll: true });
  setSync(S.sync);
}
document.addEventListener('focusout', () => setTimeout(() => { if (S.pendingRender && !inputFocused()) render(); }, 0));

function permBanner() {
  return `<div class="banner"><b>O Firestore recusou a gravação.</b> No console do Firebase (level-up-c3f9b → Firestore → Regras), publique:
<pre>rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /${COL}/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}</pre></div>`;
}

function dayNav(k) {
  const t = todayKey();
  return `<div class="daynav"><button class="icon-btn" data-act="day" data-d="-1" aria-label="Dia anterior">‹</button>
    <div class="label">${k === t ? 'Hoje' : esc(fmtShort(k))}</div>
    <button class="icon-btn" data-act="day" data-d="1" aria-label="Próximo dia">›</button>
    ${k !== t ? '<button class="btn btn-sm btn-ghost" data-act="day" data-d="0">Hoje</button>' : ''}</div>`;
}

/* ----- Hoje ----- */
function viewHoje() {
  const k = S.dayKey, st = ST(), day = dayOf(k), code = codeOf(k), W = code ? WORKOUTS[code] : null;
  const i = dayIdx(k), N = planLen(), status = P().status?.[k];
  const mode = day.mode || st.mode;
  const exs = exercisesFor(k);
  let setsDone = 0, setsTotal = 0;
  for (const e of exs) { const arr = day.sets?.[e.id] || []; const n = Math.max(e.s, arr.length); setsTotal += n; setsDone += arr.filter(x => x?.ok).length; }

  const kicker = code ? `Dia ${i} de ${N} · ${esc(fmtLong(k))}` : esc(fmtLong(k));
  const hero = W ? `
    <div class="card hero" style="--wc-col:var(--w${W.color})">
      <div class="kicker">${kicker}</div>
      <div class="row between"><div class="big">${esc(W.title)}</div><span class="chip w-${W.color}">${code === 'AL' ? 'A leve' : code === 'R' ? 'Descanso' : code}</span></div>
      <div class="muted">${esc(W.sub)}</div>
      ${exs.length ? `<div class="stats"><div class="stat"><b>${setsDone}/${setsTotal}</b><span>Séries</span></div><div class="stat"><b>${exs.length}</b><span>Exercícios</span></div><div class="stat"><b>${creatinaDoses(k) * 5} g</b><span>Creatina</span></div></div>` : ''}
      ${eventsOf(k).length ? `<div class="pill-list" style="margin-top:12px">${eventsOf(k).map(([t, v]) => v ? `<button class="chip w-livre" style="border:0;cursor:pointer" data-act="go" data-v="${v}">${esc(t)} ›</button>` : `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="row" style="margin-top:14px">
        ${status === 'done' ? '<button class="btn btn-sm" data-act="status" data-s="">✓ Feito — desfazer</button>' : `<button class="btn btn-primary btn-sm" data-act="status" data-s="done">Concluir dia</button>`}
        ${status === 'skip' ? '<button class="btn btn-sm" data-act="status" data-s="">Pulado — desfazer</button>' : status !== 'done' ? '<button class="btn btn-sm btn-ghost" data-act="status" data-s="skip">Pular</button>' : ''}
        <button class="btn btn-sm btn-ghost" data-act="daysheet" data-k="${k}">Trocar / adiar</button>
      </div>
    </div>` : `
    <div class="card"><div class="kicker">${kicker}</div><h3>Fora do período do plano</h3>
      <p class="muted">O plano vai de ${esc(fmtShort(st.start))} a ${esc(fmtShort(st.end))}. Você ainda pode registrar hábitos e dieta deste dia.</p>
      ${k > st.end ? `<button class="btn btn-primary btn-sm" data-act="extendto" data-k="${k}">Estender o plano até ${esc(fmtShort(k))}</button>` : ''}</div>`;

  let work = '';
  if (exs.length) {
    work = `<div class="card"><div class="card-head"><div><h3>Exercícios</h3><div class="muted small">Toque em ✓ ao terminar a série; o descanso começa sozinho.</div></div>
      <div class="seg"><button class="${mode === 'gym' ? 'on' : ''}" data-act="mode" data-m="gym">Academia</button><button class="${mode === 'home' ? 'on' : ''}" data-act="mode" data-m="home">Sem academia</button></div></div>
      ${exs.map((e, n) => exRow(e, n, k, mode)).join('')}
      ${code === 'A' || code === 'AL' ? `<div class="ex-tip"><b>Finalizador:</b> ${esc(WORKOUTS.A.finisher)}</div>` : ''}
      ${code === 'ARM' ? `<div class="ex-tip">Nesta versão, mantenha as elevações laterais com garrafas do Treino A e as pernas do Treino C sem academia, três vezes por semana.</div>` : ''}
    </div>`;
  } else if (code === 'R') {
    work = `<div class="card"><h3>Descanso</h3><p class="muted">Caminhada leve. Postura e vacuum continuam; creatina também. Mantenha o cardápio e tome o segundo whey à tarde.</p>
      ${k < st.end ? `<button class="btn btn-block" data-act="pullfwd" data-k="${k}">Quero treinar neste dia (adiantar o próximo treino)</button>` : ''}</div>`;
  } else if (code === 'LIVRE') {
    work = `<div class="card"><h3>Atividade livre</h3><label>O que você fez<textarea data-ch="note" placeholder="Ex.: futebol 1 h, corrida 5 km">${esc(day.note || '')}</textarea></label></div>`;
  }

  const t = totals(mealsOf(k), true), tp = totals(mealsOf(k));
  const stuck = exs.filter(e => exStatus(e.id, k).kind === 'estagnado').length, wt = weightTrend();
  const alert = stuck || wt.delta ? `<button class="card alert-card" data-act="go" data-v="evolucao"><b>Ajustes sugeridos ›</b><span class="small">${[stuck ? `${stuck} ${stuck === 1 ? 'exercício parado' : 'exercícios parados'} há 3 treinos` : '', wt.delta ? (wt.delta > 0 ? 'peso sem subir: comer mais' : 'peso subindo rápido: comer menos') : ''].filter(Boolean).join(' · ')}</span></button>` : '';
  const side = `
    ${alert}
    ${habitsCard(k, code)}
    <div class="card"><div class="card-head"><h3>Dieta do dia</h3><button class="link small" data-act="go" data-v="dieta">Abrir ›</button></div>
      ${meter('Calorias', t.k, st.kcal, 'kcal')}${meter('Proteína', t.p, st.prot, 'g')}
      <div class="muted small" style="margin-top:6px">Planejado: ${fmt(tp.k)} kcal · ${fmt(tp.p)} g de proteína</div></div>
    ${code !== 'LIVRE' ? `<div class="card"><h3>Anotação</h3><textarea data-ch="note" placeholder="Como foi o treino, dores, sono…">${esc(day.note || '')}</textarea></div>` : ''}`;

  return `<div class="view-head"><div class="grow"><h2>${k === todayKey() ? 'Hoje' : 'Dia'}</h2></div>${dayNav(k)}</div>
    <div class="grid two"><div class="grid">${hero}${work}</div><div class="grid">${side}</div></div>`;
}

function meter(label, v, target, unit) {
  const pct = target ? v / target * 100 : 0;
  return `<div class="meter" style="margin-bottom:8px"><div class="row between"><span>${label}</span><span><b>${fmt(v)}</b> <span class="muted">/ ${fmt(target)} ${unit}</span></span></div><div class="bar ${pct > 115 ? 'over' : ''}"><i style="width:${Math.min(100, pct)}%"></i></div></div>`;
}

function exRow(e, n, k, mode) {
  const arr = dayOf(k).sets?.[e.id] || [];
  const rows = Math.max(e.s, arr.length);
  const last = lastSets(e.id, k);
  const done = rows > 0 && arr.filter(x => x?.ok).length >= rows;
  const name = mode === 'home' ? e.home : e.n;
  const alt = mode === 'home' ? 'Academia: ' + e.n : 'Sem academia: ' + e.home;
  const lastTxt = last ? last.sets.filter(x => x && (x.w || x.r)).map(x => `${x.w || '–'}×${x.r || '–'}`).join(' · ') : '';
  const tg = nextTarget(e, k), st = exStatus(e.id, k);
  let sets = '';
  for (let i = 0; i < rows; i++) {
    // O que aparece apagado no campo é a meta de hoje; ✓ sem digitar registra a meta
    const s = arr[i] || {}, ls = last?.sets?.[i] || {};
    const pw = (tg?.w || ls.w) || 'kg', pr = tg?.r ?? ls.r ?? 'reps';
    sets += `<div class="set"><span class="n">${i + 1}</span>
      <input type="number" inputmode="decimal" step="0.5" min="0" placeholder="${esc(pw)}" value="${esc(s.w ?? '')}" data-ch="set" data-id="${e.id}" data-i="${i}" data-f="w" aria-label="Peso série ${i + 1}">
      <input type="number" inputmode="numeric" min="0" placeholder="${esc(pr)}" value="${esc(s.r ?? '')}" data-ch="set" data-id="${e.id}" data-i="${i}" data-f="r" aria-label="Repetições série ${i + 1}">
      <button class="check ${s.ok ? 'on' : ''}" data-act="setok" data-id="${e.id}" data-i="${i}" data-rest="${e.rest}" data-name="${esc(name)}" aria-label="Série ${i + 1} feita">✓</button></div>`;
  }
  return `<div class="ex ${done ? 'done' : ''}">
    <div class="ex-head"><div class="ex-num">${done ? '✓' : n + 1}</div><div class="grow">
      <div class="ex-name">${esc(name)}</div>
      <div class="ex-meta">${e.s} × ${esc(e.r)}${e.obs ? ' · ' + esc(e.obs) : ''}</div>
      <div class="ex-alt">${esc(alt)}</div>
      ${e.swapped ? `<div class="ex-alt" style="color:var(--wlivre)">Troca (${e.swapped}) · original: ${esc(e.orig)}</div>` : ''}
      ${lastTxt ? `<div class="last">Última vez (${esc(fmtShort(last.date))}): ${esc(lastTxt)}</div>` : ''}
      ${tg ? `<div class="target t-${tg.kind}">${esc(tg.txt)}</div>` : ''}
      ${st.kind === 'estagnado' ? `<div class="target t-down">Sem evoluir há 3 treinos. ${ALTS[e.slot] ? 'Vale trocar por uma variação (⇄ Trocar) ou ' : ''}fazer uma semana com 1 série a menos para recuperar.</div>` : ''}
    </div>${e.tip ? `<button class="mini" data-act="tip" data-id="${e.id}" aria-label="Como executar">?</button>` : ''}</div>
    ${e.tip ? `<div class="ex-tip" id="tip-${e.id}" hidden>${esc(TIPS[e.tip])}${e.tip === 'lateral' ? '<br><br>' + esc(TIPS.dor) : ''}</div>` : ''}
    <div class="sets"><div class="set-head"><span>#</span><span>kg</span><span>reps</span><span></span></div>${sets}</div>
    <div class="row ex-actions" style="margin-top:6px"><button class="link small" data-act="addset" data-id="${e.id}">+ série</button><span class="grow"></span>
      <a class="btn btn-sm btn-ghost" href="${videoUrl(name)}" target="_blank" rel="noopener" title="Vídeos de execução no YouTube">▶ Exemplo</a>
      ${ALTS[e.slot] ? `<button class="btn btn-sm btn-ghost" data-act="exswap" data-slot="${e.slot}">⇄ Trocar</button>` : ''}
      <button class="btn btn-sm btn-ghost" data-act="timer" data-rest="${e.rest}" data-name="${esc(name)}">Descanso ${e.rest}s</button></div>
  </div>`;
}

function habitsCard(k, code) {
  const h = dayOf(k).h || {};
  const dots = (id, n, labels) => `<div class="dots">${Array.from({ length: n }, (_, i) => `<button class="dot ${(h[id] || 0) > i ? 'on' : ''}" data-act="habit" data-h="${id}" data-i="${i}" aria-label="${labels ? labels[i] : i + 1}">${labels ? labels[i] : i + 1}</button>`).join('')}</div>`;
  const cr = creatinaDoses(k);
  const gtg = code === 'B' || code === 'C';
  const g = gtgSize();
  return `<div class="card"><h3>Hábitos do dia</h3><div class="habits" style="margin-top:8px">
    <div class="habit"><div class="t"><b>Postura</b><span>5 min ao acordar</span></div>${dots('postura', 1, ['✓'])}</div>
    <div class="habit"><div class="t"><b>Vacuum</b><span>3 × 20–30 s</span></div>${dots('vacuum', 3)}</div>
    <div class="habit"><div class="t"><b>Creatina</b><span>${cr === 4 ? 'Carga: 4 × 5 g com as refeições' : '5 g com uma refeição'}</span></div>${dots('creatina', cr, cr === 4 ? ['5', '10', '15', '20'] : ['5g'])}</div>
    <div class="habit"><div class="t"><b>Whey</b><span>2 doses espaçadas</span></div>${dots('whey', 2)}</div>
    <div class="habit"><div class="t"><b>Água</b><span>Garrafa de 1 L, três vezes</span></div>${dots('agua', 3, ['1L', '2L', '3L'])}</div>
    ${gtg ? `<div class="habit"><div class="t"><b>Barra GTG</b><span>${g ? `Séries de ${g}` : 'Séries de metade do máximo'}, 1 h entre elas</span></div>${dots('gtg', 8)}</div>` : ''}
    <div class="habit"><div class="t"><b>Sono 7 h+</b><span>Recuperação</span></div>${dots('sono', 1, ['✓'])}</div>
  </div></div>`;
}

/* ----- Agenda (calendário flexível) ----- */
function viewAgenda() {
  const st = ST(), sch = P().schedule, status = P().status || {}, t = todayKey();
  const first = addDays(st.start, -parseKey(st.start).getDay());
  const last = addDays(st.end, 6 - parseKey(st.end).getDay());
  let cells = WD.map(w => `<div class="cal-dow">${w}</div>`).join('');
  for (const k of range(first, last)) {
    const d = parseKey(k), inP = k >= st.start && k <= st.end, c = sch[k], W = c && WORKOUTS[c];
    const dnum = d.getDate() === 1 || k === first ? `${d.getDate()}/${d.getMonth() + 1}` : d.getDate();
    if (!inP) { cells += `<div class="cal-day out"><div class="d">${dnum}</div></div>`; continue; }
    const i = dayIdx(k), marks = [];
    if (i <= 7) marks.push('<span class="mk cr">20g</span>');
    if (k === st.start || k === st.end) marks.push('<span class="mk">MED</span>');
    if (c === 'B' || c === 'C') marks.push('<span class="mk">GTG</span>');
    if (S.days[k]?.note) marks.push('<span class="mk">✎</span>');
    cells += `<button class="cal-day ${k === t ? 'today' : ''} ${status[k] || ''} ${S.swapFrom === k ? 'sel' : ''}" data-act="calday" data-k="${k}" draggable="true">
      <div class="d"><span>${dnum}</span></div>
      <div class="code" style="--c:var(--w${W ? W.color : 'r'})">${c === 'AL' ? 'A·' : c === 'R' ? '—' : c === 'LIVRE' ? 'L' : esc(c || '?')}</div>
      <div class="lbl">${W ? esc(W.title) : ''}</div><div class="marks">${marks.join('')}</div></button>`;
  }
  const doneN = Object.values(status).filter(s => s === 'done').length, skipN = Object.values(status).filter(s => s === 'skip').length;
  const next = range(t, st.end).find(k => sch[k] && sch[k] !== 'R' && !status[k]);
  return `<div class="view-head"><div class="grow"><h2>Agenda</h2><div class="muted small">${esc(fmtShort(st.start))} → ${esc(fmtShort(st.end))} · ${planLen()} dias</div></div></div>
    ${S.swapFrom ? `<div class="banner info row between"><span>Toque no dia que vai trocar de lugar com <b>${esc(fmtShort(S.swapFrom))}</b>.</span><button class="btn btn-sm" data-act="swapcancel">Cancelar</button></div>` : ''}
    <div class="grid two">
      <div class="card"><div class="cal-grid" id="cal">${cells}</div>
        <p class="muted small" style="margin:12px 0 0">Toque num dia para trocar o treino, adiar ou marcar. No computador, arraste um dia sobre outro para trocar os dois de lugar.</p></div>
      <div class="grid">
        <div class="card"><h3>Resumo</h3><div class="kv" style="margin-top:8px">
          <span>Treinos feitos</span><b>${doneN}</b><span>Dias pulados</span><b>${skipN}</b>
          <span>Próximo treino</span><b>${next ? esc(fmtShort(next)) + ' · ' + esc(sch[next] === 'AL' ? 'A leve' : sch[next]) : '—'}</b></div></div>
        <div class="card"><h3>Ajustar o plano</h3><div class="actions" style="margin-top:10px">
          <button class="btn" data-act="postpone" data-k="${t >= st.start && t <= st.end ? t : st.start}">Adiar a partir de hoje (+1 dia)</button>
          ${sch[t] === 'R' && t < st.end ? `<button class="btn" data-act="pullfwd" data-k="${t}">Adiantar: treinar hoje o próximo treino</button>` : ''}
          <button class="btn" data-act="reflow" data-k="${t >= st.start && t <= st.end ? t : st.start}">Refazer rodízio A→B→C a partir de hoje</button>
          <button class="btn" data-act="extend" data-n="7">Estender o plano em 7 dias</button>
          <button class="btn btn-ghost btn-danger" data-act="resetplan">Restaurar calendário original</button></div>
          <p class="muted small" style="margin-bottom:0">Adiar empurra todos os treinos seguintes um dia e põe descanso no dia escolhido. Adiantar faz o contrário: num dia de descanso, traz o próximo treino e puxa os seguintes um dia para trás. Os dias de descanso fixos não mudam. Refazer rodízio continua de onde você parou, respeitando os dias de descanso.</p></div>
        <div class="card"><h3>Legenda</h3><div class="legend" style="margin-top:8px">
          ${['A', 'B', 'C', 'AL', 'ARM', 'LIVRE', 'R'].map(c => `<span class="chip w-${WORKOUTS[c].color}">${c === 'AL' ? 'A·' : c === 'R' ? '—' : c === 'LIVRE' ? 'L' : c} ${esc(WORKOUTS[c].title)}</span>`).join('')}
          <span class="chip">20g creatina (carga)</span><span class="chip">MED medições</span><span class="chip">GTG barra</span></div></div>
      </div></div>`;
}

function openDaySheet(k) {
  const c = codeOf(k), status = P().status?.[k];
  openSheet(`<h3>${esc(fmtLong(k))}</h3><div class="muted small">Dia ${dayIdx(k)} de ${planLen()}</div>
    <div class="code-pick">${CODES.map(x => `<button style="--c:var(--w${WORKOUTS[x].color})" class="${x === c ? 'on' : ''}" data-act="setcode" data-k="${k}" data-c="${x}"><b>${x === 'AL' ? 'A leve' : x === 'R' ? 'Descanso' : x === 'LIVRE' ? 'Livre' : x}</b><span>${esc(WORKOUTS[x].title)}</span></button>`).join('')}</div>
    <div class="row" style="margin-bottom:12px">
      <button class="btn btn-sm ${status === 'done' ? 'btn-primary' : ''}" data-act="sheetstatus" data-k="${k}" data-s="${status === 'done' ? '' : 'done'}">${status === 'done' ? '✓ Feito' : 'Marcar feito'}</button>
      <button class="btn btn-sm ${status === 'skip' ? 'btn-primary' : ''}" data-act="sheetstatus" data-k="${k}" data-s="${status === 'skip' ? '' : 'skip'}">${status === 'skip' ? 'Pulado' : 'Marcar pulado'}</button></div>
    <div class="actions two">
      <button class="btn btn-primary" data-act="openday" data-k="${k}">Abrir este dia</button>
      <button class="btn" data-act="swapstart" data-k="${k}">Trocar com outro dia</button>
      <button class="btn" data-act="postpone" data-k="${k}">Adiar daqui (+1 dia)</button>
      <button class="btn" data-act="pullfwd" data-k="${k}" ${c === 'R' ? '' : 'disabled title="Só num dia de descanso"'}>Adiantar para este dia</button>
      <button class="btn" data-act="reflow" data-k="${k}">Refazer rodízio daqui</button>
    </div>
    <p class="muted small" style="margin-bottom:0">${c === 'R' ? 'Adiantar traz o próximo treino para este dia e puxa os seguintes um dia para trás.' : 'Adiar põe descanso neste dia e empurra os treinos seguintes um dia.'}</p>`);
}

function writeSchedule(sched, end) {
  const f = { schedule: sched };
  if (end) f['settings.end'] = end;
  store.setFields(f);
}
// Adiar: o dia vira descanso e a sequência de treinos seguinte anda um dia, sem ocupar os dias de descanso fixos
function postpone(k) {
  const st = ST(), sch = clone(P().schedule), isRest = d => st.rest.includes(parseKey(d).getDay());
  const seq = range(k, st.end).map(d => sch[d]).filter(c => c && c !== 'R');
  for (const d of Object.keys(sch)) if (d >= k) delete sch[d];
  sch[k] = 'R';
  let d = k;
  for (const c of seq) {
    d = addDays(d, 1);
    while (isRest(d)) { sch[d] = 'R'; d = addDays(d, 1); }
    sch[d] = c;
  }
  const end = d > st.end ? d : st.end;
  for (const x of range(k, end)) if (!sch[x]) sch[x] = 'R';
  writeSchedule(sch, end); toast(`Adiado: o plano agora termina em ${fmtShort(end)}.`);
}
// Adiantar: num dia de descanso, o próximo treino vem para cá e os seguintes andam um dia para trás, sem ocupar os descansos fixos
function pullForward(k) {
  const st = ST(), sch = clone(P().schedule), isRest = d => st.rest.includes(parseKey(d).getDay());
  if (sch[k] && sch[k] !== 'R') return toast('Este dia já tem treino. Adiantar funciona num dia de descanso.');
  const seq = range(addDays(k, 1), st.end).map(d => sch[d]).filter(c => c && c !== 'R');
  if (!seq.length) return toast('Não há treino depois deste dia para adiantar.');
  for (const d of Object.keys(sch)) if (d > k) delete sch[d];
  sch[k] = seq[0];
  let d = k;
  for (const c of seq.slice(1)) {
    d = addDays(d, 1);
    while (isRest(d)) { sch[d] = 'R'; d = addDays(d, 1); }
    sch[d] = c;
  }
  writeSchedule(sch, d);
  toast(`Adiantado: ${WORKOUTS[seq[0]].name} em ${fmtShort(k)}; o plano agora termina em ${fmtShort(d)}.`);
}
function nextRotIdx(k) {
  const prev = Object.keys(P().schedule).filter(d => d < k).sort().reverse().find(d => ROT.includes(P().schedule[d]));
  return prev ? ROT.indexOf(P().schedule[prev]) + 1 : 0;
}
function reflow(k, end = ST().end) {
  const sch = clone(P().schedule);
  for (const d of Object.keys(sch)) if (d > end) delete sch[d];
  rotation(sch, k, end, ST().rest, nextRotIdx(k));
  writeSchedule(sch, end);
}
function extendTo(end) {
  const old = ST().end;
  if (end <= old) return;
  reflow(old, end); toast(`Plano estendido até ${fmtShort(end)}.`);
}
function swapDays(a, b) {
  if (a === b) return;
  const sch = clone(P().schedule); [sch[a], sch[b]] = [sch[b], sch[a]];
  writeSchedule(sch); toast(`Trocado: ${fmtShort(a)} ⇄ ${fmtShort(b)}`);
}
function setStatus(k, s) {
  const m = clone(P().status || {});
  if (s) m[k] = s; else delete m[k];
  store.setFields({ status: m });
}

/* ----- Dieta ----- */
function viewDieta() {
  const k = S.dayKey, st = ST(), meals = mealsOf(k), te = totals(meals, true), tp = totals(meals);
  const custom = !!dayOf(k).meals;
  const prev = Object.keys(S.days).filter(d => d < k && S.days[d].meals?.length).sort().pop();
  const body = meals.map((m, mi) => {
    const mt = totals([m]), all = m.items.length && m.items.every(i => i.ok);
    return `<div class="meal"><div class="meal-head"><b>${esc(m.n)}</b><span class="muted small">${esc(m.h || '')}</span>
        <span class="tot">${fmt(mt.k)} kcal · ${fmt(mt.p)} g P</span><button class="mini" data-act="mealmenu" data-m="${mi}" aria-label="Editar refeição">⋯</button></div>
      ${m.items.map((it, ii) => { const f = food(it.f), per = isPer100(f), amt = per ? `${fmt(it.q * 100)} g` : `${fmt(it.q, 1)} × ${esc(f.u)}`; return `<div class="item ${it.ok ? 'eaten' : ''}">
        <button class="tick ${it.ok ? 'on' : ''}" data-act="eat" data-m="${mi}" data-i="${ii}" aria-label="Comi">✓</button>
        <div class="nm">${esc(f.n)}<small>${amt} · ${fmt(f.k * it.q)} kcal · ${fmt(f.p * it.q, 1)} g P</small></div>
        <div class="acts"><span class="qty"><button data-act="qty" data-m="${mi}" data-i="${ii}" data-d="-1" aria-label="Menos">−</button><span>${per ? fmt(it.q * 100) : fmt(it.q, 1)}</span><button data-act="qty" data-m="${mi}" data-i="${ii}" data-d="1" aria-label="Mais">+</button></span>
        <button class="mini" data-act="swap" data-m="${mi}" data-i="${ii}" title="Substituir" aria-label="Substituir">⇄</button></div></div>`; }).join('') || '<div class="muted small" style="padding:6px 0">Sem alimentos.</div>'}
      <div class="row"><button class="link small" data-act="additem" data-m="${mi}">+ alimento</button><span class="grow"></span>${m.items.length ? `<button class="link small" data-act="eatall" data-m="${mi}">${all ? 'Desmarcar' : 'Comi tudo'}</button>` : ''}</div></div>`;
  }).join('');
  const pctK = st.kcal ? Math.min(100, te.k / st.kcal * 100) : 0, pctP = st.prot ? Math.min(100, te.p / st.prot * 100) : 0;
  return `<div class="view-head"><div class="grow"><h2>Dieta</h2><div class="muted small">Ovolactovegetariana · sem carne</div></div>${dayNav(k)}</div>
    <div class="grid two">
      <div class="card">
        <div class="diet-top">
          <div><span class="muted small">Comido</span><b>${fmt(te.k)}<small> / ${fmt(st.kcal)} kcal</small></b><div class="bar"><i style="width:${pctK}%"></i></div></div>
          <div><span class="muted small">Proteína</span><b>${fmt(te.p)}<small> / ${fmt(st.prot)} g</small></b><div class="bar"><i style="width:${pctP}%"></i></div></div>
        </div>
        ${calcBox(meals)}
        ${body}
        <button class="btn btn-ghost btn-block" data-act="addmeal" style="margin-top:6px">+ Refeição</button>
      </div>
      <div class="grid">
        ${weightCard()}${goalCard(tp, meals)}
        <div class="card"><h3>Macros</h3>${macroTable(te, tp)}</div>
        ${historyCard(k)}
        <div class="card"><h3>Cardápio</h3><p class="muted small">⇄ troca um alimento e recalcula a quantidade para manter a proteína (ou as calorias, em carboidrato, gordura e fruta). ⋯ renomeia, move ou remove a refeição.</p>
          <div class="actions">
            ${prev ? `<button class="btn" data-act="copyday" data-k="${prev}">Copiar o cardápio de ${esc(fmtShort(prev))}</button>` : ''}
            <button class="btn" data-act="savetemplate">Usar este dia como meu cardápio padrão</button>
            ${custom ? '<button class="btn btn-ghost" data-act="resetday">Voltar este dia ao cardápio padrão</button>' : ''}
            ${P().mealTemplate ? '<button class="btn btn-ghost btn-danger" data-act="resettemplate">Restaurar o cardápio-modelo do plano</button>' : ''}
          </div></div>
        <div class="card"><h3>Regra do prato</h3><ul class="small" style="padding-left:18px;color:var(--text-2)">
          <li><b>Metade do prato:</b> arroz, macarrão ou batata.</li><li><b>2 conchas:</b> feijão, lentilha ou grão-de-bico.</li>
          <li><b>Proteína:</b> ovo, omelete, queijo, tofu ou PTS; repita se puder.</li><li><b>Salada:</b> um punhado; à noite, sem exagero.</li>
          <li><b>Sem proteína no cardápio:</b> uma dose de whey ou ovos e queijo do kit.</li></ul>
          <p class="muted small" style="margin:0">Kit do quarto: whey, creatina, leite em pó, aveia, pasta de amendoim, banana, castanhas e PTS seca. Valores aproximados da TACO/Unicamp e USDA; produtos de marca vêm da Open Food Facts.</p></div>
      </div></div>`;
}

// Tabela de macros: gramas e % das calorias, comido e planejado
function macroTable(te, tp) {
  const pct = (g, kc, t) => t.k ? Math.round(g * kc / t.k * 100) : 0;
  const row = (n, key, kc) => `<tr><td>${n}</td><td>${fmt(te[key])} g</td><td>${fmt(tp[key])} g</td><td class="muted">${pct(tp[key], kc, tp)}%</td></tr>`;
  const sp = pct(tp.p, 4, tp), sc = pct(tp.c, 4, tp), sf = Math.max(0, 100 - sp - sc);
  return `<div class="macro-bar" title="Distribuição das calorias planejadas"><i style="width:${sp}%;background:var(--wa)"></i><i style="width:${sc}%;background:var(--wlivre)"></i><i style="width:${sf}%;background:var(--wb)"></i></div>
    <table class="mtable small"><tr><th></th><th>Comido</th><th>Planejado</th><th>% kcal</th></tr>
    ${row('<span class="dotc" style="background:var(--wa)"></span>Proteína', 'p', 4)}${row('<span class="dotc" style="background:var(--wlivre)"></span>Carboidrato', 'c', 4)}${row('<span class="dotc" style="background:var(--wb)"></span>Gordura', 'f', 9)}
    <tr><td><b>Calorias</b></td><td><b>${fmt(te.k)}</b></td><td><b>${fmt(tp.k)}</b></td><td></td></tr></table>`;
}

// Quanto falta no planejado para bater a meta, com opções do kit para fechar
const KIT_PROT = ['whey', 'ovo', 'pts', 'iogurte', 'leitepo', 'tofu'];
const KIT_KCAL = ['pasta', 'amendoim', 'aveia', 'banana', 'granola'];
function goalCard(tp, meals) {
  const st = ST(), gp = st.prot - tp.p, gk = st.kcal - tp.k;
  const ceia = meals.findIndex(m => m.id === 'ceia'), target = ceia >= 0 ? ceia : meals.length - 1;
  let msg, ids = [], byP = true;
  if (gp > 4) { msg = `Faltam <b>${fmt(gp)} g de proteína</b>${gk > 0 ? ` e ${fmt(gk)} kcal` : ''} no planejado. Para fechar, adicione um destes:`; ids = KIT_PROT; }
  else if (gk > 150) { msg = `A proteína está ok; faltam <b>${fmt(gk)} kcal</b> no planejado. Para fechar, adicione um destes:`; ids = KIT_KCAL; byP = false; }
  else if (gk < -300) msg = `O planejado passou <b>${fmt(-gk)} kcal</b> da meta. Se a cintura estiver subindo, reduza carboidrato ou gordura à noite.`;
  else msg = '✓ O planejado do dia bate a meta de calorias e proteína.';
  const opts = ids.map(id => {
    const f = food(id), need = byP ? gp / f.p : gk / f.k;
    let q = id === 'ovo' ? Math.max(1, Math.ceil(need)) : roundHalf(need);
    q = Math.min(q, id === 'ovo' ? 4 : id === 'whey' ? 2 : 3);
    return `<button class="opt" data-act="addsug" data-f="${id}" data-q="${q}" data-m="${target}"><div class="nm">${fmt(q, 1)} × ${esc(f.n)}<small>${esc(f.u)} · vai para ${esc(meals[target]?.n || 'a última refeição')}</small></div><div class="val">+${fmt(f.k * q)} kcal<br>+${fmt(f.p * q, 1)} g</div></button>`;
  }).slice(0, 4).join('');
  return `<div class="card"><h3>Fechar a meta</h3><p class="small" style="color:var(--text-2);margin:6px 0 0">${msg}</p>${opts ? `<div class="opt-list" style="max-height:none">${opts}</div>` : ''}</div>`;
}

// Últimos 7 dias: proteína e calorias marcadas como comidas
function historyCard(k) {
  const st = ST(), t = todayKey(), end = k < t ? k : t;
  const days = range(addDays(end, -6), end).map(d => ({ d, ...(S.days[d]?.meals ? totals(S.days[d].meals, true) : { k: 0, p: 0 }) }));
  const logged = days.filter(x => x.k > 0);
  const maxP = Math.max(st.prot * 1.15, ...days.map(x => x.p));
  const avg = n => logged.length ? logged.reduce((s, x) => s + x[n], 0) / logged.length : 0;
  return `<div class="card"><h3>Últimos 7 dias</h3>
    <div class="hist">${days.map(x => `<div class="hcol" title="${esc(fmtShort(x.d))}: ${fmt(x.k)} kcal, ${fmt(x.p)} g de proteína">
      <div class="hbar"><i class="${x.p >= st.prot ? 'ok' : ''}" style="height:${x.p / maxP * 100}%"></i><span class="hgoal" style="bottom:${st.prot / maxP * 100}%"></span></div>
      <b>${x.k ? fmt(x.k / 1000, 1) + 'k' : '–'}</b><span>${WD[parseKey(x.d).getDay()]}</span></div>`).join('')}</div>
    <p class="muted small" style="margin:8px 0 0">Barras: proteína comida (linha = meta de ${fmt(st.prot)} g). Números: mil kcal. ${logged.length ? `Média dos dias registrados: ${fmt(avg('k'))} kcal · ${fmt(avg('p'))} g.` : 'Marque o que comeu com ✓ para o histórico aparecer.'}</p></div>`;
}

function openMealMenu(mi) {
  const meals = mealsOf(S.dayKey), m = meals[mi];
  openSheet(`<h3>Refeição</h3>
    <div class="fields"><label>Nome<input type="text" id="meal-n" value="${esc(m.n)}"></label><label>Onde / quando<input type="text" id="meal-h" value="${esc(m.h || '')}" placeholder="Ex.: refeitório, 10h"></label></div>
    <div class="actions two"><button class="btn btn-primary" data-act="mealsave" data-m="${mi}">Salvar</button>
      <button class="btn" data-act="mealmove" data-m="${mi}" data-d="-1" ${mi === 0 ? 'disabled' : ''}>↑ Subir</button>
      <button class="btn" data-act="mealmove" data-m="${mi}" data-d="1" ${mi === meals.length - 1 ? 'disabled' : ''}>↓ Descer</button>
      <button class="btn btn-ghost btn-danger" data-act="mealdel" data-m="${mi}">Remover refeição</button></div>
    <p class="muted small" style="margin-bottom:0">Vale para este dia. Para levar aos próximos dias, use “Usar este dia como meu cardápio padrão”.</p>`);
}

function openNewFood() {
  openSheet(`<h3>Criar alimento</h3><div class="muted small">Use o rótulo ou a tabela da embalagem. Valores por porção.</div>
    <label style="margin-top:10px">Nome<input type="text" id="nf-n" placeholder="Ex.: Iogurte proteico da marca X"></label>
    <div class="fields">
      <label>Porção<input type="text" id="nf-u" value="1 porção" placeholder="Ex.: 1 pote (160 g)"></label>
      <label>Grupo<select id="nf-g">${Object.entries(GROUPS).filter(([g]) => g !== 'ext').map(([g, n]) => `<option value="${g}">${n}</option>`).join('')}</select></label>
      <label>Calorias (kcal)<input type="number" inputmode="decimal" id="nf-k"></label>
      <label>Proteína (g)<input type="number" inputmode="decimal" id="nf-p"></label>
      <label>Carboidrato (g)<input type="number" inputmode="decimal" id="nf-c"></label>
      <label>Gordura (g)<input type="number" inputmode="decimal" id="nf-f"></label></div>
    <p class="form-msg" id="nf-msg"></p>
    <button class="btn btn-primary btn-block" data-act="nfsave">Salvar e adicionar</button>`, () => setTimeout(() => $('#nf-n').focus(), 50));
}

function saveMeals(k, meals) { store.saveDay(k, { meals }); }
function mutateMeals(fn) { const k = S.dayKey, meals = mealsOf(k); fn(meals); saveMeals(k, meals); }

function openSwap(mi, ii) {
  const meals = mealsOf(S.dayKey), it = meals[mi].items[ii], f = food(it.f), g = f.g;
  const byP = SWAP_BY_PROTEIN.includes(g) && f.p > 0;
  const groups = g === 'leg' ? ['leg', 'prot'] : g === 'prot' ? ['prot', 'leg'] : g === 'ext' ? ['prot', 'carb'] : [g];
  const all = { ...FOODS, ...(P().customFoods || {}) };
  const opts = gr => Object.keys(all).filter(id => food(id).g === gr && id !== it.f).map(id => {
    const a = food(id);
    const q = byP ? (a.p > 0 ? roundHalf(it.q * f.p / a.p) : null) : (a.k > 0 ? roundHalf(it.q * f.k / a.k) : null);
    if (!q) return '';
    return `<button class="opt" data-act="doswap" data-m="${mi}" data-i="${ii}" data-f="${id}" data-q="${q}"><div class="nm">${esc(a.n)}<small>${fmt(q, 1)} × ${esc(a.u)}</small></div><div class="val">${fmt(a.k * q)} kcal<br>${fmt(a.p * q, 1)} g</div></button>`;
  }).join('');
  openSheet(`<h3>Substituir</h3><div class="muted small">${esc(f.n)} — ${fmt(it.q, 1)} × ${esc(f.u)} · ${fmt(f.k * it.q)} kcal · ${fmt(f.p * it.q, 1)} g de proteína</div>
    <div class="muted small" style="margin-top:4px">Equivalência por ${byP ? 'proteína' : 'calorias'}.</div>
    <div class="opt-list">${groups.map(gr => { const o = opts(gr); return o ? `<div class="group-title">${GROUPS[gr]}</div>${o}` : ''; }).join('')}</div>
    <div class="actions two" style="margin-top:12px"><button class="btn" data-act="additem" data-m="${mi}" data-replace="${ii}">Buscar outro alimento</button><button class="btn btn-ghost btn-danger" data-act="rmitem" data-m="${mi}" data-i="${ii}">Remover do cardápio</button></div>`);
}

function openAdd(mi, replace) {
  S.addTarget = { mi, rep: replace === '' || replace == null ? null : +replace };
  openSheet(`<h3>Adicionar alimento</h3><div class="muted small">Busque na base sem carne ou na internet: Open Food Facts (produtos de marca) e USDA.</div>
    <input type="search" id="add-q" placeholder="Ex.: tofu, iogurte, granola…" autocomplete="off" style="margin-top:10px">
    <div class="row" style="margin-top:8px"><button class="btn btn-sm" data-act="offsearch">Buscar na internet</button>
      <button class="btn btn-sm btn-ghost" data-act="barcode">Código de barras</button>
      <button class="btn btn-sm btn-ghost" data-act="newfood">Criar alimento</button></div>
    <div class="opt-list" id="add-list"></div>`, () => {
    const q = $('#add-q'), list = $('#add-list');
    const draw = () => {
      const s = q.value.trim();
      const hits = s ? searchFoods(s, 40).map(x => x.id) : Object.keys({ ...FOODS, ...(P().customFoods || {}) });
      list.innerHTML = hits.slice(0, 60).map(id => { const a = food(id), per = isPer100(a); return `<button class="opt" data-act="pickfood" data-f="${id}"><div class="nm">${esc(a.n)}<small>${per ? 'por 100 g' : esc(a.u)} · ${esc(a.src || GROUPS[a.g] || '')}</small></div><div class="val">${fmt(a.k)} kcal<br>${fmt(a.p, 1)} g</div></button>`; }).join('') || '<div class="empty-state small">Nada na tabela TACO nem na base. Toque em “Buscar na internet” para produtos de marca.</div>';
    };
    q.oninput = draw; q.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); offSearch(); } };
    draw(); setTimeout(() => q.focus(), 50);
  });
}

function addItem(f, q) {
  const { mi, rep } = S.addTarget;
  mutateMeals(meals => {
    if (rep != null) meals[mi].items[rep] = { f, q };
    else meals[mi].items.push({ f, q });
  });
  closeSheet(); toast(`${food(f).n} adicionado.`);
}

/* Open Food Facts (CORS liberado): busca por nome e por código de barras */
async function offSearch() {
  const q = $('#add-q')?.value.trim(), list = $('#add-list');
  if (!q) { toast('Digite o nome do produto.'); return; }
  list.innerHTML = '<div class="empty-state small">Buscando na Open Food Facts…</div>';
  const fields = 'code,product_name,product_name_pt,brands,nutriments,serving_size,serving_quantity';
  let prods = [];
  try {
    const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${fields}`, { signal: AbortSignal.timeout?.(7000) });
    if (r.ok) prods = (await r.json()).products || [];
  } catch { }
  prods = prods.filter(p => p.nutriments && p.nutriments['energy-kcal_100g'] != null && (p.product_name_pt || p.product_name));
  let src = 'Open Food Facts';
  // Reserva: USDA FoodData Central (nomes em inglês) quando a busca da Open Food Facts está fora do ar
  if (!prods.length) {
    try {
      const r = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&pageSize=25&dataType=Foundation,SR%20Legacy&query=${encodeURIComponent(q)}`);
      if (r.ok) {
        src = 'USDA FoodData Central (nomes em inglês)';
        prods = ((await r.json()).foods || []).map(f => {
          const nv = id => f.foodNutrients?.find(x => x.nutrientId === id || x.nutrientNumber === String(id))?.value;
          return { code: 'usda' + f.fdcId, product_name: f.description, brands: 'USDA', nutriments: { 'energy-kcal_100g': nv(1008) ?? nv(208), proteins_100g: nv(1003) ?? nv(203) ?? 0, carbohydrates_100g: nv(1005) ?? nv(205) ?? 0, fat_100g: nv(1004) ?? nv(204) ?? 0 } };
        }).filter(p => p.nutriments['energy-kcal_100g'] != null);
      }
    } catch { }
  }
  S.offResults = prods;
  list.innerHTML = prods.length ? `<div class="group-title">${src} · por 100 g</div>` + prods.map((p, i) => {
    const n = p.nutriments, brand = Array.isArray(p.brands) ? p.brands.join(', ') : p.brands || '';
    return `<button class="opt" data-act="pickoff" data-i="${i}"><div class="nm">${esc(p.product_name_pt || p.product_name)}<small>${esc(brand)}</small></div><div class="val">${fmt(n['energy-kcal_100g'])} kcal<br>${fmt(n.proteins_100g, 1)} g</div></button>`;
  }).join('') : '<div class="empty-state small">Nada encontrado. Tente outro nome (na USDA, em inglês: “oats”, “tofu”) ou o código de barras.</div>';
}

function offToFood(p) {
  const n = p.nutriments, id = 'off_' + (p.code || Date.now());
  const brand = Array.isArray(p.brands) ? p.brands[0] : (p.brands || '').split(',')[0];
  return { id, f: { n: (p.product_name_pt || p.product_name) + (brand ? ` (${brand.trim()})` : ''), u: '100 g', k: +n['energy-kcal_100g'] || 0, p: +n.proteins_100g || 0, c: +n.carbohydrates_100g || 0, f: +n.fat_100g || 0, g: 'ext', code: p.code || '' }, serving: +p.serving_quantity || 0 };
}
function pickOff(p) {
  const { id, f, serving } = offToFood(p);
  openSheet(`<h3>${esc(f.n)}</h3><div class="muted small">Por 100 g: ${fmt(f.k)} kcal · ${fmt(f.p, 1)} g de proteína (${String(f.code).startsWith('usda') ? 'USDA' : 'Open Food Facts'})</div>
    <label style="margin-top:12px">Quantidade (g)<input type="number" id="off-g" inputmode="decimal" value="${serving || 100}" min="1"></label>
    <button class="btn btn-primary btn-block" id="off-add">Adicionar</button>`, () => {
    $('#off-add').onclick = () => {
      const g = +$('#off-g').value || 100;
      store.setFields({ ['customFoods.' + id]: f });
      P().customFoods = { ...(P().customFoods || {}), [id]: f };
      addItem(id, Math.round(g / 100 * 100) / 100);
    };
  }, true);
}
async function offBarcode(code) {
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,product_name_pt,brands,nutriments,serving_size,serving_quantity`);
  const j = await r.json();
  if (j.status !== 1 || !j.product?.nutriments) throw new Error('Produto não encontrado na Open Food Facts.');
  return { ...j.product, code };
}
function askBarcode(onFound) {
  const canScan = 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
  openSheet(`<h3>Código de barras</h3><div class="muted small">Digite os números embaixo das barras${canScan ? ' ou use a câmera' : ''}.</div>
    <input type="text" inputmode="numeric" id="bc-in" placeholder="7891234567890" style="margin-top:10px">
    <div class="row" style="margin-top:8px"><button class="btn btn-primary" id="bc-go">Buscar</button>${canScan ? '<button class="btn" id="bc-cam">Usar câmera</button>' : ''}</div>
    <video id="bc-vid" playsinline muted style="width:100%;border-radius:12px;margin-top:10px" hidden></video><p class="form-msg" id="bc-msg"></p>`, () => {
    let stream = null;
    const stop = () => stream?.getTracks().forEach(t => t.stop());
    $('#sheet').addEventListener('close', stop, { once: true });
    const lookup = async code => {
      $('#bc-msg').textContent = 'Buscando…';
      try { const p = await offBarcode(code); stop(); onFound(p); } catch (e) { $('#bc-msg').textContent = e.message; }
    };
    $('#bc-go').onclick = () => { const c = $('#bc-in').value.replace(/\D/g, ''); if (c) lookup(c); };
    if (canScan) $('#bc-cam').onclick = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const v = $('#bc-vid'); v.hidden = false; v.srcObject = stream; await v.play();
        const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        const loop = async () => {
          if (!stream || !stream.active) return;
          try { const r = await det.detect(v); if (r[0]) { $('#bc-in').value = r[0].rawValue; return lookup(r[0].rawValue); } } catch { }
          requestAnimationFrame(loop);
        };
        loop();
      } catch { $('#bc-msg').textContent = 'Não foi possível abrir a câmera.'; }
    };
  }, true);
}

/* ----- Busca na tabela e calculadora de texto livre ----- */
// Alimentos por 100 g (TACO, pratos prontos, Open Food Facts, USDA) mostram e ajustam a quantidade em gramas
const isPer100 = x => !!x && (x.per100 || x.u === '100 g');
const STOP = new Set(['de', 'do', 'da', 'dos', 'das', 'com', 'sem', 'e', 'a', 'o', 'as', 'os', 'um', 'uma', 'ao', 'na', 'no', 'em', 'tipo', 'meu', 'minha', 'pra', 'para', 'comi', 'tomei', 'bebi']);
const stem = w => { w = w.replace(/oes$|aes$/, 'ao').replace(/ns$/, 'm').replace(/res$/, 'r'); return w.length > 3 ? w.replace(/s$/, '') : w; };
// Nomes populares que a tabela escreve de outro jeito
const SYN = [[/\bcoca( cola)?\b|\bpepsi\b/g, 'refrigerante cola'], [/\bguarana\b(?! em po)/g, 'refrigerante guarana'], [/\bfanta\b/g, 'refrigerante laranja'], [/\bsprite\b/g, 'refrigerante limao'], [/\bxis\b|\bx (?=burguer|salada|tudo)/g, 'x-'], [/\bcafezinho\b/g, 'cafe infusao'], [/\bmacarrao\b/g, 'macarrao'], [/\bovos? mexidos?\b/g, 'ovo mexido'], [/\bpaozinho\b/g, 'pao frances']];
const synonyms = s => SYN.reduce((t, [re, to]) => t.replace(re, to), norm(s));
const toks = s => synonyms(s).split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w)).map(stem);

let INDEX = null;
function foodIndex() {
  if (!INDEX) {
    INDEX = [
      ...Object.keys(FOODS).map(id => ({ id, n: FOODS[id].n, src: 'base', bonus: 0.7 })),
      ...PREPARADOS.map((r, i) => ({ id: 'prep_' + i, n: r[0], src: 'pronto', bonus: 0.4 })),
      ...TACO.map((r, i) => ({ id: 'taco_' + i, n: r[0], src: 'TACO', bonus: 0 }))
    ].map(x => ({ ...x, t: toks(x.n) }));
  }
  const custom = Object.entries(P().customFoods || {}).map(([id, f]) => ({ id, n: f.n, src: 'meu', bonus: 1, t: toks(f.n) }));
  return [...custom, ...INDEX];
}
function searchFoods(q, limit = 8) {
  const qt = toks(q);
  if (!qt.length) return [];
  const wantsRaw = qt.includes('cru') || qt.includes('crua');
  return foodIndex().map(x => {
    let hit = 0, score = 0;
    for (const w of qt) {
      if (x.t.includes(w)) { hit++; score += 3; }
      else if (w.length >= 4 && x.t.some(t => t.length >= 4 && (t.startsWith(w) || w.startsWith(t)))) { hit++; score += 2; }
    }
    if (!hit) return null;
    score += x.bonus - 0.25 * Math.max(0, x.t.length - hit);
    // O nome que começa pela palavra buscada é quase sempre o certo ("pão de queijo", não "misto de pão e queijo")
    const head = x.t[0] === qt[0] || (qt[0].length >= 4 && x.t[0]?.startsWith(qt[0]));
    if (head) score += 1.5;
    if (!wantsRaw && x.t.some(t => t === 'cru' || t === 'crua')) score -= 1.5;
    // Sem dizer o preparo, o mais comum no prato é o cozido
    if (qt.length <= 2 && x.t.some(t => t === 'cozido' || t === 'cozida')) score += 0.6;
    return { ...x, hit, score, full: hit === qt.length && head };
  }).filter(Boolean).sort((a, b) => b.hit - a.hit || b.score - a.score).slice(0, limit);
}

const NUM = { meia: 0.5, meio: 0.5, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, dez: 10 };
const MEAS = { fatia: 'fatia', colher: 'colher', concha: 'concha', escumadeira: 'escumadeira', xicara: 'xicara', copo: 'copo', lata: 'lata', latinha: 'lata', garrafa: 'garrafa', prato: 'prato', porcao: 'porcao', pedaco: 'pedaco', bola: 'bola', tigela: 'tigela', punhado: 'punhado', pote: 'pote', barra: 'barra', pacote: 'pacote', peca: 'peca', unidade: 'unidade', file: 'file', bife: 'bife', sache: 'sache', dose: 'dose' };
// Gramas de uma unidade quando a frase diz só "2 ovos", "1 banana"
const UNIT_G = [[/ovo/, 50], [/banana/, 86], [/maca/, 130], [/laranja|tangerina|mexerica/, 160], [/pao de queijo/, 40], [/pao/, 50], [/coxinha|pastel|quibe|esfiha/, 80], [/iogurte/, 170], [/bolacha|biscoito/, 8]];

function portionGrams(f) { const m = String(f.u || '').match(/\((\d+)\s*(g|ml)\)/) || String(f.u || '').match(/^(\d+)\s*(g|ml)$/); return m ? +m[1] : null; }

// Quantidade q (multiplicador da porção do alimento) a partir do que a frase disse
function amountFor(row, id) {
  const f = food(id);
  if (isPer100(f)) {
    let g = row.grams;
    if (g == null) {
      const med = f.med || {};
      if (row.measure) g = (med[row.measure] ?? MEDIDAS[row.measure]) * (row.qty ?? 1);
      else g = (med.unidade ?? UNIT_G.find(([re]) => re.test(norm(f.n)))?.[1] ?? 100) * (row.qty ?? 1);
    }
    return Math.max(0.05, Math.round(g) / 100);
  }
  const pg = portionGrams(f);
  const g = row.grams ?? (row.measure && pg ? MEDIDAS[row.measure] * (row.qty ?? 1) : null);
  if (g != null) return pg ? Math.max(0.25, Math.round(g / pg * 4) / 4) : 1;
  return row.qty ?? 1;
}

function parseMeal(text) {
  const parts = text.split(/\s*(?:,|;|\+|\n|\s+e\s+(?=\S)|\s+mais\s+)\s*/i).map(s => s.trim()).filter(Boolean);
  return parts.flatMap(part => {
    const row = parsePart(part);
    // "arroz com feijão" são dois alimentos; "café com leite" é um só (existe com esse nome)
    if (!/\scom\s/i.test(part) || row.full) return [row];
    const [first, ...others] = part.split(/\s+com\s+/i);
    return [parsePart(first), ...others.map(o => parsePart(o))];
  });
}

function parsePart(part) {
  {
    let rest = norm(part).replace(/[^a-z0-9.,\s]/g, ' ').trim(), qty = null, grams = null, measure = null, m;
    if ((m = rest.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gramas?|ml|l|litros?)\b\s*(?:de\s+)?(.*)$/))) {
      const v = +m[1].replace(',', '.'); grams = /^k|^l/.test(m[2]) ? v * 1000 : v; rest = m[3];
    } else {
      if ((m = rest.match(/^(\d+(?:[.,]\d+)?|meia|meio|uma?|duas|dois|tres|quatro|cinco|seis|sete|oito|dez)\s+(.*)$/))) { qty = NUM[m[1]] ?? +m[1].replace(',', '.'); rest = m[2]; }
      const mm = rest.match(/^([a-z]+)\s+(?:de\s+(?:sopa|cha|sobremesa)\s+)?(?:de\s+|do\s+|da\s+)?(.*)$/);
      if (mm && MEAS[stem(mm[1])] && mm[2]) { measure = MEAS[stem(mm[1])]; rest = mm[2]; if (/colher(es)? de cha/.test(norm(part))) measure = 'colher de cha'; }
      if ((m = rest.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*(g|ml)\b/))) { grams = +m[2].replace(',', '.') * (qty ?? 1); rest = m[1]; }
    }
    const cands = searchFoods(rest, 8);
    const row = { text: part, query: rest, qty, grams, measure, cands: cands.map(c => ({ id: c.id, src: c.src })), sel: cands[0]?.id || null, on: !!cands.length, full: !!cands[0]?.full };
    row.q = row.sel ? amountFor(row, row.sel) : 1;
    return row;
  }
}

function defaultMealIndex(meals) {
  const h = new Date().getHours(), want = h < 10 ? 'cafe' : h < 12 ? 'lanche' : h < 15 ? 'almoco' : h < 18 ? 'pos' : h < 21 ? 'jantar' : 'ceia';
  const i = meals.findIndex(m => m.id === want);
  return i >= 0 ? i : Math.max(0, meals.length - 1);
}

function calcBox(meals) {
  const ai = aiCfg();
  return `<div class="calc-box">
    <label for="calc-text">Comeu algo fora do plano?</label>
    <textarea id="calc-text" rows="2" placeholder="Ex.: 2 fatias de pizza de calabresa e 1 lata de refrigerante de cola">${esc(S.calcDraft || '')}</textarea>
    <div class="row" style="margin-top:8px"><select id="calc-meal" aria-label="Refeição" style="margin:0;flex:1;min-width:140px">${meals.map((m, i) => `<option value="${i}" ${i === (S.calcMeal ?? defaultMealIndex(meals)) ? 'selected' : ''}>${esc(m.n)}</option>`).join('')}</select>
      <button class="btn btn-primary" data-act="calcrun">Calcular</button></div>
    <div class="muted small" style="margin-top:6px">Busca na tabela TACO (Unicamp), com ${TACO.length} alimentos, e em pratos prontos comuns. Separe os itens com vírgula ou “e”.${ai.key ? ' A IA (Claude) fica disponível no resultado.' : ''}</div></div>`;
}

function openCalc() {
  const c = S.calc;
  const rows = c.rows.map((r, ri) => {
    if (r.ai) {
      const a = r.ai;
      return `<div class="calc-row ${r.on ? '' : 'off'}"><div class="row between"><b class="small">${esc(a.n)}</b><button class="tick ${r.on ? 'on' : ''}" data-act="calcon" data-r="${ri}" aria-label="Incluir">✓</button></div>
        <div class="muted small">${esc(a.u)} · IA${a.fonte ? ' · ' + esc(a.fonte) : ''}</div>
        <div class="calc-val">${fmt(a.k)} kcal · ${fmt(a.p, 1)} g P · ${fmt(a.c)} g C · ${fmt(a.f)} g G</div></div>`;
    }
    if (!r.sel) return `<div class="calc-row off"><b class="small">“${esc(r.text)}”</b><div class="muted small">Não encontrei na tabela.</div>
      <div class="row" style="margin-top:6px"><button class="btn btn-sm" data-act="calcweb" data-r="${ri}">Buscar produto na internet</button><button class="btn btn-sm btn-ghost" data-act="newfood">Criar alimento</button></div></div>`;
    const f = food(r.sel), per = isPer100(f);
    return `<div class="calc-row ${r.on ? '' : 'off'}"><div class="row between"><span class="muted small">“${esc(r.text)}”</span><button class="tick ${r.on ? 'on' : ''}" data-act="calcon" data-r="${ri}" aria-label="Incluir">✓</button></div>
      <select data-ch="calcsel" data-r="${ri}" aria-label="Alimento">${r.cands.map(o => `<option value="${o.id}" ${o.id === r.sel ? 'selected' : ''}>${esc(food(o.id).n)} · ${o.src}</option>`).join('')}</select>
      <div class="row" style="margin-top:6px"><label class="inline">${per ? 'Gramas' : 'Porções de ' + esc(f.u)}<input type="number" inputmode="decimal" min="0" step="${per ? 5 : 0.5}" value="${per ? Math.round(r.q * 100) : r.q}" data-ch="calcq" data-r="${ri}"></label>
        <div class="calc-val grow">${fmt(f.k * r.q)} kcal · ${fmt(f.p * r.q, 1)} g P<br><span class="muted">${fmt((f.c || 0) * r.q)} g C · ${fmt((f.f || 0) * r.q)} g G</span></div></div></div>`;
  }).join('');
  const on = c.rows.filter(r => r.on && (r.sel || r.ai));
  const tot = on.reduce((t, r) => { const f = r.ai || food(r.sel), q = r.ai ? 1 : r.q; t.k += f.k * q; t.p += f.p * q; return t; }, { k: 0, p: 0 });
  const meals = mealsOf(S.dayKey), ai = aiCfg();
  openSheet(`<h3>Resultado</h3><div class="muted small">Confira o alimento e a quantidade de cada item. Valores por 100 g da TACO (Unicamp); pratos prontos são estimativas.</div>
    ${c.note ? `<div class="banner info" style="margin:10px 0 0">${esc(c.note)}</div>` : ''}
    <div class="calc-list">${rows}</div>
    <div class="calc-total"><span>Total marcado</span><b>${fmt(tot.k)} kcal · ${fmt(tot.p, 1)} g de proteína</b></div>
    <div class="actions two"><button class="btn btn-primary" data-act="calcadd" ${on.length ? '' : 'disabled'}>Adicionar a ${esc(meals[c.mi]?.n || 'refeição')} (comido)</button>
      ${ai.key ? `<button class="btn" data-act="calcai">Calcular com IA (Claude)</button>` : `<button class="btn btn-ghost" data-act="go" data-v="ajustes">Configurar IA (opcional)</button>`}</div>`);
}

/* IA opcional: a chave da API da Anthropic fica só neste aparelho */
const aiCfg = () => { try { return JSON.parse(localStorage.getItem('pv-ai')) || {}; } catch { return {}; } };
const AI_MODELS = [['claude-opus-5-5', 'Claude Opus 5.5 — mais preciso (padrão)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 — mais barato'], ['claude-haiku-5-5', 'Claude Haiku 5.5 — o mais barato e rápido']];
const COM_FALLBACK = /^claude-(opus-5-5|sonnet-5-5)$/;
const AI_SYS = `Você calcula a composição nutricional do que a pessoa comeu, a partir de uma descrição em português do Brasil.
Para alimentos genéricos, use a Tabela Brasileira de Composição de Alimentos (TACO/Unicamp) ou a TBCA-USP como referência. Para produtos de marca, redes de restaurante ou pratos específicos, use a busca na web para achar a tabela nutricional oficial.
Quando a quantidade não for dita, use a porção típica no Brasil e escreva qual foi em "porcao". Os valores de cada item são para a quantidade comida, não por 100 g.
Responda chamando a ferramenta registrar_alimentos uma única vez, com todos os itens. Em "fonte", diga de onde veio o valor (por exemplo, "TACO" ou o site do fabricante). Use "observacao" para avisar sobre suposições importantes, em uma frase.`;
const AI_TOOL = {
  name: 'registrar_alimentos', strict: true,
  description: 'Registra os alimentos identificados na descrição, com calorias e macronutrientes da quantidade comida.',
  input_schema: {
    type: 'object', additionalProperties: false, required: ['itens', 'observacao'],
    properties: {
      itens: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nome', 'porcao', 'gramas', 'kcal', 'proteina', 'carboidrato', 'gordura', 'fonte'],
        properties: { nome: { type: 'string' }, porcao: { type: 'string' }, gramas: { type: 'number' }, kcal: { type: 'number' }, proteina: { type: 'number' }, carboidrato: { type: 'number' }, gordura: { type: 'number' }, fonte: { type: 'string' } } } },
      observacao: { type: 'string' }
    }
  }
};
let sdkP;
async function aiClient(key) {
  sdkP ||= import('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm');
  const { default: Anthropic } = await sdkP;
  return { Anthropic, client: new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }) };
}
function aiError(Anthropic, e) {
  if (!Anthropic) return e.message || 'Não foi possível carregar o SDK do Claude.';
  if (e instanceof Anthropic.AuthenticationError) return 'Chave inválida ou revogada. Confira em Ajustes.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'A chave não tem permissão para esse modelo.';
  if (e instanceof Anthropic.NotFoundError) return 'Modelo não encontrado para essa chave. Escolha outro em Ajustes.';
  if (e instanceof Anthropic.RateLimitError) return 'Limite de uso da chave atingido. Tente daqui a pouco.';
  if (e instanceof Anthropic.BadRequestError) return /credit balance/i.test(e.message) ? 'A conta da API está sem créditos.' : e.message;
  if (e instanceof Anthropic.APIConnectionError) return 'Sem conexão com a Anthropic.';
  return e.message || 'Erro ao falar com a IA.';
}
async function aiCalc(text) {
  const cfg = aiCfg(), model = cfg.model || 'claude-opus-5-5';
  let Anthropic;
  try {
    const k = await aiClient(cfg.key); Anthropic = k.Anthropic;
    const search = model.startsWith('claude-haiku') ? { type: 'web_search_20250305', name: 'web_search', max_uses: 3 } : { type: 'web_search_20260209', name: 'web_search', max_uses: 3 };
    const messages = [{ role: 'user', content: text }];
    for (let i = 0; i < 4; i++) {
      const req = { model, max_tokens: 16000, system: AI_SYS, tools: [search, AI_TOOL], messages, output_config: { effort: 'medium' } };
      // se o modelo recusar por política de segurança, o próprio servidor tenta de novo em outro modelo
      if (COM_FALLBACK.test(model)) Object.assign(req, { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
      const msg = await k.client.beta.messages.create(req);
      if (msg.stop_reason === 'refusal') throw new Error('A IA não pôde calcular essa descrição.');
      const call = msg.content.find(b => b.type === 'tool_use' && b.name === 'registrar_alimentos');
      if (call && msg.stop_reason !== 'max_tokens') return call.input;
      if (msg.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: msg.content }); continue; }
      throw new Error('A IA não devolveu os alimentos. Tente descrever de outro jeito.');
    }
    throw new Error('A busca da IA demorou demais. Tente de novo.');
  } catch (e) { throw new Error(aiError(Anthropic, e)); }
}

function pickGrams(id) {
  const f = food(id), med = f.med ? Object.entries(f.med) : [];
  openSheet(`<h3>${esc(f.n)}</h3><div class="muted small">Por 100 g: ${fmt(f.k)} kcal · ${fmt(f.p, 1)} g P · ${fmt(f.c || 0)} g C · ${fmt(f.f || 0)} g G</div>
    ${med.length ? `<div class="pill-list" style="margin-top:10px">${med.map(([m, g]) => `<button class="chip" style="border:0;cursor:pointer" data-act="gramset" data-g="${g}">1 ${m} ≈ ${g} g</button>`).join('')}</div>` : ''}
    <label style="margin-top:12px">Quantidade (g)<input type="number" id="pg-g" inputmode="decimal" value="${med[0]?.[1] || 100}" min="1"></label>
    <button class="btn btn-primary btn-block" data-act="pgadd" data-f="${id}">Adicionar</button>`);
}

/* ----- Medidas ----- */
const MF = [['ombro', 'Ombro', 'cm'], ['cintura', 'Cintura', 'cm'], ['braco', 'Braço contraído', 'cm'], ['peso', 'Peso', 'kg'], ['barras', 'Barras fixas (máx.)', '']];
function ratio(m) { return m?.ombro && m?.cintura ? m.ombro / m.cintura : null; }
function viewMedidas() {
  const st = ST(), M = P().measures || {};
  const dates = [...new Set([st.start, st.end, ...Object.keys(M)])].sort();
  const firstWith = f => dates.find(d => M[d]?.[f] != null && M[d][f] !== '');
  const lastWith = f => [...dates].reverse().find(d => M[d]?.[f] != null && M[d][f] !== '');
  const delta = (f, get) => { const a = firstWith(f), b = lastWith(f); if (!a || !b || a === b) return ''; const v = get(M[b]) - get(M[a]); const good = f === 'cintura' ? v < 0 : v > 0; return `<span class="delta ${v === 0 ? '' : good ? 'up' : 'down'}">${v > 0 ? '+' : ''}${fmt(v, f === 'ratio' ? 3 : 1)}</span>`; };
  const head = `<tr><th>Medida</th>${dates.map(d => `<th><button class="link small" data-act="medit" data-k="${d}">${d === st.start ? 'Dia 1' : d === st.end ? 'Dia ' + planLen() : esc(fmtShort(d))}<br><span class="muted">${esc(fmtShort(d))}</span></button></th>`).join('')}<th>Δ</th></tr>`;
  const rows = MF.map(([f, n, u]) => `<tr><td>${n}${u ? ` <span class="muted small">(${u})</span>` : ''}</td>${dates.map(d => `<td>${M[d]?.[f] != null && M[d][f] !== '' ? fmt(M[d][f], 1) : '<span class="muted">—</span>'}</td>`).join('')}<td>${delta(f, m => +m[f])}</td></tr>`).join('')
    + `<tr><td><b>Ombro ÷ cintura</b></td>${dates.map(d => `<td><b>${ratio(M[d]) ? fmt(ratio(M[d]), 3) : '<span class="muted">—</span>'}</b></td>`).join('')}<td>${(() => { const ds = dates.filter(d => ratio(M[d])); if (ds.length < 2) return ''; const v = ratio(M[ds.at(-1)]) - ratio(M[ds[0]]); return `<span class="delta ${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${v > 0 ? '+' : ''}${fmt(v, 3)}</span>`; })()}</td></tr>`;
  const pesoPts = dates.filter(d => M[d]?.peso).map(d => [d, +M[d].peso]);
  const ratioPts = dates.filter(d => ratio(M[d])).map(d => [d, ratio(M[d])]);
  return `<div class="view-head"><div class="grow"><h2>Medidas</h2><div class="muted small">A razão ombro ÷ cintura é o número do V: o objetivo é ela subir.</div></div>
      <button class="btn btn-primary btn-sm" data-act="medit" data-k="${todayKey()}">Registrar hoje</button></div>
    <div class="grid two">
      <div class="grid">
        <div class="card scroll-x"><table class="mtable">${head}${rows}</table><p class="muted small" style="margin-bottom:0">Toque na data para editar.</p></div>
        <div class="grid cols2">
          <div class="card chart"><h3>Peso</h3>${lineChart(pesoPts, 1, 'kg')}</div>
          <div class="card chart"><h3>Razão do V</h3>${lineChart(ratioPts, 3, '')}</div>
        </div>
      </div>
      <div class="grid">
        <div class="card"><h3>Peso rápido</h3><div class="row" style="margin-top:8px"><input type="number" id="quick-peso" inputmode="decimal" step="0.1" placeholder="kg" style="margin:0;flex:1"><button class="btn btn-primary" data-act="quickpeso">Salvar hoje</button></div>
          <p class="muted small" style="margin-bottom:0">Na primeira semana o peso deve subir 1–2 kg (água dentro do músculo, pela creatina).</p></div>
        <div class="card"><h3>Como medir</h3><ul class="small" style="padding-left:18px;color:var(--text-2);margin-bottom:0">
          <li>De manhã, em jejum, depois de ir ao banheiro, com a mesma fita.</li>
          <li><b>Ombro:</b> fita em volta dos ombros, na parte mais larga, braços relaxados.</li>
          <li><b>Cintura:</b> na altura do umbigo, barriga relaxada.</li>
          <li><b>Braço:</b> ponto mais alto do bíceps contraído.</li>
          <li><b>Barras:</b> uma série até não subir mais, sem balanço.</li>
          <li><b>Fotos:</b> frente, lado e costas, mesma luz e lugar — uma relaxado e uma abrindo as dorsais.</li></ul></div>
      </div></div>`;
}
function lineChart(pts, dec, unit) {
  if (pts.length < 2) return '<div class="empty-state small">Registre pelo menos duas datas para ver o gráfico.</div>';
  const W = 320, H = 140, px = 30, py = 18;
  const vs = pts.map(p => p[1]), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const t0 = parseKey(pts[0][0]).getTime(), t1 = parseKey(pts.at(-1)[0]).getTime() || t0 + 1;
  const xy = pts.map(([d, v]) => [px + (parseKey(d).getTime() - t0) / (t1 - t0 || 1) * (W - 2 * px), H - py - (v - lo) / span * (H - 2 * py)]);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico">
    <polyline points="${xy.map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${xy.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="4" fill="var(--accent)"/><text x="${x}" y="${y - 9}" text-anchor="middle" font-size="11" fill="var(--text-2)" font-family="JetBrains Mono, monospace">${fmt(pts[i][1], dec)}</text><text x="${x}" y="${H - 2}" text-anchor="middle" font-size="10" fill="var(--muted)">${parseKey(pts[i][0]).getDate()}/${parseKey(pts[i][0]).getMonth() + 1}</text>`).join('')}
  </svg>`;
}
function openMeasure(k) {
  const m = P().measures?.[k] || {}, st = ST();
  openSheet(`<h3>Medidas — ${esc(fmtShort(k))}</h3>
    <label>Data<input type="date" id="m-date" value="${k}"></label>
    <div class="fields">${MF.map(([f, n, u]) => `<label>${n}${u ? ` (${u})` : ''}<input type="number" inputmode="decimal" step="0.1" id="m-${f}" value="${esc(m[f] ?? '')}"></label>`).join('')}</div>
    <div class="actions two"><button class="btn btn-primary" id="m-save">Salvar</button>${P().measures?.[k] && k !== st.start ? '<button class="btn btn-ghost btn-danger" id="m-del">Apagar data</button>' : ''}</div>`, () => {
    $('#m-save').onclick = () => {
      const d = $('#m-date').value || k, obj = {};
      for (const [f] of MF) { const v = $('#m-' + f).value; if (v !== '') obj[f] = +v; }
      const all = clone(P().measures || {});
      if (d !== k) delete all[k];
      all[d] = obj;
      store.setFields({ measures: all }); closeSheet(); toast('Medidas salvas.');
    };
    const del = $('#m-del');
    if (del) del.onclick = () => { const all = clone(P().measures || {}); delete all[k]; store.setFields({ measures: all }); closeSheet(); };
  });
}

/* ----- Fichas, guia, mais, ajustes ----- */
function openExSwap(slot) {
  const k = S.dayKey, base = exercisesOf(codeOf(k), k).find(e => e.id === slot);
  if (!base) return;
  const cur = dayOf(k).swap?.[slot] ?? P().exSwap?.[slot] ?? 'orig';
  const opts = [{ k: 'orig', n: base.n, tag: 'Original do plano' }, ...ALTS[slot]];
  const scope = S.swapScope === 'hoje' ? 'hoje' : 'sempre';
  S.swapScope = scope;
  openSheet(`<h3>Trocar exercício</h3><div class="muted small">Mesma função no treino: continua ${base.s} × ${esc(base.r)}. Toque em ▶ para ver a execução.</div>
    <div class="seg" style="margin:12px 0 2px"><button class="${scope === 'sempre' ? 'on' : ''}" data-act="swapscope" data-s="sempre">Em todos os treinos</button><button class="${scope === 'hoje' ? 'on' : ''}" data-act="swapscope" data-s="hoje">Só neste dia</button></div>
    <div class="opt-list">${opts.map(o => `<div class="opt-row">
      <button class="opt ${o.k === cur ? 'cur' : ''}" data-act="pickex" data-slot="${slot}" data-k="${o.k}"><div class="nm">${esc(o.n)}<small>${o.k === cur ? 'Em uso' : o.tag || ''}</small></div><div class="val">${o.k === cur ? '✓' : ''}</div></button>
      <a class="mini" href="${videoUrl(o.n)}" target="_blank" rel="noopener" aria-label="Ver execução de ${esc(o.n)}">▶</a></div>`).join('')}</div>`);
}

function viewFichas() {
  const perm = P().exSwap || {};
  const card = c => { const W = WORKOUTS[c]; return `<div class="card"><div class="row between"><h3>${W.name} — ${esc(W.title)}</h3><span class="chip w-${W.color}">${c}</span></div><div class="muted small">${esc(W.sub)}</div>
    <div class="scroll-x"><table class="mtable" style="margin-top:8px"><tr><th>Exercício</th><th>Séries × reps</th><th>Sem academia</th></tr>
    ${W.ex.map(e => { const alt = perm[e.id] && perm[e.id] !== 'orig' ? ALTS[e.id]?.find(a => a.k === perm[e.id]) : null; const nm = alt ? alt.n : e.n; return `<tr><td><a href="${videoUrl(nm)}" target="_blank" rel="noopener">${esc(nm)} ▶</a>${alt ? `<br><span class="muted small">no lugar de ${esc(e.n)}</span>` : ''}${ALTS[e.id] ? `<br><span class="muted small">Trocas: ${ALTS[e.id].filter(a => a !== alt).map(a => esc(a.n)).join(' · ')}</span>` : ''}</td><td style="font-family:var(--f-body)">${e.s} × ${esc(e.r)}${e.obs ? `<br><span class="muted small">${esc(e.obs)}</span>` : ''}</td><td style="font-family:var(--f-body)"><a href="${videoUrl(e.home)}" target="_blank" rel="noopener">${esc(e.home)} ▶</a></td></tr>`; }).join('')}</table></div>
    ${W.finisher ? `<div class="ex-tip">${esc(W.finisher)}</div>` : ''}</div>`; };
  return `<div class="view-head"><div class="grow"><h2>Fichas</h2><div class="muted small">Descanse 2 min nos exercícios grandes e 45–60 s nas elevações laterais. A cada treino, +1 repetição ou um pouco mais de peso.</div></div></div>
    <div class="grid">${card('A')}${card('B')}${card('C')}
    <div class="card"><h3>Armstrong — sem academia</h3><ul class="small" style="padding-left:18px;color:var(--text-2)"><li><b>Toda manhã:</b> 3 séries máximas de flexão.</li>${ARMSTRONG.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <p class="muted small" style="margin:0">Na agenda, escolha “ARM” no dia: o app avança sozinho do dia 1 ao 5.</p></div></div>`;
}
function viewGuia() {
  return `<div class="view-head"><div class="grow"><h2>Guia</h2><div class="muted small">O plano completo, em resumo.</div></div></div>
    <div class="guide">${GUIDE.map((g, i) => `<details ${i === 0 ? 'open' : ''}><summary>${esc(g.t)}</summary><div class="body">${g.html}</div></details>`).join('')}</div>`;
}
function viewMais() {
  const item = (v, d) => `<button class="card" data-act="go" data-v="${v}" style="text-align:left;cursor:pointer;display:flex;gap:14px;align-items:center"><span style="color:var(--accent)">${svg(v)}</span><span class="grow"><b>${TITLES[v]}</b><br><span class="muted small">${d}</span></span>›</button>`;
  return `<div class="grid">${item('evolucao', 'Metas de carga, estagnação, balança')}${item('fichas', 'Treinos A, B, C e Armstrong')}${item('guia', 'Postura, GTG, creatina, dieta, fontes')}${item('ajustes', 'Plano, metas, whey, tema, instalar o app')}${item('conta', esc(store?.email || 'Conta conectada'))}</div>`;
}
function viewAjustes() {
  const st = ST(), theme = localStorage.getItem('pv-theme') || 'auto';
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return `<div class="view-head"><div class="grow"><h2>Ajustes</h2></div></div>
  <div class="grid cols2">
    <div class="card"><h3>Plano</h3>
      <div class="fields" style="margin-top:8px"><label>Início<input type="date" id="s-start" value="${st.start}"></label><label>Duração (dias)<input type="number" id="s-len" min="3" max="120" value="${planLen()}"></label></div>
      <label>Dias de descanso<div class="wd-pick" id="s-rest">${WD.map((w, i) => `<button type="button" class="${st.rest.includes(i) ? 'on' : ''}" data-act="restday" data-i="${i}">${w}</button>`).join('')}</div></label>
      <label>Local padrão<div class="seg" style="margin-top:6px"><button class="${st.mode === 'gym' ? 'on' : ''}" data-act="defmode" data-m="gym">Academia</button><button class="${st.mode === 'home' ? 'on' : ''}" data-act="defmode" data-m="home">Sem academia</button></div></label>
      <button class="btn btn-primary btn-block" data-act="applyplan">Aplicar e refazer o calendário</button>
      <p class="muted small" style="margin-bottom:0">Refaz o rodízio A→B→C com o início, a duração e os dias de descanso escolhidos. Registros de séries, dieta e medidas são mantidos.</p></div>
    <div class="card"><h3>Metas diárias</h3>
      <div class="fields" style="margin-top:8px"><label>Calorias (kcal)<input type="number" data-ch="setting" data-f="kcal" value="${st.kcal}"></label><label>Proteína (g)<input type="number" data-ch="setting" data-f="prot" value="${st.prot}"></label></div>
      <h3 style="margin-top:6px">Seu whey</h3><p class="muted small" style="margin-top:0">Confira o rótulo: a dose de 32 g costuma ter 20–25 g de proteína.</p>
      <div class="fields"><label>Dose (g)<input type="number" data-ch="setting" data-f="wheyG" value="${st.wheyG}"></label><label>Proteína (g)<input type="number" data-ch="setting" data-f="wheyP" value="${st.wheyP}"></label><label>Calorias<input type="number" data-ch="setting" data-f="wheyK" value="${st.wheyK}"></label></div>
      <button class="btn btn-block" data-act="wheybarcode">Preencher pelo código de barras</button></div>
    <div class="card"><h3>Aparência</h3><div class="seg" style="margin-top:8px">${[['auto', 'Automático'], ['dark', 'Escuro'], ['light', 'Claro']].map(([v, n]) => `<button class="${theme === v ? 'on' : ''}" data-act="theme" data-t="${v}">${n}</button>`).join('')}</div></div>
    <div class="card"><h3>Instalar o app</h3>
      ${standalone ? '<p class="muted">Você já está usando o app instalado.</p>' : S.installEvt ? '<p class="muted small">Instala como aplicativo no celular ou no computador, com ícone próprio e funcionamento offline.</p><button class="btn btn-primary btn-block" data-act="install">Instalar Protocolo V</button>' :
      `<ul class="small" style="padding-left:18px;color:var(--text-2);margin-bottom:0"><li><b>Android (Chrome):</b> menu ⋮ → Instalar app.</li><li><b>iPhone (Safari):</b> Compartilhar → Adicionar à Tela de Início.</li><li><b>Computador (Chrome ou Edge):</b> ícone de instalar no fim da barra de endereço.</li></ul>`}</div>
    ${(() => { const ai = aiCfg(); return `<div class="card"><h3>IA para calcular refeições (opcional)</h3>
      <p class="muted small" style="margin-top:4px">Sem isso, a calculadora da Dieta usa a tabela TACO, que funciona para todo mundo. Com uma chave da API da Anthropic, aparece também “Calcular com IA”, que entende pratos e marcas e busca a tabela na internet. A chave fica só neste aparelho; a descrição da refeição vai para a Anthropic, com cobrança por uso na sua conta.</p>
      <label>Chave da API<input type="password" id="ai-key" autocomplete="off" placeholder="sk-ant-…" value="${esc(ai.key || '')}"></label>
      <label>Modelo<select id="ai-model">${AI_MODELS.map(([v, n]) => `<option value="${v}" ${v === (ai.model || 'claude-opus-5-5') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <p class="form-msg" id="ai-msg"></p>
      <div class="actions two"><button class="btn btn-primary" data-act="aisave">Salvar</button><button class="btn" data-act="aitest">Testar chave</button>
      ${ai.key ? '<button class="btn btn-ghost btn-danger" data-act="airemove">Remover chave</button>' : ''}</div></div>`; })()}
  </div>`;
}
function viewConta() {
  const a = store?.account || {};
  const when = s => s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  return `<div class="view-head"><div class="grow"><h2>Conta</h2></div></div>
  <div class="grid cols2">
    <div class="card"><div class="row" style="gap:14px;align-items:center">
        <div class="logo-mark" style="width:52px;height:52px;font-size:1.6rem">${esc((store?.email || 'T')[0].toUpperCase())}</div>
        <div class="grow" style="min-width:0"><div class="kicker" style="color:var(--ok)">● Conectado</div><b style="word-break:break-all">${esc(store?.email || 'Modo de teste (sem conta)')}</b></div></div>
      <div class="kv small" style="margin-top:16px">
        <span>E-mail verificado</span><b>${a.verified ? 'sim' : 'não'}</b>
        <span>Conta criada</span><b>${when(a.created)}</b>
        <span>Último login</span><b>${when(a.last)}</b>
        <span>Sincronização</span><b>${{ ok: 'em dia', saving: 'salvando', offline: 'offline', err: 'erro' }[S.sync]}</b></div>
      <p class="muted small">Seus treinos, dieta e medidas ficam salvos nesta conta e aparecem em qualquer aparelho em que você entrar com ela.</p></div>
    <div class="card"><h3>Segurança</h3>
      <div class="actions" style="margin-top:10px">
        <button class="btn" data-act="resetpass">Enviar e-mail para trocar a senha</button>
        <button class="btn btn-danger" data-act="logout">Sair desta conta</button></div>
      <p class="muted small" style="margin-bottom:0">Sair só desconecta este aparelho. Para entrar com outra conta, saia e faça login de novo.</p></div>
  </div>`;
}

/* ---------- sheet, toast, timer ---------- */
function openSheet(html, onMount, keepOpen) {
  const d = $('#sheet');
  $('#sheet-body').innerHTML = '<div class="sheet-grip"></div>' + html;
  if (!d.open) d.showModal();
  onMount && onMount();
}
function closeSheet() { const d = $('#sheet'); if (d.open) d.close(); }
$('#sheet').addEventListener('click', e => { if (e.target === e.currentTarget) closeSheet(); });

let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600); }

const T = { end: 0, total: 0, id: null };
let actx;
function beep() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    [0, .25, .5].forEach(t => { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(actx.destination); g.gain.setValueAtTime(.25, actx.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, actx.currentTime + t + .18); o.start(actx.currentTime + t); o.stop(actx.currentTime + t + .2); });
  } catch { }
}
function startTimer(sec, label) {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch { }
  T.total = sec; T.end = Date.now() + sec * 1000;
  $('#timer-label').textContent = label ? 'Descanso · ' + label : 'Descanso';
  const el = $('#timer'); el.hidden = false; el.classList.remove('end');
  clearInterval(T.id); T.id = setInterval(tickTimer, 250); tickTimer();
}
function tickTimer() {
  const left = Math.max(0, Math.ceil((T.end - Date.now()) / 1000));
  $('#timer-num').textContent = `${Math.floor(left / 60)}:${pad(left % 60)}`;
  $('.timer-ring').style.setProperty('--p', `${(1 - left / T.total) * 100}%`);
  if (left === 0) {
    clearInterval(T.id); $('#timer').classList.add('end'); beep();
    navigator.vibrate?.([200, 100, 200]);
    setTimeout(() => { if (Date.now() >= T.end) $('#timer').hidden = true; }, 8000);
  }
}
$('#timer-plus').onclick = () => { T.end += 15000; T.total += 15; if ($('#timer').classList.contains('end')) { $('#timer').classList.remove('end'); clearInterval(T.id); T.id = setInterval(tickTimer, 250); } tickTimer(); };
$('#timer-stop').onclick = () => { clearInterval(T.id); $('#timer').hidden = true; };

/* ---------- ações ---------- */
const ACT = {
  go: el => go(el.dataset.v),
  day: el => { const d = +el.dataset.d; S.dayKey = d === 0 ? todayKey() : addDays(S.dayKey, d); render(); },
  status: el => { setStatus(S.dayKey, el.dataset.s); if (el.dataset.s === 'done') toast('Dia concluído. Bom trabalho!'); },
  mode: el => store.saveDay(S.dayKey, { mode: el.dataset.m }),
  tip: el => { const t = document.getElementById('tip-' + el.dataset.id); if (t) t.hidden = !t.hidden; },
  exswap: el => openExSwap(el.dataset.slot),
  swapscope: el => { S.swapScope = el.dataset.s; el.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); },
  pickex: el => {
    const k = S.dayKey, slot = el.dataset.slot, key = el.dataset.k;
    if (S.swapScope === 'hoje') store.saveDay(k, { ['swap.' + slot]: key });
    else {
      store.setFields({ ['exSwap.' + slot]: key });
      if (dayOf(k).swap?.[slot] != null) store.saveDay(k, { ['swap.' + slot]: null });
    }
    closeSheet(); toast(S.swapScope === 'hoje' ? 'Trocado só para este dia.' : 'Trocado em todos os treinos.');
  },
  timer: el => startTimer(+el.dataset.rest, el.dataset.name),
  addset: el => {
    const k = S.dayKey, id = el.dataset.id, ex = exercisesFor(k).find(e => e.id === id);
    const arr = clone(dayOf(k).sets?.[id] || []);
    while (arr.length < (ex?.s || 0)) arr.push({});
    arr.push({}); store.saveDay(k, { ['sets.' + id]: arr });
  },
  setok: el => {
    const k = S.dayKey, id = el.dataset.id, i = +el.dataset.i;
    const arr = clone(dayOf(k).sets?.[id] || []);
    while (arr.length <= i) arr.push({});
    const s = arr[i] || {};
    s.ok = !s.ok;
    if (s.ok) {
      // Sem valores digitados: registra a meta de hoje (ou, sem meta, o da última vez)
      const ls = lastSets(id, k)?.sets?.[i], ex = exercisesFor(k).find(x => x.id === id), tg = ex && nextTarget(ex, k);
      const w = tg?.w ?? ls?.w, r = tg?.r ?? ls?.r;
      if (s.w == null && w != null) s.w = w;
      if (s.r == null && r != null) s.r = r;
      startTimer(+el.dataset.rest, el.dataset.name);
    }
    arr[i] = s;
    store.saveDay(k, { ['sets.' + id]: arr });
    // Treino completo → marca o dia como feito
    const day = clone(dayOf(k)); day.sets = { ...(day.sets || {}), [id]: arr };
    const exs = exercisesFor(k);
    const all = exs.length && exs.every(e => { const a = day.sets[e.id] || []; return a.filter(x => x?.ok).length >= Math.max(e.s, a.length); });
    if (all && P().status?.[k] !== 'done') { setStatus(k, 'done'); toast('Treino completo! Dia marcado como feito.'); }
  },
  habit: el => {
    const k = S.dayKey, h = el.dataset.h, i = +el.dataset.i, cur = dayOf(k).h?.[h] || 0;
    store.saveDay(k, { ['h.' + h]: cur === i + 1 ? i : i + 1 });
  },
  daysheet: el => openDaySheet(el.dataset.k),
  extendto: el => extendTo(el.dataset.k),
  calday: el => {
    const k = el.dataset.k;
    if (S.swapFrom) { const a = S.swapFrom; S.swapFrom = null; swapDays(a, k); render(); return; }
    openDaySheet(k);
  },
  swapcancel: () => { S.swapFrom = null; render(); },
  setcode: el => { const sch = clone(P().schedule); sch[el.dataset.k] = el.dataset.c; writeSchedule(sch); closeSheet(); },
  sheetstatus: el => { setStatus(el.dataset.k, el.dataset.s); closeSheet(); },
  openday: el => { S.dayKey = el.dataset.k; closeSheet(); go('hoje'); },
  swapstart: el => { S.swapFrom = el.dataset.k; closeSheet(); if (S.view !== 'agenda') go('agenda'); else render(); toast('Agora toque no outro dia.'); },
  postpone: el => { closeSheet(); postpone(el.dataset.k); },
  pullfwd: el => { closeSheet(); pullForward(el.dataset.k); },
  reflow: el => { closeSheet(); if (confirm(`Refazer o rodízio A→B→C a partir de ${fmtShort(el.dataset.k)}? Os treinos escolhidos à mão desses dias serão substituídos.`)) { reflow(el.dataset.k); toast('Rodízio refeito.'); } },
  extend: el => extendTo(addDays(ST().end, +el.dataset.n)),
  resetplan: () => { if (!confirm('Restaurar o calendário original (início, 15 dias, sábado de descanso)? Os registros são mantidos.')) return; const st = ST(); const end = addDays(st.start, 14); store.setFields({ schedule: rotation({}, st.start, end, st.rest, 0), 'settings.end': end }); toast('Calendário restaurado.'); },
  eat: el => mutateMeals(m => { const it = m[+el.dataset.m].items[+el.dataset.i]; it.ok = !it.ok; }),
  eatall: el => mutateMeals(m => { const items = m[+el.dataset.m].items; const v = !items.every(i => i.ok); items.forEach(i => i.ok = v); }),
  qty: el => mutateMeals(m => {
    const it = m[+el.dataset.m].items[+el.dataset.i], step = isPer100(food(it.f)) ? 0.25 : 0.5;
    it.q = Math.max(step, Math.round((it.q + Math.sign(+el.dataset.d) * step) / step) * step);
  }),
  swap: el => openSwap(+el.dataset.m, +el.dataset.i),
  doswap: el => { mutateMeals(m => { const it = m[+el.dataset.m].items[+el.dataset.i]; m[+el.dataset.m].items[+el.dataset.i] = { f: el.dataset.f, q: +el.dataset.q, ok: it.ok }; }); closeSheet(); toast('Substituído.'); },
  rmitem: el => { mutateMeals(m => m[+el.dataset.m].items.splice(+el.dataset.i, 1)); closeSheet(); },
  additem: el => openAdd(+el.dataset.m, el.dataset.replace),
  pickfood: el => isPer100(food(el.dataset.f)) ? pickGrams(el.dataset.f) : addItem(el.dataset.f, 1),
  gramset: el => { $('#pg-g').value = el.dataset.g; },
  pgadd: el => { const g = +$('#pg-g').value; if (!(g > 0)) return toast('Digite os gramas.'); addItem(el.dataset.f, Math.round(g) / 100); },
  calcrun: () => {
    const text = ($('#calc-text')?.value || S.calcDraft || '').trim();
    if (!text) return toast('Descreva o que você comeu.');
    const meals = mealsOf(S.dayKey);
    S.calc = { text, mi: +($('#calc-meal')?.value ?? defaultMealIndex(meals)), rows: parseMeal(text), note: '' };
    if (!S.calc.rows.some(r => r.sel)) S.calc.note = 'Não achei esses itens na tabela. Tente outro nome (ex.: “refrigerante” em vez da marca), busque o produto na internet ou crie o alimento.';
    openCalc();
  },
  calcon: el => { const r = S.calc.rows[+el.dataset.r]; r.on = !r.on; openCalc(); },
  calcweb: el => { const r = S.calc.rows[+el.dataset.r]; openAdd(S.calc.mi); setTimeout(() => { const q = $('#add-q'); if (q) { q.value = r.query; offSearch(); } }, 80); },
  calcadd: () => {
    const c = S.calc, rows = c.rows.filter(r => r.on && (r.sel || r.ai));
    const newFoods = {};
    mutateMeals(meals => {
      const m = meals[c.mi] || meals[meals.length - 1];
      rows.forEach((r, i) => {
        if (r.ai) { const id = 'ai_' + Date.now() + '_' + i; newFoods[id] = r.ai; m.items.push({ f: id, q: 1, ok: true }); }
        else m.items.push({ f: r.sel, q: r.q, ok: true });
      });
    });
    for (const [id, f] of Object.entries(newFoods)) store.setFields({ ['customFoods.' + id]: f });
    P().customFoods = { ...(P().customFoods || {}), ...newFoods };
    S.calcDraft = ''; const t = $('#calc-text'); if (t) t.value = '';
    closeSheet(); toast(`${rows.length} ${rows.length === 1 ? 'item adicionado' : 'itens adicionados'} como comidos.`);
  },
  calcai: async el => {
    el.disabled = true; el.textContent = 'Calculando com IA…';
    try {
      const out = await aiCalc(S.calc.text);
      S.calc.rows = out.itens.map(x => ({ text: x.nome, on: true, ai: { n: x.nome, u: x.porcao + (x.gramas ? ` (${Math.round(x.gramas)} g)` : ''), k: +x.kcal || 0, p: +x.proteina || 0, c: +x.carboidrato || 0, f: +x.gordura || 0, g: 'ext', fonte: x.fonte } }));
      S.calc.note = out.observacao || '';
      openCalc();
    } catch (e) { el.disabled = false; el.textContent = 'Calcular com IA (Claude)'; toast(e.message); }
  },
  aisave: () => {
    const key = $('#ai-key').value.trim(), model = $('#ai-model').value;
    try { localStorage.setItem('pv-ai', JSON.stringify({ key, model })); } catch { }
    toast(key ? 'IA configurada neste aparelho.' : 'Chave removida.'); render();
  },
  aitest: async el => {
    const key = $('#ai-key').value.trim(), model = $('#ai-model').value, msg = $('#ai-msg');
    if (!key) { msg.textContent = 'Cole a chave primeiro.'; return; }
    el.disabled = true; msg.className = 'form-msg ok'; msg.textContent = 'Testando…';
    let Anthropic;
    try { const k = await aiClient(key); Anthropic = k.Anthropic; await k.client.messages.countTokens({ model, messages: [{ role: 'user', content: 'teste' }] }); msg.textContent = 'Chave funcionando.'; }
    catch (e) { msg.className = 'form-msg'; msg.textContent = aiError(Anthropic, e); }
    el.disabled = false;
  },
  airemove: () => { try { localStorage.removeItem('pv-ai'); } catch { } toast('Chave removida deste aparelho.'); render(); },
  applykcal: el => { const v = +el.dataset.v; store.setFields({ 'settings.kcal': v }); toast(`Meta de calorias: ${fmt(v)} kcal.`); },
  addshake: () => {
    const shake = { id: 'shake', n: 'Shake extra', h: 'quarto', items: [{ f: 'leitepo', q: 1 }, { f: 'aveia', q: 1 }, { f: 'pasta', q: 1 }] };
    const tpl = templateMeals();
    if (!tpl.some(m => m.id === 'shake')) { tpl.push(shake); store.setFields({ mealTemplate: tpl }); }
    const t = todayKey();
    if (S.days[t]?.meals && !S.days[t].meals.some(m => m.id === 'shake')) store.saveDay(t, { meals: [...clone(S.days[t].meals), clone(shake)] });
    toast('Shake extra adicionado ao cardápio.');
  },
  evoswap: el => { store.setFields({ ['exSwap.' + el.dataset.slot]: el.dataset.k }); toast('Exercício trocado nos próximos treinos.'); },
  newblock: () => {
    const st = ST(), len = planLen(), start = todayKey(), end = addDays(start, len - 1);
    // Exercícios estagnados entram no bloco novo como variação; as cargas continuam no histórico
    const swaps = {};
    for (const e of PLAN_EX()) {
      const cur = P().exSwap?.[e.id], id = cur && cur !== 'orig' ? e.id + '__' + cur : e.id;
      if (exStatus(id, '9999').kind !== 'estagnado') continue;
      const alt = ALTS[e.id]?.find(a => a.k !== cur);
      if (alt) swaps['exSwap.' + e.id] = alt.k;
    }
    const n = Object.keys(swaps).length;
    if (!confirm(`Começar um bloco novo de ${len} dias hoje (${fmtShort(start)} a ${fmtShort(end)})?${n ? ` ${n} ${n === 1 ? 'exercício estagnado será trocado' : 'exercícios estagnados serão trocados'} por uma variação.` : ''}`)) return;
    store.setFields({ 'settings.start': start, 'settings.end': end, schedule: rotation({}, start, end, st.rest, 0), ...swaps });
    toast('Bloco novo começou hoje.'); go('agenda');
  },
  offsearch: () => offSearch(),
  pickoff: el => pickOff(S.offResults[+el.dataset.i]),
  barcode: () => askBarcode(pickOff),
  mealmenu: el => openMealMenu(+el.dataset.m),
  mealsave: el => {
    const n = $('#meal-n').value.trim(), h = $('#meal-h').value.trim();
    if (!n) return toast('Dê um nome à refeição.');
    mutateMeals(m => { m[+el.dataset.m].n = n; m[+el.dataset.m].h = h; }); closeSheet();
  },
  mealmove: el => { const i = +el.dataset.m, j = i + +el.dataset.d; mutateMeals(m => { if (m[j]) [m[i], m[j]] = [m[j], m[i]]; }); closeSheet(); },
  mealdel: el => { const m = mealsOf(S.dayKey)[+el.dataset.m]; if (!confirm(`Remover “${m.n}” deste dia?`)) return; mutateMeals(ms => ms.splice(+el.dataset.m, 1)); closeSheet(); },
  addmeal: () => { mutateMeals(m => m.push({ id: 'r' + Date.now(), n: 'Nova refeição', h: '', items: [] })); setTimeout(() => openMealMenu(mealsOf(S.dayKey).length - 1), 50); },
  copyday: el => {
    const src = clone(S.days[el.dataset.k]?.meals || []).map(m => ({ ...m, items: m.items.map(({ f, q }) => ({ f, q })) }));
    if (!src.length) return;
    if (dayOf(S.dayKey).meals && !confirm(`Substituir o cardápio deste dia pelo de ${fmtShort(el.dataset.k)}?`)) return;
    saveMeals(S.dayKey, src); toast(`Cardápio de ${fmtShort(el.dataset.k)} copiado.`);
  },
  addsug: el => {
    const mi = +el.dataset.m, f = el.dataset.f, q = +el.dataset.q;
    mutateMeals(m => { if (!m[mi]) m.push({ id: 'ceia', n: 'Ceia', h: 'quarto', items: [] }); m[Math.max(0, mi)].items.push({ f, q }); });
    toast(`${food(f).n} adicionado.`);
  },
  newfood: () => openNewFood(),
  nfsave: () => {
    const v = id => $('#nf-' + id).value.trim(), n = v('n'), k = +v('k');
    if (!n || !(k >= 0) || v('k') === '') { $('#nf-msg').textContent = 'Preencha pelo menos o nome e as calorias.'; return; }
    const id = 'my_' + Date.now(), f = { n, u: v('u') || '1 porção', k, p: +v('p') || 0, c: +v('c') || 0, f: +v('f') || 0, g: v('g') };
    store.setFields({ ['customFoods.' + id]: f });
    P().customFoods = { ...(P().customFoods || {}), [id]: f };
    addItem(id, 1);
  },
  savetemplate: () => { const meals = mealsOf(S.dayKey).map(m => ({ ...m, items: m.items.map(({ f, q }) => ({ f, q })) })); store.setFields({ mealTemplate: meals }); toast('Cardápio padrão salvo. Vale para os dias sem ajuste próprio.'); },
  resetday: () => { store.saveDay(S.dayKey, { meals: templateMeals() }); toast('Dia voltou ao cardápio padrão.'); },
  resettemplate: () => { if (confirm('Voltar ao cardápio-modelo do plano?')) store.setFields({ mealTemplate: null }); },
  medit: el => openMeasure(el.dataset.k),
  quickpeso: () => { const v = +$('#quick-peso').value; if (!v) return toast('Digite o peso.'); store.setFields({ ['measures.' + todayKey() + '.peso']: v }); toast('Peso salvo.'); },
  restday: el => { el.classList.toggle('on'); },
  defmode: el => store.setFields({ 'settings.mode': el.dataset.m }),
  applyplan: () => {
    const start = $('#s-start').value, len = Math.min(120, Math.max(3, +$('#s-len').value || 15));
    const rest = [...document.querySelectorAll('#s-rest button')].map((b, i) => b.classList.contains('on') ? i : -1).filter(i => i >= 0);
    if (!start) return toast('Escolha a data de início.');
    if (!confirm('Refazer o calendário com essas opções? Trocas manuais na agenda serão substituídas.')) return;
    const end = addDays(start, len - 1);
    store.setFields({ 'settings.start': start, 'settings.end': end, 'settings.rest': rest, schedule: rotation({}, start, end, rest, 0) });
    toast('Calendário refeito.');
  },
  wheybarcode: () => askBarcode(p => {
    const n = p.nutriments, g = +p.serving_quantity || ST().wheyG;
    const prot = Math.round((+n.proteins_serving || +n.proteins_100g * g / 100) * 10) / 10;
    const kcal = Math.round(+n['energy-kcal_serving'] || +n['energy-kcal_100g'] * g / 100);
    if (!prot) { toast('Rótulo sem proteína cadastrada. Preencha à mão.'); return; }
    store.setFields({ 'settings.wheyG': g, 'settings.wheyP': prot, 'settings.wheyK': kcal || ST().wheyK });
    closeSheet(); toast(`Whey atualizado: ${fmt(prot, 1)} g de proteína por dose de ${g} g.`);
  }),
  theme: el => { const t = el.dataset.t; try { localStorage.setItem('pv-theme', t); } catch { } applyTheme(); render(); },
  install: async () => { const e = S.installEvt; if (!e) return; e.prompt(); await e.userChoice; S.installEvt = null; render(); },
  logout: () => { if (confirm('Sair desta conta neste aparelho?')) { S.view = 'hoje'; history.replaceState(null, '', '#hoje'); store.signOut(); } },
  resetpass: async () => {
    if (!store?.resetPassword) return toast('Indisponível no modo de teste.');
    try { await store.resetPassword(); toast('Enviamos o link para ' + store.email + '.'); } catch (e) { toast('Não foi possível enviar: ' + (e.code || e.message)); }
  }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !store) return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el); }
});
document.addEventListener('change', e => {
  const el = e.target; if (!el.dataset || !store) return;
  const ch = el.dataset.ch, k = S.dayKey;
  if (ch === 'set') {
    const id = el.dataset.id, i = +el.dataset.i, arr = clone(dayOf(k).sets?.[id] || []);
    while (arr.length <= i) arr.push({});
    arr[i] = { ...(arr[i] || {}), [el.dataset.f]: el.value === '' ? null : +el.value };
    store.saveDay(k, { ['sets.' + id]: arr });
  } else if (ch === 'note') store.saveDay(k, { note: el.value });
  else if (ch === 'setting') { const v = +el.value; if (v > 0) store.setFields({ ['settings.' + el.dataset.f]: v }); }
  else if (ch === 'calcsel') { const r = S.calc.rows[+el.dataset.r]; r.sel = el.value; r.q = amountFor(r, r.sel); openCalc(); }
  else if (ch === 'calcq') { const r = S.calc.rows[+el.dataset.r], v = +el.value; if (v > 0) { r.q = isPer100(food(r.sel)) ? v / 100 : v; openCalc(); } }
});
// Rascunho da calculadora sobrevive aos redesenhos da tela
document.addEventListener('input', e => { if (e.target.id === 'calc-text') S.calcDraft = e.target.value; if (e.target.id === 'calc-meal') S.calcMeal = +e.target.value; });
document.addEventListener('change', e => { if (e.target.id === 'calc-meal') S.calcMeal = +e.target.value; });

/* Arrastar e soltar na agenda (computador) */
let dragK = null;
document.addEventListener('dragstart', e => { const el = e.target.closest?.('.cal-day[data-k]'); if (!el) return; dragK = el.dataset.k; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragK); });
document.addEventListener('dragover', e => { const el = e.target.closest?.('.cal-day[data-k]'); if (!el || !dragK) return; e.preventDefault(); document.querySelectorAll('.cal-day.drop').forEach(x => x !== el && x.classList.remove('drop')); el.classList.add('drop'); });
document.addEventListener('dragend', () => { dragK = null; document.querySelectorAll('.cal-day.drop,.cal-day.dragging').forEach(x => x.classList.remove('drop', 'dragging')); });
document.addEventListener('drop', e => { const el = e.target.closest?.('.cal-day[data-k]'); if (!el || !dragK) return; e.preventDefault(); const a = dragK; dragK = null; swapDays(a, el.dataset.k); });

/* ---------- tema, instalação, início ---------- */
function applyTheme() {
  let t = 'auto'; try { t = localStorage.getItem('pv-theme') || 'auto'; } catch { }
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}
applyTheme();

// Falha no carregamento: em vez de ficar preso no logo, mostra o motivo e como sair dali
function bootFail(e) {
  console.error(e);
  if ($('#boot').hidden) return;
  window.__pvFailed = true;
  const msg = e?.message || e?.reason?.message || String(e || 'erro desconhecido');
  $('#boot').innerHTML = `<div class="login-card" style="text-align:center"><div class="logo-mark" style="margin:0 auto 14px">V</div>
    <h3 style="font-size:1.3rem;text-transform:uppercase">Não foi possível carregar</h3>
    <p class="muted small">Verifique a internet. Se abriu pelo WhatsApp ou Instagram, abra o link no Chrome ou no Safari.</p>
    <p class="small mono" style="word-break:break-word;color:var(--danger)">${esc(msg)}</p>
    <button class="btn btn-primary btn-block" onclick="location.reload()">Tentar de novo</button></div>`;
}
addEventListener('error', e => { if (!$('#boot').hidden) bootFail(e.error || e.message); });
addEventListener('unhandledrejection', e => { if (!$('#boot').hidden) bootFail(e.reason); });
window.__pvLoaded = true;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; if (S.view === 'ajustes') render(); });
if ('serviceWorker' in navigator && !DEMO) navigator.serviceWorker.register('sw.js').catch(() => { });

// Virada do dia com o app aberto
setInterval(() => { const t = todayKey(); if (S.lastToday && S.lastToday !== t && S.dayKey === S.lastToday) { S.dayKey = t; render(); } S.lastToday = t; }, 60000);
S.lastToday = todayKey();

if (DEMO) { store = demoStore(); showApp(); }
else firebaseStart().catch(e => bootFail(e));
