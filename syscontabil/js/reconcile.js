// Conciliação de partidas: marca cada lançamento de uma conta (ex.: banco) como
// conciliado com o extrato e mostra o que ainda está pendente.
import { state } from './state.js';
import { toCents, formatCents, formatDateBR, escapeHtml, applyMoneyMask } from './utils.js';
import { showToast, refreshIcons } from './ui.js';
import { persistBatch } from './workspaces.js';
import { getAccount, hasChildren, isSelfOrDescendant, isDebitNature, codeFromInput, sortedAccounts } from './accounts.js';
import { getCostCenterName } from './costCenters.js';
import { period, periodLabel, entryInScope, refreshCcSelectors } from './reports.js';

const view = { accountCode: '', filter: 'todas', statementCents: 0 };

const sortChrono = (a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt - b.createdAt) || a.id.localeCompare(b.id);

// Partidas da conta selecionada (com índice dentro do lote, para poder marcar)
const collectEntries = (acc) => {
    const list = [];
    for (const batch of [...state.batches].sort(sortChrono)) {
        batch.entries.forEach((entry, index) => {
            if (isSelfOrDescendant(entry.accountCode, acc.code) && entryInScope(entry)) list.push({ batch, entry, index });
        });
    }
    return list;
};

const inPeriod = (date) => (!period.from || date >= period.from) && (!period.to || date <= period.to);

// Só contas do último nível (analíticas) com lançamentos podem ser conciliadas
const reconcilableAccounts = () => {
    const used = new Set();
    for (const b of state.batches) for (const e of b.entries) used.add(e.accountCode);
    return sortedAccounts().filter(a => used.has(a.code) && !hasChildren(a.code) && a.role !== 'result');
};

export const initConciliacao = () => {
    refreshCcSelectors();
    document.getElementById('conc-period-label').innerText = periodLabel();
    document.getElementById('dl-contas-conc').innerHTML = reconcilableAccounts()
        .map(a => `<option value="${escapeHtml(`${a.code} - ${a.name}`)}"></option>`).join('');
    renderConciliacao();
};

export const setConciliacaoAccount = (text) => {
    const acc = getAccount(codeFromInput(text));
    if (acc && hasChildren(acc.code)) {
        showToast(`${acc.code} é sintética. Escolha a conta do último nível (ex.: a subconta do cliente ou fornecedor).`, 'error');
        view.accountCode = '';
        renderConciliacao();
        return;
    }
    view.accountCode = acc ? acc.code : '';
    if (!acc && text.trim()) showToast('Conta não encontrada. Selecione uma conta analítica com lançamentos.', 'error');
    renderConciliacao();
};

export const setConciliacaoFilter = (value) => {
    view.filter = value;
    renderConciliacao();
};

export const onStatementInput = (input) => {
    view.statementCents = applyMoneyMask(input);
    updateSummary();
};

// Saldo na natureza da conta, em centavos, para um conjunto de partidas
const balanceOf = (acc, items) => {
    const debit = isDebitNature(acc);
    let bal = 0;
    for (const { entry } of items) {
        const cents = toCents(entry.value);
        bal += (entry.type === 'D') === debit ? cents : -cents;
    }
    return bal;
};

const suffix = (acc, bal) => bal === 0 ? '' : ((isDebitNature(acc) ? bal > 0 : bal < 0) ? ' D' : ' C');

let lastItems = [];

const updateSummary = () => {
    const acc = getAccount(view.accountCode);
    if (!acc) return;
    // Posição até a data final (o extrato é uma posição, não um movimento)
    const untilEnd = collectEntries(acc).filter(x => !period.to || x.batch.date <= period.to);
    const reconciled = untilEnd.filter(x => x.entry.reconciled);
    const pending = untilEnd.filter(x => !x.entry.reconciled);

    const book = balanceOf(acc, untilEnd);
    const rec = balanceOf(acc, reconciled);
    const pend = balanceOf(acc, pending);
    const diff = view.statementCents - rec;

    document.getElementById('conc-saldo-contabil').innerText = formatCents(Math.abs(book)) + suffix(acc, book);
    document.getElementById('conc-saldo-conciliado').innerText = formatCents(Math.abs(rec)) + suffix(acc, rec);
    document.getElementById('conc-saldo-pendente').innerText = `${formatCents(Math.abs(pend))}${suffix(acc, pend)} (${pending.length})`;
    const diffEl = document.getElementById('conc-diferenca');
    diffEl.innerText = view.statementCents === 0 ? '--' : (diff === 0 ? 'Conferido ✓' : formatCents(diff));
    diffEl.classList.toggle('text-danger', view.statementCents !== 0 && diff !== 0);
    diffEl.classList.toggle('text-ok', view.statementCents !== 0 && diff === 0);
};

export const renderConciliacao = () => {
    const acc = getAccount(view.accountCode);
    const area = document.getElementById('conc-content-area');
    if (!acc) { area.classList.add('hidden'); return; }
    area.classList.remove('hidden');

    document.getElementById('conc-acc-info').innerText =
        `${acc.code} - ${acc.name} · ${periodLabel()}`;

    const all = collectEntries(acc).filter(x => inPeriod(x.batch.date));
    lastItems = all.filter(x =>
        view.filter === 'todas' ||
        (view.filter === 'pendentes' && !x.entry.reconciled) ||
        (view.filter === 'conciliadas' && x.entry.reconciled));

    const tbody = document.getElementById('conc-tbody');
    if (lastItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty">${all.length ? 'Nenhuma partida com esse filtro.' : 'Nenhum movimento no período.'}</td></tr>`;
    } else {
        tbody.innerHTML = lastItems.map(({ batch, entry, index }) => {
            const cents = toCents(entry.value);
            const rec = !!entry.reconciled;
            return `
                <tr class="${rec ? 'row-reconciled' : ''}">
                    <td class="text-center"><input type="checkbox" class="chk" ${rec ? 'checked' : ''} onchange="toggleReconcile('${escapeHtml(batch.id)}', ${index}, this.checked)" title="${rec ? 'Conciliada em ' + new Date(entry.reconciledAt || 0).toLocaleDateString('pt-BR') : 'Marcar como conciliada'}"></td>
                    <td>${formatDateBR(batch.date)}</td>
                    <td class="font-mono">${escapeHtml(batch.id)}</td>
                    <td>${escapeHtml(batch.description)}${entry.accountCode !== acc.code ? ` <span class="muted">(${escapeHtml(entry.accountCode)})</span>` : ''}</td>
                    <td class="muted text-xs">${escapeHtml(entry.ccId)} - ${escapeHtml(getCostCenterName(entry.ccId))}</td>
                    <td class="text-right">${entry.type === 'D' ? formatCents(cents) : ''}</td>
                    <td class="text-right">${entry.type === 'C' ? formatCents(cents) : ''}</td>
                    <td class="text-center"><span class="badge ${rec ? 'badge-green' : 'badge-orange'}">${rec ? 'Conciliada' : 'Pendente'}</span></td>
                </tr>`;
        }).join('');
    }

    document.getElementById('conc-count').innerText = `${lastItems.length} partida(s) · ${all.filter(x => !x.entry.reconciled).length} pendente(s) no período`;
    updateSummary();
    refreshIcons();
};

const setReconciled = (entry, checked) => {
    if (checked) { entry.reconciled = true; entry.reconciledAt = Date.now(); }
    else { delete entry.reconciled; delete entry.reconciledAt; }
};

export const toggleReconcile = async (batchId, index, checked) => {
    const batch = state.batches.find(b => b.id === batchId);
    const entry = batch?.entries[index];
    if (!entry) return;
    setReconciled(entry, checked);
    renderConciliacao();
    await persistBatch(batch);
};

// Marca/desmarca todas as partidas visíveis (uma gravação por lote)
export const reconcileAllVisible = async (checked) => {
    if (lastItems.length === 0) return;
    const touched = new Map();
    for (const { batch, entry } of lastItems) {
        if (!!entry.reconciled !== checked) { setReconciled(entry, checked); touched.set(batch.id, batch); }
    }
    renderConciliacao();
    for (const batch of touched.values()) await persistBatch(batch);
    showToast(checked ? `${lastItems.length} partida(s) conciliada(s).` : 'Marcações removidas.');
};
