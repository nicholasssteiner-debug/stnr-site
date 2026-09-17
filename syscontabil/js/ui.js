// Componentes de interface compartilhados: toasts, modal de confirmação,
// navegação entre telas, abas de configuração e menu lateral (mobile).
import { state } from './state.js';
import { escapeHtml } from './utils.js';

export const refreshIcons = () => { if (window.lucide) window.lucide.createIcons(); };

// ---------- Toast ----------
export const showToast = (msg, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i data-lucide="${type === 'error' ? 'alert-circle' : 'check-circle'}" class="w-4 h-4 shrink-0"></i><span>${escapeHtml(msg)}</span>`;
    container.appendChild(toast);
    refreshIcons();
    requestAnimationFrame(() => toast.classList.add('toast-in'));
    setTimeout(() => {
        toast.classList.remove('toast-in');
        setTimeout(() => toast.remove(), 300);
    }, type === 'error' ? 4500 : 3000);
};

// ---------- Confirmação ----------
let confirmCallback = null;

export const showConfirm = (msg, callback) => {
    document.getElementById('confirm-msg').innerText = msg;
    const modal = document.getElementById('confirm-modal');
    const box = document.getElementById('confirm-modal-box');
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        box.classList.remove('scale-95');
    });
    confirmCallback = callback;
};

export const closeConfirm = () => {
    const modal = document.getElementById('confirm-modal');
    const box = document.getElementById('confirm-modal-box');
    modal.classList.add('opacity-0');
    box.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 250);
    confirmCallback = null;
};

export const initConfirmModal = () => {
    document.getElementById('confirm-btn').addEventListener('click', () => {
        const cb = confirmCallback;
        closeConfirm();
        if (cb) cb();
    });
};

// ---------- Navegação ----------
const TITLES = {
    planoContas: 'Plano de Contas',
    novoLote: 'Novo Lançamento',
    consultaLotes: 'Consulta de Lotes',
    razao: 'Razão Contábil',
    balancete: 'Balancete de Verificação',
    balanco: 'Balanço Patrimonial',
    dre: 'Demonstração do Resultado (DRE)',
    configuracao: 'Configurações',
};

// Cada módulo registra o renderizador da própria tela (evita import circular).
const viewRenderers = {};
export const registerView = (tabId, renderFn) => { viewRenderers[tabId] = renderFn; };

export const navigate = (tabId, params) => {
    if (!document.getElementById(`view-${tabId}`)) tabId = 'planoContas';
    state.activeTab = tabId;   // gravado junto com a próxima alteração de dados; não gera write por clique

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.id === `nav-${tabId}`));
    document.getElementById('header-title').innerText = TITLES[tabId] || tabId;
    document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${tabId}`).classList.remove('hidden');

    closeSidebar();
    if (viewRenderers[tabId]) viewRenderers[tabId](params);
    refreshIcons();
};

// ---------- Abas de Configurações ----------
export const switchConfigTab = (tab) => {
    ['dados', 'dre', 'cc'].forEach(t => {
        document.getElementById(`config-area-${t}`).classList.toggle('hidden', t !== tab);
        document.getElementById(`tab-btn-${t}`).classList.toggle('active', t === tab);
    });
};

// ---------- Menu lateral (mobile) ----------
export const toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-backdrop').classList.toggle('hidden');
};

export const closeSidebar = () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-backdrop').classList.add('hidden');
};

// ---------- Impressão / exportação ----------
export const printPage = () => window.print();

// Exporta uma ou mais <table> (ids separados por vírgula) para CSV
// (separador ";" e vírgula decimal: abre direto no Excel pt-BR).
export const exportTableCSV = (tableIds, filename) => {
    const rows = [];
    for (const id of tableIds.split(',')) {
        const table = document.getElementById(id.trim());
        if (!table) continue;
        if (rows.length) rows.push('');
        for (const tr of table.querySelectorAll('tr')) {
            rows.push([...tr.querySelectorAll('th,td')].map(td => {
                const text = td.innerText.replace(/\s+/g, ' ').trim().replace(/^R\$\s?/, '');
                return `"${text.replace(/"/g, '""')}"`;
            }).join(';'));
        }
    }
    if (!rows.length) { showToast('Nada para exportar.', 'error'); return; }
    const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
};
