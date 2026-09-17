// Relatórios: filtro de período compartilhado, Razão, Balancete e Balanço Patrimonial.
// Todos os cálculos são feitos em centavos inteiros.
import { state } from './state.js';
import { toCents, formatCents, formatDateBR, escapeHtml } from './utils.js';
import { navigate } from './ui.js';
import { getAccount, sortedAccounts, hasChildren, isSelfOrDescendant, isDebitNature, isReducing, codeFromInput } from './accounts.js';

// ---------- Período ----------
export const period = { from: '', to: '' };

const inPeriod = (date) => (!period.from || date >= period.from) && (!period.to || date <= period.to);

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

export const clearPeriod = () => {
    period.from = '';
    period.to = '';
    document.querySelectorAll('.period-from, .period-to').forEach(el => { el.value = ''; });
    navigate(state.activeTab);
};

export const periodLabel = () => {
    if (period.from && period.to) return `Período: ${formatDateBR(period.from)} a ${formatDateBR(period.to)}`;
    if (period.from) return `A partir de ${formatDateBR(period.from)}`;
    if (period.to) return `Até ${formatDateBR(period.to)}`;
    return 'Todo o período';
};

// Soma débitos/créditos (centavos) de uma conta e de suas descendentes em um conjunto de lotes
const sumAccount = (batches, code) => {
    let d = 0, c = 0;
    for (const b of batches) for (const e of b.entries) {
        if (!isSelfOrDescendant(e.accountCode, code)) continue;
        if (e.type === 'D') d += toCents(e.value); else c += toCents(e.value);
    }
    return { d, c };
};

// Saldo na natureza da conta (positivo = saldo "normal")
const natureBalance = (acc, d, c) => (isDebitNature(acc) ? d - c : c - d);

// Representação "1.234,56 D" / "1.234,56 C"
const balanceWithSuffix = (acc, bal) => {
    if (bal === 0) return formatCents(0);
    const debit = isDebitNature(acc) ? bal > 0 : bal < 0;
    return `${formatCents(Math.abs(bal))} ${debit ? 'D' : 'C'}`;
};

const sortChrono = (a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt - b.createdAt) || a.id.localeCompare(b.id);

// ---------- Razão ----------
export const initRazao = () => {
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

    // Saldo anterior ao período
    const opening = sumAccount(getOpeningBatches(), acc.code);
    let running = natureBalance(acc, opening.d, opening.c);
    if (period.from) {
        rows.push(`<tr class="row-synth"><td>${formatDateBR(period.from)}</td><td>--</td><td>Saldo anterior</td><td></td><td></td><td class="text-right">${balanceWithSuffix(acc, running)}</td></tr>`);
    }

    let tD = 0, tC = 0, found = 0;
    for (const batch of [...getPeriodBatches()].sort(sortChrono)) {
        for (const e of batch.entries) {
            if (!isSelfOrDescendant(e.accountCode, acc.code)) continue;
            found++;
            const cents = toCents(e.value);
            if (e.type === 'D') tD += cents; else tC += cents;
            running += (e.type === 'D') === debitNature ? cents : -cents;
            const desc = escapeHtml(batch.description)
                + (e.accountCode !== acc.code ? ` <span class="muted">(${escapeHtml(e.accountCode)})</span>` : '')
                + (e.reconciled ? ' <span class="badge badge-green" title="Partida conciliada">✓</span>' : '');
            rows.push(`
                <tr>
                    <td>${formatDateBR(batch.date)}</td>
                    <td class="font-mono">${escapeHtml(batch.id)}</td>
                    <td>${desc}</td>
                    <td class="text-right">${e.type === 'D' ? formatCents(cents) : ''}</td>
                    <td class="text-right">${e.type === 'C' ? formatCents(cents) : ''}</td>
                    <td class="text-right font-medium ${running < 0 ? 'text-danger' : ''}">${balanceWithSuffix(acc, running)}</td>
                </tr>`);
        }
    }

    if (found === 0 && !period.from) rows.push('<tr><td colspan="6" class="empty">Nenhum movimento registrado.</td></tr>');
    else if (found === 0) rows.push('<tr><td colspan="6" class="empty">Nenhum movimento no período.</td></tr>');

    tbody.innerHTML = rows.join('');
    document.getElementById('razao-t-deb').innerText = formatCents(tD);
    document.getElementById('razao-t-cre').innerText = formatCents(tC);
    document.getElementById('razao-t-sal').innerText = balanceWithSuffix(acc, running);
};

// ---------- Balancete ----------
export const renderBalancete = () => {
    document.getElementById('balancete-period-label').innerText = periodLabel();
    const tbody = document.getElementById('balancete-tbody');
    const periodBatches = getPeriodBatches();
    const openingBatches = getOpeningBatches();

    // Totais gerais direto dos lançamentos (sempre batem com o que foi lançado)
    let gD = 0, gC = 0;
    for (const b of periodBatches) for (const e of b.entries) (e.type === 'D' ? (gD += toCents(e.value)) : (gC += toCents(e.value)));

    const rows = [];
    for (const acc of sortedAccounts()) {
        const mov = sumAccount(periodBatches, acc.code);
        const open = sumAccount(openingBatches, acc.code);
        const openBal = natureBalance(acc, open.d, open.c);
        if (mov.d === 0 && mov.c === 0 && openBal === 0) continue;

        const finalBal = openBal + natureBalance(acc, mov.d, mov.c);
        const level = acc.code.split('.').length;
        rows.push(`
            <tr class="${hasChildren(acc.code) ? 'row-synth' : ''}">
                <td class="font-mono" style="padding-left:${0.75 + (level - 1) * 0.9}rem">${escapeHtml(acc.code)}</td>
                <td>${escapeHtml(acc.name)}</td>
                <td class="text-right muted">${balanceWithSuffix(acc, openBal)}</td>
                <td class="text-right">${formatCents(mov.d)}</td>
                <td class="text-right">${formatCents(mov.c)}</td>
                <td class="text-right font-medium ${finalBal < 0 ? 'text-danger' : ''}">${balanceWithSuffix(acc, finalBal)}</td>
            </tr>`);
    }

    tbody.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="6" class="empty">Nenhum movimento no período.</td></tr>';
    document.getElementById('balancete-t-deb').innerText = formatCents(gD);
    document.getElementById('balancete-t-cre').innerText = formatCents(gC);
    const diff = gD - gC;
    const diffEl = document.getElementById('balancete-t-dif');
    diffEl.innerText = diff === 0 ? 'Fechado ✓' : `${formatCents(Math.abs(diff))} ${diff > 0 ? 'D' : 'C'}`;
    diffEl.classList.toggle('text-danger', diff !== 0);
};

// ---------- Balanço Patrimonial ----------
export const renderBalanco = () => {
    const content = document.getElementById('balanco-content');
    const batches = getBatchesUntil();
    document.getElementById('balanco-period-label').innerText = period.to ? `Posição em ${formatDateBR(period.to)}` : 'Posição atual (todos os lançamentos)';

    let totalAtivo = 0, totalPassivo = 0, resultado = 0;
    const ativo = [], passivo = [];

    for (const acc of sortedAccounts()) {
        const { d, c } = sumAccount(batches, acc.code);
        if (d === 0 && c === 0) continue;
        const synthetic = hasChildren(acc.code);

        // Somente analíticas entram nos totais (as sintéticas já as agregam)
        if (!synthetic) {
            if (acc.type === 'Ativo') totalAtivo += d - c;
            else if (acc.type === 'Passivo') totalPassivo += c - d;
            else if (acc.type === 'Receita') resultado += c - d;
            else if (acc.type === 'Despesa') resultado -= d - c;
        }

        // Valor exibido no grupo: redutoras aparecem negativas
        const shown = acc.type === 'Ativo' ? d - c : c - d;
        const line = { code: acc.code, name: acc.name, val: shown, reducing: isReducing(acc), synthetic, level: acc.code.split('.').length };
        if (acc.type === 'Ativo') ativo.push(line);
        else if (acc.type === 'Passivo') passivo.push(line);
    }

    const renderLines = (lines) => lines.length === 0
        ? '<tr><td colspan="2" class="empty">Nenhum saldo.</td></tr>'
        : lines.map(l => `
            <tr class="${l.synthetic ? 'row-synth' : ''}">
                <td style="padding-left:${0.75 + (l.level - 1) * 0.9}rem" class="${l.reducing ? 'muted' : ''}">${escapeHtml(l.code)} - ${escapeHtml(l.name)}</td>
                <td class="text-right ${l.val < 0 ? 'text-danger' : ''}">${formatCents(l.val)}</td>
            </tr>`).join('');

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
                <table class="tbl compact" id="balanco-passivo-table">
                    <tbody>
                        ${renderLines(passivo)}
                        <tr class="row-synth"><td>Resultado do Exercício (Receitas - Despesas)</td><td class="text-right ${resultado < 0 ? 'text-danger' : 'text-accent'}">${formatCents(resultado)}</td></tr>
                    </tbody>
                </table>
                <div class="total-bar"><span>Total Passivo + PL</span><span>${formatCents(totalPL)}</span></div>
            </div>
        </div>
        <div class="p-3 text-center text-sm ${fechado ? 'text-ok' : 'text-danger'}">
            ${fechado ? 'Ativo = Passivo + PL ✓' : `Diferença entre Ativo e Passivo + PL: ${formatCents(Math.abs(totalAtivo - totalPL))}`}
        </div>`;
};
