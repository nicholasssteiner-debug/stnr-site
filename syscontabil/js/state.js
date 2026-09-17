// Estado global da aplicação e valores padrão.
// `state` é um único objeto mutável compartilhado; nunca é reatribuído (use resetState).

export const INITIAL_ACCOUNTS = [
    { code: '1.1.01', name: 'Caixa', type: 'Ativo' },
    { code: '1.1.02', name: 'Banco Conta Movimento', type: 'Ativo' },
    { code: '1.1.03', name: 'Clientes', type: 'Ativo' },
    { code: '1.1.04', name: '(-) Provisão para Devedores Duvidosos', type: 'Ativo' },
    { code: '1.2.01', name: 'Estoque de Mercadorias', type: 'Ativo' },
    { code: '1.3.01', name: 'Máquinas e Equipamentos', type: 'Ativo' },
    { code: '1.3.02', name: '(-) Depreciação Acumulada', type: 'Ativo' },
    { code: '2.1.01', name: 'Fornecedores a Pagar', type: 'Passivo' },
    { code: '2.1.02', name: 'Salários a Pagar', type: 'Passivo' },
    { code: '2.2.01', name: 'Capital Social', type: 'Passivo' },
    { code: '2.2.02', name: '(-) Prejuízos Acumulados', type: 'Passivo' },
    { code: '3.1.01', name: 'Receita Bruta de Vendas', type: 'Receita' },
    { code: '3.1.02', name: 'Receita de Prestação de Serviços', type: 'Receita' },
    { code: '3.2.01', name: '(-) Devoluções de Vendas', type: 'Receita' },
    { code: '3.2.02', name: '(-) Impostos s/ Vendas', type: 'Receita' },
    { code: '3.2.03', name: '(-) Descontos Incondicionais', type: 'Receita' },
    { code: '4.1.01', name: 'Custo das Mercadorias Vendidas (CMV)', type: 'Despesa' },
    { code: '4.2.01', name: 'Despesas com Salários', type: 'Despesa' },
    { code: '4.2.02', name: 'Despesas com Aluguel', type: 'Despesa' },
];

export const DRE_GROUPS = [
    { id: 'receitaBruta', name: 'Receita Bruta de Vendas/Serviços', nature: 'C' },
    { id: 'deducoes', name: '(-) Deduções e Impostos sobre Vendas', nature: 'D' },
    { id: 'custos', name: '(-) Custos (CMV/CSP)', nature: 'D' },
    { id: 'despesasOperacionais', name: '(-) Despesas Operacionais', nature: 'D' },
    { id: 'outrasReceitasDespesas', name: '(+/-) Outras Receitas e Despesas', nature: 'C' },
];

export const INITIAL_DRE_CONFIG = {
    receitaBruta: ['3.1.01', '3.1.02'],
    deducoes: ['3.2.01', '3.2.02', '3.2.03'],
    custos: ['4.1.01'],
    despesasOperacionais: ['4.2.01', '4.2.02'],
    outrasReceitasDespesas: [],
};

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
        accounts: Array.isArray(s.accounts) && s.accounts.length ? s.accounts.map(a => ({ code: String(a.code), name: String(a.name || ''), type: a.type || 'Ativo' })) : def.accounts,
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
