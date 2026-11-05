/* Lúmen — regras da economia. Funções puras: o app, o modo demo e a auditoria usam as mesmas. */
export const CONTAS_INICIAIS = 7;
export const SALDO_INICIAL = 2500;
export const LASTRO_INICIAL = 7500;    // centavos: R$ 75,00
export const CARENCIA = 2500;          // movimentações que cada moeda precisa antes do saque
export const TETO_CARTAO = 715;        // limite máximo do cartão
export const PASSO_CARTAO = 143;       // limite inicial e quanto o algoritmo libera por fatura paga
export const JUROS_PCT = 2;            // sobre a fatura no débito automático
export const CASHBACK_PCT = 1;         // sobre as compras no cartão
export const RENDIMENTO_PCT = 1;       // por ciclo, sobre a poupança
export const CICLO = 7 * 86400000;     // ciclo da fatura e da poupança
export const LIMITE_MOEDAS = 100000;   // o estado inteiro cabe em um documento do Firestore
export const MAX_CONTAS = 60;

const COFRE = 'cofre', ECONOMIA = 'economia', POUPANCA = 'poup';
const BYTE = { [COFRE]: 253, [ECONOMIA]: 254, [POUPANCA]: 255 };
const byte = s => BYTE[s] ?? parseInt(s.slice(1), 10);
export const ehConta = s => /^s\d+$/.test(s);
export const contas = e => Object.keys(e.saldos).filter(ehConta).sort((a, b) => byte(a) - byte(b));
export const proximaConta = e => 's' + (Math.max(...contas(e).map(byte)) + 1);
const novoCartao = () => ({ lib: PASSO_CARTAO, princ: 0, juros: 0, venc: 0, atraso: false });
const novaAplicacao = () => ({ n: 0, prox: 0 });

/* 2500 para cada conta, mais o cofre que empresta para os cartões (715 por conta). */
export function genese() {
  const nas = CONTAS_INICIAIS * SALDO_INICIAL, cofre = CONTAS_INICIAIS * TETO_CARTAO, n = nas + cofre;
  const dono = new Uint8Array(n), mov = new Uint16Array(n), saldos = {}, cartoes = {}, aplic = {};
  for (let k = 1; k <= CONTAS_INICIAIS; k++) { saldos['s' + k] = SALDO_INICIAL; cartoes['s' + k] = novoCartao(); aplic['s' + k] = novaAplicacao(); }
  for (let i = 0; i < nas; i++) dono[i] = (i % CONTAS_INICIAIS) + 1;
  dono.fill(BYTE[COFRE], nas);
  Object.assign(saldos, { [COFRE]: cofre, [ECONOMIA]: 0, [POUPANCA]: 0 });
  return { seq: 0, lastro: LASTRO_INICIAL, saldos, cartoes, aplic, dono, mov };
}
const VALOR_INICIAL = LASTRO_INICIAL / (CONTAS_INICIAIS * (SALDO_INICIAL + TETO_CARTAO));

export const emitidas = e => Object.values(e.saldos).reduce((a, b) => a + b, 0);
export const valorMoeda = e => { const c = emitidas(e); return c ? e.lastro / c : 0; }; // centavos
export const inflacao = e => { const v = valorMoeda(e); return v ? (VALOR_INICIAL / v - 1) * 100 : Infinity; };
export const economiaAberta = e => e.saldos[ECONOMIA] > 0;
export const disponivelCartao = (e, s) => { const c = e.cartoes[s]; return c.atraso ? 0 : Math.max(0, c.lib - c.princ); };

export function moedasDe(e, slot) {
  const k = byte(slot), lista = [];
  for (let i = 0; i < e.dono.length; i++) if (e.dono[i] === k) lista.push(i);
  return lista;
}

export function resumo(e, slot) {
  const lista = moedasDe(e, slot);
  let sacaveis = 0, maior = 0, soma = 0;
  for (const i of lista) { const m = e.mov[i]; if (m >= CARENCIA) sacaveis++; if (m > maior) maior = m; soma += m; }
  return { total: lista.length, sacaveis, maior, media: lista.length ? soma / lista.length : 0 };
}

/* Passa moedas adiante, sempre as menos rodadas. Só conta movimentação entre pessoas e compras. */
function mover(e, de, para, qtd, contar) {
  if (!qtd) return;
  if (e.saldos[de] < qtd) throw new Error('Saldo insuficiente.');
  const lista = moedasDe(e, de).sort((a, b) => e.mov[a] - e.mov[b] || a - b).slice(0, qtd), k = byte(para);
  for (const i of lista) { e.dono[i] = k; if (contar && e.mov[i] < 65535) e.mov[i]++; }
  e.saldos[de] -= qtd; e.saldos[para] += qtd;
}

function pagarFatura(e, de, qtd) {
  const c = e.cartoes[de], j = Math.min(qtd, c.juros), p = qtd - j;
  mover(e, de, ECONOMIA, j, false); c.juros -= j;
  mover(e, de, COFRE, p, false); c.princ -= p;
}
const subirLimite = c => { c.lib = Math.min(TETO_CARTAO, c.lib + PASSO_CARTAO); };
const baixarLimite = c => { c.lib = Math.max(PASSO_CARTAO, c.lib - PASSO_CARTAO); };
const positivo = n => { if (!Number.isInteger(n) || n <= 0) throw new Error('Quantidade inválida.'); };
const pessoaOuFalha = (e, s) => { if (!ehConta(s) || !(s in e.saldos)) throw new Error('Destino inválido.'); };

/* Aplica uma transação e devolve o novo estado, sem tocar no anterior. */
export function aplicar(e0, tx) {
  const e = {
    ...e0, seq: e0.seq + 1, saldos: { ...e0.saldos }, dono: e0.dono.slice(), mov: e0.mov.slice(),
    cartoes: Object.fromEntries(Object.entries(e0.cartoes).map(([k, v]) => [k, { ...v }])),
    aplic: Object.fromEntries(Object.entries(e0.aplic).map(([k, v]) => [k, { ...v }])),
  };
  delete e.cashback;
  const c = e.cartoes[tx.de], a = e.aplic[tx.de];
  switch (tx.tipo) {
    case 'envio':
      positivo(tx.qtd); pessoaOuFalha(e, tx.para);
      if (tx.de === tx.para) throw new Error('Destino inválido.');
      mover(e, tx.de, tx.para, tx.qtd, true);
      break;
    case 'compra': {
      positivo(tx.qtd); pessoaOuFalha(e, tx.para);
      if (tx.de === tx.para) throw new Error('Destino inválido.');
      if (c.atraso) throw new Error('Cartão bloqueado até quitar a fatura atrasada.');
      if (c.princ + tx.qtd > c.lib) throw new Error('Passou do limite liberado do cartão.');
      if (e.saldos[COFRE] < tx.qtd) throw new Error('O cofre do banco está sem moedas para o cartão.');
      mover(e, COFRE, tx.para, tx.qtd, true);
      c.princ += tx.qtd;
      if (!c.venc) c.venc = tx.quando + CICLO;
      const volta = Math.min(Math.floor(tx.qtd * CASHBACK_PCT / 100), e.saldos[ECONOMIA]);
      mover(e, ECONOMIA, tx.de, volta, false);
      e.cashback = volta;
      break;
    }
    case 'fatura': {
      positivo(tx.qtd);
      if (tx.qtd > c.princ + c.juros) throw new Error('Isso é mais do que a fatura.');
      const emDia = tx.quando <= c.venc;
      pagarFatura(e, tx.de, tx.qtd);
      if (!c.princ && !c.juros) { if (emDia) subirLimite(c); c.venc = 0; c.atraso = false; }
      break;
    }
    case 'debito': {
      if (!c.venc || tx.quando < c.venc) throw new Error('A fatura ainda não venceu.');
      c.juros += Math.ceil((c.princ + c.juros) * JUROS_PCT / 100);
      pagarFatura(e, tx.de, Math.min(e.saldos[tx.de], c.princ + c.juros));
      if (!c.princ && !c.juros) { if (!c.atraso) subirLimite(c); c.venc = 0; c.atraso = false; } else { baixarLimite(c); c.venc = tx.quando + CICLO; c.atraso = true; }
      break;
    }
    case 'guardar':
      positivo(tx.qtd);
      if (!economiaAberta(e)) throw new Error('A poupança abre quando a Economia tiver moedas.');
      mover(e, tx.de, POUPANCA, tx.qtd, false);
      a.n += tx.qtd;
      if (!a.prox) a.prox = tx.quando + CICLO;
      break;
    case 'resgatar':
      positivo(tx.qtd);
      if (tx.qtd > a.n) throw new Error('Você não tem tudo isso guardado.');
      mover(e, POUPANCA, tx.de, tx.qtd, false);
      a.n -= tx.qtd;
      if (!a.n) a.prox = 0;
      break;
    case 'rendimento': {
      if (!a.prox || tx.quando < a.prox) throw new Error('Ainda não rendeu.');
      const y = Math.min(Math.floor(a.n * RENDIMENTO_PCT / 100), e.saldos[ECONOMIA]);
      mover(e, ECONOMIA, POUPANCA, y, false);
      a.n += y; a.prox = tx.quando + CICLO;
      break;
    }
    case 'conta':
      if (tx.slot !== proximaConta(e0)) throw new Error('Conta inválida.');
      if (contas(e0).length >= MAX_CONTAS) throw new Error(`O limite é de ${MAX_CONTAS} contas.`);
      e.saldos[tx.slot] = 0; e.cartoes[tx.slot] = novoCartao(); e.aplic[tx.slot] = novaAplicacao();
      break;
    case 'emissao': {
      positivo(tx.qtd);
      if (tx.para !== COFRE && tx.para !== ECONOMIA) pessoaOuFalha(e, tx.para);
      if (!Number.isInteger(tx.deposito) || tx.deposito < 0) throw new Error('Depósito inválido.');
      const n = e0.dono.length + tx.qtd;
      if (n > LIMITE_MOEDAS) throw new Error(`O limite do sistema é ${LIMITE_MOEDAS} moedas.`);
      e.dono = new Uint8Array(n); e.dono.set(e0.dono); e.dono.fill(byte(tx.para), e0.dono.length);
      e.mov = new Uint16Array(n); e.mov.set(e0.mov);
      e.saldos[tx.para] += tx.qtd; e.lastro += tx.deposito;
      break;
    }
    case 'caixinha':
      if (!Number.isInteger(tx.delta) || tx.delta === 0) throw new Error('Valor inválido.');
      if (e.lastro + tx.delta < 0) throw new Error('A caixinha não tem tudo isso.');
      e.lastro += tx.delta;
      break;
    case 'saque': {
      positivo(tx.qtd);
      if (!Number.isInteger(tx.valor) || tx.valor < 0 || tx.valor > e.lastro) throw new Error('A caixinha não cobre esse cheque.');
      const lista = moedasDe(e0, tx.de).filter(i => e0.mov[i] >= CARENCIA).sort((x, y) => e0.mov[y] - e0.mov[x] || x - y);
      if (lista.length < tx.qtd) throw new Error('Cheque sem fundos: faltam moedas liberadas.');
      for (const i of lista.slice(0, tx.qtd)) e.dono[i] = 0;
      e.saldos[tx.de] -= tx.qtd; e.lastro -= tx.valor;
      break;
    }
    default: throw new Error('Transação desconhecida.');
  }
  return e;
}

/* Cada moeda ocupa 3 bytes: dono + movimentações. */
export function empacotar(e) {
  const n = e.dono.length, b = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) { b[i * 3] = e.dono[i]; b[i * 3 + 1] = e.mov[i] & 255; b[i * 3 + 2] = e.mov[i] >> 8; }
  let s = '';
  for (let i = 0; i < b.length; i += 8190) s += String.fromCharCode(...b.subarray(i, i + 8190));
  return btoa(s);
}

export function desempacotar(d) {
  const s = atob(d.moedas), n = s.length / 3, dono = new Uint8Array(n), mov = new Uint16Array(n);
  for (let i = 0; i < n; i++) { dono[i] = s.charCodeAt(i * 3); mov[i] = s.charCodeAt(i * 3 + 1) | (s.charCodeAt(i * 3 + 2) << 8); }
  return { seq: d.seq, lastro: d.lastro, saldos: d.saldos, cartoes: d.cartoes, aplic: d.aplic, dono, mov };
}

const ordena = v => (v && typeof v === 'object') ? Object.keys(v).sort().map(k => [k, ordena(v[k])]) : v;
const canon = m => JSON.stringify(ordena(m));

/* Refaz toda a história desde a gênese e compara com o estado publicado. */
export function auditar(doc, txs) {
  let e = genese();
  for (const tx of txs) {
    if (tx.seq !== e.seq + 1) return { ok: false, motivo: `Falta a transação ${e.seq + 1}.` };
    try { e = aplicar(e, tx); } catch (err) { return { ok: false, motivo: `Transação ${tx.seq}: ${err.message}` }; }
  }
  const iguais = e.seq === doc.seq && e.lastro === doc.lastro && empacotar(e) === doc.moedas
    && canon(e.saldos) === canon(doc.saldos) && canon(e.cartoes) === canon(doc.cartoes) && canon(e.aplic) === canon(doc.aplic);
  return iguais ? { ok: true, n: txs.length } : { ok: false, motivo: 'O estado publicado não bate com a história das transações.' };
}
