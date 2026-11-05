/* Caraminguás — modo demo (só em localhost, ?demo&como=s3): tudo em memória, sem Firebase. */
import { SLOTS, genese, aplicar, empacotar, auditar } from './core.js';

export function criar() {
  const como = new URLSearchParams(location.search).get('como') || 's1';
  const dados = { e: genese(), contas: {}, txs: [], saques: [], convites: [] };
  SLOTS.forEach((s, i) => { dados.contas[s] = { nome: i ? `Amigo ${i + 1}` : 'Nicholas', uid: i ? null : 'u1' }; });
  let avisar = () => {}, n = 0;
  const agora = () => ({ seconds: Date.now() / 1000 });
  const executar = async tx => {
    const novo = aplicar(dados.e, tx);
    dados.e = novo;
    dados.txs.unshift({ ...tx, seq: novo.seq, por: como, em: agora(), ...(tx.tipo === 'saque' ? { valor: novo.valorSaque } : {}) });
    avisar();
    return novo;
  };
  return {
    dados, executar,
    iniciar(sessao, aviso) { avisar = aviso; sessao({ fase: 'dentro', slot: como, admin: como === 's1', email: 'demo@local' }); },
    entrar() {}, sair() {},
    async pedirSaque(qtd) { dados.saques.unshift({ id: 'q' + ++n, slot: como, qtd, status: 'pendente', em: agora() }); avisar(); },
    async pagarSaque(s) { const novo = await executar({ tipo: 'saque', de: s.slot, qtd: s.qtd }); s.status = 'pago'; s.valor = novo.valorSaque; avisar(); },
    async recusarSaque(s) { s.status = 'recusado'; avisar(); },
    async renomear(slot, nome) { dados.contas[slot].nome = nome; avisar(); },
    async gerarConvite(slot) { const token = 'demo' + ++n; dados.convites.push({ token, slot }); avisar(); return token; },
    async desvincular(slot) { dados.contas[slot].uid = null; dados.convites = dados.convites.filter(c => c.slot !== slot); avisar(); },
    async auditar() {
      const d = dados.e;
      return auditar({ seq: d.seq, lastro: d.lastro, saldos: d.saldos, moedas: empacotar(d) }, [...dados.txs].reverse());
    },
  };
}
