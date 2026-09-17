// DRE: configuração dos grupos e demonstração do resultado do período.
import { state, DRE_GROUPS } from './state.js';
import { toCents, formatCents, escapeHtml, compareCodes } from './utils.js';
import { persistState } from './workspaces.js';
import { getAccountName, getStandardAccounts, isAnalytic, getChildAccounts, isSelfOrDescendant, displayCode } from './accounts.js';
import { getPeriodBatches, periodLabel, entryInScope, refreshCcSelectors } from './reports.js';

// Saldo (centavos) das contas listadas, na natureza do grupo: 'C' soma créditos, 'D' soma débitos
const groupBalance = (codes, nature, batches) => {
    let total = 0;
    for (const b of batches) for (const e of b.entries) {
        if (!entryInScope(e) || !codes.some(c => isSelfOrDescendant(e.accountCode, c))) continue;
        const cents = toCents(e.value);
        total += (e.type === nature) ? cents : -cents;
    }
    return total;
};

// Grupo em que a conta está alocada (ou null). Subcontas herdam o grupo da conta-mãe.
const groupOf = (code) => DRE_GROUPS.find(g => state.dreConfig[g.id].some(c => isSelfOrDescendant(code, c)))?.id ?? null;

// ---------- Configuração ----------
export const renderConfiguracaoDRE = () => {
    const grid = document.getElementById('configuracao-grid');
    // Contas de resultado mapeáveis: analíticas ou contas cujas filhas são só subcontas
    // (as subcontas não aparecem aqui: herdam o grupo da conta)
    const resultAccounts = getStandardAccounts()
        .filter(a => (a.type === 'Receita' || a.type === 'Despesa') && (isAnalytic(a.code) || getChildAccounts(a.code).every(c => c.sub)))
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
    refreshCcSelectors();
    // Lotes de encerramento zeram as contas de resultado; ficam fora da DRE para ela continuar informativa
    const batches = getPeriodBatches().filter(b => b.kind !== 'closing');
    document.getElementById('dre-period-label').innerText = periodLabel() + (getPeriodBatches().some(b => b.kind === 'closing') ? ' · lotes de encerramento não considerados' : '');

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
    const resultadoOperacional = lucroBruto - despesasOperacionais;
    const financeiro = val('resultadoFinanceiro');
    const outras = val('outrasReceitasDespesas');
    const resultadoAntesIR = resultadoOperacional + financeiro + outras;
    const impostos = val('impostosResultado');
    const resultadoLiquido = resultadoAntesIR - impostos;

    const header = (title, value) => `<tr class="dre-header"><td>${title}</td><td class="text-right">${formatCents(value)}</td></tr>`;
    const total = (title, value) => `<tr class="dre-total"><td>${title}</td><td class="text-right ${value < 0 ? 'text-danger' : ''}">${formatCents(value)}</td></tr>`;
    const detail = (groupId) => {
        const g = DRE_GROUPS.find(x => x.id === groupId);
        // Só detalha contas com movimento no período (o plano completo tem centenas de contas)
        return state.dreConfig[groupId].map(code => {
            const v = groupBalance([code], g.nature, batches);
            return v === 0 ? '' : `<tr class="dre-detail"><td>${escapeHtml(displayCode(code))} - ${escapeHtml(getAccountName(code))}</td><td class="text-right ${v < 0 ? 'text-danger' : ''}">${formatCents(v)}</td></tr>`;
        }).join('');
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
                ${total('7. (=) RESULTADO OPERACIONAL', resultadoOperacional)}
                ${header('8. (+/-) RESULTADO FINANCEIRO', financeiro)}${detail('resultadoFinanceiro')}
                ${header('9. (+/-) OUTRAS RECEITAS E DESPESAS', outras)}${detail('outrasReceitasDespesas')}
                ${total('10. (=) RESULTADO ANTES DO IRPJ E DA CSLL', resultadoAntesIR)}
                ${header('11. (-) IRPJ E CSLL', impostos)}${detail('impostosResultado')}
                <tr class="${resultClass}"><td>(=) RESULTADO LÍQUIDO DO EXERCÍCIO</td><td class="text-right">${formatCents(resultadoLiquido)}</td></tr>
            </tbody>
        </table>`;
};
