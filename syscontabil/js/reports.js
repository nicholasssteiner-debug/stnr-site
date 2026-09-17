// Relatórios: filtros compartilhados (período e departamento), Razão, Balancete
// e Balanço Patrimonial. Todos os cálculos são feitos em centavos inteiros.
//
// Níveis de análise: conta → subconta → departamento (centro de custo).
// O departamento "0" é o totalizador (todos os departamentos).
import { state } from './state.js';
import { toCents, formatCents, formatDateBR, escapeHtml } from './utils.js';
import { navigate } from './ui.js';
import { getAccount, sortedAccounts, hasChildren, isSelfOrDescendant, isDebitNature, isReducing, codeFromInput, getResultAccount } from './accounts.js';

// ---------- Filtros ----------
export const period = { from: '', to: '', cc: '' };   // cc vazio = departamento 0 (todos)

const inPeriod = (date) => (!period.from || date >= period.from) && (!period.to || date <= period.to);

// Partida dentro do departamento selecionado
export const entryInScope = (e) => !period.cc || e.ccId === period.cc;

// Lotes dentro do período selecionado
export const getPeriodBatches = () => state.batches.filter(b => inPeriod(b.date));
// Lotes anteriores ao início do período (para saldo anterior)
export const getOpeningBatches = () => period.from ? state.batches.filter(b => b.date < period.from) : [];
// Lotes até a data final (posição patrimonial)
export const getBatchesUntil = () => state.batches.filter(b => !period.to || b.date <= period.to);

export const setPeriod = (field, value) => {
    period[field] = value || '';
    document.querySelectorAll(`.period-${field}`).forEach(el => { if (el.value !== period[field]) el.value = period[field]; });
    navigate(state.activeTab);
};

export const setCostCenter = (value) => {
    period.cc = value || '';
    document.querySelectorAll('.period-cc').forEach(el => { if (el.value !== period.cc) el.value = period.cc; });
    navigate(state.activeTab);
};

export const clearPeriod = () => {
    period.from = '';
    period.to = '';
    period.cc = '';
    document.querySelectorAll('.period-from, .period-to, .period-cc').forEach(el => { el.value = ''; });
    navigate(state.activeTab);
};

// Preenche os seletores de departamento (0 = totalizador) e mantém a seleção
export const refreshCcSelectors = () => {
    if (period.cc && !state.costCenters.some(c => c.id === period.cc)) period.cc = '';
    const options = '<option value="">0 - Todos os departamentos (totalizador)</option>'
        + state.costCenters.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.id)} - ${escapeHtml(c.name)}</option>`).join('');
    document.querySelectorAll('.period-cc').forEach(el => { el.innerHTML = options; el.value = period.cc; });
};

export const ccLabel = () => {
    if (!period.cc) return 'Departamento 0 (todos)';
    const cc = state.costCenters.find(c => c.id === period.cc);
    return `Departamento ${period.cc}${cc ? ' - ' + cc.name : ''}`;
};

export const periodLabel = () => {
    let p = 'Todo o período';
    if (period.from && period.to) p = `Período: ${formatDateBR(period.from)} a ${formatDateBR(period.to)}`;
    else if (period.from) p = `A partir de ${formatDateBR(period.from)}`;
    else if (period.to) p = `Até ${formatDateBR(period.to)}`;
    return `${p} · ${ccLabel()}`;
};

// Soma débitos/créditos (centavos) de uma conta e de suas descendentes em um conjunto de lotes.
// `cc` restringe ao departamento ('' = todos).
export const sumAccount = (batches, code, cc = period.cc) => {
    let d = 0, c = 0;
    for (const b of batches) for (const e of b.entries) {
        if (!isSelfOrDescendant(e.accountCode, code)) continue;
        if (cc && e.ccId !== cc) continue;
        if (e.type === 'D') d += toCents(e.value); else c += toCents(e.value);
    }
    return { d, c };
};

// Saldo na natureza da conta (positivo = saldo "normal")
const natureBalance = (acc, d, c) => (isDebitNature(acc) ? d - c : c - d);

// Representação "1.234,56 D" / "1.234,56 C"
export const balanceWithSuffix = (acc, bal) => {
    if (bal === 0) return formatCents(0);
    const debit = isDebitNature(acc) ? bal > 0 : bal < 0;
    return `${formatCents(Math.abs(bal))} ${debit ? 'D' : 'C'}`;
};

const sortChrono = (a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt - b.createdAt) || a.id.localeCompare(b.id);

const ccName = (id) => state.costCenters.find(c => c.id === id)?.name ?? '';

// ---------- Razão ----------
export const initRazao = () => {
    refreshCcSelectors();
    document.getElementById('razao-period-label').innerText = periodLabel();
    renderRazaoContent();
};

export const renderRazaoContent = () => {
    const acc = getAccount(codeFromInput(document.getElementById('razao-acc-select').value));
    const area = document.getElementById('razao-content-area');
    if (!acc) { area.classList.add('hidden'); return; }
    area.classList.remove('hidden');

    const debitNature = isDebitNature(acc);
    document.getElementById('razao-acc-info').innerText =
        `${acc.code} - ${acc.name} · Natureza ${debitNature ? 'Devedora' : 'Credora'}${hasChildren(acc.code) ? ' · Visão sintética' : ''} · ${periodLabel()}`;

    const tbody = document.getElementById('razao-tbody');
    const rows = [];

    // Conta automática: o saldo é o resultado (receitas − despesas), não há partidas próprias
    if (acc.role === 'result') {
        const anterior = computeResult(getOpeningBatches(), period.cc);
        const doPeriodo = computeResult(getPeriodBatches(), period.cc);
        const final = anterior + doPeriodo;
        if (period.from) rows.push(`<tr class="row-synth"><td>${formatDateBR(period.from)}</td><td>--</td><td>Resultado acumulado anterior</td><td></td><td></td><td></td><td class="text-right">${balanceWithSuffix(acc, anterior)}</td></tr>`);
        rows.push(`<tr><td>${period.to ? formatDateBR(period.to) : '--'}</td><td>--</td><td>Resultado do período (receitas − despesas) <span class="badge badge-accent">auto</span></td><td>${escapeHtml(period.cc || '0')}</td><td class="text-right">${doPeriodo < 0 ? formatCents(-doPeriodo) : ''}</td><td class="text-right">${doPeriodo > 0 ? formatCents(doPeriodo) : ''}</td><td class="text-right font-medium">${balanceWithSuffix(acc, final)}</td></tr>`);
        rows.push('<tr><td colspan="7" class="empty">Conta automática: não recebe lançamentos manuais. Veja o detalhe na DRE.</td></tr>');
        tbody.innerHTML = rows.join('');
        document.getElementById('razao-t-deb').innerText = formatCents(doPeriodo < 0 ? -doPeriodo : 0);
        document.getElementById('razao-t-cre').innerText = formatCents(doPeriodo > 0 ? doPeriodo : 0);
        document.getElementById('razao-t-sal').innerText = balanceWithSuffix(acc, final);
        return;
    }

    // Saldo anterior ao período
    const opening = sumAccount(getOpeningBatches(), acc.code);
    let running = natureBalance(acc, opening.d, opening.c);
    if (period.from) {
        rows.push(`<tr class="row-synth"><td>${formatDateBR(period.from)}</td><td>--</td><td>Saldo anterior</td><td></td><td></td><td></td><td class="text-right">${balanceWithSuffix(acc, running)}</td></tr>`);
    }

    let tD = 0, tC = 0, found = 0;
    for (const batch of [...getPeriodBatches()].sort(sortChrono)) {
        for (const e of batch.entries) {
            if (!isSelfOrDescendant(e.accountCode, acc.code) || !entryInScope(e)) continue;
            found++;
            const cents = toCents(e.value);
            if (e.type === 'D') tD += cents; else tC += cents;
            running += (e.type === 'D') === debitNature ? cents : -cents;
            const desc = escapeHtml(batch.description)
                + (e.accountCode !== acc.code ? ` <span class="muted">(${escapeHtml(e.accountCode)})</span>` : '')
                + (batch.kind === 'closing' ? ' <span class="badge badge-gray">encerramento</span>' : '')
                + (e.reconciled ? ' <span class="badge badge-green" title="Partida conciliada">✓</span>' : '');
            rows.push(`
                <tr>
                    <td>${formatDateBR(batch.date)}</td>
                    <td class="font-mono">${escapeHtml(batch.id)}</td>
                    <td>${desc}</td>
                    <td class="muted text-xs" title="${escapeHtml(ccName(e.ccId))}">${escapeHtml(e.ccId)}</td>
                    <td class="text-right">${e.type === 'D' ? formatCents(cents) : ''}</td>
                    <td class="text-right">${e.type === 'C' ? formatCents(cents) : ''}</td>
                    <td class="text-right font-medium ${running < 0 ? 'text-danger' : ''}">${balanceWithSuffix(acc, running)}</td>
                </tr>`);
        }
    }

    if (found === 0 && !period.from) rows.push('<tr><td colspan="7" class="empty">Nenhum movimento registrado.</td></tr>');
    else if (found === 0) rows.push('<tr><td colspan="7" class="empty">Nenhum movimento no período.</td></tr>');

    tbody.innerHTML = rows.join('');
    document.getElementById('razao-t-deb').innerText = formatCents(tD);
    document.getElementById('razao-t-cre').innerText = formatCents(tC);
    document.getElementById('razao-t-sal').innerText = balanceWithSuffix(acc, running);
};

// ---------- Balancete ----------
// Níveis: conta → subconta → departamento. Com o departamento 0 (todos) selecionado e mais
// de um centro de custo, cada conta analítica é aberta por departamento; a linha da conta
// é o totalizador.
export const renderBalancete = () => {
    refreshCcSelectors();
    document.getElementById('balancete-period-label').innerText = periodLabel();
    const tbody = document.getElementById('balancete-tbody');
    const periodBatches = getPeriodBatches();
    const openingBatches = getOpeningBatches();
    const byDept = !period.cc && state.costCenters.length > 1 && document.getElementById('balancete-by-dept')?.checked;
    document.getElementById('balancete-by-dept-wrap')?.classList.toggle('hidden', !!period.cc || state.costCenters.length <= 1);

    // Totais gerais direto dos lançamentos do departamento selecionado
    let gD = 0, gC = 0;
    for (const b of periodBatches) for (const e of b.entries) {
        if (!entryInScope(e)) continue;
        if (e.type === 'D') gD += toCents(e.value); else gC += toCents(e.value);
    }

    const rows = [];
    const line = (acc, code, name, openBal, mov, level, cls = '', extra = '') => {
        const finalBal = openBal + natureBalance(acc, mov.d, mov.c);
        rows.push(`
            <tr class="${cls}">
                <td class="font-mono" style="padding-left:${0.75 + (level - 1) * 0.9}rem">${code}</td>
                <td>${name}${extra}</td>
                <td class="text-right muted">${balanceWithSuffix(acc, openBal)}</td>
                <td class="text-right">${formatCents(mov.d)}</td>
                <td class="text-right">${formatCents(mov.c)}</td>
                <td class="text-right font-medium ${finalBal < 0 ? 'text-danger' : ''}">${balanceWithSuffix(acc, finalBal)}</td>
            </tr>`);
    };

    for (const acc of sortedAccounts()) {
        const mov = sumAccount(periodBatches, acc.code);
        const open = sumAccount(openingBatches, acc.code);
        const openBal = natureBalance(acc, open.d, open.c);
        if (mov.d === 0 && mov.c === 0 && openBal === 0) continue;

        const level = acc.code.split('.').length;
        const synthetic = hasChildren(acc.code);
        line(acc, escapeHtml(acc.code), escapeHtml(acc.name), openBal, mov, level, synthetic ? 'row-synth' : '',
            byDept && !synthetic ? ' <span class="muted text-xs">(depto 0 - total)</span>' : '');

        // Nível departamento (só nas analíticas)
        if (byDept && !synthetic) {
            for (const cc of state.costCenters) {
                const movCc = sumAccount(periodBatches, acc.code, cc.id);
                const openCc = sumAccount(openingBatches, acc.code, cc.id);
                const openBalCc = natureBalance(acc, openCc.d, openCc.c);
                if (movCc.d === 0 && movCc.c === 0 && openBalCc === 0) continue;
                line(acc, `<span class="muted">${escapeHtml(cc.id)}</span>`, `<span class="muted">${escapeHtml(cc.name)}</span>`, openBalCc, movCc, level + 1, 'row-dept');
            }
        }
    }

    tbody.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="6" class="empty">Nenhum movimento no período.</td></tr>';
    document.getElementById('balancete-t-deb').innerText = formatCents(gD);
    document.getElementById('balancete-t-cre').innerText = formatCents(gC);
    const diff = gD - gC;
    const diffEl = document.getElementById('balancete-t-dif');
    diffEl.innerText = diff === 0 ? 'Fechado ✓' : `${formatCents(Math.abs(diff))} ${diff > 0 ? 'D' : 'C'}`;
    diffEl.classList.toggle('text-danger', diff !== 0);
    diffEl.title = diff !== 0 && period.cc ? 'Um departamento isolado pode não fechar: a contrapartida do lançamento pode estar em outro departamento.' : '';
};

// ---------- Resultado do exercício (receitas − despesas), em centavos ----------
// `cc` restringe ao departamento ('' = todos). Inclui lotes de encerramento: após o
// encerramento, o resultado volta a zero e o saldo passa para Lucros/Prejuízos Acumulados.
export const computeResult = (batches, cc = '') => {
    let resultado = 0;
    for (const b of batches) for (const e of b.entries) {
        const acc = getAccount(e.accountCode);
        if (!acc || (cc && e.ccId !== cc)) continue;
        const cents = toCents(e.value);
        if (acc.type === 'Receita') resultado += e.type === 'C' ? cents : -cents;
        else if (acc.type === 'Despesa') resultado -= e.type === 'D' ? cents : -cents;
    }
    return resultado;
};

// ---------- Balanço Patrimonial ----------
export const renderBalanco = () => {
    const content = document.getElementById('balanco-content');
    const batches = getBatchesUntil();
    document.getElementById('balanco-period-label').innerText = period.to ? `Posição em ${formatDateBR(period.to)}` : 'Posição atual (todos os lançamentos)';

    const resultado = computeResult(batches);
    const resultAcc = getResultAccount();

    let totalAtivo = 0, totalPassivo = 0;
    const ativo = [], passivo = [];

    for (const acc of sortedAccounts()) {
        const { d, c } = sumAccount(batches, acc.code, '');   // Balanço é sempre consolidado
        const synthetic = hasChildren(acc.code);
        // A conta de resultado (e suas contas-pai) recebe o resultado automaticamente
        const carriesResult = resultAcc && acc.type === 'Passivo' && isSelfOrDescendant(resultAcc.code, acc.code);
        if (d === 0 && c === 0 && !carriesResult) continue;

        // Somente analíticas entram nos totais (as sintéticas já as agregam)
        if (!synthetic) {
            if (acc.type === 'Ativo') totalAtivo += d - c;
            else if (acc.type === 'Passivo') totalPassivo += c - d;
        }

        // Valor exibido no grupo: redutoras aparecem negativas
        let shown = acc.type === 'Ativo' ? d - c : c - d;
        if (carriesResult) shown += resultado;
        const line = { code: acc.code, name: acc.name, val: shown, reducing: isReducing(acc), synthetic, level: acc.code.split('.').length, auto: acc.role === 'result' };
        if (acc.type === 'Ativo') ativo.push(line);
        else if (acc.type === 'Passivo') passivo.push(line);
    }

    const renderLines = (lines) => lines.length === 0
        ? '<tr><td colspan="2" class="empty">Nenhum saldo.</td></tr>'
        : lines.map(l => `
            <tr class="${l.synthetic ? 'row-synth' : ''}">
                <td style="padding-left:${0.75 + (l.level - 1) * 0.9}rem" class="${l.reducing ? 'muted' : ''}">${escapeHtml(l.code)} - ${escapeHtml(l.name)}${l.auto ? ' <span class="badge badge-accent" title="Receitas − despesas do período">auto</span>' : ''}</td>
                <td class="text-right ${l.val < 0 ? 'text-danger' : ''}">${formatCents(l.val)}</td>
            </tr>`).join('');

    // Sem conta automática no plano, o resultado aparece como linha avulsa do PL
    const fallbackRow = resultAcc ? '' :
        `<tr class="row-synth"><td>Resultado do Exercício (Receitas − Despesas) <span class="muted text-xs">— importe o plano padrão para ter a conta "Superávit ou Déficit do Exercício"</span></td><td class="text-right ${resultado < 0 ? 'text-danger' : 'text-accent'}">${formatCents(resultado)}</td></tr>`;

    const totalPL = totalPassivo + resultado;
    const fechado = totalAtivo === totalPL;

    content.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x divide-[var(--border)]">
            <div>
                <div class="group-title">Ativo</div>
                <table class="tbl compact" id="balanco-ativo-table"><tbody>${renderLines(ativo)}</tbody></table>
                <div class="total-bar"><span>Total do Ativo</span><span>${formatCents(totalAtivo)}</span></div>
            </div>
            <div>
                <div class="group-title">Passivo e Patrimônio Líquido</div>
                <table class="tbl compact" id="balanco-passivo-table"><tbody>${renderLines(passivo)}${fallbackRow}</tbody></table>
                <div class="total-bar"><span>Total Passivo + PL</span><span>${formatCents(totalPL)}</span></div>
            </div>
        </div>
        <div class="p-3 text-center text-sm ${fechado ? 'text-ok' : 'text-danger'}">
            ${fechado ? 'Ativo = Passivo + PL ✓' : `Diferença entre Ativo e Passivo + PL: ${formatCents(Math.abs(totalAtivo - totalPL))}`}
        </div>`;
};
