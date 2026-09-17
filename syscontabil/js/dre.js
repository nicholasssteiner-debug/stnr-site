// DRE: configuração dos grupos e demonstração do resultado do período.
import { state, DRE_GROUPS } from './state.js';
import { toCents, formatCents, escapeHtml, compareCodes } from './utils.js';
import { persistState } from './workspaces.js';
import { getAccountName, getAnalyticAccounts, isSelfOrDescendant } from './accounts.js';
import { getPeriodBatches, periodLabel } from './reports.js';

// Saldo (centavos) das contas listadas, na natureza do grupo: 'C' soma créditos, 'D' soma débitos
const groupBalance = (codes, nature, batches) => {
    let total = 0;
    for (const b of batches) for (const e of b.entries) {
        if (!codes.some(c => isSelfOrDescendant(e.accountCode, c))) continue;
        const cents = toCents(e.value);
        total += (e.type === nature) ? cents : -cents;
    }
    return total;
};

// Grupo em que a conta está alocada (ou null)
const groupOf = (code) => DRE_GROUPS.find(g => state.dreConfig[g.id].includes(code))?.id ?? null;

// ---------- Configuração ----------
export const renderConfiguracaoDRE = () => {
    const grid = document.getElementById('configuracao-grid');
    const resultAccounts = getAnalyticAccounts()
        .filter(a => a.type === 'Receita' || a.type === 'Despesa')
        .sort((a, b) => compareCodes(a.code, b.code));

    const unallocated = resultAccounts.filter(a => !groupOf(a.code));
    document.getElementById('dre-unallocated').innerHTML = unallocated.length
        ? `<i data-lucide="alert-triangle" class="w-4 h-4 inline mr-1"></i> ${unallocated.length} conta(s) de resultado fora da DRE: ${unallocated.map(a => escapeHtml(a.code)).join(', ')}`
        : '<i data-lucide="check-circle" class="w-4 h-4 inline mr-1"></i> Todas as contas de resultado estão mapeadas.';

    grid.innerHTML = DRE_GROUPS.map(group => {
        const items = resultAccounts.map(acc => {
            const current = groupOf(acc.code);
            const checked = current === group.id;
            const elsewhere = current && !checked;
            return `
                <label class="dre-item ${elsewhere ? 'opacity-40' : ''}">
                    <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleDreConfig('${escapeHtml(group.id)}', '${escapeHtml(acc.code)}', this.checked)">
                    <div>
                        <div class="text-sm font-medium">${escapeHtml(acc.code)} - ${escapeHtml(acc.name)}</div>
                        <div class="text-xs muted">${escapeHtml(acc.type)}${elsewhere ? ` · alocada em "${escapeHtml(DRE_GROUPS.find(g => g.id === current).name)}"` : ''}</div>
                    </div>
                </label>`;
        }).join('');

        return `
            <div class="card overflow-hidden flex flex-col h-80">
                <div class="card-head text-sm font-semibold">${escapeHtml(group.name)}</div>
                <div class="p-2 overflow-y-auto flex-1">${items || '<p class="empty">Nenhuma conta de resultado.</p>'}</div>
            </div>`;
    }).join('');
};

export const toggleDreConfig = (groupId, accountCode, checked) => {
    for (const key of Object.keys(state.dreConfig)) state.dreConfig[key] = state.dreConfig[key].filter(c => c !== accountCode);
    if (checked) state.dreConfig[groupId].push(accountCode);
    renderConfiguracaoDRE();
    persistState();
};

// ---------- Demonstração ----------
export const renderDRE = () => {
    const batches = getPeriodBatches();
    document.getElementById('dre-period-label').innerText = periodLabel();

    const val = (groupId) => {
        const g = DRE_GROUPS.find(x => x.id === groupId);
        return groupBalance(state.dreConfig[groupId], g.nature, batches);
    };

    const receitaBruta = val('receitaBruta');
    const deducoes = val('deducoes');
    const receitaLiquida = receitaBruta - deducoes;
    const custos = val('custos');
    const lucroBruto = receitaLiquida - custos;
    const despesasOperacionais = val('despesasOperacionais');
    const outras = val('outrasReceitasDespesas');
    const resultadoLiquido = lucroBruto - despesasOperacionais + outras;

    const header = (title, value) => `<tr class="dre-header"><td>${title}</td><td class="text-right">${formatCents(value)}</td></tr>`;
    const total = (title, value) => `<tr class="dre-total"><td>${title}</td><td class="text-right ${value < 0 ? 'text-danger' : ''}">${formatCents(value)}</td></tr>`;
    const detail = (groupId) => {
        const g = DRE_GROUPS.find(x => x.id === groupId);
        return state.dreConfig[groupId].map(code =>
            `<tr class="dre-detail"><td>${escapeHtml(code)} - ${escapeHtml(getAccountName(code))}</td><td class="text-right">${formatCents(groupBalance([code], g.nature, batches))}</td></tr>`
        ).join('');
    };

    const resultClass = resultadoLiquido >= 0 ? 'dre-result-ok' : 'dre-result-bad';
    document.getElementById('dre-content').innerHTML = `
        <table class="tbl" id="dre-table">
            <tbody>
                ${header('1. RECEITA BRUTA DE VENDAS E SERVIÇOS', receitaBruta)}${detail('receitaBruta')}
                ${header('2. (-) DEDUÇÕES DA RECEITA', deducoes)}${detail('deducoes')}
                ${total('3. (=) RECEITA OPERACIONAL LÍQUIDA', receitaLiquida)}
                ${header('4. (-) CUSTOS DAS VENDAS E SERVIÇOS', custos)}${detail('custos')}
                ${total('5. (=) RESULTADO BRUTO', lucroBruto)}
                ${header('6. (-) DESPESAS OPERACIONAIS', despesasOperacionais)}${detail('despesasOperacionais')}
                ${header('7. (+/-) OUTRAS RECEITAS E DESPESAS', outras)}${detail('outrasReceitasDespesas')}
                <tr class="${resultClass}"><td>(=) RESULTADO LÍQUIDO DO EXERCÍCIO</td><td class="text-right">${formatCents(resultadoLiquido)}</td></tr>
            </tbody>
        </table>`;
};
