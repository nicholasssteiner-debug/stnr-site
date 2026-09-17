// Plano de contas: consultas à hierarquia, cadastro e exclusão.
// Regras: código é identificador imutável (sem renumeração automática) e
// contas com lançamentos não podem ser excluídas.
import { state } from './state.js';
import { compareCodes, escapeHtml } from './utils.js';
import { showToast, showConfirm, refreshIcons } from './ui.js';
import { persistState } from './workspaces.js';
import { FULL_CHART, dreGroupFor } from './chartOfAccounts.js';

// ---------- Consultas ----------
export const getAccount = (code) => state.accounts.find(a => a.code === code);
export const getAccountName = (code) => getAccount(code)?.name ?? 'Desconhecida';

// Conta de resultado do exercício (Superávit/Déficit): saldo automático, sem lançamentos manuais
export const getResultAccount = () => state.accounts.find(a => a.role === 'result') || null;
export const isResultAccount = (code) => getAccount(code)?.role === 'result';

// Conta analítica que já tem lançamentos diretos não pode receber subcontas
export const hasDirectEntries = (code) => state.batches.some(b => b.entries.some(e => e.accountCode === code));

// true se `code` for igual a `parentCode` ou estiver abaixo dele (1.1.01 ⊂ 1.1, mas 1.10 ⊄ 1.1)
export const isSelfOrDescendant = (code, parentCode) => code === parentCode || code.startsWith(parentCode + '.');

export const hasChildren = (code) => state.accounts.some(a => a.code.startsWith(code + '.'));
export const isAnalytic = (code) => !hasChildren(code);

export const getChildAccounts = (parentCode) =>
    state.accounts.filter(a => a.code.startsWith(parentCode + '.') && a.code.split('.').length === parentCode.split('.').length + 1);

// Todas as contas analíticas (folhas) abaixo de `code`, em qualquer nível
export const getAnalyticDescendants = (code) =>
    state.accounts.filter(a => a.code.startsWith(code + '.') && isAnalytic(a.code)).sort((a, b) => compareCodes(a.code, b.code));

export const getAnalyticAccounts = () => state.accounts.filter(a => isAnalytic(a.code));

export const sortedAccounts = () => [...state.accounts].sort((a, b) => compareCodes(a.code, b.code));

// Natureza do saldo: Ativo/Despesa devedora, Passivo/Receita credora; "(-)" inverte (conta redutora).
export const isReducing = (acc) => acc.name.trim().startsWith('(-)');
export const isDebitNature = (acc) => {
    const base = acc.type === 'Ativo' || acc.type === 'Despesa';
    return isReducing(acc) ? !base : base;
};

export const accountHasEntries = (code) =>
    state.batches.some(b => b.entries.some(e => isSelfOrDescendant(e.accountCode, code)));

export const countAccountEntries = (code) =>
    state.batches.reduce((n, b) => n + b.entries.filter(e => isSelfOrDescendant(e.accountCode, code)).length, 0);

// Preenche os <datalist> usados nos campos de pesquisa
export const updateDatalists = () => {
    const opt = (code, name) => `<option value="${escapeHtml(`${code} - ${name}`)}"></option>`;
    const all = sortedAccounts();
    document.getElementById('dl-contas').innerHTML = all.map(a => opt(a.code, a.name)).join('');
    // No lançamento qualquer conta pode ser digitada; se for sintética, a subconta é exigida.
    document.getElementById('dl-contas-lancamento').innerHTML = all.filter(a => a.role !== 'result').map(a => opt(a.code, hasChildren(a.code) ? `${a.name} (sintética)` : a.name)).join('');
    document.getElementById('dl-cc').innerHTML = state.costCenters.map(c => opt(c.id, c.name)).join('');
};

// Extrai o código de um texto "1.1.01 - Caixa" (ou só "1.1.01")
export const codeFromInput = (text) => String(text || '').split(' - ')[0].trim();

// ---------- Tela ----------
export const renderPlanoContas = () => {
    const tbody = document.getElementById('plano-contas-tbody');
    const all = sortedAccounts();
    const search = (document.getElementById('plano-search')?.value || '').trim().toLowerCase();

    // Filtro por código ou nome; ao filtrar, mantém as contas-pai para preservar a hierarquia
    let accounts = all;
    if (search) {
        const keep = new Set();
        for (const a of all) {
            if (!a.code.toLowerCase().includes(search) && !a.name.toLowerCase().includes(search)) continue;
            const parts = a.code.split('.');
            for (let i = 1; i <= parts.length; i++) keep.add(parts.slice(0, i).join('.'));
        }
        accounts = all.filter(a => keep.has(a.code));
    }

    const countEl = document.getElementById('plano-count');
    if (countEl) countEl.innerText = search ? `${accounts.length} de ${all.length} conta(s)` : `${all.length} conta(s) · ${all.filter(a => isAnalytic(a.code)).length} analíticas`;

    // Aviso quando a atividade ainda usa um plano reduzido ou não tem a conta de resultado
    const banner = document.getElementById('plano-import-banner');
    if (banner) {
        const missing = FULL_CHART.filter(a => !all.some(b => b.code === a.code)).length;
        const noResult = !getResultAccount();
        banner.classList.toggle('hidden', missing < 50 && !noResult);
        document.getElementById('plano-import-banner-text').innerText = noResult && missing < 50
            ? 'Esta atividade não tem a conta automática "Superávit ou Déficit do Exercício". Importe o plano padrão para criá-la.'
            : `Esta atividade tem ${all.length} conta(s); o plano padrão completo (comércio + serviços) tem ${FULL_CHART.length}. Importar acrescenta só o que falta, sem alterar as contas atuais.`;
    }

    if (accounts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty">${all.length ? 'Nenhuma conta encontrada.' : 'Nenhuma conta cadastrada.'}</td></tr>`;
        return;
    }

    tbody.innerHTML = accounts.map(acc => {
        const level = acc.code.split('.').length;
        const synthetic = hasChildren(acc.code);
        const entries = countAccountEntries(acc.code);
        const badge = { Ativo: 'badge-green', Passivo: 'badge-orange', Receita: 'badge-blue', Despesa: 'badge-red' }[acc.type] || 'badge-gray';
        const isResult = acc.role === 'result';
        // Conta do último nível com lançamentos (ou a conta automática) não pode ganhar subcontas
        const subBlocked = isResult || (!synthetic && entries > 0);
        const subTitle = isResult ? 'Conta automática: não recebe subcontas' : subBlocked ? 'Conta com lançamentos não pode receber subcontas' : 'Adicionar Subconta';
        return `
            <tr class="${synthetic ? 'row-synth' : ''}">
                <td class="font-mono" style="padding-left:${0.75 + (level - 1) * 0.9}rem">${escapeHtml(acc.code)}</td>
                <td>${escapeHtml(acc.name)}</td>
                <td>
                    <span class="badge ${badge}">${escapeHtml(acc.type)}</span>
                    ${synthetic ? '<span class="muted text-xs italic ml-2">Sintética</span>' : ''}
                    ${isResult ? '<span class="badge badge-accent ml-2" title="Saldo calculado automaticamente: receitas − despesas">Automática</span>' : ''}
                    ${entries ? `<span class="muted text-xs ml-2" title="Lançamentos vinculados">${entries} lçto(s)</span>` : ''}
                </td>
                <td class="text-center whitespace-nowrap">
                    <button onclick="promptSubAccount('${escapeHtml(acc.code)}', '${escapeHtml(acc.type)}')" class="icon-btn" title="${subTitle}" ${subBlocked ? 'disabled' : ''}><i data-lucide="plus-square" class="w-4 h-4"></i></button>
                    <button onclick="deleteAccount('${escapeHtml(acc.code)}')" class="icon-btn danger" title="${entries ? 'Conta com lançamentos não pode ser excluída' : 'Excluir Conta'}" ${entries ? 'disabled' : ''}><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </td>
            </tr>`;
    }).join('');
    refreshIcons();
};

// Sugere o próximo código de subconta (maior sufixo numérico + 1)
export const promptSubAccount = (parentCode, type) => {
    const children = getChildAccounts(parentCode);
    let next = 1, width = 2;
    for (const c of children) {
        const suf = c.code.split('.').pop();
        const n = parseInt(suf, 10);
        if (!isNaN(n)) { next = Math.max(next, n + 1); width = Math.max(width, suf.length); }
    }
    const newCode = `${parentCode}.${String(next).padStart(width, '0')}`;
    document.getElementById('acc-code').value = newCode;
    document.getElementById('acc-type').value = type;
    document.getElementById('acc-name').focus();
    showToast(`Código ${newCode} sugerido para subconta de ${parentCode}`);
};

export const addAccount = (e) => {
    e.preventDefault();
    const codeInput = document.getElementById('acc-code');
    const nameInput = document.getElementById('acc-name');
    const code = codeInput.value.trim().replace(/\.+$/, '');
    const name = nameInput.value.trim();
    const type = document.getElementById('acc-type').value;

    if (!/^\d+(\.\d+)*$/.test(code)) {
        showToast('Código inválido. Use números separados por ponto (ex.: 1.1.03).', 'error');
        return;
    }
    if (getAccount(code)) {
        showToast(`Já existe a conta ${code}. Escolha outro código.`, 'error');
        return;
    }
    // Uma conta pai que já tenha lançamentos diretos viraria sintética e "esconderia" esses lançamentos.
    const parentCode = code.includes('.') ? code.slice(0, code.lastIndexOf('.')) : null;
    if (parentCode) {
        const parent = getAccount(parentCode);
        if (parent && isAnalytic(parentCode) && hasDirectEntries(parentCode)) {
            showToast(`A conta ${parentCode} já possui lançamentos diretos e não pode receber subcontas.`, 'error');
            return;
        }
        if (parent && parent.role === 'result') {
            showToast('A conta de resultado do exercício é automática e não recebe subcontas.', 'error');
            return;
        }
        if (parent && parent.type !== type) {
            showToast(`A subconta deve ter o mesmo tipo da conta pai (${parent.type}).`, 'error');
            return;
        }
    }

    state.accounts.push({ code, name, type });
    updateDatalists();
    codeInput.value = '';
    nameInput.value = '';
    renderPlanoContas();
    persistState();
    showToast('Conta adicionada com sucesso!');
};

export const deleteAccount = (code) => {
    const entries = countAccountEntries(code);
    if (entries > 0) {
        showToast(`A conta ${code} possui ${entries} lançamento(s) e não pode ser excluída. Exclua ou edite os lotes primeiro.`, 'error');
        return;
    }
    const subs = state.accounts.filter(a => a.code.startsWith(code + '.')).length;
    const msg = subs
        ? `A conta ${code} possui ${subs} subconta(s). Excluir apagará todas elas. Continuar?`
        : `Excluir a conta ${code}?`;

    showConfirm(msg, () => {
        state.accounts = state.accounts.filter(a => !isSelfOrDescendant(a.code, code));
        for (const key of Object.keys(state.dreConfig)) {
            state.dreConfig[key] = state.dreConfig[key].filter(c => !isSelfOrDescendant(c, code));
        }
        updateDatalists();
        renderPlanoContas();
        persistState();
        showToast('Conta excluída.');
    });
};

// ---------- Importar plano de contas padrão ----------
// Acrescenta à atividade atual as contas do plano padrão que ainda não existem.
// Nunca remove nem renomeia contas existentes. Contas analíticas que já tenham
// lançamentos diretos não recebem subcontas (isso esconderia os lançamentos).
export const importDefaultChart = () => {
    const existing = new Set(state.accounts.map(a => a.code));
    const blockedParents = new Set(
        state.accounts
            .filter(a => isAnalytic(a.code) && state.batches.some(b => b.entries.some(e => e.accountCode === a.code)))
            .map(a => a.code)
    );

    const toAdd = [];
    const skipped = [];
    for (const acc of [...FULL_CHART].sort((a, b) => compareCodes(a.code, b.code))) {
        if (existing.has(acc.code)) continue;
        const parentCode = acc.code.includes('.') ? acc.code.slice(0, acc.code.lastIndexOf('.')) : null;
        if (parentCode && [...blockedParents].some(p => isSelfOrDescendant(acc.code, p))) { skipped.push(acc.code); continue; }
        const parent = parentCode ? (getAccount(parentCode) || toAdd.find(a => a.code === parentCode)) : null;
        if (parentCode && (!parent || parent.type !== acc.type)) { skipped.push(acc.code); continue; }
        toAdd.push({ ...acc });
    }

    if (toAdd.length === 0) {
        showToast(skipped.length ? `Nada a importar: ${skipped.length} conta(s) conflitam com contas que já têm lançamentos.` : 'O plano padrão já está completo nesta atividade.', 'error');
        return;
    }

    const msg = `Adicionar ${toAdd.length} conta(s) do plano padrão (comércio + serviços) a esta atividade?`
        + (skipped.length ? ` ${skipped.length} conta(s) serão ignoradas por conflitar com lançamentos existentes.` : '')
        + ' As contas atuais não serão alteradas.';

    showConfirm(msg, () => {
        state.accounts.push(...toAdd);
        // Contas que viraram sintéticas saem da DRE (as filhas assumem o lugar)
        for (const key of Object.keys(state.dreConfig)) state.dreConfig[key] = state.dreConfig[key].filter(c => isAnalytic(c));
        // Mapeia na DRE as novas contas de resultado que ainda não estão em nenhum grupo
        const mapped = new Set(Object.values(state.dreConfig).flat());
        for (const acc of toAdd) {
            if (acc.type !== 'Receita' && acc.type !== 'Despesa') continue;
            if (!isAnalytic(acc.code) || mapped.has(acc.code)) continue;
            const group = dreGroupFor(acc.code);
            if (group && state.dreConfig[group]) state.dreConfig[group].push(acc.code);
        }
        updateDatalists();
        renderPlanoContas();
        persistState();
        showToast(`${toAdd.length} conta(s) importada(s). Plano com ${state.accounts.length} contas.`);
    });
};
