/* Lúmen — interface. Os dados vêm de nuvem.js (Firebase) ou demo.js (localhost com ?demo). */
import {
  CARENCIA, TETO_CARTAO, JUROS_PCT, CASHBACK_PCT, RENDIMENTO_PCT, contas, emitidas, valorMoeda, inflacao,
  resumo, aplicar, economiaAberta, disponivelCartao,
} from './core.js?v=3';

const params = new URLSearchParams(location.search);
const DEMO = params.has('demo') && ['localhost', '127.0.0.1'].includes(location.hostname);
const store = (await import(DEMO ? './demo.js?v=3' : './nuvem.js?v=3')).criar();
const D = store.dados;
if (DEMO) window.__demo = store;

const raiz = document.getElementById('app'), folha = document.getElementById('folha'), avisoEl = document.getElementById('aviso');
let sessao = null, aba = 'inicio', cartaoAba = 'saldo', moedasAba = 'minhas', extratoAba = 'minha', extratoFiltro = 'tudo', oculto = false;
try { oculto = localStorage.getItem('lumen-oculto') === '1'; } catch {}

const SVG = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  olho: SVG('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'),
  fechado: SVG('<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5-1.3"/>'),
  sino: SVG('<path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  cobrar: SVG('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 20h16"/>'),
  enviar: SVG('<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>'),
  sacar: SVG('<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 11h7M6 14h4M16 14h2"/>'),
  cartao: SVG('<rect x="2.5" y="5" width="19" height="14" rx="2.500"/><path d="M2.5 10h19M6.5 15h3"/>'),
  cofre: SVG('<rect x="3" y="4" width="18" height="15" rx="2.500"/><circle cx="12" cy="11.5" r="3.2"/><path d="M12 8.3V7M7 19v2M17 19v2"/>'),
  cash: SVG('<circle cx="12" cy="12" r="9"/><path d="M15 9.2c-.6-1-1.7-1.5-3-1.5-1.8 0-3 .9-3 2.2 0 3 6 1.4 6 4.3 0 1.3-1.3 2.2-3 2.2-1.4 0-2.6-.6-3.1-1.6M12 6v12"/>'),
  cadeado: SVG('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
};
const LU = '<svg class="lu" viewBox="0 0 22 24" fill="none" stroke="currentColor" stroke-width="2.3" aria-label="lúmens"><path d="M11 1.800 20 7v10l-9 5.200L2 17V7z"/><circle cx="11" cy="12" r="4.300"/></svg>';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => Math.round(n).toLocaleString('pt-BR');
const lu = n => LU + `<span class="num">${num(n)}</span>`;
const luT = n => `${num(n)} ${Math.round(n) === 1 ? 'lúmen' : 'lúmens'}`;   // para texto puro
const real = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const real4 = c => 'R$ ' + (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const pct = p => !isFinite(p) ? 'sem lastro' : (p > 0 ? '+' : '') + p.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const nome = s => ({ cofre: 'Cofre do cartão', economia: 'Economia' }[s] || D.contas[s]?.nome || s);
const centavos = t => Math.round(parseFloat(String(t).replace(/\./g, '').replace(',', '.')) * 100);
const inicial = s => esc((nome(s).trim()[0] || '?').toUpperCase());
const dia = ms => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const esconde = html => oculto ? '••••' : html;
const opcoesContas = lista => lista.map(s => `<option value="${s}">${esc(nome(s))}</option>`).join('');
const inteiro = v => parseInt(String(v).replace(/\D/g, ''), 10);
const fmtReal = c => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Campos de valor: lúmen é sempre inteiro; real preenche da direita para a esquerda, como em app de banco. */
const CHIPS = [10, 100, 500, 1000];
const campoLu = (nomeCampo, rotulo, { max, valor, tudo, chips = true } = {}) => `<label><span class="rot">${rotulo}</span>
  <span class="campo">${LU}<input name="${nomeCampo}" type="text" inputmode="numeric" autocomplete="off" placeholder="0" required data-lumen ${max === undefined ? '' : `data-max="${max}"`} value="${valor ? num(valor) : ''}"></span></label>
  ${chips ? `<div class="chips">${CHIPS.map(n => `<button type="button" data-chip="${n}">+${num(n)}</button>`).join('')}${tudo ? '<button type="button" data-chip="tudo">Tudo</button>' : ''}</div>` : ''}`;
const campoReal = (nomeCampo, rotulo, { id = '', required = true } = {}) => `<label ${id ? `id="${id}"` : ''}><span class="rot">${rotulo}</span>
  <span class="campo"><b>R$</b><input name="${nomeCampo}" type="text" inputmode="numeric" autocomplete="off" placeholder="0,00" ${required ? 'required' : ''} data-real></span></label>`;

function mascaraLu(el) {
  const antes = el.value, depois = antes.slice(el.selectionStart ?? antes.length).replace(/\D/g, '').length;
  let d = antes.replace(/\D/g, '').replace(/^0+/, '').slice(0, 7);
  const max = el.dataset.max;
  if (max !== undefined && Number(d) > Number(max)) { d = max === '0' ? '' : max; aviso(`O máximo aqui é ${num(Number(max))}.`); }
  el.value = d ? num(Number(d)) : '';
  let i = el.value.length;
  for (let c = 0; i > 0 && c < depois; i--) if (/\d/.test(el.value[i - 1])) c++;
  el.setSelectionRange(i, i);
}
function mascaraReal(el) {
  const d = el.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
  el.value = d ? fmtReal(Number(d)) : '';
}
const definir = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
folha.addEventListener('input', ev => {
  if (ev.target.matches('[data-lumen]')) mascaraLu(ev.target);
  else if (ev.target.matches('[data-real]')) mascaraReal(ev.target);
}, true);
folha.addEventListener('click', ev => {
  const b = ev.target.closest('[data-chip]'); if (!b) return;
  const el = folha.querySelector('[data-lumen]');
  definir(el, b.dataset.chip === 'tudo' ? el.dataset.max : String((inteiro(el.value) || 0) + Number(b.dataset.chip)));
});

function aviso(msg) {
  avisoEl.textContent = msg; avisoEl.classList.add('on');
  clearTimeout(aviso.t); aviso.t = setTimeout(() => avisoEl.classList.remove('on'), 3400);
}
async function tentar(fn, ok) {
  try { await fn(); if (ok) aviso(ok); return true; }
  catch (err) { console.error('[lumen]', err); aviso(err.code === 'permission-denied' ? 'O banco recusou essa operação.' : err.message); return false; }
}

/* ---------- telas fora da carteira ---------- */
function capa(titulo, texto, botao) {
  raiz.innerHTML = `<section class="capa"><div class="logo">${LU}</div><h1>${titulo}</h1><p>${texto}</p>${botao || ''}</section>`;
}
function telaFora() {
  capa('Lúmen', params.has('convite')
    ? 'Você foi convidado para o banco da galera. Entre com sua conta Google.'
    : 'O banco de mentirinha da galera. Nada aqui é dinheiro de verdade.',
    '<button class="btn branco" data-acao="entrar">Entrar com Google</button>');
}

/* ---------- início ---------- */
const cobrancasParaMim = () => D.cobrancas.filter(c => c.status === 'aberta' && c.para === sessao.slot);
const atalho = (acao, rotulo, ic, travado, etiqueta) => `<button class="atalho ${travado ? 'travado' : ''}" data-acao="${acao}">
  ${travado ? `<span class="cadeado">${I.cadeado}</span>` : ''}${etiqueta ? `<span class="etiqueta">${etiqueta}</span>` : ''}<span class="ic">${ic}</span>${rotulo}</button>`;

function vInicio() {
  const e = D.e, s = sessao.slot, r = resumo(e, s), v = valorMoeda(e), inf = inflacao(e), aberta = economiaAberta(e), a = e.aplic[s], c = e.cartoes[s];
  const pend = cobrancasParaMim().length + (sessao.admin ? D.cheques.filter(x => x.status === 'emitido').length : 0);
  const interno = cartaoAba === 'saldo' ? `
    <small>Disponível para gastar</small>
    <div class="valor">${esconde(lu(e.saldos[s]))}</div>
    <div class="faixa"><i></i><span class="espaco">${esconde(real(e.saldos[s] * v))} hoje</span><button class="btn mini" data-acao="enviar">Enviar</button></div>` : `
    <small>Guardado na poupança</small>
    <div class="valor">${esconde(lu(a.n))}</div>
    <div class="faixa"><i style="background:${aberta ? 'var(--verde)' : 'var(--suave)'}"></i><span class="espaco">${aberta ? `Rende ${RENDIMENTO_PCT}% por semana` : 'Abre quando a Economia tiver moedas'}</span><button class="btn mini" data-acao="poupanca">Abrir</button></div>`;
  return `
  <header class="topo">
    <button class="redondo eu" data-acao="perfil" aria-label="Perfil">${inicial(s)}</button>
    <span class="espaco"></span>
    <button class="redondo" data-acao="olho" aria-label="Mostrar ou esconder valores">${oculto ? I.fechado : I.olho}</button>
    <button class="redondo" data-acao="avisos" aria-label="Avisos">${I.sino}${pend ? `<span class="ponto">${pend}</span>` : ''}</button>
    <span class="pilula num">${LU}${real4(v)}</span>
  </header>
  <section class="azulao">
    <div class="abas2">
      <button class="${cartaoAba === 'saldo' ? 'on' : ''}" data-cartao="saldo">Saldo</button>
      <button class="${cartaoAba === 'poup' ? 'on' : ''}" data-cartao="poup">Poupança</button>
    </div>
    <div class="interno">${interno}</div>
    <div class="cotacao"><span>Inflação acumulada</span><b class="num">${pct(inf)}</b></div>
  </section>
  <section class="atalhos">
    ${atalho('cobrar', 'Cobrar', I.cobrar)}${atalho('enviar', 'Enviar', I.enviar)}${atalho('sacar', 'Sacar', I.sacar)}
    ${atalho('cartao', 'Cartão', I.cartao)}${atalho('poupanca', 'Poupança', I.cofre, !aberta, aberta ? RENDIMENTO_PCT + '%' : '')}${atalho('cashback', 'Cashback', I.cash, !aberta, aberta ? CASHBACK_PCT + '%' : '')}
  </section>
  ${c.princ + c.juros ? `<section class="bloco"><div class="linha" style="padding:0"><div class="meio"><b>Fatura do cartão</b><span>Débito automático em ${dia(c.venc)}, com ${JUROS_PCT}% de juros</span></div><div class="fim">${lu(c.princ + c.juros)}</div></div></section>` : ''}
  <section class="bloco">
    <h2>Rumo ao saque</h2>
    <p>${r.sacaveis ? `<b>${num(r.sacaveis)}</b> moedas já liberadas.` : r.total ? `Sua moeda mais rodada precisa de mais <b>${num(Math.max(0, CARENCIA - r.maior))}</b> movimentações.` : 'Você está sem moedas.'}</p>
    <div class="barra"><i style="width:${Math.min(100, r.maior / CARENCIA * 100)}%"></i></div>
    <p class="nota" style="margin:0">Mais rodada: ${num(r.maior)} de ${num(CARENCIA)} · média das suas: ${num(r.media)}</p>
  </section>`;
}

/* ---------- moedas ---------- */
function vMoedas() {
  const e = D.e, minhas = moedasAba === 'minhas', r = resumo(e, sessao.slot), v = valorMoeda(e);
  const topo = `<h1 class="titulo">Moedas</h1><div class="opcoes"><button class="btn ${minhas ? 'on' : ''}" data-moedas="minhas">Minhas</button><button class="btn ${minhas ? '' : 'on'}" data-moedas="geral">Geral</button></div>`;
  const legenda = `<div class="legenda"><span><i style="background:#2f7bf6"></i>${minhas ? 'Suas' : 'Da galera'}</span>${minhas ? '<span><i style="background:#5c6474"></i>Da galera</span>' : ''}<span><i style="background:#f2b53c"></i>Liberada</span><span><i style="background:#5a3f94"></i>No banco</span></div>`;
  if (minhas) return `${topo}<section class="bloco"><canvas id="mapa"></canvas>${legenda}</section>
    <section class="bloco"><div class="grade">
      <div><span>Suas moedas</span><b>${lu(r.total)}</b></div><div><span>Valem hoje</span><b>${real(r.total * v)}</b></div>
      <div><span>Liberadas para saque</span><b>${num(r.sacaveis)}</b></div><div><span>Mais rodada</span><b>${num(r.maior)}</b></div>
    </div></section>`;
  const noBanco = ['cofre', 'economia', 'poup'].reduce((a, k) => a + e.saldos[k], 0);
  return `${topo}<section class="bloco"><canvas id="mapa"></canvas>${legenda}</section>
  <section class="bloco"><div class="grade">
    <div><span>Emitidas</span><b>${lu(emitidas(e))}</b></div><div><span>Com a galera</span><b>${lu(emitidas(e) - noBanco)}</b></div>
    <div><span>Valor da moeda</span><b>${real4(v)}</b></div><div><span>Caixinha</span><b>${real(e.lastro)}</b></div>
  </div></section>
  <section class="bloco"><h2>Moedas de todo mundo</h2>${[...contas(e)].sort((a, b) => e.saldos[b] - e.saldos[a]).map(s => {
    const x = resumo(e, s);
    return `<div class="linha"><div class="avatar ${D.contas[s]?.uid ? '' : 'vazio'}">${inicial(s)}</div><div class="meio"><b>${esc(nome(s))}</b><span>${num(x.sacaveis)} liberadas · média ${num(x.media)}</span></div><div class="fim">${lu(x.total)}</div></div>`;
  }).join('')}</section>`;
}

function desenharMapa() {
  const c = document.getElementById('mapa'); if (!c) return;
  const e = D.e, n = e.dono.length, cols = 150, linhas = Math.ceil(n / cols), meu = inteiro(sessao.slot.slice(1)), geral = moedasAba === 'geral';
  c.width = cols; c.height = linhas;
  const g = c.getContext('2d'), img = g.createImageData(cols, linhas), base = [28, 32, 41];
  const mistura = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
  for (let i = 0; i < n; i++) {
    const d = e.dono[i]; let cor;
    if (!d) cor = base;
    else if (d >= 253) cor = [90, 63, 148];
    else if (e.mov[i] >= CARENCIA) cor = [242, 181, 60];
    else cor = mistura(base, geral || d === meu ? [47, 123, 246] : [92, 100, 116], 0.45 + 0.55 * e.mov[i] / CARENCIA);
    img.data.set([...cor, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
}

/* ---------- galera ---------- */
function vGalera() {
  const e = D.e, v = valorMoeda(e);
  return `<h1 class="titulo">Galera</h1>
  <button class="btn cheio" data-acao="nova-conta-amigo">Convidar alguém</button>
  <p class="nota" style="margin:10px 2px 0">A conta nova começa zerada. As moedas dela vêm de quem quiser mandar.</p>
  <section class="bloco">${[...contas(e)].sort((a, b) => e.saldos[b] - e.saldos[a]).map(s => {
    const c = D.contas[s] || {}, link = !c.uid && D.convites.some(x => x.slot === s) && c.criador;
    return `<div class="linha"><div class="avatar ${c.uid ? '' : 'vazio'}">${inicial(s)}</div>
      <div class="meio"><b>${esc(nome(s))}${s === sessao.slot ? ' (você)' : ''}</b><span>${c.uid ? 'Na carteira' : 'Convite pendente'}</span></div>
      ${link ? `<button class="btn claro mini" data-acao="convidar" data-slot="${s}">Link</button>` : ''}
      <div class="fim">${lu(e.saldos[s])}<small>${real(e.saldos[s] * v)}</small></div></div>`;
  }).join('')}</section>`;
}

/* ---------- extrato ---------- */
function descreverTx(t) {
  switch (t.tipo) {
    case 'envio': return { titulo: `${nome(t.de)} → ${nome(t.para)}`, sub: t.msg || '', fim: lu(t.qtd) };
    case 'compra': return { titulo: `${nome(t.de)} → ${nome(t.para)} no cartão`, sub: [t.msg, t.cashback ? `cashback de ${luT(t.cashback)}` : ''].filter(Boolean).join(' · '), fim: lu(t.qtd) };
    case 'fatura': return { titulo: `${nome(t.de)} pagou a fatura`, sub: '', fim: lu(t.qtd) };
    case 'debito': return { titulo: `Débito automático de ${nome(t.de)}`, sub: `Fatura com ${JUROS_PCT}% de juros`, fim: '' };
    case 'guardar': return { titulo: `${nome(t.de)} guardou na poupança`, sub: '', fim: lu(t.qtd) };
    case 'resgatar': return { titulo: `${nome(t.de)} resgatou da poupança`, sub: '', fim: lu(t.qtd) };
    case 'rendimento': return { titulo: `Poupança de ${nome(t.de)} rendeu`, sub: '', fim: '' };
    case 'conta': return { titulo: `Conta nova: ${nome(t.slot)}`, sub: '', fim: '' };
    case 'emissao': return { titulo: `Banco gerou moedas para ${nome(t.para)}`, sub: t.deposito ? `${real(t.deposito)} depositados na caixinha` : 'Sem depósito: inflação na veia', fim: '+' + lu(t.qtd) };
    case 'caixinha': return { titulo: t.delta > 0 ? 'Depósito na caixinha' : 'Retirada da caixinha', sub: '', fim: real(Math.abs(t.delta)) };
    case 'saque': return { titulo: `Cheque de ${nome(t.de)} compensado`, sub: real(t.valor || 0), fim: '−' + lu(t.qtd) };
    default: return { titulo: t.tipo, sub: '', fim: '' };
  }
}
const quando = t => t.em ? new Date(t.em.seconds * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'agora';
const STATUS = { emitido: 'Aguardando compensação', compensado: 'Compensado', devolvido: 'Devolvido' };

/* Quanto a transação mudou o saldo desta conta. As antigas não guardam isso e são deduzidas pelo tipo. */
function variacao(t, s) {
  if (t.efeito) return t.efeito[s] || 0;
  if (t.tipo === 'envio') return t.de === s ? -t.qtd : t.para === s ? t.qtd : 0;
  if (t.tipo === 'compra') return t.para === s ? t.qtd : 0;
  if (t.tipo === 'emissao') return t.para === s ? t.qtd : 0;
  if (t.de !== s) return 0;
  return { guardar: -t.qtd, fatura: -t.qtd, saque: -t.qtd, resgatar: t.qtd }[t.tipo] || 0;
}
const envolve = (t, s) => t.quem ? t.quem.includes(s) : t.de === s || t.para === s;

/* Texto da linha do ponto de vista do dono da conta. */
function linhaPessoal(t, s) {
  const saiu = t.de === s;
  switch (t.tipo) {
    case 'envio': return { titulo: saiu ? `Enviado para ${nome(t.para)}` : `Recebido de ${nome(t.de)}`, sub: t.msg || '' };
    case 'compra': return saiu
      ? { titulo: `Pago no cartão para ${nome(t.para)}`, sub: [t.msg, t.cashback ? 'com cashback' : ''].filter(Boolean).join(' · '), lateral: `${num(t.qtd)} na fatura` }
      : { titulo: `Recebido de ${nome(t.de)}`, sub: t.msg ? `${t.msg} · pago no cartão` : 'Pago no cartão' };
    case 'fatura': return { titulo: 'Pagamento da fatura', sub: '' };
    case 'debito': return { titulo: 'Débito automático da fatura', sub: `Com ${JUROS_PCT}% de juros` };
    case 'guardar': return { titulo: 'Guardado na poupança', sub: '' };
    case 'resgatar': return { titulo: 'Resgate da poupança', sub: '' };
    case 'rendimento': return { titulo: 'Rendimento da poupança', sub: 'Fica guardado na poupança', lateral: t.rendeu ? `+${num(t.rendeu)} na poupança` : '' };
    case 'emissao': return { titulo: 'Moedas recebidas do banco', sub: '' };
    case 'saque': return { titulo: 'Cheque compensado', sub: real(t.valor || 0) };
    default: return { titulo: t.tipo, sub: '' };
  }
}

function extratoPessoal() {
  const s = sessao.slot, porSeq = new Map();
  [...D.meuExtrato, ...D.txs.filter(t => envolve(t, s))].forEach(t => porSeq.set(t.seq, t));
  let saldo = D.e.saldos[s];   // volta no tempo a partir do saldo de agora
  return [...porSeq.values()].sort((a, b) => b.seq - a.seq).map(t => {
    const d = variacao(t, s), linha = { t, d, saldo, ...linhaPessoal(t, s) };
    saldo -= d;
    return linha;
  });
}

function vMeuExtrato() {
  const s = sessao.slot, todas = extratoPessoal();
  const entrou = todas.reduce((a, l) => a + Math.max(l.d, 0), 0), saiu = todas.reduce((a, l) => a + Math.min(l.d, 0), 0);
  const lista = todas.filter(l => extratoFiltro === 'tudo' || (extratoFiltro === 'entradas' ? l.d > 0 : l.d < 0));
  const meus = D.cheques.filter(c => c.slot === s);
  let diaAtual = '';
  const linhas = lista.map(l => {
    const data = l.t.em ? new Date(l.t.em.seconds * 1000) : new Date();
    const rot = data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
    const cabeca = rot === diaAtual ? '' : `<h3 class="dia">${rot}</h3>`;
    diaAtual = rot;
    const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${cabeca}<div class="linha"><div class="meio"><b>${esc(l.titulo)}</b><span>${esc(l.sub ? `${l.sub} · ${hora}` : hora)}</span></div>
      <div class="fim"><span class="${l.d > 0 ? 'baixa' : ''}">${l.d ? `${l.d > 0 ? '+' : '−'}${lu(Math.abs(l.d))}` : esc(l.lateral || '')}</span><small>Saldo ${esconde(num(l.saldo))}</small></div></div>`;
  }).join('');
  return `<section class="bloco"><div class="grade">
      <div><span>Saldo atual</span><b>${esconde(lu(D.e.saldos[s]))}</b></div>
      <div><span>Valor hoje</span><b>${esconde(real(D.e.saldos[s] * valorMoeda(D.e)))}</b></div>
      <div><span>Entradas</span><b class="baixa">${esconde(lu(entrou))}</b></div>
      <div><span>Saídas</span><b>${esconde(lu(Math.abs(saiu)))}</b></div>
    </div></section>
  ${meus.length ? `<section class="bloco"><h2>Seus cheques</h2>${meus.map(c => `<div class="linha"><div class="meio"><b>Cheque nº ${esc(c.numero)}</b><span>${STATUS[c.status]}</span></div>
    <button class="btn claro mini" data-acao="ver-cheque" data-id="${esc(c.id)}">Ver</button><div class="fim">${real(c.valor)}<small>${lu(c.qtd)}</small></div></div>`).join('')}</section>` : ''}
  <div class="chips filtro">${[['tudo', 'Tudo'], ['entradas', 'Entradas'], ['saidas', 'Saídas']].map(([k, r]) => `<button class="${extratoFiltro === k ? 'on' : ''}" data-filtro="${k}">${r}</button>`).join('')}</div>
  <section class="bloco" style="margin-top:10px">${linhas || '<p class="nota" style="margin:0">Nenhuma movimentação aqui.</p>'}
    ${D.temMais ? '<button class="btn claro cheio" data-acao="mais-extrato" style="margin-top:10px">Ver mais</button>' : ''}</section>`;
}

function vExtratoGalera() {
  return `<section class="bloco">${D.txs.length ? D.txs.map(t => {
    const d = descreverTx(t);
    return `<div class="linha"><div class="meio"><b>${esc(d.titulo)}</b><span>${esc(d.sub ? d.sub + ' · ' + quando(t) : quando(t))}</span></div><div class="fim">${d.fim}</div></div>`;
  }).join('') : '<p class="nota" style="margin:0">Nada ainda. Alguém tem que começar a zoeira.</p>'}</section>`;
}

function vExtrato() {
  const minha = extratoAba === 'minha';
  return `<h1 class="titulo">Extrato</h1>
  <div class="opcoes"><button class="btn ${minha ? 'on' : ''}" data-extrato="minha">Minha conta</button><button class="btn ${minha ? '' : 'on'}" data-extrato="galera">Galera</button></div>
  ${minha ? vMeuExtrato() : vExtratoGalera()}`;
}

/* ---------- banco (só o administrador) ---------- */
function vBanco() {
  const e = D.e, pend = D.cheques.filter(c => c.status === 'emitido');
  return `<h1 class="titulo">Banco</h1>
  <section class="bloco"><h2>Caixinha</h2>
    <div class="grade">
      <div><span>Depositado</span><b>${real(e.lastro)}</b></div>
      <div><span>Moedas emitidas</span><b>${lu(emitidas(e))}</b></div>
      <div><span>Valor da moeda</span><b>${real4(valorMoeda(e))}</b></div>
      <div><span>Inflação acumulada</span><b class="${inflacao(e) > 0.05 ? 'alta' : ''}">${pct(inflacao(e))}</b></div>
    </div>
    <div class="botoes">
      <button class="btn mini" data-acao="emitir">Gerar moedas</button>
      <button class="btn claro mini" data-acao="caixinha">Depositar ou retirar</button>
      <button class="btn claro mini" data-acao="auditar">Auditar</button>
    </div></section>
  <section class="bloco"><h2>Economia</h2>
    <div class="grade">
      <div><span>Juros guardados</span><b>${lu(e.saldos.economia)}</b></div>
      <div><span>Cofre do cartão</span><b>${lu(e.saldos.cofre)}</b></div>
      <div><span>Poupança da galera</span><b>${lu(e.saldos.poup)}</b></div>
      <div><span>Poupança e cashback</span><b class="${economiaAberta(e) ? 'baixa' : ''}">${economiaAberta(e) ? 'Liberados' : 'Travados'}</b></div>
    </div>
    <p class="nota" style="margin:10px 0 0">Os ${JUROS_PCT}% de juros das faturas caem aqui e pagam o rendimento e o cashback.</p></section>
  ${pend.length ? `<section class="bloco"><h2>Cheques a compensar</h2>${pend.map(c => `<div class="linha quebra"><div class="meio"><b>${esc(nome(c.slot))} · nº ${esc(c.numero)}</b><span>${luT(c.qtd)} · ${real(c.valor)}</span></div>
    <button class="btn mini" data-acao="compensar" data-id="${esc(c.id)}">Compensar</button><button class="btn claro mini" data-acao="devolver" data-id="${esc(c.id)}">Devolver</button></div>`).join('')}</section>` : ''}
  <section class="bloco"><h2>Contas</h2>
    <button class="btn cheio" data-acao="nova-conta" style="margin-bottom:6px">Criar conta</button>
    ${contas(e).map(s => {
    const c = D.contas[s] || {}, tem = D.convites.find(x => x.slot === s);
    return `<div class="linha quebra"><div class="avatar ${c.uid ? '' : 'vazio'}">${inicial(s)}</div>
      <div class="meio"><b>${esc(nome(s))}</b><span>${s === sessao.slot ? 'Você' : c.uid ? 'Conectado' : tem ? 'Convite criado' : 'Sem convite'}</span></div>
      <button class="btn claro mini" data-acao="renomear" data-slot="${s}">Nome</button>
      ${s === sessao.slot ? '' : c.uid
        ? `<button class="btn perigo mini" data-acao="desvincular" data-slot="${s}">Soltar</button>`
        : `<button class="btn mini" data-acao="convidar" data-slot="${s}">Convidar</button>`}</div>`;
  }).join('')}</section>`;
}

const ABAS = { inicio: ['Início', vInicio], moedas: ['Moedas', vMoedas], galera: ['Galera', vGalera], extrato: ['Extrato', vExtrato], banco: ['Banco', vBanco] };

function desenhar() {
  if (!sessao) return;
  if (sessao.fase === 'fora') return telaFora();
  if (sessao.fase === 'sem-convite') return capa('Sem convite', `A conta ${esc(sessao.email)} ainda não está no banco. Peça um link de convite para alguém da galera.`, '<button class="btn claro" data-acao="sair">Usar outra conta</button>');
  if (sessao.fase === 'erro') return capa('Deu ruim', esc(sessao.msg), '<button class="btn claro" data-acao="sair">Sair</button>');
  if (!D.e || !D.contas[sessao.slot]) return capa('Lúmen', 'Abrindo o cofre...');
  const abas = Object.entries(ABAS).filter(([k]) => k !== 'banco' || sessao.admin);
  raiz.innerHTML = `${ABAS[aba][1]()}<nav><div>${abas.map(([k, [r]]) => `<button class="${k === aba ? 'on' : ''}" data-aba="${k}">${r}</button>`).join('')}</div></nav>`;
  desenharMapa();
}

/* ---------- folhas ---------- */
function abrir(html, aoEnviar, aoMudar) {
  folha.innerHTML = `<form>${html}</form>`;
  const f = folha.firstElementChild;
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const b = f.querySelector('[type=submit]'); b.disabled = true;
    const r = await aoEnviar(new FormData(f), f);
    if (r === true) folha.close(); else if (r !== 'manter') b.disabled = false;
  });
  f.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', () => folha.close()));
  if (aoMudar) { f.addEventListener('input', () => aoMudar(f)); aoMudar(f); }
  if (!folha.open) folha.showModal();
  return f;
}
const rodape = rotulo => `<div class="fim-folha"><button type="button" class="btn claro" data-fechar>Cancelar</button><button type="submit" class="btn">${esc(rotulo)}</button></div>`;
const fechar = '<button type="button" class="btn claro cheio" data-fechar>Fechar</button><button type="submit" hidden></button>';
const info = (titulo, corpo) => abrir(`<h2>${esc(titulo)}</h2>${corpo}${fechar}`, async () => true);

function folhaEnviar() {
  const e = D.e, s = sessao.slot, outros = contas(e).filter(x => x !== s), credito = disponivelCartao(e, s);
  let fonte = 'envio';
  const f = abrir(`<h2>Enviar</h2>
    <div class="opcoes"><button type="button" class="btn on" id="f-saldo">Saldo</button><button type="button" class="btn" id="f-cartao">Cartão</button></div>
    <label>Para quem<select name="para">${opcoesContas(outros)}</select></label>
    ${campoLu('qtd', 'Quantas', { max: e.saldos[s], tudo: true })}
    <label>Recado (opcional)<input name="msg" maxlength="80"></label>
    <p class="nota" id="dica"></p>${rodape('Enviar')}`, async d => {
    const qtd = inteiro(d.get('qtd')), msg = d.get('msg').trim(), tx = { tipo: fonte, de: s, para: d.get('para'), qtd };
    if (msg) tx.msg = msg;
    return tentar(() => store.executar(tx), `${luT(qtd)} para ${nome(tx.para)}.`);
  });
  const marcar = v => {
    fonte = v;
    const max = v === 'envio' ? e.saldos[s] : credito;
    f.querySelector('#f-saldo').classList.toggle('on', v === 'envio'); f.querySelector('#f-cartao').classList.toggle('on', v === 'compra');
    f.qtd.dataset.max = max; f.querySelector('.rot').textContent = `Quantas (disponível: ${num(max)})`;
    if (f.qtd.value) definir(f.qtd, f.qtd.value);
    f.querySelector('#dica').textContent = v === 'envio' ? 'Cada moeda enviada ganha 1 movimentação. Saem primeiro as menos rodadas.' : `Entra na sua fatura.${economiaAberta(e) ? ` Volta ${CASHBACK_PCT}% de cashback.` : ''}`;
  };
  f.querySelector('#f-saldo').onclick = () => marcar('envio');
  f.querySelector('#f-cartao').onclick = () => marcar('compra');
  marcar('envio');
}

function folhaCobrar() {
  const outros = contas(D.e).filter(x => x !== sessao.slot);
  abrir(`<h2>Cobrar</h2>
    <label>Quem vai pagar<select name="para">${opcoesContas(outros)}</select></label>
    ${campoLu('qtd', 'Quanto')}
    <label>Motivo (opcional)<input name="msg" maxlength="80"></label>${rodape('Enviar cobrança')}`,
  async d => tentar(() => store.cobrar(d.get('para'), inteiro(d.get('qtd')), d.get('msg').trim()), `Cobrança enviada para ${nome(d.get('para'))}.`));
}

function folhaAvisos() {
  const minhas = cobrancasParaMim(), feitas = D.cobrancas.filter(c => c.status === 'aberta' && c.de === sessao.slot);
  const cheques = sessao.admin ? D.cheques.filter(c => c.status === 'emitido') : [];
  if (!minhas.length && !feitas.length && !cheques.length) return info('Avisos', '<p class="nota">Nada pendente.</p>');
  abrir(`<h2>Avisos</h2>
    ${minhas.map(c => `<div class="linha quebra"><div class="meio"><b>${esc(nome(c.de))} cobrou ${esc(luT(c.qtd))}</b><span>${esc(c.msg || 'Sem motivo')}</span></div>
      <button type="button" class="btn mini" data-acao="pagar-cobranca" data-id="${esc(c.id)}" data-tipo="envio">Pagar</button>
      <button type="button" class="btn claro mini" data-acao="pagar-cobranca" data-id="${esc(c.id)}" data-tipo="compra">No cartão</button>
      <button type="button" class="btn claro mini" data-acao="recusar-cobranca" data-id="${esc(c.id)}">Recusar</button></div>`).join('')}
    ${feitas.map(c => `<div class="linha"><div class="meio"><b>Você cobrou ${esc(nome(c.para))}</b><span>${esc(luT(c.qtd))} · aguardando</span></div>
      <button type="button" class="btn claro mini" data-acao="cancelar-cobranca" data-id="${esc(c.id)}">Cancelar</button></div>`).join('')}
    ${cheques.map(c => `<div class="linha"><div class="meio"><b>Cheque de ${esc(nome(c.slot))}</b><span>${real(c.valor)} · veja na aba Banco</span></div></div>`).join('')}
    <div style="margin-top:10px">${fechar}</div>`, async () => true);
}

function folhaCartao() {
  const e = D.e, s = sessao.slot, c = e.cartoes[s], fatura = c.princ + c.juros;
  abrir(`<h2>Cartão</h2>
    <div class="plastico"><div><small>Disponível</small><br><b>${lu(disponivelCartao(e, s))}</b></div>
      <div class="pe"><span>${esc(nome(s))}</span><small>Limite ${num(c.lib)} de ${num(TETO_CARTAO)}</small></div></div>
    <div class="barra"><i style="width:${c.lib / TETO_CARTAO * 100}%"></i></div>
    <p class="nota">Cada fatura paga em dia libera mais limite. Fatura atrasada baixa o limite e trava o cartão.</p>
    <div class="grade" style="margin-bottom:14px"><div><span>Fatura atual</span><b>${lu(fatura)}</b></div><div><span>Débito automático</span><b>${c.venc ? dia(c.venc) : 'Sem fatura'}</b></div></div>
    ${fatura ? `<p class="nota">Pagando antes do vencimento não tem juros. No débito automático entram ${JUROS_PCT}%.</p>
      ${campoLu('qtd', 'Quanto pagar agora', { max: fatura, valor: Math.min(fatura, e.saldos[s]), chips: false })}${rodape('Pagar fatura')}` : fechar}`,
  async d => tentar(() => store.executar({ tipo: 'fatura', de: s, qtd: inteiro(d.get('qtd')) }), 'Fatura paga.'));
}

function folhaPoupanca() {
  const e = D.e, s = sessao.slot, a = e.aplic[s], aberta = economiaAberta(e);
  if (!aberta && !a.n) return info('Poupança', '<p>Travada por enquanto. Ela abre quando a Economia do banco tiver moedas, e essas moedas vêm dos juros do cartão.</p>');
  let tipo = aberta ? 'guardar' : 'resgatar';
  const f = abrir(`<h2>Poupança</h2>
    <div class="grade" style="margin-bottom:14px"><div><span>Guardado</span><b>${lu(a.n)}</b></div><div><span>Rendimento</span><b>${RENDIMENTO_PCT}% por semana</b></div></div>
    <div class="opcoes"><button type="button" class="btn" id="g" ${aberta ? '' : 'disabled'}>Guardar</button><button type="button" class="btn" id="r">Resgatar</button></div>
    ${campoLu('qtd', 'Quanto', { max: e.saldos[s], tudo: true })}
    <p class="nota">Moeda guardada não ganha movimentação. O rendimento sai da Economia e para se ela esvaziar.</p>${rodape('Confirmar')}`,
  async d => tentar(() => store.executar({ tipo, de: s, qtd: inteiro(d.get('qtd')) }), 'Poupança atualizada.'));
  const marcar = t => {
    tipo = t;
    f.querySelector('#g').classList.toggle('on', t === 'guardar'); f.querySelector('#r').classList.toggle('on', t === 'resgatar');
    const max = t === 'guardar' ? e.saldos[s] : a.n;
    f.qtd.dataset.max = max; f.querySelector('.rot').textContent = `Quanto (disponível: ${num(max)})`;
    if (f.qtd.value) definir(f.qtd, f.qtd.value);
  };
  f.querySelector('#g').onclick = () => marcar('guardar');
  f.querySelector('#r').onclick = () => marcar('resgatar');
  marcar(tipo);
}

function folhaCashback() {
  const e = D.e, ganhos = D.txs.filter(t => t.de === sessao.slot && t.cashback).reduce((a, t) => a + t.cashback, 0);
  info('Cashback', economiaAberta(e)
    ? `<p>Cada envio no cartão devolve ${CASHBACK_PCT}% em moedas, pagos pela Economia do banco.</p><div class="grade" style="margin-bottom:14px"><div><span>Você recebeu</span><b>${lu(ganhos)}</b></div><div><span>Na Economia</span><b>${lu(e.saldos.economia)}</b></div></div>`
    : '<p>Travado por enquanto. Ele abre quando a Economia do banco tiver moedas, e essas moedas vêm dos juros do cartão.</p>');
}

/* ---------- cheque ---------- */
function desenharCheque(c) {
  const k = document.createElement('canvas'); k.id = 'cheque'; k.width = 1000; k.height = 440;
  const g = k.getContext('2d');
  g.fillStyle = '#eaf1ff'; g.fillRect(0, 0, 1000, 440);
  g.strokeStyle = 'rgba(47,123,246,.08)'; g.lineWidth = 2;
  for (let i = -180; i < 1000; i += 26) { g.beginPath(); g.moveTo(i, 14); g.lineTo(i + 180, 426); g.stroke(); }
  g.strokeStyle = '#2f7bf6'; g.lineWidth = 6; g.strokeRect(14, 14, 972, 412);
  const t = (s, x, y, f, cor = '#10131a', al = 'left') => { g.font = f; g.fillStyle = cor; g.textAlign = al; g.fillText(s, x, y); };
  t('BANCO LÚMEN', 44, 74, '800 34px Inter, sans-serif', '#173f8a');
  t(`Cheque nº ${c.numero}`, 956, 70, '600 26px Inter, sans-serif', '#10131a', 'right');
  t('Pague-se por este cheque a quantia de', 44, 142, '400 25px Inter, sans-serif', '#3b4454');
  t(real(c.valor), 44, 206, '800 58px Inter, sans-serif');
  t(luT(c.qtd), 956, 200, '700 34px Inter, sans-serif', '#173f8a', 'right');
  t('Compensação por fora com Nicholas Steiner.', 44, 262, '400 25px Inter, sans-serif', '#3b4454');
  g.strokeStyle = '#10131a'; g.lineWidth = 2; g.beginPath(); g.moveTo(560, 356); g.lineTo(956, 356); g.stroke();
  t(nome(c.slot), 758, 346, 'italic 600 32px Georgia, serif', '#173f8a', 'center');
  t('Assinatura do emitente', 758, 386, '400 20px Inter, sans-serif', '#3b4454', 'center');
  t(new Date((c.em?.seconds || Date.now() / 1000) * 1000).toLocaleDateString('pt-BR'), 44, 346, '600 25px Inter, sans-serif');
  t('Dinheiro de mentirinha entre amigos. Sem valor legal.', 44, 392, '400 19px Inter, sans-serif', '#6b7484');
  return k;
}

function folhaCheque(c) {
  const f = abrir(`<h2>Cheque nº ${esc(c.numero)}</h2><div id="lugar"></div>
    <p class="nota">${c.status === 'emitido' ? 'Mande para o Nicholas. As moedas só saem quando ele compensar.' : STATUS[c.status] + '.'}</p>
    <div class="fim-folha" style="grid-template-columns:1fr 1fr"><button type="button" class="btn claro" data-fechar>Fechar</button><button type="button" class="btn" id="mandar">Compartilhar</button></div><button type="submit" hidden></button>`, async () => true);
  const k = desenharCheque(c);
  f.querySelector('#lugar').append(k);
  f.querySelector('#mandar').onclick = () => k.toBlob(async blob => {
    const arq = new File([blob], `cheque-${c.numero}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [arq] })) { try { await navigator.share({ files: [arq], title: `Cheque ${c.numero}` }); } catch {} return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = arq.name; a.click(); URL.revokeObjectURL(a.href);
  });
}

function folhaSacar() {
  const e = D.e, r = resumo(e, sessao.slot), v = valorMoeda(e);
  if (!r.sacaveis) return info('Sacar', `<p>Nenhuma moeda sua chegou às ${num(CARENCIA)} movimentações ainda. A mais rodada está em ${num(r.maior)}.</p>`);
  abrir(`<h2>Emitir cheque</h2>
    ${campoLu('qtd', `Quantas moedas (liberadas: ${num(r.sacaveis)})`, { max: r.sacaveis, tudo: true })}
    <div class="previa" id="previa"></div>
    <p class="nota">O app gera o cheque, você manda para o Nicholas e ele compensa por fora.</p>${rodape('Emitir cheque')}`, async d => {
    const qtd = inteiro(d.get('qtd')); let c;
    if (!await tentar(async () => { c = await store.emitirCheque(qtd, Math.floor(qtd * v)); })) return false;
    folhaCheque(c);
    return 'manter';
  }, f => { f.querySelector('#previa').textContent = `Valor do cheque: ${real(Math.floor((inteiro(f.qtd.value) || 0) * v))}.`; });
}

/* ---------- administrador ---------- */
function previa(p, tx) {
  try {
    const e = aplicar(D.e, { ...tx, quando: Date.now() });
    p.textContent = `Moeda passa a valer ${real4(valorMoeda(e))}. Inflação acumulada: ${pct(inflacao(e))}.`;
  } catch (err) { p.textContent = err.message; }
}

function formEmissao(destinos, botao, titulo, aoConfirmar) {
  let guardou = true;
  const f = abrir(`<h2>${esc(titulo)}</h2>
    ${campoLu('qtd', 'Quantas moedas', { valor: 2500 })}
    ${destinos ? `<label>Para quem<select name="para">${opcoesContas(destinos)}</select></label>` : ''}
    <div class="opcoes"><button type="button" class="btn on" id="sim">Com depósito</button><button type="button" class="btn" id="nao">Sem depósito</button></div>
    ${campoReal('dep', 'Quanto depositei', { id: 'campo', required: false })}
    <div class="previa" id="previa"></div>${rodape(botao)}`,
  async d => aoConfirmar(d, guardou ? centavos(d.get('dep')) || 0 : 0));
  const atualizar = () => previa(f.querySelector('#previa'), { tipo: 'emissao', para: f.para?.value || 's1', qtd: inteiro(f.qtd.value) || 0, deposito: guardou ? centavos(f.dep.value) || 0 : 0 });
  const sugerir = () => { f.dep.value = fmtReal(Math.round((inteiro(f.qtd.value) || 0) * valorMoeda(D.e))); };
  const marcar = v => { guardou = v; f.querySelector('#sim').classList.toggle('on', v); f.querySelector('#nao').classList.toggle('on', !v); f.querySelector('#campo').hidden = !v; atualizar(); };
  f.querySelector('#sim').onclick = () => marcar(true);
  f.querySelector('#nao').onclick = () => marcar(false);
  f.qtd.addEventListener('input', () => { if (guardou) sugerir(); atualizar(); });
  f.dep.addEventListener('input', atualizar);
  f.para?.addEventListener('input', atualizar);
  sugerir(); atualizar();
}

const folhaEmitir = () => formEmissao([...contas(D.e), 'cofre', 'economia'], 'Gerar', 'Gerar moedas', (d, deposito) =>
  tentar(() => store.executar({ tipo: 'emissao', para: d.get('para'), qtd: inteiro(d.get('qtd')), deposito }), 'Moedas geradas.'));

function folhaNovaConta() {
  const f = abrir(`<h2>Criar conta</h2><label>Nome<input name="n" maxlength="24" required></label>
    <div class="opcoes"><button type="submit" class="btn on">Sem dinheiro</button><button type="button" class="btn" id="dinheiro">Com moedas</button></div>
    <button type="button" class="btn claro cheio" data-fechar>Cancelar</button>`, async d => tentar(() => store.criarConta(d.get('n').trim()), 'Conta criada, sem saldo.'));
  f.querySelector('#dinheiro').onclick = () => {
    const n = f.n.value.trim();
    if (!n) return aviso('Coloque o nome primeiro.');
    formEmissao(null, 'Criar conta', `Moedas para ${n}`, (d, deposito) => tentar(async () => {
      const slot = await store.criarConta(n);
      await store.executar({ tipo: 'emissao', para: slot, qtd: inteiro(d.get('qtd')), deposito });
    }, `Conta de ${n} criada.`));
  };
}

function folhaCaixinha() {
  let sinal = 1;
  const atualizar = form => {
    const c = centavos(form.v.value), p = form.querySelector('#previa');
    if (!c) { p.textContent = ''; return; }
    previa(p, { tipo: 'caixinha', delta: sinal * c });
  };
  const f = abrir(`<h2>Caixinha</h2><p class="nota">Saldo: ${real(D.e.lastro)}. Só registra aqui, nenhum banco de verdade é tocado.</p>
    <div class="opcoes"><button type="button" class="btn on" id="dep">Depositei</button><button type="button" class="btn" id="ret">Retirei</button></div>
    ${campoReal('v', 'Valor')}
    <div class="previa" id="previa"></div>${rodape('Registrar')}`,
  async d => tentar(() => store.executar({ tipo: 'caixinha', delta: sinal * centavos(d.get('v')) }), 'Caixinha atualizada.'), atualizar);
  const marcar = s => { sinal = s; f.querySelector('#dep').classList.toggle('on', s > 0); f.querySelector('#ret').classList.toggle('on', s < 0); atualizar(f); };
  f.querySelector('#dep').onclick = () => marcar(1);
  f.querySelector('#ret').onclick = () => marcar(-1);
}

function folhaNome(slot) {
  abrir(`<h2>Nome da conta</h2><label>Nome<input name="n" maxlength="24" required value="${esc(nome(slot))}"></label>${rodape('Salvar')}`,
    async d => tentar(() => store.renomear(slot, d.get('n').trim()), 'Nome salvo.'));
}

function folhaPerfil() {
  info(nome(sessao.slot), `<p class="nota">${esc(sessao.email)}</p><div class="botoes" style="margin:0 0 12px"><button type="button" class="btn claro mini" data-acao="meu-nome">Mudar meu nome</button><button type="button" class="btn perigo mini" data-acao="sair">Sair</button></div>`);
}

function mostrarConvite(slot, token) {
  const link = `${location.origin}${location.pathname}?convite=${token}`;
  const texto = `Entra aí no Lúmen, o banco de mentirinha da galera: ${link}`;
  const f = abrir(`<h2>Convite de ${esc(nome(slot))}</h2>
    <label>Link único desta conta<input readonly value="${esc(link)}"></label>
    <div class="fim-folha" style="grid-template-columns:1fr 1fr;margin-bottom:10px">
      <button type="button" class="btn claro" id="copiar">Copiar</button>
      <a class="btn" style="text-align:center;text-decoration:none;line-height:24px" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(texto)}">WhatsApp</a>
    </div>${fechar}`, async () => true);
  f.querySelector('#copiar').onclick = async () => { await navigator.clipboard.writeText(link); aviso('Link copiado.'); };
}
async function folhaConvite(slot) {
  let token = D.convites.find(x => x.slot === slot)?.token;
  if (!token && !await tentar(async () => { token = await store.gerarConvite(slot); })) return;
  mostrarConvite(slot, token);
}
function folhaContaAmigo() {
  abrir(`<h2>Convidar alguém</h2><label>Nome da pessoa<input name="n" maxlength="24" required></label>
    <p class="nota">A conta começa zerada. Quem quiser ajudar manda moedas para ela.</p>${rodape('Criar convite')}`, async d => {
    let slot, token;
    const n = d.get('n').trim();
    if (!await tentar(async () => { slot = await store.criarConta(n); token = await store.gerarConvite(slot); })) return false;
    D.contas[slot] ||= { nome: n, uid: null };
    mostrarConvite(slot, token);
    return 'manter';
  });
}

function folhaConfirmar(titulo, texto, rotulo, fn) {
  abrir(`<h2>${esc(titulo)}</h2><p>${esc(texto)}</p>${rodape(rotulo)}`, fn);
}

/* ---------- cliques ---------- */
document.addEventListener('click', ev => {
  const alvo = ev.target.closest('[data-acao],[data-aba],[data-cartao],[data-moedas],[data-extrato],[data-filtro]');
  if (!alvo) return;
  const ds = alvo.dataset;
  if (ds.aba) { aba = ds.aba; desenhar(); scrollTo(0, 0); return; }
  if (ds.cartao) { cartaoAba = ds.cartao; desenhar(); return; }
  if (ds.moedas) { moedasAba = ds.moedas; desenhar(); return; }
  if (ds.extrato) { extratoAba = ds.extrato; desenhar(); return; }
  if (ds.filtro) { extratoFiltro = ds.filtro; desenhar(); return; }
  const { acao, slot, id, tipo } = ds, ch = D.cheques.find(x => x.id === id), cb = D.cobrancas.find(x => x.id === id);
  ({
    entrar: () => tentar(() => store.entrar()),
    sair: () => { if (folha.open) folha.close(); store.sair(); },
    olho: () => { oculto = !oculto; try { localStorage.setItem('lumen-oculto', oculto ? '1' : '0'); } catch {} desenhar(); },
    avisos: folhaAvisos, perfil: folhaPerfil, cobrar: folhaCobrar, enviar: folhaEnviar, sacar: folhaSacar,
    cartao: folhaCartao, poupanca: folhaPoupanca, cashback: folhaCashback, emitir: folhaEmitir, caixinha: folhaCaixinha,
    'nova-conta': folhaNovaConta, 'nova-conta-amigo': folhaContaAmigo,
    'meu-nome': () => folhaNome(sessao.slot), renomear: () => folhaNome(slot), convidar: () => folhaConvite(slot),
    'ver-cheque': () => folhaCheque(ch), 'mais-extrato': () => store.maisExtrato(),
    'pagar-cobranca': async () => { if (await tentar(() => store.pagarCobranca(cb, tipo), 'Cobrança paga.')) folhaAvisos(); },
    'recusar-cobranca': async () => { await tentar(() => store.fecharCobranca(cb, 'recusada'), 'Cobrança recusada.'); folhaAvisos(); },
    'cancelar-cobranca': async () => { await tentar(() => store.fecharCobranca(cb, 'cancelada'), 'Cobrança cancelada.'); folhaAvisos(); },
    desvincular: () => folhaConfirmar('Soltar conta', `${nome(slot)} perde o acesso, mas as moedas continuam na conta até um novo convite ser aceito.`, 'Soltar',
      () => tentar(() => store.desvincular(slot), 'Conta liberada.')),
    compensar: () => folhaConfirmar('Compensar cheque', `${nome(ch.slot)}: ${luT(ch.qtd)} saem de circulação e ${real(ch.valor)} saem da caixinha. Pague por fora.`, 'Compensar',
      () => tentar(() => store.compensar(ch), 'Cheque compensado.')),
    devolver: () => tentar(() => store.devolver(ch), 'Cheque devolvido.'),
    auditar: () => tentar(async () => {
      const r = await store.auditar();
      aviso(r.ok ? `Tudo certo: ${num(r.n)} transações conferidas moeda por moeda.` : `Problema: ${r.motivo}`);
    }),
  })[acao]?.();
});

store.iniciar(s => {
  sessao = s;
  if (aba === 'banco' && !s.admin) aba = 'inicio';
  desenhar();
}, desenhar);
