// Encerramento do exercício: gera o lote que zera as contas de resultado
// (receitas e despesas) e transfere o resultado líquido para Lucros Acumulados
// (lucro) ou Prejuízos Acumulados (prejuízo).
//
// Depois do encerramento, a conta automática "Superávit ou Déficit do Exercício"
// volta a zero e o valor passa a compor o PL pela conta de destino.
import { state } from './state.js';
import { toCents, fromCents, formatCents, todayISO, formatDateBR, escapeHtml, padSeq } from './utils.js';
import { showToast, refreshIcons, navigate } from './ui.js';
import { persistBatch } from './workspaces.js';
import { getAccount, getAnalyticAccounts, hasChildren, isDebitNature, codeFromInput } from './accounts.js';

const view = { date: '', destCode: '' };

// Saldos (centavos) das contas de resultado por (conta analítica, departamento) até a data.
// Como encerramentos anteriores zeraram as contas, o que sobra é o resultado do exercício.
const resultBalances = (untilDate) => {
    const map = new Map(); // `${code}|${cc}` -> saldo na natureza da conta
    for (const b of state.batches) {
        if (b.date > untilDate) continue;
        for (const e of b.entries) {
            const acc = getAccount(e.accountCode);
            if (!acc || (acc.type !== 'Receita' && acc.type !== 'Despesa') || hasChildren(acc.code)) continue;
            const key = `${acc.code}|${e.ccId}`;
            const cents = toCents(e.value);
            const signed = (e.type === 'D') === isDebitNature(acc) ? cents : -cents;
            map.set(key, (map.get(key) || 0) + signed);
        }
    }
    return map;
};

// Resultado líquido a encerrar: receitas − despesas (respeitando contas redutoras)
const netResult = (balances) => {
    let total = 0;
    for (const [key, bal] of balances) {
        const acc = getAccount(key.split('|')[0]);
        if (!acc) continue;
        const credit = !isDebitNature(acc);            // receita "normal" é credora
        total += credit ? bal : -bal;
    }
    return total;
};

const destinationOptions = () =>
    getAnalyticAccounts().filter(a => a.type === 'Passivo' && a.role !== 'result');

const defaultDestination = (result) => {
    const role = result < 0 ? 'accumulatedLosses' : 'retainedEarnings';
    return state.accounts.find(a => a.role === role) || state.accounts.find(a => a.role === 'retainedEarnings') || null;
};

const updatePreview = () => {
    const balances = resultBalances(view.date);
    const result = netResult(balances);
    const el = document.getElementById('closing-preview');
    const count = [...balances.values()].filter(v => v !== 0).length;
    el.innerHTML = count === 0
        ? '<span class="muted">Nenhuma conta de resultado com saldo até essa data — nada a encerrar.</span>'
        : `${count} saldo(s) de resultado serão zerados. Resultado a transferir: <strong class="${result < 0 ? 'text-danger' : 'text-ok'}">${formatCents(Math.abs(result))} ${result < 0 ? '(prejuízo)' : '(lucro)'}</strong>`;
    document.getElementById('closing-submit').disabled = count === 0;
    return result;
};

export const openClosingModal = () => {
    view.date = document.querySelector('.period-to')?.value || todayISO();
    const balances = resultBalances(view.date);
    const dest = defaultDestination(netResult(balances));
    view.destCode = dest?.code || '';

    document.getElementById('closing-date').value = view.date;
    document.getElementById('dl-contas-pl').innerHTML = destinationOptions()
        .map(a => `<option value="${escapeHtml(`${a.code} - ${a.name}`)}"></option>`).join('');
    document.getElementById('closing-dest').value = dest ? `${dest.code} - ${dest.name}` : '';
    document.getElementById('closing-desc').value = `Encerramento do exercício em ${formatDateBR(view.date)}`;
    updatePreview();

    const modal = document.getElementById('closing-modal');
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.remove('opacity-0'));
    refreshIcons();
};

export const closeClosingModal = () => {
    const modal = document.getElementById('closing-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 250);
};

export const onClosingDateChange = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    view.date = value;
    document.getElementById('closing-date').value = value;
    document.getElementById('closing-desc').value = `Encerramento do exercício em ${formatDateBR(value)}`;
    const result = updatePreview();
    const dest = defaultDestination(result);
    if (dest) { view.destCode = dest.code; document.getElementById('closing-dest').value = `${dest.code} - ${dest.name}`; }
};

export const onClosingDestChange = (text) => {
    const acc = getAccount(codeFromInput(text));
    const ok = acc && acc.type === 'Passivo' && !hasChildren(acc.code) && acc.role !== 'result';
    view.destCode = ok ? acc.code : '';
    if (!ok && text.trim()) showToast('Escolha uma conta analítica do Patrimônio Líquido (ex.: Lucros ou Prejuízos Acumulados).', 'error');
};

export const confirmClosing = async (e) => {
    if (e) e.preventDefault();
    const date = document.getElementById('closing-date').value;
    const description = document.getElementById('closing-desc').value.trim() || `Encerramento do exercício em ${formatDateBR(date)}`;
    const dest = getAccount(view.destCode);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { showToast('Informe a data do encerramento.', 'error'); return; }
    if (!dest) { showToast('Informe a conta de destino do resultado.', 'error'); return; }
    if (state.batches.some(b => b.kind === 'closing' && b.date === date)) { showToast(`Já existe um lote de encerramento em ${formatDateBR(date)}.`, 'error'); return; }

    const balances = resultBalances(date);
    const entries = [];
    for (const [key, bal] of balances) {
        if (bal === 0) continue;
        const [code, ccId] = key.split('|');
        const acc = getAccount(code);
        // Zera o saldo: lança o oposto da natureza do saldo remanescente
        const debitBalance = (bal > 0) === isDebitNature(acc);
        entries.push({ accountCode: code, ccId, type: debitBalance ? 'C' : 'D', value: fromCents(Math.abs(bal)) });
    }
    if (entries.length === 0) { showToast('Nada a encerrar nessa data.', 'error'); return; }

    const result = netResult(balances);
    const defaultCc = state.costCenters[0]?.id || '';
    // Lucro credita o destino (aumenta o PL); prejuízo debita
    if (result !== 0) entries.push({ accountCode: dest.code, ccId: defaultCc, type: result > 0 ? 'C' : 'D', value: fromCents(Math.abs(result)) });

    // Conferência de partidas dobradas
    const tD = entries.filter(x => x.type === 'D').reduce((s, x) => s + toCents(x.value), 0);
    const tC = entries.filter(x => x.type === 'C').reduce((s, x) => s + toCents(x.value), 0);
    if (tD !== tC) { showToast('Erro interno: lote de encerramento não fecha.', 'error'); console.error({ entries, tD, tC }); return; }

    let seq = Math.max(1, Number(state.nextBatchSeq) || 1);
    const ids = new Set(state.batches.map(b => b.id));
    while (ids.has(`LOTE-${padSeq(seq)}`)) seq++;
    const batch = { id: `LOTE-${padSeq(seq)}`, date, description, createdAt: Date.now(), kind: 'closing', entries };
    state.batches.unshift(batch);
    state.nextBatchSeq = seq + 1;

    document.getElementById('closing-submit').disabled = true;
    await persistBatch(batch);
    closeClosingModal();
    showToast(`Exercício encerrado: lote ${batch.id} com ${entries.length} partida(s). Resultado ${result < 0 ? 'de prejuízo' : 'de lucro'} de ${formatCents(Math.abs(result))} transferido para ${dest.code}.`);
    navigate('consultaLotes');
};
