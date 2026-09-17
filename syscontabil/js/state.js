// Estado global da aplicação e valores padrão.
// `state` é um único objeto mutável compartilhado; nunca é reatribuído (use resetState).
import { FULL_CHART, buildDreConfig } from './chartOfAccounts.js';

// Plano de contas padrão das novas atividades (comércio + serviços, 4 níveis)
export const INITIAL_ACCOUNTS = FULL_CHART;

// Grupos da DRE, na ordem de apresentação
export const DRE_GROUPS = [
    { id: 'receitaBruta', name: 'Receita Operacional Bruta', nature: 'C' },
    { id: 'deducoes', name: '(-) Deduções da Receita Bruta', nature: 'D' },
    { id: 'custos', name: '(-) Custos das Vendas e dos Serviços', nature: 'D' },
    { id: 'despesasOperacionais', name: '(-) Despesas Operacionais', nature: 'D' },
    { id: 'resultadoFinanceiro', name: '(+/-) Resultado Financeiro', nature: 'C' },
    { id: 'outrasReceitasDespesas', name: '(+/-) Outras Receitas e Despesas', nature: 'C' },
    { id: 'impostosResultado', name: '(-) IRPJ e CSLL', nature: 'D' },
];

export const DRE_GROUP_IDS = DRE_GROUPS.map(g => g.id);

export const INITIAL_DRE_CONFIG = buildDreConfig(INITIAL_ACCOUNTS, DRE_GROUP_IDS);

export const ACCOUNT_TYPES = ['Ativo', 'Passivo', 'Receita', 'Despesa'];

export const createDefaultState = () => ({
    workspaceName: 'Atividade Inicial',
    activeTab: 'planoContas',
    accounts: INITIAL_ACCOUNTS.map(a => ({ ...a })),
    batches: [],
    dreConfig: JSON.parse(JSON.stringify(INITIAL_DRE_CONFIG)),
    costCenters: [{ id: 'CC-01', name: 'Sede Administrativa' }],
    nextBatchSeq: 1,
});

// Estado compartilhado (dados da atividade aberta)
export const state = createDefaultState();

// Sessão (não persistida na atividade)
export const session = {
    user: null,
    workspaceId: null,
    workspaces: [],   // cache da lista de atividades {id, workspaceName, updatedAt}
};

// Substitui o conteúdo de `state` mantendo a mesma referência do objeto.
export const resetState = (next) => {
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, next);
};

// Garante que atividades antigas (ou incompletas) tenham todos os campos esperados.
export const normalizeState = (raw, fallbackName = 'Sem Nome') => {
    const def = createDefaultState();
    const s = raw && typeof raw === 'object' ? raw : {};

    const dreConfig = {};
    for (const g of DRE_GROUPS) {
        dreConfig[g.id] = Array.isArray(s.dreConfig?.[g.id]) ? [...s.dreConfig[g.id]] : [];
    }

    const batches = Array.isArray(s.batches) ? s.batches.map(normalizeBatch) : [];

    // Sequência de lotes: continua a partir do maior número já usado.
    let maxSeq = 0;
    for (const b of batches) {
        const m = /(\d+)$/.exec(b.id || '');
        if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
    }

    return {
        workspaceName: s.workspaceName || fallbackName,
        activeTab: s.activeTab || def.activeTab,
        accounts: Array.isArray(s.accounts) && s.accounts.length
            ? s.accounts.map(a => ({ code: String(a.code), name: String(a.name || ''), type: a.type || 'Ativo', ...(a.role ? { role: a.role } : {}) }))
            : def.accounts,
        batches,
        dreConfig,
        costCenters: Array.isArray(s.costCenters) && s.costCenters.length ? s.costCenters.map(c => ({ id: String(c.id), name: String(c.name || '') })) : def.costCenters,
        nextBatchSeq: Math.max(Number(s.nextBatchSeq) || 1, maxSeq + 1),
    };
};

export const normalizeBatch = (b) => ({
    id: String(b.id),
    date: b.date || '',
    description: b.description || '',
    createdAt: Number(b.createdAt) || 0,
    entries: Array.isArray(b.entries) ? b.entries.map(e => ({
        accountCode: String(e.accountCode),
        ccId: e.ccId || '',
        type: e.type === 'C' ? 'C' : 'D',
        value: Math.round((Number(e.value) || 0) * 100) / 100,  // reais com 2 casas
        // Conciliação: só grava os campos quando a partida está conciliada
        ...(e.reconciled ? { reconciled: true, reconciledAt: Number(e.reconciledAt) || 0 } : {}),
    })) : [],
});
