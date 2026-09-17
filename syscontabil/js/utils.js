// Utilitários puros (sem DOM/Firebase): dinheiro em centavos, datas locais,
// escape de HTML e ordenação de códigos contábeis.

// ---------- Dinheiro (sempre em centavos inteiros para evitar erro de ponto flutuante) ----------
export const toCents = (reais) => Math.round((Number(reais) || 0) * 100);
export const fromCents = (cents) => (cents || 0) / 100;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brNumber = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatCents = (cents) => brl.format(fromCents(cents));
export const formatCurrency = (reais) => formatCents(toCents(reais));
// "1.234,56" sem o símbolo R$ (para campos de digitação)
export const formatCentsPlain = (cents) => brNumber.format(fromCents(cents));

// Converte o texto de um campo (ex.: "1.234,56", "1234,56", "R$ 12,00") em centavos.
// Regra "calculadora": só os dígitos importam; os 2 últimos são os centavos.
export const parseCentsInput = (text) => {
    const digits = String(text || '').replace(/\D/g, '');
    if (!digits) return 0;
    return parseInt(digits, 10);
};

// Aplica a máscara brasileira em um <input>: enquanto digita, exibe 1.234,56.
export const applyMoneyMask = (input) => {
    const cents = parseCentsInput(input.value);
    input.value = cents ? formatCentsPlain(cents) : '';
    return cents;
};

// ---------- Datas (sem deslocamento de fuso: "2026-09-17" é 17/09 no horário local) ----------
const pad2 = (n) => String(n).padStart(2, '0');

export const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const parseISODate = (iso) => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
};

export const formatDateBR = (iso) => {
    const d = parseISODate(iso);
    return d ? d.toLocaleDateString('pt-BR') : '--';
};

export const formatDateTimeBR = (ts) => ts ? new Date(ts).toLocaleString('pt-BR') : '--';

// ---------- HTML ----------
export const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// ---------- Códigos contábeis ----------
// Compara "1.1.9" < "1.1.10" numericamente por segmento.
export const compareCodes = (a, b) => {
    const pa = a.split('.'), pb = b.split('.');
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        if (pa[i] === undefined) return -1;
        if (pb[i] === undefined) return 1;
        const na = parseInt(pa[i], 10), nb = parseInt(pb[i], 10);
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
        if (pa[i] !== pb[i]) return pa[i].localeCompare(pb[i]);
    }
    return 0;
};

export const padSeq = (n, size = 4) => String(n).padStart(size, '0');

// Debounce simples para agrupar gravações na nuvem.
export const debounce = (fn, ms) => {
    let t = null;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
};
