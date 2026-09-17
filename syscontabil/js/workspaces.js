// Persistência na nuvem (Firestore) e gestão de "Atividades" (workspaces).
//
// Estrutura:
//   users/{uid}/workspaces/{wsId}                 -> { workspaceName, createdAt, updatedAt, state }
//   users/{uid}/workspaces/{wsId}/batches/{loteId} -> um documento por lote
//
// Os lotes ficam numa subcoleção (e não dentro do documento da atividade) para não
// esbarrar no limite de 1 MiB por documento do Firestore. Atividades antigas que ainda
// tenham `state.batches` embutido são migradas automaticamente na primeira abertura.
import { db, collection, doc, setDoc, getDoc, getDocs, deleteDoc, writeBatch } from './firebase.js';
import { state, session, resetState, normalizeState, normalizeBatch, createDefaultState } from './state.js';
import { escapeHtml, formatDateTimeBR, padSeq } from './utils.js';
import { showToast, showConfirm, refreshIcons } from './ui.js';

const SAVE_DELAY_MS = 700;
const CHUNK = 400; // limite do writeBatch é 500 operações

let onWorkspaceLoaded = () => {};
export const setOnWorkspaceLoaded = (fn) => { onWorkspaceLoaded = fn; };

const wsRef = (wsId) => doc(db, 'users', session.user.uid, 'workspaces', wsId);
const batchesRef = (wsId) => collection(db, 'users', session.user.uid, 'workspaces', wsId, 'batches');
const batchRef = (wsId, batchId) => doc(db, 'users', session.user.uid, 'workspaces', wsId, 'batches', batchId);

// Estado da atividade sem os lotes (que vivem na subcoleção)
const stateWithoutBatches = () => {
    const { batches, ...rest } = state;
    return rest;
};

// ---------- Gravação do estado (debounced) ----------
let saveTimer = null;
let savePending = false;

const writeState = async () => {
    savePending = false;
    if (!session.user || !session.workspaceId) return;
    try {
        const now = Date.now();
        await setDoc(wsRef(session.workspaceId), {
            state: stateWithoutBatches(),
            workspaceName: state.workspaceName,
            updatedAt: now,
        }, { merge: true });
        touchCache(session.workspaceId, now);
    } catch (e) {
        console.error('Erro ao salvar:', e);
        showToast('Erro ao sincronizar com a nuvem. Verifique a conexão.', 'error');
    }
};

// Agenda a gravação do estado (várias alterações seguidas viram um único write).
export const persistState = () => {
    savePending = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeState, SAVE_DELAY_MS);
};

// Grava imediatamente o que estiver pendente (usado antes de trocar de atividade).
export const flushPending = async () => {
    clearTimeout(saveTimer);
    if (savePending) await writeState();
};

// ---------- Lotes ----------
export const persistBatch = async (batch) => {
    if (!session.user || !session.workspaceId) return;
    try {
        await setDoc(batchRef(session.workspaceId, batch.id), batch);
        persistState(); // nextBatchSeq / updatedAt
    } catch (e) {
        console.error('Erro ao salvar lote:', e);
        showToast('Erro ao salvar o lote na nuvem.', 'error');
    }
};

export const removeBatch = async (batchId) => {
    if (!session.user || !session.workspaceId) return;
    try {
        await deleteDoc(batchRef(session.workspaceId, batchId));
        persistState();
    } catch (e) {
        console.error('Erro ao excluir lote:', e);
        showToast('Erro ao excluir o lote na nuvem.', 'error');
    }
};

const writeBatchesChunked = async (wsId, batches) => {
    for (let i = 0; i < batches.length; i += CHUNK) {
        const wb = writeBatch(db);
        batches.slice(i, i + CHUNK).forEach(b => wb.set(batchRef(wsId, b.id), b));
        await wb.commit();
    }
};

const deleteAllBatches = async (wsId) => {
    const qs = await getDocs(batchesRef(wsId));
    const refs = qs.docs.map(d => d.ref);
    for (let i = 0; i < refs.length; i += CHUNK) {
        const wb = writeBatch(db);
        refs.slice(i, i + CHUNK).forEach(r => wb.delete(r));
        await wb.commit();
    }
};

// Corrige IDs duplicados herdados da versão antiga (LOTE-0003 repetido, por exemplo)
const dedupeBatchIds = (batches, startSeq) => {
    const seen = new Set();
    let seq = startSeq;
    for (const b of batches) {
        if (seen.has(b.id)) {
            while (seen.has(`LOTE-${padSeq(seq)}`)) seq++;
            b.id = `LOTE-${padSeq(seq++)}`;
        }
        seen.add(b.id);
    }
    return seq;
};

// ---------- Carregar uma atividade ----------
const loadWorkspaceData = async (wsId) => {
    const snap = await getDoc(wsRef(wsId));
    if (!snap.exists()) return null;
    const data = snap.data();

    const normalized = normalizeState(data.state, data.workspaceName);
    const embedded = normalized.batches; // lotes ainda dentro do documento (formato antigo)

    const qs = await getDocs(batchesRef(wsId));
    const fromSub = qs.docs.map(d => normalizeBatch({ id: d.id, ...d.data() }));

    let batches = fromSub;
    let needsRewrite = false;

    if (embedded.length > 0) {
        // Migração: move os lotes embutidos para a subcoleção
        const known = new Set(fromSub.map(b => b.id));
        const toMigrate = embedded.filter(b => !known.has(b.id));
        normalized.nextBatchSeq = dedupeBatchIds(toMigrate, normalized.nextBatchSeq);
        await writeBatchesChunked(wsId, toMigrate);
        batches = [...fromSub, ...toMigrate];
        needsRewrite = true;
    }

    normalized.batches = batches;
    return { normalized, needsRewrite, createdAt: data.createdAt };
};

const activate = async (wsId, loaded) => {
    session.workspaceId = wsId;
    resetState(loaded.normalized);

    if (loaded.needsRewrite) {
        // Regrava sem `batches` (sem merge, para remover o campo antigo)
        await setDoc(wsRef(wsId), {
            state: stateWithoutBatches(),
            workspaceName: state.workspaceName,
            createdAt: loaded.createdAt || Date.now(),
            updatedAt: Date.now(),
        });
    }

    document.getElementById('current-workspace-name').innerText = state.workspaceName;
    onWorkspaceLoaded();
};

export const loadWorkspace = async (wsId) => {
    if (!session.user || wsId === session.workspaceId) return;
    try {
        await flushPending();
        const loaded = await loadWorkspaceData(wsId);
        if (!loaded) { showToast('Atividade não encontrada.', 'error'); return; }
        await activate(wsId, loaded);
        renderWorkspacesList();
        showToast('Atividade carregada com sucesso!');
    } catch (e) {
        console.error(e);
        showToast('Erro ao carregar a atividade.', 'error');
    }
};

// ---------- Criar / excluir ----------
// Cria uma atividade e a torna a atual.
//   copy = true  -> cópia da atividade aberta (plano, lotes e configurações)
//   copy = false -> começa do zero (plano de contas padrão, sem lançamentos)
export const createWorkspace = async (name, copy) => {
    name = String(name || '').trim();
    if (!name) { showToast('Dê um nome à nova atividade.', 'error'); return false; }
    if (!session.user) return false;

    try {
        await flushPending();
        const id = 'ws_' + Date.now();
        const now = Date.now();
        const next = copy ? JSON.parse(JSON.stringify(state)) : createDefaultState();
        next.workspaceName = name;
        next.activeTab = copy ? state.activeTab : 'planoContas';

        session.workspaceId = id;
        resetState(next);

        await setDoc(wsRef(id), {
            state: stateWithoutBatches(),
            workspaceName: name,
            createdAt: now,
            updatedAt: now,
        });
        if (state.batches.length) await writeBatchesChunked(id, state.batches);

        document.getElementById('current-workspace-name').innerText = name;
        session.workspaces.unshift({ id, workspaceName: name, updatedAt: now });
        onWorkspaceLoaded();
        renderWorkspacesList();
        showToast(copy ? 'Cópia salva como nova atividade!' : `Atividade "${name}" criada do zero.`);
        return true;
    } catch (e) {
        console.error(e);
        showToast('Erro ao criar a atividade.', 'error');
        return false;
    }
};

// Botão "Salvar cópia" da tela de Configurações
export const createNewWorkspace = async () => {
    const nameInput = document.getElementById('ws-name-input');
    if (await createWorkspace(nameInput.value, true)) nameInput.value = '';
};

// ---------- Modal "+" (nova atividade) ----------
export const openNewWorkspaceModal = () => {
    if (!session.user) return;
    const modal = document.getElementById('ws-modal');
    const input = document.getElementById('ws-modal-name');
    input.value = '';
    document.getElementById('ws-modal-blank').checked = true;
    modal.classList.remove('hidden');
    requestAnimationFrame(() => { modal.classList.remove('opacity-0'); input.focus(); });
};

export const closeNewWorkspaceModal = () => {
    const modal = document.getElementById('ws-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 250);
};

export const confirmNewWorkspace = async (e) => {
    if (e) e.preventDefault();
    const name = document.getElementById('ws-modal-name').value;
    const copy = document.getElementById('ws-modal-copy').checked;
    const btn = document.getElementById('ws-modal-submit');
    btn.disabled = true;
    const ok = await createWorkspace(name, copy);
    btn.disabled = false;
    if (ok) closeNewWorkspaceModal();
};

export const deleteWorkspace = (wsId) => {
    if (wsId === session.workspaceId) {
        showToast('Não é possível excluir a atividade que está aberta no momento.', 'error');
        return;
    }
    const ws = session.workspaces.find(w => w.id === wsId);
    showConfirm(`Excluir definitivamente a atividade "${ws?.workspaceName || wsId}" e todos os seus lotes?`, async () => {
        try {
            await deleteAllBatches(wsId);
            await deleteDoc(wsRef(wsId));
            session.workspaces = session.workspaces.filter(w => w.id !== wsId);
            renderWorkspacesList();
            showToast('Atividade apagada.');
        } catch (e) {
            console.error(e);
            showToast('Erro ao excluir a atividade.', 'error');
        }
    });
};

// ---------- Lista de atividades ----------
const touchCache = (wsId, updatedAt) => {
    const ws = session.workspaces.find(w => w.id === wsId);
    if (ws) {
        ws.updatedAt = updatedAt;
        ws.workspaceName = state.workspaceName;
        if (!document.getElementById('view-configuracao').classList.contains('hidden')) renderWorkspacesList();
    }
};

export const loadWorkspacesList = async () => {
    if (!session.user) return;
    const qs = await getDocs(collection(db, 'users', session.user.uid, 'workspaces'));
    session.workspaces = qs.docs.map(d => {
        const data = d.data();
        return { id: d.id, workspaceName: data.workspaceName || data.state?.workspaceName || 'Sem Nome', updatedAt: data.updatedAt || 0 };
    });
    renderWorkspacesList();
};

export const renderWorkspacesList = () => {
    const tbody = document.getElementById('ws-tbody');
    if (!tbody) return;
    const list = [...session.workspaces].sort((a, b) => b.updatedAt - a.updatedAt);

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty">Nenhuma atividade salva. Crie uma acima!</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(ws => {
        const current = ws.id === session.workspaceId;
        return `
            <tr class="${current ? 'row-current' : ''}">
                <td class="font-semibold">
                    ${escapeHtml(ws.workspaceName)}
                    ${current ? '<span class="badge badge-accent ml-2">Atual</span>' : ''}
                </td>
                <td class="muted">${formatDateTimeBR(ws.updatedAt)}</td>
                <td class="text-center whitespace-nowrap">
                    <button onclick="loadWorkspace('${escapeHtml(ws.id)}')" class="icon-btn" title="Carregar Atividade" ${current ? 'disabled' : ''}><i data-lucide="folder-open" class="w-[18px] h-[18px]"></i></button>
                    <button onclick="deleteWorkspace('${escapeHtml(ws.id)}')" class="icon-btn danger" title="Excluir Atividade" ${current ? 'disabled' : ''}><i data-lucide="trash-2" class="w-[18px] h-[18px]"></i></button>
                </td>
            </tr>`;
    }).join('');
    refreshIcons();
};

// ---------- Inicialização após login ----------
export const initUserWorkspaces = async () => {
    await loadWorkspacesList();

    if (session.workspaces.length === 0) {
        // Primeiro acesso: cria a atividade padrão
        const id = 'ws_' + Date.now();
        const now = Date.now();
        session.workspaceId = id;
        resetState(createDefaultState());
        await setDoc(wsRef(id), {
            state: stateWithoutBatches(),
            workspaceName: state.workspaceName,
            createdAt: now,
            updatedAt: now,
        });
        session.workspaces = [{ id, workspaceName: state.workspaceName, updatedAt: now }];
        document.getElementById('current-workspace-name').innerText = state.workspaceName;
        onWorkspaceLoaded();
        renderWorkspacesList();
        return;
    }

    // Abre a atividade modificada mais recentemente
    const mostRecent = [...session.workspaces].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const loaded = await loadWorkspaceData(mostRecent.id);
    if (loaded) {
        await activate(mostRecent.id, loaded);
    } else {
        showToast('Não foi possível abrir a atividade mais recente.', 'error');
    }
    renderWorkspacesList();
};

// Limpa a sessão ao sair
export const clearSession = () => {
    clearTimeout(saveTimer);
    savePending = false;
    session.user = null;
    session.workspaceId = null;
    session.workspaces = [];
};
