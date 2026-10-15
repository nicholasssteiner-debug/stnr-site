// Ponto de entrada: liga os módulos entre si, registra as telas e expõe
// no `window` as funções chamadas pelos atributos onclick/onchange do HTML.
import { state } from './state.js';
import { registerView, navigate, switchConfigTab, toggleSidebar, closeSidebar, closeConfirm, initConfirmModal, refreshIcons, printPage, exportTableCSV } from './ui.js';
import { toggleAuthMode, handleAuthSubmit, doLogout, watchAuth } from './auth.js';
import { initUserWorkspaces, createNewWorkspace, openNewWorkspaceModal, closeNewWorkspaceModal, confirmNewWorkspace, loadWorkspace, deleteWorkspace, renderWorkspacesList, setOnWorkspaceLoaded, clearSession } from './workspaces.js';
import { renderPlanoContas, addAccount, deleteAccount, promptSubAccount, cancelSubAccountMode, updateDatalists, importDefaultChart } from './accounts.js';
import { renderCCConfig, addCostCenter, deleteCostCenter } from './costCenters.js';
import { initNovoLote, cancelEditLote, handleLineContaSearch, handleLineCcSearch, updateLoteLine, onLoteValueInput, addNovoLoteLine, removeLoteLine, saveNovoLote, renderConsultaLotes, toggleBatch, editBatch, deleteBatch } from './lotes.js';
import { initRazao, renderRazaoContent, onRazaoContaChange, onRazaoSubChange, renderBalancete, renderBalanco, setPeriod, setCostCenter, clearPeriod } from './reports.js';
import { openClosingModal, closeClosingModal, onClosingDateChange, onClosingDestChange, confirmClosing } from './closing.js';
import { renderConfiguracaoDRE, toggleDreConfig, renderDRE } from './dre.js';
import { initConciliacao, setConciliacaoAccount, setConciliacaoSub, setConciliacaoFilter, onStatementInput, toggleReconcile, reconcileAllVisible } from './reconcile.js';
import { renderDracmaPanel, linkDracma, syncDracmaNow, openDracmaWorkspace, autoSyncDracma } from './dracma.js';

// ---------- Telas ----------
registerView('planoContas', renderPlanoContas);
registerView('novoLote', initNovoLote);
registerView('consultaLotes', renderConsultaLotes);
registerView('conciliacao', initConciliacao);
registerView('razao', initRazao);
registerView('balancete', renderBalancete);
registerView('balanco', renderBalanco);
registerView('dre', renderDRE);
registerView('configuracao', () => { renderWorkspacesList(); renderConfiguracaoDRE(); renderCCConfig(); renderDracmaPanel(); });

// Ao abrir uma atividade: atualiza as listas de pesquisa e abre a última tela usada;
// na atividade STNR - DRACMA, aplica as subcontas e os lotes enviados pelo DRACMA
setOnWorkspaceLoaded(() => {
    updateDatalists();
    navigate(state.activeTab || 'planoContas');
    autoSyncDracma();
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
    addAccount, deleteAccount, promptSubAccount, cancelSubAccountMode, renderPlanoContas, importDefaultChart,
    // centros de custo
    addCostCenter, deleteCostCenter,
    // lotes
    cancelEditLote, handleLineContaSearch, handleLineCcSearch, updateLoteLine, onLoteValueInput, addNovoLoteLine, removeLoteLine, saveNovoLote,
    renderConsultaLotes, toggleBatch, editBatch, deleteBatch,
    // relatórios
    renderRazaoContent, onRazaoContaChange, onRazaoSubChange, renderBalancete, setPeriod, setCostCenter, clearPeriod,
    // encerramento do exercício
    openClosingModal, closeClosingModal, onClosingDateChange, onClosingDestChange, confirmClosing,
    // DRE
    toggleDreConfig,
    // conciliação
    setConciliacaoAccount, setConciliacaoSub, setConciliacaoFilter, onStatementInput, toggleReconcile, reconcileAllVisible,
    // integração DRACMA
    renderDracmaPanel, linkDracma, syncDracmaNow, openDracmaWorkspace,
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
