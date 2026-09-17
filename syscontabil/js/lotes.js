// Lançamentos em lote (partidas dobradas): formulário de novo lote / edição
// e a tela de consulta de lotes.
import { state } from './state.js';
import { toCents, fromCents, formatCents, formatCentsPlain, applyMoneyMask, todayISO, formatDateBR, escapeHtml, padSeq } from './utils.js';
import { showToast, showConfirm, navigate, refreshIcons } from './ui.js';
import { persistBatch, removeBatch } from './workspaces.js';
import { getAccount, getAccountName, hasChildren, getAnalyticDescendants, codeFromInput } from './accounts.js';
import { getCostCenter, getCostCenterName } from './costCenters.js';

const form = { editingId: null, lines: [] };
let lineSeq = 0;
let expandedBatchId = null;

const newLine = (type) => ({ id: ++lineSeq, accountCode: '', subAccountCode: '', ccId: '', type, cents: 0, textInput: '', ccInput: '' });

const ccText = (id) => id ? `${id} - ${getCostCenterName(id)}` : '';
const accText = (code) => code ? `${code} - ${getAccountName(code)}` : '';

// Procura o pai "principal" (primeira conta sintética acima de `code`) para preencher o formulário na edição
const findMainParent = (code) => {
    const parts = code.split('.');
    for (let i = 1; i < parts.length; i++) {
        const candidate = parts.slice(0, i).join('.');
        if (getAccount(candidate) && hasChildren(candidate)) return candidate;
    }
    return null;
};

// Próximo ID livre (não reaproveita números mesmo após exclusões)
const nextBatchId = () => {
    let seq = Math.max(1, Number(state.nextBatchSeq) || 1);
    const ids = new Set(state.batches.map(b => b.id));
    while (ids.has(`LOTE-${padSeq(seq)}`)) seq++;
    return { id: `LOTE-${padSeq(seq)}`, seq };
};

// ---------- Formulário ----------
export const initNovoLote = (params) => {
    const editId = params?.editId || null;
    const batch = editId ? state.batches.find(b => b.id === editId) : null;

    form.editingId = batch ? batch.id : null;
    document.getElementById('nl-lote-id').value = batch ? batch.id : nextBatchId().id;
    document.getElementById('nl-date').value = batch ? batch.date : todayISO();
    document.getElementById('nl-desc').value = batch ? batch.description : '';

    const banner = document.getElementById('nl-edit-banner');
    banner.classList.toggle('hidden', !batch);
    if (batch) document.getElementById('nl-edit-id').innerText = batch.id;
    document.getElementById('btn-save-lote-text').innerText = batch ? 'Salvar Alterações' : 'Salvar Lote';

    if (batch) {
        form.lines = batch.entries.map(e => {
            const main = findMainParent(e.accountCode);
            return {
                id: ++lineSeq,
                accountCode: main || e.accountCode,
                subAccountCode: main ? e.accountCode : '',
                ccId: e.ccId,
                type: e.type,
                cents: toCents(e.value),
                textInput: accText(main || e.accountCode),
                ccInput: ccText(e.ccId),
            };
        });
    } else {
        form.lines = [newLine('D'), newLine('C')];
    }
    renderNovoLoteLines();
};

export const cancelEditLote = () => {
    form.editingId = null;
    navigate('consultaLotes');
};

const totals = () => {
    let d = 0, c = 0;
    for (const l of form.lines) (l.type === 'D' ? (d += l.cents) : (c += l.cents));
    return { d, c, balanced: d > 0 && d === c };
};

const updateLoteTotalsUI = () => {
    const { d, c, balanced } = totals();
    const tdEl = document.getElementById('nl-total-d');
    const tcEl = document.getElementById('nl-total-c');
    tdEl.innerText = formatCents(d);
    tcEl.innerText = formatCents(c);
    tdEl.classList.toggle('text-danger', !balanced && d > 0);
    tcEl.classList.toggle('text-danger', !balanced && c > 0);

    const warnEl = document.getElementById('nl-warning');
    const btnSave = document.getElementById('btn-save-lote');
    const unbalanced = !balanced && (d > 0 || c > 0);
    warnEl.classList.toggle('hidden', !unbalanced);
    if (unbalanced) document.getElementById('nl-warning-text').innerText = `Lançamento não bate! Diferença: ${formatCents(Math.abs(d - c))}`;
    btnSave.disabled = !balanced;
};

const renderNovoLoteLines = () => {
    const tbody = document.getElementById('novo-lote-tbody');
    const ccLocked = state.costCenters.length === 1;
    const defaultCc = state.costCenters[0];

    tbody.innerHTML = form.lines.map(line => {
        if (ccLocked && defaultCc && !line.ccId) { line.ccId = defaultCc.id; line.ccInput = ccText(defaultCc.id); }

        const synthetic = line.accountCode && hasChildren(line.accountCode);
        const subs = synthetic ? getAnalyticDescendants(line.accountCode) : [];
        const subOptions = synthetic
            ? '<option value="">Selecione a subconta...</option>' + subs.map(s => `<option value="${escapeHtml(s.code)}" ${line.subAccountCode === s.code ? 'selected' : ''}>${escapeHtml(s.code)} - ${escapeHtml(s.name)}</option>`).join('')
            : '<option value="">Não exigida</option>';

        return `
            <tr>
                <td><input type="text" list="dl-contas-lancamento" value="${escapeHtml(line.textInput)}" onchange="handleLineContaSearch(${line.id}, this.value)" placeholder="Pesquise a conta..." class="input" autocomplete="off"></td>
                <td><select onchange="updateLoteLine(${line.id}, 'subAccountCode', this.value)" class="input" ${synthetic ? '' : 'disabled'}>${subOptions}</select></td>
                <td><input type="text" list="dl-cc" value="${escapeHtml(line.ccInput)}" onchange="handleLineCcSearch(${line.id}, this.value)" placeholder="Pesquise o CC..." class="input" ${ccLocked ? 'readonly' : ''} autocomplete="off"></td>
                <td>
                    <select onchange="updateLoteLine(${line.id}, 'type', this.value)" class="input font-bold">
                        <option value="D" ${line.type === 'D' ? 'selected' : ''}>D</option>
                        <option value="C" ${line.type === 'C' ? 'selected' : ''}>C</option>
                    </select>
                </td>
                <td><input type="text" inputmode="numeric" placeholder="0,00" value="${line.cents ? formatCentsPlain(line.cents) : ''}" oninput="onLoteValueInput(${line.id}, this)" class="input text-right font-medium money" autocomplete="off"></td>
                <td class="text-center">
                    <button onclick="removeLoteLine(${line.id})" ${form.lines.length <= 2 ? 'disabled' : ''} class="icon-btn danger" title="Remover linha"><i data-lucide="trash-2" class="w-[18px] h-[18px]"></i></button>
                </td>
            </tr>`;
    }).join('');

    updateLoteTotalsUI();
    refreshIcons();
};

export const handleLineContaSearch = (id, textValue) => {
    const line = form.lines.find(l => l.id === id);
    if (!line) return;
    const found = getAccount(codeFromInput(textValue));
    if (found) {
        line.accountCode = found.code;
        line.textInput = accText(found.code);
    } else {
        line.accountCode = '';
        line.textInput = textValue;
        if (textValue.trim()) showToast('Conta não encontrada. Selecione uma opção da lista.', 'error');
    }
    line.subAccountCode = '';
    renderNovoLoteLines();
};

export const handleLineCcSearch = (id, textValue) => {
    const line = form.lines.find(l => l.id === id);
    if (!line) return;
    const found = getCostCenter(codeFromInput(textValue));
    line.ccId = found ? found.id : '';
    line.ccInput = found ? ccText(found.id) : textValue;
    if (!found && textValue.trim()) showToast('Centro de custo não encontrado. Selecione uma opção da lista.', 'error');
};

export const updateLoteLine = (id, field, value) => {
    const line = form.lines.find(l => l.id === id);
    if (!line) return;
    line[field] = value;
    if (field === 'type') updateLoteTotalsUI(); else renderNovoLoteLines();
};

// Máscara brasileira: o usuário digita só números e vê 1.234,56
export const onLoteValueInput = (id, input) => {
    const line = form.lines.find(l => l.id === id);
    if (!line) return;
    line.cents = applyMoneyMask(input);
    updateLoteTotalsUI();
};

export const addNovoLoteLine = () => {
    const { d, c } = totals();
    // A nova linha já vem com o tipo e o valor que faltam para fechar o lote
    const line = newLine(d > c ? 'C' : 'D');
    line.cents = Math.abs(d - c);
    form.lines.push(line);
    renderNovoLoteLines();
};

export const removeLoteLine = (id) => {
    if (form.lines.length <= 2) return;
    form.lines = form.lines.filter(l => l.id !== id);
    renderNovoLoteLines();
};

export const saveNovoLote = async () => {
    const date = document.getElementById('nl-date').value;
    const description = document.getElementById('nl-desc').value.trim();

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { showToast('Informe a data do lançamento.', 'error'); return; }
    if (!description) { showToast('Preencha o histórico do lote.', 'error'); return; }

    const entries = [];
    for (const l of form.lines) {
        if (!l.accountCode) { showToast('Há linha sem conta selecionada.', 'error'); return; }
        if (!l.ccId) { showToast('Há linha sem centro de custo.', 'error'); return; }
        if (l.cents <= 0) { showToast('Há linha sem valor.', 'error'); return; }
        const synthetic = hasChildren(l.accountCode);
        if (synthetic && !l.subAccountCode) { showToast(`A conta ${l.accountCode} é sintética: selecione a subconta.`, 'error'); return; }
        const finalCode = synthetic ? l.subAccountCode : l.accountCode;
        if (hasChildren(finalCode)) { showToast(`A conta ${finalCode} é sintética e não aceita lançamentos.`, 'error'); return; }
        entries.push({ accountCode: finalCode, ccId: l.ccId, type: l.type, value: fromCents(l.cents) });
    }
    if (!totals().balanced) { showToast('Débitos e créditos precisam ser iguais.', 'error'); return; }

    if (form.editingId) {
        const idx = state.batches.findIndex(b => b.id === form.editingId);
        if (idx < 0) { showToast('Lote não encontrado.', 'error'); return; }
        // Mantém a marcação de conciliação das partidas que não mudaram (conta, D/C e valor)
        const remaining = state.batches[idx].entries.filter(e => e.reconciled);
        for (const entry of entries) {
            const i = remaining.findIndex(e => e.accountCode === entry.accountCode && e.type === entry.type && e.value === entry.value);
            if (i >= 0) { entry.reconciled = true; entry.reconciledAt = remaining[i].reconciledAt || 0; remaining.splice(i, 1); }
        }
        const updated = { ...state.batches[idx], date, description, entries, updatedAt: Date.now() };
        state.batches[idx] = updated;
        await persistBatch(updated);
        showToast(`Lote ${updated.id} atualizado!`);
    } else {
        const { id, seq } = nextBatchId();
        const batch = { id, date, description, entries, createdAt: Date.now() };
        state.batches.unshift(batch);
        state.nextBatchSeq = seq + 1;
        await persistBatch(batch);
        showToast(`Lote ${id} salvo com sucesso!`);
    }
    form.editingId = null;
    expandedBatchId = null;
    navigate('consultaLotes');
};

// ---------- Consulta ----------
const sortForList = (a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt - a.createdAt) || b.id.localeCompare(a.id);

export const renderConsultaLotes = () => {
    const listEl = document.getElementById('consulta-list');
    const search = document.getElementById('consulta-search').value.toLowerCase().trim();

    const filtered = state.batches
        .filter(b => !search || b.id.toLowerCase().includes(search) || b.description.toLowerCase().includes(search) || formatDateBR(b.date).includes(search))
        .sort(sortForList);

    document.getElementById('consulta-count').innerText = `${filtered.length} de ${state.batches.length} lote(s)`;

    if (filtered.length === 0) {
        listEl.innerHTML = '<div class="empty">Nenhum lote encontrado.</div>';
        return;
    }

    listEl.innerHTML = filtered.map(batch => {
        const expanded = expandedBatchId === batch.id;
        const totalCents = batch.entries.filter(e => e.type === 'D').reduce((s, e) => s + toCents(e.value), 0);
        const details = !expanded ? '' : `
            <div class="batch-details">
                <table class="tbl compact min-w-[600px]">
                    <thead><tr><th class="w-28">Conta</th><th>Nome</th><th class="w-40">C. Custo</th><th class="w-16 text-center">D/C</th><th class="w-32 text-right">Valor</th></tr></thead>
                    <tbody>
                        ${batch.entries.map(e => `
                            <tr>
                                <td class="font-mono">${escapeHtml(e.accountCode)}</td>
                                <td>${escapeHtml(getAccountName(e.accountCode))}</td>
                                <td class="muted text-xs">${escapeHtml(e.ccId)} - ${escapeHtml(getCostCenterName(e.ccId))}</td>
                                <td class="text-center"><span class="badge ${e.type === 'D' ? 'badge-blue' : 'badge-orange'}">${e.type}</span></td>
                                <td class="text-right font-medium">${formatCents(toCents(e.value))}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;

        return `
            <div class="batch-row">
                <div class="batch-head" onclick="toggleBatch('${escapeHtml(batch.id)}')">
                    <i data-lucide="${expanded ? 'chevron-down' : 'chevron-right'}" class="w-5 h-5 muted shrink-0"></i>
                    <div class="w-28 font-semibold shrink-0">${escapeHtml(batch.id)}</div>
                    <div class="w-24 muted text-sm shrink-0">${formatDateBR(batch.date)}</div>
                    <div class="flex-1 truncate text-sm min-w-[8rem]">${escapeHtml(batch.description)}</div>
                    <div class="w-36 text-right font-medium shrink-0">${formatCents(totalCents)}</div>
                    <div class="flex gap-1 shrink-0">
                        <button onclick="editBatch(event, '${escapeHtml(batch.id)}')" class="icon-btn" title="Editar Lote"><i data-lucide="pencil" class="w-[18px] h-[18px]"></i></button>
                        <button onclick="deleteBatch(event, '${escapeHtml(batch.id)}')" class="icon-btn danger" title="Excluir Lote"><i data-lucide="trash-2" class="w-[18px] h-[18px]"></i></button>
                    </div>
                </div>
                ${details}
            </div>`;
    }).join('');
    refreshIcons();
};

export const toggleBatch = (id) => {
    expandedBatchId = expandedBatchId === id ? null : id;
    renderConsultaLotes();
};

export const editBatch = (event, id) => {
    event.stopPropagation();
    navigate('novoLote', { editId: id });
};

export const deleteBatch = (event, id) => {
    event.stopPropagation();
    showConfirm(`Excluir o lote ${id}? Os saldos das contas envolvidas serão alterados.`, async () => {
        state.batches = state.batches.filter(b => b.id !== id);
        if (expandedBatchId === id) expandedBatchId = null;
        renderConsultaLotes();
        await removeBatch(id);
        showToast('Lote excluído.');
    });
};
