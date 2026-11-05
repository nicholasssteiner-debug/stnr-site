/* Caraminguás — regras da economia. Funções puras: o app, o modo demo e a auditoria usam as mesmas. */
export const MOEDAS_INICIAIS = 5000;
export const LASTRO_INICIAL = 7500;   // centavos: R$ 75,00
export const CARENCIA = 2500;         // movimentações que cada moeda precisa antes do saque
export const LIMITE_MOEDAS = 100000;  // o estado inteiro cabe em um documento do Firestore
export const SLOTS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];
const VALOR_INICIAL = LASTRO_INICIAL / MOEDAS_INICIAIS;
const idx = slot => SLOTS.indexOf(slot) + 1;

/* 5000 moedas divididas entre 7: duas contas ficam com 715 e cinco com 714. */
export function genese() {
  const dono = new Uint8Array(MOEDAS_INICIAIS), mov = new Uint16Array(MOEDAS_INICIAIS);
  const saldos = Object.fromEntries(SLOTS.map(s => [s, 0]));
  for (let i = 0; i < MOEDAS_INICIAIS; i++) { dono[i] = (i % 7) + 1; saldos[SLOTS[i % 7]]++; }
  return { seq: 0, lastro: LASTRO_INICIAL, dono, mov, saldos };
}

export const circulacao = e => Object.values(e.saldos).reduce((a, b) => a + b, 0);
export const valorMoeda = e => { const c = circulacao(e); return c ? e.lastro / c : 0; }; // centavos
export const inflacao = e => { const v = valorMoeda(e); return v ? (VALOR_INICIAL / v - 1) * 100 : Infinity; };

export function minhasMoedas(e, slot) {
  const k = idx(slot), lista = [];
  for (let i = 0; i < e.dono.length; i++) if (e.dono[i] === k) lista.push(i);
  return lista;
}

export function resumo(e, slot) {
  const lista = minhasMoedas(e, slot);
  let sacaveis = 0, maior = 0, soma = 0;
  for (const i of lista) { const m = e.mov[i]; if (m >= CARENCIA) sacaveis++; if (m > maior) maior = m; soma += m; }
  return { total: lista.length, sacaveis, maior, media: lista.length ? soma / lista.length : 0 };
}

const inteiroPositivo = n => Number.isInteger(n) && n > 0;

/* Aplica uma transação e devolve o novo estado. A moeda enviada é sempre a menos rodada de quem envia. */
export function aplicar(e0, tx) {
  const e = { ...e0, seq: e0.seq + 1, saldos: { ...e0.saldos } };
  if (tx.tipo === 'envio') {
    if (!inteiroPositivo(tx.qtd)) throw new Error('Quantidade inválida.');
    if (tx.de === tx.para || !SLOTS.includes(tx.para)) throw new Error('Destino inválido.');
    if (e.saldos[tx.de] < tx.qtd) throw new Error('Saldo insuficiente.');
    e.dono = e0.dono.slice(); e.mov = e0.mov.slice();
    const lista = minhasMoedas(e0, tx.de).sort((a, b) => e0.mov[a] - e0.mov[b] || a - b).slice(0, tx.qtd);
    for (const i of lista) { e.dono[i] = idx(tx.para); if (e.mov[i] < 65535) e.mov[i]++; }
    e.saldos[tx.de] -= tx.qtd; e.saldos[tx.para] += tx.qtd;
  } else if (tx.tipo === 'emissao') {
    if (!inteiroPositivo(tx.qtd)) throw new Error('Quantidade inválida.');
    if (!SLOTS.includes(tx.para)) throw new Error('Destino inválido.');
    if (!Number.isInteger(tx.deposito) || tx.deposito < 0) throw new Error('Depósito inválido.');
    const n = e0.dono.length + tx.qtd;
    if (n > LIMITE_MOEDAS) throw new Error(`O limite do sistema é ${LIMITE_MOEDAS} moedas.`);
    e.dono = new Uint8Array(n); e.dono.set(e0.dono); e.dono.fill(idx(tx.para), e0.dono.length);
    e.mov = new Uint16Array(n); e.mov.set(e0.mov);
    e.saldos[tx.para] += tx.qtd; e.lastro += tx.deposito;
  } else if (tx.tipo === 'caixinha') {
    if (!Number.isInteger(tx.delta) || tx.delta === 0) throw new Error('Valor inválido.');
    if (e.lastro + tx.delta < 0) throw new Error('A caixinha não tem tudo isso.');
    e.lastro += tx.delta;
  } else if (tx.tipo === 'saque') {
    if (!inteiroPositivo(tx.qtd)) throw new Error('Quantidade inválida.');
    const lista = minhasMoedas(e0, tx.de).filter(i => e0.mov[i] >= CARENCIA).sort((a, b) => e0.mov[b] - e0.mov[a] || a - b);
    if (lista.length < tx.qtd) throw new Error('Essa conta não tem tantas moedas liberadas.');
    const valor = Math.floor(tx.qtd * e0.lastro / circulacao(e0));
    e.dono = e0.dono.slice();
    for (const i of lista.slice(0, tx.qtd)) e.dono[i] = 0;
    e.saldos[tx.de] -= tx.qtd; e.lastro -= valor; e.valorSaque = valor;
  } else throw new Error('Transação desconhecida.');
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
  return { seq: d.seq, lastro: d.lastro, saldos: { ...d.saldos }, dono, mov };
}

/* Refaz toda a história desde a gênese e compara com o estado publicado. */
export function auditar(estadoDoc, txs) {
  let e = genese();
  for (const tx of txs) {
    if (tx.seq !== e.seq + 1) return { ok: false, motivo: `Falta a transação ${e.seq + 1}.` };
    try { e = aplicar(e, tx); } catch (err) { return { ok: false, motivo: `Transação ${tx.seq}: ${err.message}` }; }
  }
  const iguais = e.seq === estadoDoc.seq && e.lastro === estadoDoc.lastro && empacotar(e) === estadoDoc.moedas
    && SLOTS.every(s => e.saldos[s] === estadoDoc.saldos[s]);
  return iguais ? { ok: true, n: txs.length } : { ok: false, motivo: 'O estado publicado não bate com a história das transações.' };
}
