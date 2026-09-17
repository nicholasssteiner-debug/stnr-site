// Centros de custo: cadastro, exclusão e tela de configuração.
import { state } from './state.js';
import { escapeHtml } from './utils.js';
import { showToast, showConfirm, refreshIcons } from './ui.js';
import { persistState } from './workspaces.js';
import { updateDatalists } from './accounts.js';

export const getCostCenter = (id) => state.costCenters.find(c => c.id === id);
export const getCostCenterName = (id) => getCostCenter(id)?.name ?? id;

const countCcEntries = (id) =>
    state.batches.reduce((n, b) => n + b.entries.filter(e => e.ccId === id).length, 0);

export const renderCCConfig = () => {
    const tbody = document.getElementById('cc-tbody');
    tbody.innerHTML = state.costCenters.map((cc, i) => {
        const used = countCcEntries(cc.id);
        return `
            <tr>
                <td class="font-mono font-semibold">${escapeHtml(cc.id)} ${i === 0 ? '<span class="badge badge-accent ml-2">Padrão</span>' : ''}</td>
                <td>${escapeHtml(cc.name)} ${used ? `<span class="muted text-xs ml-2">${used} lçto(s)</span>` : ''}</td>
                <td class="text-center">
                    ${i !== 0
                        ? `<button onclick="deleteCostCenter('${escapeHtml(cc.id)}')" class="icon-btn danger" title="${used ? 'Centro de custo em uso' : 'Excluir'}" ${used ? 'disabled' : ''}><i data-lucide="trash-2" class="w-4 h-4"></i></button>`
                        : '<span class="muted text-xs">Bloqueado</span>'}
                </td>
            </tr>`;
    }).join('');
    refreshIcons();
};

export const addCostCenter = (e) => {
    e.preventDefault();
    const idInput = document.getElementById('cc-id-input');
    const nameInput = document.getElementById('cc-name-input');
    const id = idInput.value.trim().toUpperCase();
    const name = nameInput.value.trim();

    if (!id || !name) { showToast('Informe a sigla e o nome do centro de custo.', 'error'); return; }
    if (id.includes(' - ')) { showToast('A sigla não pode conter " - ".', 'error'); return; }
    if (getCostCenter(id)) { showToast('Já existe um centro de custo com essa sigla.', 'error'); return; }

    state.costCenters.push({ id, name });
    updateDatalists();
    idInput.value = '';
    nameInput.value = '';
    renderCCConfig();
    persistState();
    showToast('Centro de custo adicionado!');
};

export const deleteCostCenter = (id) => {
    const used = countCcEntries(id);
    if (used > 0) {
        showToast(`O centro de custo ${id} está em ${used} lançamento(s) e não pode ser excluído.`, 'error');
        return;
    }
    showConfirm(`Excluir o centro de custo ${id}?`, () => {
        state.costCenters = state.costCenters.filter(c => c.id !== id);
        updateDatalists();
        renderCCConfig();
        persistState();
        showToast('Centro de custo excluído.');
    });
};
