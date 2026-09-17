// Ponto de entrada: liga os módulos entre si, registra as telas e expõe
// no `window` as funções chamadas pelos atributos onclick/onchange do HTML.
import { state } from './state.js';
import { registerView, navigate, switchConfigTab, toggleSidebar, closeSidebar, closeConfirm, initConfirmModal, refreshIcons, printPage, exportTableCSV } from './ui.js';
import { toggleAuthMode, handleAuthSubmit, doLogout, watchAuth } from './auth.js';
import { initUserWorkspaces, createNewWorkspace, openNewWorkspaceModal, closeNewWorkspaceModal, confirmNewWorkspace, loadWorkspace, deleteWorkspace, renderWorkspacesList, setOnWorkspaceLoaded, clearSession } from './workspaces.js';
import { renderPlanoContas, addAccount, deleteAccount, promptSubAccount, updateDatalists, importDefaultChart } from './accounts.js';
import { renderCCConfig, addCostCenter, deleteCostCenter } from './costCenters.js';
import { initNovoLote, cancelEditLote, handleLineContaSearch, handleLineCcSearch, updateLoteLine, onLoteValueInput, addNovoLoteLine, removeLoteLine, saveNovoLote, renderConsultaLotes, toggleBatch, editBatch, deleteBatch } from './lotes.js';
import { initRazao, renderRazaoContent, renderBalancete, renderBalanco, setPeriod, setCostCenter, clearPeriod } from './reports.js';
import { openClosingModal, closeClosingModal, onClosingDateChange, onClosingDestChange, confirmClosing } from './closing.js';
import { renderConfiguracaoDRE, toggleDreConfig, renderDRE } from './dre.js';
import { initConciliacao, setConciliacaoAccount, setConciliacaoFilter, onStatementInput, toggleReconcile, reconcileAllVisible } from './reconcile.js';

// ---------- Telas ----------
registerView('planoContas', renderPlanoContas);
registerView('novoLote', initNovoLote);
registerView('consultaLotes', renderConsultaLotes);
registerView('conciliacao', initConciliacao);
registerView('razao', initRazao);
registerView('balancete', renderBalancete);
registerView('balanco', renderBalanco);
registerView('dre', renderDRE);
registerView('configuracao', () => { renderWorkspacesList(); renderConfiguracaoDRE(); renderCCConfig(); });

// Ao abrir uma atividade: atualiza as listas de pesquisa e abre a última tela usada
setOnWorkspaceLoaded(() => {
    updateDatalists();
    navigate(state.activeTab || 'planoContas');
});

// ---------- Handlers usados no HTML ----------
Object.assign(window, {
    // navegação / ui
    navigate, switchConfigTab, toggleSidebar, closeSidebar, closeConfirm, printPage, exportTableCSV,
    // autenticação
    toggleAuthMode, handleAuthSubmit, doLogout,
    // atividades
    createNewWorkspace, openNewWorkspaceModal, closeNewWorkspaceModal, confirmNewWorkspace, loadWorkspace, deleteWorkspace,
    // plano de contas
    addAccount, deleteAccount, promptSubAccount, renderPlanoContas, importDefaultChart,
    // centros de custo
    addCostCenter, deleteCostCenter,
    // lotes
    cancelEditLote, handleLineContaSearch, handleLineCcSearch, updateLoteLine, onLoteValueInput, addNovoLoteLine, removeLoteLine, saveNovoLote,
    renderConsultaLotes, toggleBatch, editBatch, deleteBatch,
    // relatórios
    renderRazaoContent, renderBalancete, setPeriod, setCostCenter, clearPeriod,
    // encerramento do exercício
    openClosingModal, closeClosingModal, onClosingDateChange, onClosingDestChange, confirmClosing,
    // DRE
    toggleDreConfig,
    // conciliação
    setConciliacaoAccount, setConciliacaoFilter, onStatementInput, toggleReconcile, reconcileAllVisible,
});

// Acesso ao estado pelo console do navegador (diagnóstico)
window.__syscontabil = { state, updateDatalists };

// ---------- Inicialização ----------
initConfirmModal();
refreshIcons();

watchAuth({
    onLogin: () => {
        initUserWorkspaces().catch(e => {
            console.error(e);
            document.getElementById('current-workspace-name').innerText = 'Erro ao carregar';
        });
    },
    onLogout: () => {
        clearSession();
        document.getElementById('current-workspace-name').innerText = '--';
    },
});
