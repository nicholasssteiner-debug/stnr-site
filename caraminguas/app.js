/* Caraminguás — interface. Os dados vêm de nuvem.js (Firebase) ou demo.js (localhost com ?demo). */
import { CARENCIA, SLOTS, circulacao, valorMoeda, inflacao, resumo, aplicar } from './core.js';

const params = new URLSearchParams(location.search);
const DEMO = params.has('demo') && ['localhost', '127.0.0.1'].includes(location.hostname);
const store = (await import(DEMO ? './demo.js' : './nuvem.js')).criar();
const D = store.dados;

const raiz = document.getElementById('app'), folha = document.getElementById('folha'), avisoEl = document.getElementById('aviso');
let sessao = null, aba = 'inicio';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => Math.round(n).toLocaleString('pt-BR');
const real = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const real4 = c => 'R$ ' + (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const pct = p => !isFinite(p) ? 'sem lastro' : (p > 0 ? '+' : '') + p.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const nome = s => D.contas[s]?.nome || s;
const centavos = t => Math.round(parseFloat(String(t).replace(/\./g, '').replace(',', '.')) * 100);
const inicial = s => esc((nome(s).trim()[0] || '?').toUpperCase());

function aviso(msg) {
  avisoEl.textContent = msg; avisoEl.classList.add('on');
  clearTimeout(aviso.t); aviso.t = setTimeout(() => avisoEl.classList.remove('on'), 3200);
}
async function tentar(fn, ok) {
  try { await fn(); if (ok) aviso(ok); return true; }
  catch (err) { console.error('[caraminguas]', err); aviso(err.code === 'permission-denied' ? 'O banco recusou essa operação.' : err.message); return false; }
}

/* ---------- telas fora da carteira ---------- */
function capa(titulo, texto, botao) {
  raiz.innerHTML = `<section class="capa"><div class="selo">C</div><h1>${titulo}</h1><p>${texto}</p>${botao || ''}</section>`;
}
function telaFora() {
  const convidado = params.has('convite');
  capa('Caraminguás', convidado
    ? 'Você foi convidado para a carteira da galera. Entre com sua conta Google para pegar suas moedas.'
    : 'A carteira de mentirinha da galera. Nada aqui é dinheiro de verdade.',
    '<button class="btn google" data-acao="entrar">Entrar com Google</button>');
}

/* ---------- abas ---------- */
function vInicio() {
  const e = D.e, r = resumo(e, sessao.slot), v = valorMoeda(e), inf = inflacao(e);
  const falta = Math.max(0, CARENCIA - r.maior);
  return `
  <section class="cedula">
    <small>Olá, ${esc(nome(sessao.slot))}. Seu saldo:</small>
    <div class="saldo">${num(r.total)}</div>
    <small>caraminguás · valem ${real(r.total * v)} hoje</small>
    <div class="acoes">
      <button class="btn ouro" data-acao="enviar" ${r.total ? '' : 'disabled'}>Enviar</button>
      <button class="btn claro" data-acao="sacar">Sacar</button>
    </div>
  </section>
  <section class="bloco">
    <h2>Rumo ao saque</h2>
    <p>${r.sacaveis ? `<b>${num(r.sacaveis)}</b> moedas já liberadas.` : r.total ? `Sua moeda mais rodada precisa de mais <b>${num(falta)}</b> movimentações.` : 'Você está sem moedas.'}</p>
    <div class="barra"><i style="width:${Math.min(100, r.maior / CARENCIA * 100)}%"></i></div>
    <p class="nota">Mais rodada: ${num(r.maior)} de ${num(CARENCIA)} · média das suas: ${num(r.media)}</p>
  </section>
  <section class="bloco">
    <h2>Cotação</h2>
    <div class="grade">
      <div><span>Valor da moeda</span><b>${real4(v)}</b></div>
      <div><span>Inflação acumulada</span><b class="${inf > 0.05 ? 'alta' : inf < -0.05 ? 'baixa' : ''}">${pct(inf)}</b></div>
      <div><span>Em circulação</span><b>${num(circulacao(e))}</b></div>
      <div><span>Caixinha</span><b>${real(e.lastro)}</b></div>
    </div>
  </section>`;
}

function vMoedas() {
  const e = D.e;
  let rodadas = 0, liberadas = 0;
  for (let i = 0; i < e.dono.length; i++) if (e.dono[i]) { if (e.mov[i] >= CARENCIA) liberadas++; else if (e.mov[i]) rodadas++; }
  return `<section class="bloco">
    <h2>Mapa das moedas</h2>
    <p class="nota">Cada ponto é uma moeda. Quanto mais forte, mais perto das ${num(CARENCIA)} movimentações.</p>
    <canvas id="mapa"></canvas>
    <div class="legenda">
      <span><i style="background:#1f6b4f"></i>Suas</span><span><i style="background:#8d8a7c"></i>Da galera</span>
      <span><i style="background:#c8962e"></i>Liberada</span><span><i style="background:#efe9d9;box-shadow:inset 0 0 0 1px #dcd4c0"></i>Sacada</span>
    </div>
  </section>
  <section class="bloco"><div class="grade">
    <div><span>Já rodaram</span><b>${num(rodadas)}</b></div>
    <div><span>Liberadas para saque</span><b>${num(liberadas)}</b></div>
  </div></section>`;
}

function desenharMapa() {
  const c = document.getElementById('mapa'); if (!c) return;
  const e = D.e, n = e.dono.length, cols = 100, linhas = Math.ceil(n / cols), meu = SLOTS.indexOf(sessao.slot) + 1;
  c.width = cols; c.height = linhas;
  const g = c.getContext('2d'), img = g.createImageData(cols, linhas);
  const mistura = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
  for (let i = 0; i < n; i++) {
    let cor;
    if (!e.dono[i]) cor = [239, 233, 217];
    else if (e.mov[i] >= CARENCIA) cor = [200, 150, 46];
    else {
      const t = 0.3 + 0.7 * e.mov[i] / CARENCIA;
      cor = mistura([239, 233, 217], e.dono[i] === meu ? [31, 107, 79] : [110, 108, 96], t);
    }
    img.data.set([...cor, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
}

function vGalera() {
  const e = D.e, v = valorMoeda(e);
  const ordem = [...SLOTS].sort((a, b) => e.saldos[b] - e.saldos[a]);
  return `<section class="bloco"><h2>A galera</h2>${ordem.map(s => {
    const c = D.contas[s] || {};
    return `<div class="linha"><div class="avatar ${c.uid ? '' : 'vazio'}">${inicial(s)}</div>
      <div class="meio"><b>${esc(nome(s))}${s === sessao.slot ? ' (você)' : ''}</b><span>${c.uid ? 'Na carteira' : 'Convite pendente'}</span></div>
      <div class="fim">${num(e.saldos[s])}<small>${real(e.saldos[s] * v)}</small></div></div>`;
  }).join('')}</section>
  <section class="bloco"><div class="botoes" style="margin:0"><button class="btn claro mini" data-acao="meu-nome">Mudar meu nome</button></div></section>`;
}

function descreverTx(t) {
  if (t.tipo === 'envio') return { titulo: `${nome(t.de)} → ${nome(t.para)}`, sub: t.msg || '', fim: num(t.qtd) };
  if (t.tipo === 'emissao') return {
    titulo: `Banco emitiu moedas para ${nome(t.para)}`,
    sub: t.deposito ? `${real(t.deposito)} guardados na caixinha` : 'Sem depósito: inflação na veia',
    fim: '+' + num(t.qtd),
  };
  if (t.tipo === 'caixinha') return { titulo: t.delta > 0 ? 'Depósito na caixinha' : 'Retirada da caixinha', sub: '', fim: real(Math.abs(t.delta)) };
  return { titulo: `${nome(t.de)} sacou`, sub: real(t.valor || 0), fim: '−' + num(t.qtd) };
}

function vExtrato() {
  const meus = D.saques.filter(s => s.slot === sessao.slot);
  return `${meus.length ? `<section class="bloco"><h2>Seus saques</h2>${meus.map(s => `<div class="linha"><div class="meio"><b>${num(s.qtd)} moedas</b>
    <span>${{ pendente: 'Aguardando o banco', pago: 'Pago: ' + real(s.valor || 0), recusado: 'Recusado' }[s.status]}</span></div></div>`).join('')}</section>` : ''}
  <section class="bloco"><h2>Extrato da galera</h2>${D.txs.length ? D.txs.map(t => {
    const d = descreverTx(t), quando = t.em ? new Date(t.em.seconds * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'agora';
    return `<div class="linha"><div class="meio"><b>${esc(d.titulo)}</b><span>${esc(d.sub ? d.sub + ' · ' + quando : quando)}</span></div><div class="fim">${esc(d.fim)}</div></div>`;
  }).join('') : '<p class="nota">Nada ainda. Alguém tem que começar a zoeira.</p>'}</section>`;
}

function vBanco() {
  const e = D.e, pend = D.saques.filter(s => s.status === 'pendente');
  return `<section class="bloco"><h2>Banco Central</h2>
    <div class="grade" style="margin-bottom:12px">
      <div><span>Caixinha</span><b>${real(e.lastro)}</b></div>
      <div><span>Em circulação</span><b>${num(circulacao(e))}</b></div>
    </div>
    <div class="botoes">
      <button class="btn mini" data-acao="emitir">Gerar moedas</button>
      <button class="btn claro mini" data-acao="caixinha">Mexer na caixinha</button>
      <button class="btn claro mini" data-acao="auditar">Auditar</button>
    </div></section>
  ${pend.length ? `<section class="bloco"><h2>Saques pedidos</h2>${pend.map(s => `<div class="linha"><div class="meio"><b>${esc(nome(s.slot))}</b><span>${num(s.qtd)} moedas · ${real(Math.floor(s.qtd * valorMoeda(e)))}</span></div>
    <button class="btn mini" data-acao="pagar" data-id="${esc(s.id)}">Pagar</button><button class="btn claro mini" data-acao="recusar" data-id="${esc(s.id)}">Recusar</button></div>`).join('')}</section>` : ''}
  <section class="bloco"><h2>Contas e convites</h2>${SLOTS.map(s => {
    const c = D.contas[s] || {}, tem = D.convites.find(x => x.slot === s);
    return `<div class="linha"><div class="avatar ${c.uid ? '' : 'vazio'}">${inicial(s)}</div>
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
  if (sessao.fase === 'sem-convite') return capa('Sem convite', `A conta ${esc(sessao.email)} ainda não está na carteira. Peça o link de convite ao administrador.`, '<button class="link" data-acao="sair">Usar outra conta</button>');
  if (sessao.fase === 'erro') return capa('Deu ruim', esc(sessao.msg), '<button class="link" data-acao="sair">Sair</button>');
  if (!D.e) return capa('Caraminguás', 'Abrindo o cofre...');
  const abas = Object.entries(ABAS).filter(([k]) => k !== 'banco' || sessao.admin);
  raiz.innerHTML = `<header class="topo"><b>Caraminguás</b><button class="link" data-acao="sair">Sair</button></header>
    ${ABAS[aba][1]()}
    <nav><div>${abas.map(([k, [r]]) => `<button class="${k === aba ? 'on' : ''}" data-aba="${k}">${r}</button>`).join('')}</div></nav>`;
  desenharMapa();
}

/* ---------- folhas (formulários) ---------- */
function abrir(html, aoEnviar, aoMudar) {
  folha.innerHTML = `<form method="dialog">${html}</form>`;
  const f = folha.firstElementChild;
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const b = f.querySelector('[type=submit]'); b.disabled = true;
    if (await aoEnviar(new FormData(f), f)) folha.close(); else b.disabled = false;
  });
  f.querySelector('[data-fechar]')?.addEventListener('click', () => folha.close());
  if (aoMudar) { f.addEventListener('input', () => aoMudar(f)); aoMudar(f); }
  folha.showModal();
  return f;
}
const rodape = rotulo => `<div class="fim-folha"><button type="button" class="btn claro" data-fechar>Cancelar</button><button type="submit" class="btn">${rotulo}</button></div>`;

function folhaEnviar() {
  const max = D.e.saldos[sessao.slot], outros = SLOTS.filter(s => s !== sessao.slot);
  const f = abrir(`<h2>Enviar moedas</h2>
    <label>Para quem<select name="para">${outros.map(s => `<option value="${s}">${esc(nome(s))}</option>`).join('')}</select></label>
    <div class="par"><label>Quantas (você tem ${num(max)})<input name="qtd" type="number" inputmode="numeric" min="1" max="${max}" required></label><button type="button" class="btn claro" id="tudo">Tudo</button></div>
    <label>Recado (opcional)<input name="msg" maxlength="80" placeholder="pelo churrasco de ontem"></label>
    <p class="nota">Cada moeda enviada ganha 1 movimentação. Saem primeiro as suas menos rodadas.</p>
    ${rodape('Enviar')}`, async d => {
    const qtd = parseInt(d.get('qtd'), 10), msg = d.get('msg').trim();
    const tx = { tipo: 'envio', de: sessao.slot, para: d.get('para'), qtd };
    if (msg) tx.msg = msg;
    return tentar(() => store.executar(tx), `${num(qtd)} moedas enviadas para ${nome(tx.para)}.`);
  });
  f.querySelector('#tudo').onclick = () => { f.qtd.value = max; };
}

function folhaSacar() {
  const r = resumo(D.e, sessao.slot), v = valorMoeda(D.e);
  if (!r.sacaveis) return abrir(`<h2>Sacar</h2><p>Nenhuma moeda sua chegou às ${num(CARENCIA)} movimentações ainda. A mais rodada está em ${num(r.maior)}.</p>
    <button type="button" class="btn claro" data-fechar style="width:100%">Entendi</button><button type="submit" hidden></button>`, async () => true);
  abrir(`<h2>Pedir saque</h2>
    <label>Quantas moedas (liberadas: ${num(r.sacaveis)})<input name="qtd" type="number" inputmode="numeric" min="1" max="${r.sacaveis}" required></label>
    <div class="previa" id="previa"></div>
    <p class="nota">O administrador confirma o pedido. As moedas sacadas saem de circulação e o valor sai da caixinha.</p>
    ${rodape('Pedir saque')}`, async d => tentar(() => store.pedirSaque(parseInt(d.get('qtd'), 10)), 'Pedido enviado ao banco.'),
  f => { f.querySelector('#previa').textContent = `Hoje isso vale ${real(Math.floor((parseInt(f.qtd.value, 10) || 0) * v))}.`; });
}

function folhaEmitir() {
  let guardou = true;
  const f = abrir(`<h2>Gerar moedas</h2>
    <label>Quantas<input name="qtd" type="number" inputmode="numeric" min="1" value="5000" required></label>
    <label>Para quem<select name="para">${SLOTS.map(s => `<option value="${s}">${esc(nome(s))}</option>`).join('')}</select></label>
    <div class="opcoes"><button type="button" class="btn on" id="sim">Guardei na caixinha</button><button type="button" class="btn" id="nao">Não guardei</button></div>
    <label id="campo">Quanto guardei (R$)<input name="dep" inputmode="decimal"></label>
    <div class="previa" id="previa"></div>${rodape('Gerar')}`, async d => {
    const deposito = guardou ? centavos(d.get('dep')) : 0;
    return tentar(() => store.executar({ tipo: 'emissao', para: d.get('para'), qtd: parseInt(d.get('qtd'), 10), deposito }), 'Moedas geradas.');
  }, atualizar);
  function atualizar(form) {
    const q = parseInt(form.qtd.value, 10) || 0, dep = guardou ? centavos(form.dep.value) || 0 : 0;
    const p = form.querySelector('#previa');
    if (!q) { p.textContent = ''; return; }
    try {
      const e = aplicar(D.e, { tipo: 'emissao', para: form.para.value, qtd: q, deposito: dep });
      p.textContent = `Moeda passa a valer ${real4(valorMoeda(e))}. Inflação acumulada: ${pct(inflacao(e))}.`;
    } catch (err) { p.textContent = err.message; }
  }
  const sugerir = () => { f.dep.value = (parseInt(f.qtd.value, 10) * valorMoeda(D.e) / 100 || 0).toFixed(2).replace('.', ','); };
  const marcar = v => {
    guardou = v;
    f.querySelector('#sim').classList.toggle('on', v); f.querySelector('#nao').classList.toggle('on', !v);
    f.querySelector('#campo').hidden = !v; atualizar(f);
  };
  f.querySelector('#sim').onclick = () => marcar(true);
  f.querySelector('#nao').onclick = () => marcar(false);
  f.qtd.addEventListener('input', () => { if (guardou) sugerir(); atualizar(f); });
  sugerir(); atualizar(f);
}

function folhaCaixinha() {
  let sinal = 1;
  const f = abrir(`<h2>Mexer na caixinha</h2><p class="nota">Saldo: ${real(D.e.lastro)}. Só registra aqui: nenhum banco é tocado.</p>
    <div class="opcoes"><button type="button" class="btn on" id="dep">Depositei</button><button type="button" class="btn" id="ret">Retirei</button></div>
    <label>Valor (R$)<input name="v" inputmode="decimal" required></label>
    <div class="previa" id="previa"></div>${rodape('Registrar')}`,
  async d => tentar(() => store.executar({ tipo: 'caixinha', delta: sinal * centavos(d.get('v')) }), 'Caixinha atualizada.'), atualizar);
  function atualizar(form) {
    const c = centavos(form.v.value), p = form.querySelector('#previa');
    if (!c) { p.textContent = ''; return; }
    try {
      const e = aplicar(D.e, { tipo: 'caixinha', delta: sinal * c });
      p.textContent = `Moeda passa a valer ${real4(valorMoeda(e))}. Inflação acumulada: ${pct(inflacao(e))}.`;
    } catch (err) { p.textContent = err.message; }
  }
  const marcar = s => { sinal = s; f.querySelector('#dep').classList.toggle('on', s > 0); f.querySelector('#ret').classList.toggle('on', s < 0); atualizar(f); };
  f.querySelector('#dep').onclick = () => marcar(1);
  f.querySelector('#ret').onclick = () => marcar(-1);
}

function folhaNome(slot) {
  abrir(`<h2>Nome da conta</h2><label>Nome<input name="n" maxlength="24" required value="${esc(nome(slot))}"></label>${rodape('Salvar')}`,
    async d => tentar(() => store.renomear(slot, d.get('n').trim()), 'Nome salvo.'));
}

async function folhaConvite(slot) {
  let c = D.convites.find(x => x.slot === slot), token = c?.token;
  if (!token && !await tentar(async () => { token = await store.gerarConvite(slot); })) return;
  const link = `${location.origin}${location.pathname}?convite=${token}`;
  const texto = `Entra aí na Caraminguás, a carteira de mentirinha da galera. Suas moedas estão te esperando: ${link}`;
  const f = abrir(`<h2>Convite de ${esc(nome(slot))}</h2>
    <label>Link único desta conta<input readonly value="${esc(link)}"></label>
    <div class="fim-folha" style="grid-template-columns:1fr 1fr">
      <button type="button" class="btn claro" id="copiar">Copiar</button>
      <a class="btn ouro" style="text-align:center;text-decoration:none;line-height:22px" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(texto)}">WhatsApp</a>
    </div><div style="margin-top:10px"><button type="button" class="btn claro" data-fechar style="width:100%">Fechar</button></div><button type="submit" hidden></button>`, async () => true);
  f.querySelector('#copiar').onclick = async () => { await navigator.clipboard.writeText(link); aviso('Link copiado.'); };
}

function folhaConfirmar(titulo, texto, rotulo, fn) {
  abrir(`<h2>${esc(titulo)}</h2><p>${esc(texto)}</p>${rodape(esc(rotulo))}`, fn);
}

/* ---------- cliques ---------- */
document.addEventListener('click', async ev => {
  const alvo = ev.target.closest('[data-acao],[data-aba]');
  if (!alvo) return;
  if (alvo.dataset.aba) { aba = alvo.dataset.aba; desenhar(); scrollTo(0, 0); return; }
  const { acao, slot, id } = alvo.dataset, s = D.saques.find(x => x.id === id);
  ({
    entrar: () => tentar(() => store.entrar()),
    sair: () => store.sair(),
    enviar: folhaEnviar, sacar: folhaSacar, emitir: folhaEmitir, caixinha: folhaCaixinha,
    'meu-nome': () => folhaNome(sessao.slot),
    renomear: () => folhaNome(slot),
    convidar: () => folhaConvite(slot),
    desvincular: () => folhaConfirmar('Soltar conta', `${nome(slot)} perde o acesso, mas as moedas continuam na conta até um novo convite ser aceito.`, 'Soltar',
      () => tentar(() => store.desvincular(slot), 'Conta liberada.')),
    pagar: () => folhaConfirmar('Pagar saque', `${nome(s.slot)} saca ${num(s.qtd)} moedas. Elas saem de circulação e ${real(Math.floor(s.qtd * valorMoeda(D.e)))} saem da caixinha. O pagamento em si é com você, fora do app.`, 'Confirmar',
      () => tentar(() => store.pagarSaque(s), 'Saque registrado.')),
    recusar: () => tentar(() => store.recusarSaque(s), 'Saque recusado.'),
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
