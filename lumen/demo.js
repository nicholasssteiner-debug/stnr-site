/* Lúmen — modo demo (só em localhost, ?demo&como=s3): tudo em memória, sem Firebase. */
import { genese, contas, proximaConta, aplicar, marcas, empacotar, auditar } from './core.js?v=3';

export function criar() {
  const como = new URLSearchParams(location.search).get('como') || 's1';
  const dados = { e: genese(), contas: {}, txs: [], meuExtrato: [], temMais: false, cheques: [], cobrancas: [], convites: [] };
  contas(dados.e).forEach((s, i) => { dados.contas[s] = { nome: i ? `Amigo ${i + 1}` : 'Nicholas', uid: i ? null : 'u1' }; });
  let avisar = () => {}, n = 0;
  const em = () => ({ seconds: Date.now() / 1000 });
  const executar = async tx => {
    const t0 = { ...tx, quando: Date.now() }, antes = dados.e, novo = aplicar(antes, t0);
    dados.e = novo;
    dados.txs.unshift({ ...t0, ...marcas(antes, novo, t0), seq: novo.seq, por: como, em: em(), ...(novo.cashback ? { cashback: novo.cashback } : {}) });
    avisar();
    return novo;
  };
  return {
    dados, executar,
    iniciar(sessao, aviso) { avisar = aviso; sessao({ fase: 'dentro', slot: como, admin: como === 's1', email: 'demo@local' }); },
    entrar() {}, sair() {}, maisExtrato() {},
    async criarConta(nome) {
      const slot = proximaConta(dados.e);
      await executar({ tipo: 'conta', slot });
      dados.contas[slot] = { nome, uid: null, criador: como };
      avisar();
      return slot;
    },
    async renomear(slot, nome) { dados.contas[slot].nome = nome; avisar(); },
    async gerarConvite(slot) { const token = 'demo' + ++n; dados.convites.push({ token, slot, por: como }); avisar(); return token; },
    async desvincular(slot) { dados.contas[slot].uid = null; dados.convites = dados.convites.filter(c => c.slot !== slot); avisar(); },
    async emitirCheque(qtd, valor) {
      const c = { id: 'c' + ++n, numero: String(100000 + n), slot: como, qtd, valor, status: 'emitido', em: em() };
      dados.cheques.unshift(c); avisar();
      return c;
    },
    async compensar(c) { await executar({ tipo: 'saque', de: c.slot, qtd: c.qtd, valor: c.valor }); c.status = 'compensado'; avisar(); },
    async devolver(c) { c.status = 'devolvido'; avisar(); },
    async cobrar(para, qtd, msg) { dados.cobrancas.unshift({ id: 'b' + ++n, de: como, para, qtd, msg, status: 'aberta', em: em() }); avisar(); },
    async pagarCobranca(c, tipo) { await executar({ tipo, de: como, para: c.de, qtd: c.qtd, ...(c.msg ? { msg: c.msg } : {}) }); c.status = 'paga'; avisar(); },
    async fecharCobranca(c, status) { c.status = status; avisar(); },
    async auditar() {
      const d = dados.e;
      return auditar({ seq: d.seq, lastro: d.lastro, saldos: d.saldos, cartoes: d.cartoes, aplic: d.aplic, moedas: empacotar(d) }, [...dados.txs].reverse());
    },
  };
}
