/* Protocolo V — app de treino (stnr.com.br/treino). Firebase Auth + Firestore (projeto level-up-c3f9b). */
import { WORKOUTS, CODES, TIPS, ARMSTRONG, GUIDE, FOODS, GROUPS, SWAP_BY_PROTEIN, MEALS } from './data.js';

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
  const app = appM.initializeApp(FB_CFG);
  const auth = authM.getAuth(app);
  auth.languageCode = 'pt';
  let db;
  try { db = fsM.initializeFirestore(app, { localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }) }); }
  catch { db = fsM.getFirestore(app); }

  bindLogin(authM, auth);
  let unsub = [];
  authM.onAuthStateChanged(auth, user => {
    unsub.forEach(f => f()); unsub = [];
    S.user = user;
    if (!user) { S.profile = null; showLogin(); return; }
    const profRef = fsM.doc(db, COL, user.uid);
    const daysCol = fsM.collection(db, COL, user.uid, 'dias');
    const onErr = e => { console.error(e); if (e.code === 'permission-denied') S.permErr = true; setSync('err'); render(); if (!S.profile) { S.profile = defaultProfile(); showApp(); } };
    store = {
      email: user.email,
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
  if (f === 'whey') { const st = ST(); return { ...FOODS.whey, u: `1 dose (${st.wheyG} g)`, k: +st.wheyK, p: +st.wheyP }; }
  return FOODS[f] || P().customFoods?.[f] || { n: 'Alimento removido', u: '', k: 0, p: 0, g: 'ext' };
}
function templateMeals() {
  const t = P().mealTemplate;
  if (t) return clone(t);
  return MEALS.map(m => ({ id: m.id, n: m.n, h: m.h, items: m.items.map(([f, q]) => ({ f, q })) }));
}
const mealsOf = k => dayOf(k).meals ? clone(dayOf(k).meals) : templateMeals();
function totals(meals, onlyEaten) {
  let k = 0, p = 0;
  for (const m of meals) for (const it of m.items) { if (onlyEaten && !it.ok) continue; const f = food(it.f); k += f.k * it.q; p += f.p * it.q; }
  return { k, p };
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
const TITLES = { hoje: 'Hoje', agenda: 'Agenda', dieta: 'Dieta', medidas: 'Medidas', fichas: 'Fichas', guia: 'Guia', ajustes: 'Ajustes', mais: 'Mais' };
const SIDE = ['hoje', 'agenda', 'dieta', 'medidas', 'fichas', 'guia', 'ajustes'];
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
  const inMais = ['fichas', 'guia', 'ajustes', 'mais'].includes(v);
  $('#tabbar').innerHTML = TABS.map(n => `<button class="${v === n || (n === 'mais' && inMais) ? 'on' : ''}" data-act="go" data-v="${n}">${svg(n)}${TITLES[n]}</button>`).join('');
  $('#view-title').textContent = TITLES[v];
  const done = Object.values(P().status || {}).filter(s => s === 'done').length;
  const trainDays = Object.values(P().schedule).filter(c => c !== 'R').length;
  $('#side-progress').innerHTML = `<div class="meter"><div class="row between small"><span class="muted">Treinos feitos</span><b>${done}/${trainDays}</b></div><div class="bar"><i style="width:${Math.min(100, done / Math.max(1, trainDays) * 100)}%"></i></div></div>`;
  const views = { hoje: viewHoje, agenda: viewAgenda, dieta: viewDieta, medidas: viewMedidas, fichas: viewFichas, guia: viewGuia, ajustes: viewAjustes, mais: viewMais };
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
  const exs = code ? exercisesOf(code, k) : [];
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
    work = `<div class="card"><h3>Descanso</h3><p class="muted">Caminhada leve. Postura e vacuum continuam; creatina também. Mantenha o cardápio e tome o segundo whey à tarde.</p></div>`;
  } else if (code === 'LIVRE') {
    work = `<div class="card"><h3>Atividade livre</h3><label>O que você fez<textarea data-ch="note" placeholder="Ex.: futebol 1 h, corrida 5 km">${esc(day.note || '')}</textarea></label></div>`;
  }

  const t = totals(mealsOf(k), true), tp = totals(mealsOf(k));
  const side = `
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
  let sets = '';
  for (let i = 0; i < rows; i++) {
    const s = arr[i] || {}, ls = last?.sets?.[i] || {};
    sets += `<div class="set"><span class="n">${i + 1}</span>
      <input type="number" inputmode="decimal" step="0.5" min="0" placeholder="${esc(ls.w ?? 'kg')}" value="${esc(s.w ?? '')}" data-ch="set" data-id="${e.id}" data-i="${i}" data-f="w" aria-label="Peso série ${i + 1}">
      <input type="number" inputmode="numeric" min="0" placeholder="${esc(ls.r ?? 'reps')}" value="${esc(s.r ?? '')}" data-ch="set" data-id="${e.id}" data-i="${i}" data-f="r" aria-label="Repetições série ${i + 1}">
      <button class="check ${s.ok ? 'on' : ''}" data-act="setok" data-id="${e.id}" data-i="${i}" data-rest="${e.rest}" data-name="${esc(name)}" aria-label="Série ${i + 1} feita">✓</button></div>`;
  }
  return `<div class="ex ${done ? 'done' : ''}">
    <div class="ex-head"><div class="ex-num">${done ? '✓' : n + 1}</div><div class="grow">
      <div class="ex-name">${esc(name)}</div>
      <div class="ex-meta">${e.s} × ${esc(e.r)}${e.obs ? ' · ' + esc(e.obs) : ''}</div>
      <div class="ex-alt">${esc(alt)}</div>
      ${lastTxt ? `<div class="last">Última vez (${esc(fmtShort(last.date))}): ${esc(lastTxt)}</div>` : ''}
    </div>${e.tip ? `<button class="mini" data-act="tip" data-id="${e.id}" aria-label="Como executar">?</button>` : ''}</div>
    ${e.tip ? `<div class="ex-tip" id="tip-${e.id}" hidden>${esc(TIPS[e.tip])}${e.tip === 'lateral' ? '<br><br>' + esc(TIPS.dor) : ''}</div>` : ''}
    <div class="sets"><div class="set-head"><span>#</span><span>kg</span><span>reps</span><span></span></div>${sets}</div>
    <div class="row" style="margin-top:6px"><button class="link small" data-act="addset" data-id="${e.id}">+ série</button><span class="grow"></span>
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
          <button class="btn" data-act="reflow" data-k="${t >= st.start && t <= st.end ? t : st.start}">Refazer rodízio A→B→C a partir de hoje</button>
          <button class="btn" data-act="extend" data-n="7">Estender o plano em 7 dias</button>
          <button class="btn btn-ghost btn-danger" data-act="resetplan">Restaurar calendário original</button></div>
          <p class="muted small" style="margin-bottom:0">Adiar empurra todos os treinos seguintes um dia e põe descanso no dia escolhido. Refazer rodízio continua de onde você parou, respeitando os dias de descanso.</p></div>
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
      <button class="btn" data-act="reflow" data-k="${k}">Refazer rodízio daqui</button>
    </div>`);
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
  const body = meals.map((m, mi) => {
    const mt = totals([m]);
    return `<div class="meal"><div class="meal-head"><b>${esc(m.n)}</b><span class="muted small">${esc(m.h || '')}</span><span class="tot">${fmt(mt.k)} kcal · ${fmt(mt.p)} g</span></div>
      ${m.items.map((it, ii) => { const f = food(it.f); return `<div class="item ${it.ok ? 'eaten' : ''}">
        <button class="tick ${it.ok ? 'on' : ''}" data-act="eat" data-m="${mi}" data-i="${ii}" aria-label="Comi">✓</button>
        <div class="nm">${esc(f.n)}<small>${fmt(it.q, 1)} × ${esc(f.u)} · ${fmt(f.k * it.q)} kcal · ${fmt(f.p * it.q, 1)} g prot.</small></div>
        <div class="acts"><span class="qty"><button data-act="qty" data-m="${mi}" data-i="${ii}" data-d="-0.5" aria-label="Menos">−</button><span>${fmt(it.q, 1)}</span><button data-act="qty" data-m="${mi}" data-i="${ii}" data-d="0.5" aria-label="Mais">+</button></span>
        <button class="mini" data-act="swap" data-m="${mi}" data-i="${ii}" title="Substituir" aria-label="Substituir">⇄</button></div></div>`; }).join('')}
      <div class="row"><button class="link small" data-act="additem" data-m="${mi}">+ alimento</button><span class="grow"></span><button class="link small" data-act="eatall" data-m="${mi}">Marcar refeição</button></div></div>`;
  }).join('');
  return `<div class="view-head"><div class="grow"><h2>Dieta</h2><div class="muted small">Ovolactovegetariana · sem carne</div></div>${dayNav(k)}</div>
    <div class="grid two">
      <div class="card">${body}</div>
      <div class="grid">
        <div class="card"><h3>Consumido</h3><div style="margin-top:8px">${meter('Calorias', te.k, st.kcal, 'kcal')}${meter('Proteína', te.p, st.prot, 'g')}</div>
          <div class="kv small" style="margin-top:8px"><span>Planejado no dia</span><b>${fmt(tp.k)} kcal · ${fmt(tp.p)} g</b><span>Meta</span><b>${fmt(st.kcal)} kcal · ${fmt(st.prot)} g</b></div></div>
        <div class="card"><h3>Cardápio</h3><p class="muted small">Toque em ⇄ para trocar um alimento: a quantidade é recalculada para manter a proteína (ou as calorias, no caso de carboidrato, gordura e fruta).</p>
          <div class="actions">
            <button class="btn" data-act="savetemplate">Usar este dia como meu cardápio padrão</button>
            ${custom ? '<button class="btn btn-ghost" data-act="resetday">Voltar este dia ao cardápio padrão</button>' : ''}
            ${P().mealTemplate ? '<button class="btn btn-ghost btn-danger" data-act="resettemplate">Restaurar o cardápio-modelo do plano</button>' : ''}
          </div></div>
        <div class="card"><h3>Regra do prato</h3><ul class="small" style="padding-left:18px;color:var(--text-2)">
          <li><b>Metade do prato:</b> arroz, macarrão ou batata.</li><li><b>2 conchas:</b> feijão, lentilha ou grão-de-bico.</li>
          <li><b>Proteína:</b> ovo, omelete, queijo, tofu ou PTS; repita se puder.</li><li><b>Salada:</b> um punhado; à noite, sem exagero.</li>
          <li><b>Sem proteína no cardápio:</b> uma dose de whey ou ovos e queijo do kit.</li></ul>
          <p class="muted small" style="margin:0">Kit do quarto: whey, creatina, leite em pó, aveia, pasta de amendoim, banana, castanhas e PTS seca. Valores aproximados da TACO/Unicamp; produtos de marca vêm da Open Food Facts.</p></div>
      </div></div>`;
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
      <button class="btn btn-sm btn-ghost" data-act="barcode">Código de barras</button></div>
    <div class="opt-list" id="add-list"></div>`, () => {
    const q = $('#add-q'), list = $('#add-list');
    const draw = () => {
      const s = norm(q.value.trim());
      const all = { ...FOODS, ...(P().customFoods || {}) };
      const hits = Object.keys(all).filter(id => !s || norm(food(id).n).includes(s));
      list.innerHTML = hits.slice(0, 60).map(id => { const a = food(id); return `<button class="opt" data-act="pickfood" data-f="${id}"><div class="nm">${esc(a.n)}<small>${esc(a.u)} · ${GROUPS[a.g] || ''}</small></div><div class="val">${fmt(a.k)} kcal<br>${fmt(a.p, 1)} g</div></button>`; }).join('') || '<div class="empty-state small">Nada na base local. Toque em “Buscar na internet”.</div>';
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
          return { code: 'usda' + f.fdcId, product_name: f.description, brands: 'USDA', nutriments: { 'energy-kcal_100g': nv(1008) ?? nv(208), proteins_100g: nv(1003) ?? nv(203) ?? 0 } };
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
  return { id, f: { n: (p.product_name_pt || p.product_name) + (brand ? ` (${brand.trim()})` : ''), u: '100 g', k: +n['energy-kcal_100g'] || 0, p: +n.proteins_100g || 0, g: 'ext', code: p.code || '' }, serving: +p.serving_quantity || 0 };
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
function viewFichas() {
  const card = c => { const W = WORKOUTS[c]; return `<div class="card"><div class="row between"><h3>${W.name} — ${esc(W.title)}</h3><span class="chip w-${W.color}">${c}</span></div><div class="muted small">${esc(W.sub)}</div>
    <div class="scroll-x"><table class="mtable" style="margin-top:8px"><tr><th>Exercício</th><th>Séries × reps</th><th>Sem academia</th></tr>
    ${W.ex.map(e => `<tr><td>${esc(e.n)}</td><td style="font-family:var(--f-body)">${e.s} × ${esc(e.r)}${e.obs ? `<br><span class="muted small">${esc(e.obs)}</span>` : ''}</td><td style="font-family:var(--f-body)">${esc(e.home)}</td></tr>`).join('')}</table></div>
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
  return `<div class="grid">${item('fichas', 'Treinos A, B, C e Armstrong')}${item('guia', 'Postura, GTG, creatina, dieta, fontes')}${item('ajustes', 'Plano, metas, whey, tema, instalar o app')}</div>`;
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
    <div class="card"><h3>Conta</h3><p class="muted small">${esc(store?.email || '')}</p><button class="btn btn-block btn-danger" data-act="logout">Sair</button></div>
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
  tip: el => { const t = $('#tip-' + el.dataset.id); if (t) t.hidden = !t.hidden; },
  timer: el => startTimer(+el.dataset.rest, el.dataset.name),
  addset: el => {
    const k = S.dayKey, id = el.dataset.id, ex = exercisesOf(codeOf(k), k).find(e => e.id === id);
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
      const ls = lastSets(id, k)?.sets?.[i];
      // Sem valores digitados: repete o da última vez (toque rápido)
      if (s.w == null && ls?.w != null) s.w = ls.w;
      if (s.r == null && ls?.r != null) s.r = ls.r;
      startTimer(+el.dataset.rest, el.dataset.name);
    }
    arr[i] = s;
    store.saveDay(k, { ['sets.' + id]: arr });
    // Treino completo → marca o dia como feito
    const day = clone(dayOf(k)); day.sets = { ...(day.sets || {}), [id]: arr };
    const exs = exercisesOf(codeOf(k), k);
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
  reflow: el => { closeSheet(); if (confirm(`Refazer o rodízio A→B→C a partir de ${fmtShort(el.dataset.k)}? Os treinos escolhidos à mão desses dias serão substituídos.`)) { reflow(el.dataset.k); toast('Rodízio refeito.'); } },
  extend: el => extendTo(addDays(ST().end, +el.dataset.n)),
  resetplan: () => { if (!confirm('Restaurar o calendário original (início, 15 dias, sábado de descanso)? Os registros são mantidos.')) return; const st = ST(); const end = addDays(st.start, 14); store.setFields({ schedule: rotation({}, st.start, end, st.rest, 0), 'settings.end': end }); toast('Calendário restaurado.'); },
  eat: el => mutateMeals(m => { const it = m[+el.dataset.m].items[+el.dataset.i]; it.ok = !it.ok; }),
  eatall: el => mutateMeals(m => { const items = m[+el.dataset.m].items; const v = !items.every(i => i.ok); items.forEach(i => i.ok = v); }),
  qty: el => mutateMeals(m => { const it = m[+el.dataset.m].items[+el.dataset.i]; it.q = Math.max(0.5, Math.round((it.q + +el.dataset.d) * 2) / 2); }),
  swap: el => openSwap(+el.dataset.m, +el.dataset.i),
  doswap: el => { mutateMeals(m => { const it = m[+el.dataset.m].items[+el.dataset.i]; m[+el.dataset.m].items[+el.dataset.i] = { f: el.dataset.f, q: +el.dataset.q, ok: it.ok }; }); closeSheet(); toast('Substituído.'); },
  rmitem: el => { mutateMeals(m => m[+el.dataset.m].items.splice(+el.dataset.i, 1)); closeSheet(); },
  additem: el => openAdd(+el.dataset.m, el.dataset.replace),
  pickfood: el => addItem(el.dataset.f, 1),
  offsearch: () => offSearch(),
  pickoff: el => pickOff(S.offResults[+el.dataset.i]),
  barcode: () => askBarcode(pickOff),
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
  logout: () => { if (confirm('Sair desta conta neste aparelho?')) store.signOut(); }
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
});

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
addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; if (S.view === 'ajustes') render(); });
if ('serviceWorker' in navigator && !DEMO) navigator.serviceWorker.register('sw.js').catch(() => { });

// Virada do dia com o app aberto
setInterval(() => { const t = todayKey(); if (S.lastToday && S.lastToday !== t && S.dayKey === S.lastToday) { S.dayKey = t; render(); } S.lastToday = t; }, 60000);
S.lastToday = todayKey();

if (DEMO) { store = demoStore(); showApp(); }
else firebaseStart().catch(e => { console.error(e); $('#boot').innerHTML = '<div class="empty-state">Não foi possível carregar. Verifique a conexão e recarregue.</div>'; });
