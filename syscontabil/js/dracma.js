// Integração com o DRACMA de treinamento (mesmo usuário do Firebase).
//
//   users/{uid}/integrations/dracma            pedido de vínculo feito no DRACMA: plano de contas e centros de custo
//                                              iniciais, subcontas a criar (pessoas) e, após o vínculo, o wsId
//   users/{uid}/integrations/dracma/lotes/{id} lotes exportados pelo DRACMA aguardando importação
//
// Vincular cria (ou reaproveita) a atividade "STNR - DRACMA". A partir daí ela é a fonte do plano de contas,
// das subcontas e dos centros de custo que o DRACMA puxa no botão Sincronizar. Subcontas novas e lotes
// enviados pelo DRACMA são aplicados aqui ao vincular, no botão "Sincronizar agora" e ao abrir a atividade.
import { db, doc, getDoc, setDoc, getDocs, collection } from './firebase.js';
import { state, session, normalizeBatch } from './state.js';
import { escapeHtml, formatDateTimeBR } from './utils.js';
import { showToast, refreshIcons, navigate } from './ui.js';
import { createWorkspace, loadWorkspace, persistState, persistBatch } from './workspaces.js';
import { updateDatalists, getAccount, hasChildren, hasDirectEntries, isPostingAccount, getSubAccounts, POSTING_DIGITS } from './accounts.js';

export const DRACMA_ACTIVITY = 'STNR - DRACMA';

const intRef = () => doc(db, 'users', session.user.uid, 'integrations', 'dracma');
const lotesCol = () => collection(db, 'users', session.user.uid, 'integrations', 'dracma', 'lotes');

let busy = false;

const readIntegration = async () => {
    const snap = await getDoc(intRef());
    return snap.exists() ? snap.data() : null;
};

const pendingLotes = async () => {
    const qs = await getDocs(lotesCol());
    return qs.docs.filter(d => !d.data().importado).map(d => ({ ref: d.ref, id: d.id, ...d.data() }));
};

const isDracmaWorkspace = (info) => !!info && info.status === 'vinculado' && info.wsId === session.workspaceId;

// ---------- Centros de custo ----------
// O plano de contas da atividade é o padrão do SysContábil (criado com a atividade); do DRACMA vêm só
// os centros de custo iniciais (versões antigas do DRACMA). Hoje o DRACMA usa os centros de custo da própria atividade.
const applyCostCenters = (info, replace) => {
    const centros = (info.centros || []).map(c => ({ id: String(c.id), name: String(c.name || '') }));
    if (replace && centros.length) { state.costCenters = centros; return centros.length; }
    let added = 0;
    for (const c of centros) if (!state.costCenters.some(x => x.id === c.id)) { state.costCenters.push(c); added++; }
    return added;
};

// Partida aceita: conta de 7 dígitos sem subcontas, ou subconta de uma conta de 7 dígitos
const postingProblem = (code) => {
    const acc = getAccount(code);
    if (!acc) return `conta ${code} não existe`;
    if (acc.sub) return isPostingAccount(acc.parent) ? '' : `subconta ${code} fora de conta de ${POSTING_DIGITS} dígitos`;
    if (!isPostingAccount(code)) return `conta ${code} não recebe lançamento (só ${POSTING_DIGITS} dígitos)`;
    if (getSubAccounts(code).length) return `conta ${code} tem subcontas: falta a subconta`;
    return '';
};

// ---------- Subcontas (pessoas) e lotes enviados pelo DRACMA ----------
const applyPending = async (info) => {
    const res = { subs: 0, lotes: 0, batches: 0, erros: [] };

    for (const s of info.subcontas || []) {
        const parent = getAccount(String(s.parent));
        if (!parent) { res.erros.push(`Conta ${s.parent} não existe para a subconta ${s.sub}.`); continue; }
        if (!isPostingAccount(parent.code)) { res.erros.push(`${parent.code} não é conta de ${POSTING_DIGITS} dígitos: subconta ${s.sub} não criada.`); continue; }
        const code = `${parent.code}.${s.sub}`;
        const ex = getAccount(code);
        if (ex) { if (ex.name !== s.name) ex.name = s.name; continue; }
        if (!hasChildren(parent.code) && hasDirectEntries(parent.code)) { res.erros.push(`${parent.code} tem lançamentos diretos: subconta ${s.sub} não criada.`); continue; }
        state.accounts.push({ code, name: String(s.name), type: parent.type, sub: String(s.sub), parent: parent.code });
        res.subs++;
    }

    for (const lote of await pendingLotes()) {
        const batches = Array.isArray(lote.batches) ? lote.batches : [];
        const problems = [];
        for (const b of batches) for (const e of b.entries || []) {
            const p = postingProblem(e.accountCode);
            if (p) problems.push(p);
            if (e.ccId && !state.costCenters.some(c => c.id === e.ccId)) problems.push(`centro de custo ${e.ccId} não existe`);
        }
        if (problems.length) {
            res.erros.push(`Lote ${lote.numero || lote.id}: ${[...new Set(problems)].slice(0, 5).join('; ')}.`);
            await setDoc(lote.ref, { erroImportacao: [...new Set(problems)].join('; '), verificadoEm: Date.now() }, { merge: true });
            continue;
        }
        for (const b of batches) {
            if (state.batches.some(x => x.id === b.id)) continue;
            const nb = normalizeBatch(b);
            state.batches.push(nb);
            await persistBatch(nb);
            res.batches++;
        }
        await setDoc(lote.ref, { importado: true, importadoEm: Date.now(), wsId: session.workspaceId, erroImportacao: null }, { merge: true });
        res.lotes++;
    }

    updateDatalists();
    persistState();
    await setDoc(intRef(), { ultimaImportacao: Date.now() }, { merge: true });
    return res;
};

const summary = (r) => [
    r.subs ? `${r.subs} subconta(s) criada(s)` : '',
    r.lotes ? `${r.lotes} lote(s) importado(s) (${r.batches} lançamento(s))` : '',
].filter(Boolean).join(', ');

// ---------- Ações ----------
export const linkDracma = async () => {
    if (busy || !session.user) return;
    busy = true;
    try {
        const info = await readIntegration();
        if (!info || !info.status) {
            showToast('Nenhum pedido de vínculo. No DRACMA Treinamento, entre em Integração com este mesmo usuário e clique em "Solicitar vínculo".', 'error');
            return;
        }
        const known = session.workspaces.find(w => w.id === info.wsId) || session.workspaces.find(w => w.workspaceName === DRACMA_ACTIVITY);
        if (known) {
            await loadWorkspace(known.id);
            if (session.workspaceId !== known.id) return;
            const n = applyCostCenters(info, false);
            persistState();
            showToast(`Atividade ${DRACMA_ACTIVITY} reaproveitada${n ? `: ${n} centro(s) de custo acrescentado(s)` : ''}.`);
        } else {
            if (!await createWorkspace(DRACMA_ACTIVITY, false)) return;   // plano de contas padrão do SysContábil
            applyCostCenters(info, true);
            persistState();
            showToast(`Atividade ${DRACMA_ACTIVITY} criada com o plano de contas e os centros de custo padrão do SysContábil (entidade ${info.entidade || 'STNR'}).`);
        }
        await setDoc(intRef(), { status: 'vinculado', wsId: session.workspaceId, atividade: DRACMA_ACTIVITY, entidade: 'STNR', vinculadoEm: Date.now(), vinculadoPor: session.user.email }, { merge: true });
        const r = await applyPending({ ...info, wsId: session.workspaceId });
        if (summary(r)) showToast(summary(r));
        if (r.erros.length) showToast(r.erros.slice(0, 3).join(' '), 'error');
        navigate('planoContas');
    } catch (e) {
        console.error(e);
        showToast('Erro ao vincular com o DRACMA: ' + e.message, 'error');
    } finally {
        busy = false;
        renderDracmaPanel();
    }
};

export const syncDracmaNow = async () => {
    if (busy || !session.user) return;
    busy = true;
    try {
        const info = await readIntegration();
        if (!isDracmaWorkspace(info)) { showToast(`Abra a atividade ${DRACMA_ACTIVITY} para sincronizar.`, 'error'); return; }
        const r = await applyPending(info);
        showToast(summary(r) || 'Nada novo do DRACMA.');
        if (r.erros.length) showToast(r.erros.slice(0, 3).join(' '), 'error');
    } catch (e) {
        console.error(e);
        showToast('Erro ao sincronizar com o DRACMA: ' + e.message, 'error');
    } finally {
        busy = false;
        renderDracmaPanel();
    }
};

// Chamado ao abrir uma atividade: se for a STNR - DRACMA, aplica o que o DRACMA enviou.
export const autoSyncDracma = async () => {
    if (!session.user || state.workspaceName !== DRACMA_ACTIVITY || busy) return;
    try {
        const info = await readIntegration();
        if (!isDracmaWorkspace(info)) return;
        busy = true;
        const r = await applyPending(info);
        if (summary(r)) showToast('DRACMA: ' + summary(r));
        if (r.erros.length) showToast('DRACMA: ' + r.erros.slice(0, 2).join(' '), 'error');
    } catch (e) {
        console.error(e);
    } finally {
        busy = false;
    }
};

export const openDracmaWorkspace = async () => {
    const info = await readIntegration();
    if (info?.wsId) await loadWorkspace(info.wsId);
};

// ---------- Painel (Configurações → Integração DRACMA) ----------
export const renderDracmaPanel = async () => {
    const el = document.getElementById('dracma-panel');
    if (!el || !session.user) return;
    el.innerHTML = '<p class="muted text-sm">Carregando...</p>';
    let info, pend = [];
    try {
        info = await readIntegration();
        if (info?.status === 'vinculado') pend = await pendingLotes();
    } catch (e) {
        el.innerHTML = `<p class="text-sm" style="color:#ff5c7a">Erro ao ler a integração: ${escapeHtml(e.message)}</p>`;
        return;
    }
    const status = info?.status || 'nenhum';
    const here = isDracmaWorkspace(info);
    const subsPend = (info?.subcontas || []).filter(s => !getAccount(`${s.parent}.${s.sub}`)).length;

    const step = (ok, title, text) => `
        <div class="card-head rounded-lg border border-stnr-border" style="${ok ? 'border-color:#3ddc97' : ''}">
            <h3 class="font-bold mb-1">${ok ? '✓ ' : ''}${title}</h3><p class="muted text-sm">${text}</p>
        </div>`;

    el.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            ${step(status !== 'nenhum', '1. Solicitar no DRACMA', `No DRACMA Treinamento → Integração, entre com <b>${escapeHtml(session.user.email)}</b> e clique em "Solicitar vínculo".`)}
            ${step(status === 'vinculado', '2. Vincular aqui', `Cria a atividade <b>${DRACMA_ACTIVITY}</b> com o plano de contas e os centros de custo padrão daqui; o DRACMA passa a usar exatamente os desta atividade. Entidade: STNR.`)}
            ${step(status === 'vinculado', '3. Usar', 'O DRACMA puxa daqui contas, subcontas e centros de custo (botão Sincronizar). Lotes exportados lá entram aqui ao abrir a atividade.')}
        </div>
        ${status === 'nenhum' || status === 'desvinculado' ? `
            <div class="card-head rounded-lg border border-stnr-border">
                <p class="text-sm">Nenhum pedido de vínculo ${status === 'desvinculado' ? 'ativo (o DRACMA foi desvinculado)' : 'encontrado'} para este usuário.</p>
                <button onclick="renderDracmaPanel()" class="btn btn-ghost btn-sm mt-3"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Verificar novamente</button>
            </div>` : ''}
        ${status === 'pendente' ? `
            <div class="card-head rounded-lg border border-stnr-border">
                <p class="text-sm mb-1">Pedido de vínculo de <b>${escapeHtml(info.email || '')}</b> em ${formatDateTimeBR(info.solicitadoEm)}.</p>
                <p class="muted text-sm mb-3">${(info.subcontas || []).length} subconta(s). Entidade ${escapeHtml(info.entidade || 'STNR')}.</p>
                <button onclick="linkDracma()" class="btn btn-primary"><i data-lucide="link" class="w-4 h-4"></i> Vincular — criar atividade ${DRACMA_ACTIVITY}</button>
            </div>` : ''}
        ${status === 'vinculado' ? `
            <div class="card-head rounded-lg border border-stnr-border">
                <p class="text-sm mb-1">Vinculado à atividade <b>${DRACMA_ACTIVITY}</b> em ${formatDateTimeBR(info.vinculadoEm)}. ${info.ultimaImportacao ? 'Última importação: ' + formatDateTimeBR(info.ultimaImportacao) + '.' : ''}</p>
                <p class="muted text-sm mb-3">${pend.length} lote(s) aguardando importação · ${subsPend} subconta(s) a criar.</p>
                ${here
                    ? `<button onclick="syncDracmaNow()" class="btn btn-primary"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Sincronizar agora</button>`
                    : `<button onclick="openDracmaWorkspace()" class="btn btn-primary"><i data-lucide="folder-open" class="w-4 h-4"></i> Abrir ${DRACMA_ACTIVITY}</button>`}
                <button onclick="linkDracma()" class="btn btn-ghost ml-2" title="Acrescenta ao plano as contas do pedido de vínculo que ainda faltam"><i data-lucide="link" class="w-4 h-4"></i> Revincular</button>
            </div>` : ''}`;
    refreshIcons();
};
