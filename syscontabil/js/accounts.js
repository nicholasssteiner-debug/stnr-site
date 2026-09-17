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

// Conta x subconta é uma distinção ESTRUTURAL, não de formato de código:
//  - conta: registro do plano (código 0.0.00.000), criada no formulário do topo;
//  - subconta: criada pelo "+" de uma conta; tem `parent` (a conta-mãe) e `sub` (código livre,
//    ex.: 1234 para um funcionário). O código interno é `parent.sub`, para manter a hierarquia
//    nos totais; nas telas aparece só o `sub`. Subconta é sempre o último nível.
export const isSubAccount = (acc) => !!acc?.sub;
export const isSubAccountCode = (code) => isSubAccount(getAccount(code));

// Código para exibição: subconta mostra o código livre; conta mostra o código do plano
export const displayCode = (code) => getAccount(code)?.sub ?? code;

// Contas do plano (sem as subcontas), para os seletores "Conta"
export const getStandardAccounts = () => sortedAccounts().filter(a => !a.sub);

// Subcontas de uma conta
export const getSubAccounts = (code) => sortedAccounts().filter(a => a.parent === code);

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
    // Seletores "Conta" dos relatórios: só contas do padrão (as subcontas vão no campo ao lado)
    document.getElementById('dl-contas-padrao').innerHTML = all.filter(a => !isSubAccountCode(a.code)).map(a => opt(a.code, hasChildren(a.code) ? `${a.name} (sintética)` : a.name)).join('');
    // Lançamento: escolhe-se a conta; a subconta (quando houver) vai no campo ao lado
    document.getElementById('dl-contas-lancamento').innerHTML = all.filter(a => a.role !== 'result' && !a.sub).map(a => opt(a.code, hasChildren(a.code) ? `${a.name} (sintética)` : a.name)).join('');
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
        const isSub = !!acc.sub;
        const subBlocked = isResult || isSub || (!synthetic && entries > 0);
        const subTitle = isResult ? 'Conta automática: não recebe subcontas' : isSub ? 'Subconta é o último nível' : subBlocked ? 'Conta com lançamentos não pode receber subcontas' : 'Adicionar subconta (código livre)';
        return `
            <tr class="${synthetic ? 'row-synth' : (isSub ? 'row-sub' : '')}">
                <td class="font-mono" style="padding-left:${0.75 + (level - 1) * 0.9}rem" title="${isSub ? 'Subconta de ' + escapeHtml(acc.parent) : ''}">${escapeHtml(isSub ? acc.sub : acc.code)}</td>
                <td>${escapeHtml(acc.name)}</td>
                <td>
                    <span class="badge ${badge}">${escapeHtml(acc.type)}</span>
                    ${synthetic ? '<span class="muted text-xs italic ml-2">Sintética</span>' : ''}
                    ${isSub ? '<span class="badge badge-gray ml-2" title="Criada pelo + da conta; código livre">subconta</span>' : ''}
                    ${isResult ? '<span class="badge badge-accent ml-2" title="Saldo calculado automaticamente: receitas − despesas">Automática</span>' : ''}
                    ${entries ? `<span class="muted text-xs ml-2" title="Lançamentos vinculados">${entries} lçto(s)</span>` : ''}
                </td>
                <td class="text-center whitespace-nowrap">
                    <button onclick="promptSubAccount('${escapeHtml(acc.code)}')" class="icon-btn" title="${subTitle}" ${subBlocked ? 'disabled' : ''}><i data-lucide="plus-square" class="w-4 h-4"></i></button>
                    <button onclick="deleteAccount('${escapeHtml(acc.code)}')" class="icon-btn danger" title="${entries ? 'Conta com lançamentos não pode ser excluída' : 'Excluir Conta'}" ${entries ? 'disabled' : ''}><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </td>
            </tr>`;
    }).join('');
    refreshIcons();
};

// ---------- Formulário: conta (topo) x subconta (botão "+" da linha) ----------
// Modo do formulário: null = criando conta do padrão; código = criando subconta dessa conta
let subParentCode = null;

const setFormMode = (parentCode) => {
    subParentCode = parentCode || null;
    const parent = subParentCode ? getAccount(subParentCode) : null;
    const banner = document.getElementById('acc-sub-banner');
    const title = document.getElementById('acc-form-title');
    const codeLabel = document.getElementById('acc-code-label');
    const codeInput = document.getElementById('acc-code');
    const typeInput = document.getElementById('acc-type');
    const submitText = document.getElementById('acc-submit-text');

    if (parent) {
        banner.classList.remove('hidden');
        document.getElementById('acc-sub-parent').innerText = `${parent.code} - ${parent.name}`;
        title.innerText = 'Adicionar Subconta';
        codeLabel.innerText = 'Código da subconta (livre: 1234, F001, CLI-07...)';
        codeInput.placeholder = 'Ex.: 1234';
        typeInput.value = parent.type;
        typeInput.disabled = true;
        submitText.innerText = 'Adicionar subconta';
    } else {
        banner.classList.add('hidden');
        title.innerText = 'Adicionar Conta (plano padrão)';
        codeLabel.innerText = 'Código da conta (padrão 0.0.00.000)';
        codeInput.placeholder = 'Ex.: 1.1.03';
        typeInput.disabled = false;
        submitText.innerText = 'Adicionar conta';
    }
    refreshIcons();
};

export const cancelSubAccountMode = () => {
    setFormMode(null);
    document.getElementById('acc-code').value = '';
    document.getElementById('acc-name').value = '';
};

// Botão "+" da linha: entra no modo subconta e sugere o próximo código numérico (editável)
export const promptSubAccount = (parentCode) => {
    const parent = getAccount(parentCode);
    if (!parent) return;
    if (parent.sub) { showToast('Subconta é o último nível: não recebe outras subcontas.', 'error'); return; }
    if (parent.role === 'result') { showToast('A conta de resultado do exercício é automática e não recebe subcontas.', 'error'); return; }
    if (isAnalytic(parentCode) && hasDirectEntries(parentCode)) {
        showToast(`A conta ${parentCode} já possui lançamentos diretos e não pode receber subcontas.`, 'error');
        return;
    }
    setFormMode(parentCode);
    const nums = getSubAccounts(parentCode).map(a => parseInt(a.sub, 10)).filter(n => !isNaN(n));
    document.getElementById('acc-code').value = String((nums.length ? Math.max(...nums) : 0) + 1);
    document.getElementById('acc-name').value = '';
    document.getElementById('acc-name').focus();
    document.getElementById('view-planoContas').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export const addAccount = (e) => {
    e.preventDefault();
    const codeInput = document.getElementById('acc-code');
    const nameInput = document.getElementById('acc-name');
    const name = nameInput.value.trim();
    if (!name) { showToast('Informe o nome.', 'error'); return; }

    if (subParentCode) {
        // ----- Subconta: código livre, única dentro da conta-mãe -----
        const parent = getAccount(subParentCode);
        if (!parent) { cancelSubAccountMode(); return; }
        const sub = codeInput.value.trim();
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(sub)) {
            showToast('Código da subconta: use letras, números, "-" ou "_" (sem pontos nem espaços).', 'error');
            return;
        }
        if (getSubAccounts(parent.code).some(a => a.sub.toLowerCase() === sub.toLowerCase())) {
            showToast(`Já existe a subconta ${sub} em ${parent.code}.`, 'error');
            return;
        }
        if (isAnalytic(parent.code) && hasDirectEntries(parent.code)) {
            showToast(`A conta ${parent.code} já possui lançamentos diretos e não pode receber subcontas.`, 'error');
            return;
        }
        // Código interno = conta.subcódigo (mantém a hierarquia para os totais); o exibido é só `sub`
        state.accounts.push({ code: `${parent.code}.${sub}`, name, type: parent.type, sub, parent: parent.code });
        updateDatalists();
        codeInput.value = String((parseInt(sub, 10) || 0) + 1);
        nameInput.value = '';
        renderPlanoContas();
        persistState();
        showToast(`Subconta ${sub} - ${name} criada em ${parent.code}. Continue adicionando ou cancele.`);
        nameInput.focus();
        return;
    }

    // ----- Conta do plano padrão -----
    const code = codeInput.value.trim().replace(/\.+$/, '');
    const type = document.getElementById('acc-type').value;
    if (!/^\d+(\.\d+)*$/.test(code)) {
        showToast('Código de conta inválido. Use números separados por ponto (ex.: 1.1.03). Para clientes, fornecedores ou funcionários use o "+" da conta para criar subcontas.', 'error');
        return;
    }
    if (getAccount(code)) {
        showToast(`Já existe a conta ${code}. Escolha outro código.`, 'error');
        return;
    }
    const parentCode = code.includes('.') ? code.slice(0, code.lastIndexOf('.')) : null;
    if (parentCode) {
        const parent = getAccount(parentCode);
        if (parent && parent.sub) { showToast('Não é possível criar contas abaixo de uma subconta.', 'error'); return; }
        if (parent && isAnalytic(parentCode) && hasDirectEntries(parentCode)) {
            showToast(`A conta ${parentCode} já possui lançamentos diretos e não pode receber contas abaixo dela.`, 'error');
            return;
        }
        if (parent && parent.role === 'result') {
            showToast('A conta de resultado do exercício é automática e não recebe contas abaixo dela.', 'error');
            return;
        }
        if (parent && parent.type !== type) {
            showToast(`A conta deve ter o mesmo tipo da conta pai (${parent.type}).`, 'error');
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
        // Contas que ganharam contas-filhas saem da DRE (as filhas assumem); com subcontas, permanece
        for (const key of Object.keys(state.dreConfig)) state.dreConfig[key] = state.dreConfig[key].filter(c => isAnalytic(c) || getChildAccounts(c).every(ch => ch.sub));
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
