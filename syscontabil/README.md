# SysContábil

Sistema de escrituração por partidas dobradas do portal STNR. A página de entrada é
`../SysContábil.html` (só marcação); toda a lógica fica nesta pasta, em módulos ES
que se importam entre si.

## Estrutura

```
SysContábil.html          tela (HTML puro) — carrega syscontabil/js/main.js
syscontabil/
  app.css                 tema escuro (mesmas cores do index.html) e componentes
  js/
    main.js               ponto de entrada: registra telas e expõe handlers no window
    firebase.js           inicialização do Firebase (Auth + Firestore)
    state.js              estado compartilhado, valores padrão e normalização
    chartOfAccounts.js    plano de contas padrão (340 contas, comércio + serviços) e mapeamento da DRE
    utils.js              dinheiro em centavos, máscara 1.234,56, datas locais, escape HTML
    ui.js                 toasts, modal de confirmação, navegação, menu mobile, CSV/impressão
    auth.js               login / cadastro
    workspaces.js         persistência na nuvem e "Atividades"
    accounts.js           plano de contas
    costCenters.js        centros de custo
    lotes.js              novo lançamento, edição e consulta de lotes
    reconcile.js          conciliação de partidas (marcação vs. extrato)
    closing.js            encerramento do exercício (lote automático)
    reports.js            período, Razão, Balancete, Balanço Patrimonial
    dre.js                configuração e demonstração da DRE
```

Dependências entre módulos (setas = importa):

```
main ─► ui, auth, workspaces, accounts, costCenters, lotes, reports, dre, reconcile
accounts ─► state, utils, ui, workspaces
lotes ─► state, utils, ui, workspaces, accounts, costCenters
reports ─► state, utils, ui, accounts
dre ─► state, utils, workspaces, accounts, reports
reconcile ─► state, utils, ui, workspaces, accounts, costCenters, reports
workspaces ─► firebase, state, utils, ui
```

`ui.js` não importa nenhum módulo de negócio: as telas se registram nele via
`registerView(tabId, render)`, o que evita importações circulares.

## Regras de negócio

- Valores são calculados em **centavos inteiros** (sem erro de ponto flutuante).
  No Firestore continuam salvos em reais com 2 casas, compatível com os dados antigos.
- Campos de valor usam máscara brasileira: digitar `123456` exibe `1.234,56`.
- Datas `AAAA-MM-DD` são interpretadas no fuso local (sem "voltar um dia").
- Código de conta é identificador fixo: não há renumeração em cascata.
- Conta ou centro de custo com lançamentos não pode ser excluído.
- Conta sintética (com filhas) não recebe lançamento; o formulário exige a subconta
  analítica, em qualquer profundidade do plano.
- Número de lote vem de um contador persistido (`nextBatchSeq`); IDs nunca se repetem,
  mesmo após exclusões.
- Conta automática "Superávit ou Déficit do Exercício" (`role: 'result'`, 2.3.02, logo após o
  Capital Social): não aceita lançamentos manuais nem subcontas; no Balanço e no Razão seu
  saldo é receitas − despesas até a data. Sem ela no plano, o Balanço mostra a linha avulsa.
- Subcontas: conta do último nível que já tem lançamentos diretos não pode receber
  subcontas (botão "+" desabilitado e validação no cadastro/importação).
- Conciliação só em contas do último nível (analíticas) com lançamentos; contas sintéticas
  são recusadas. Razão e Balancete funcionam em qualquer nível (o sintético agrega as filhas).
- Conciliação: cada partida pode ser marcada como conciliada (`reconciled`, `reconciledAt`
  gravados no lote). A tela compara o saldo conciliado com o saldo do extrato e lista
  as partidas pendentes; a marcação sobrevive à edição do lote quando conta, D/C e
  valor não mudam.
- Plano de contas padrão (`chartOfAccounts.js`): 4 níveis (1.1.01.001), 340 contas, cobre
  Ativo/Passivo/PL, receitas de vendas e de serviços, deduções, CMV, CSP, despesas por
  natureza, resultado financeiro e IRPJ/CSLL. `validateChart` garante pai existente, tipo
  igual ao do pai e códigos únicos; `buildDreConfig` mapeia cada analítica de resultado
  em exatamente um dos 7 grupos da DRE. O botão "Importar plano padrão" acrescenta a uma
  atividade existente só as contas que faltam, sem tocar nas atuais.
- Botão "+" (cabeçalho e Configurações) cria uma atividade nova do zero ou uma cópia
  da atual; a atividade anterior permanece na lista.
- Conta x subconta é estrutural, não de formato de código. Conta = registro do plano
  (código 0.0.00.000), criada no formulário do topo. Subconta = criada pelo "+" da conta:
  guarda `parent` (conta-mãe) e `sub` (código livre: 1234, F-77...). Internamente o código é
  `parent.sub` para manter a hierarquia nos totais; nas telas aparece só o `sub`. Subconta é
  sempre o último nível e herda o tipo e o grupo da DRE da conta-mãe. Razão e Conciliação
  selecionam em dois campos (Conta → Subconta); o Balancete marca as subcontas.
- Níveis de análise: conta → subconta → departamento (centro de custo). Razão, Balancete,
  DRE e Conciliação têm o seletor "Departamento"; o departamento 0 é o totalizador. No
  Balancete, com o depto 0 selecionado e mais de um centro de custo, cada conta analítica
  é aberta por departamento (linha da conta = total). O Balanço é sempre consolidado.
- Encerramento do exercício (`closing.js`, botão no Balanço e na DRE): gera um lote
  `kind: 'closing'` que zera cada saldo de receita/despesa por (conta, departamento) até a
  data e transfere o resultado para Lucros Acumulados (`role: 'retainedEarnings'`) ou
  Prejuízos Acumulados (`role: 'accumulatedLosses'`), escolhíveis no modal. Depois disso a
  conta automática volta a zero. A DRE ignora lotes de encerramento; Razão e Balancete os
  mostram. Para desfazer, exclua o lote na Consulta de Lotes.
- Relatórios aceitam período (De/Até). Razão e Balancete mostram saldo anterior;
  o Balanço usa a posição até a data final.

## Firestore

```
users/{uid}/workspaces/{wsId}                  { workspaceName, createdAt, updatedAt, state }
users/{uid}/workspaces/{wsId}/batches/{loteId}  um documento por lote
```

Os lotes ficam em subcoleção para não atingir o limite de 1 MiB por documento.
Atividades no formato antigo (lotes dentro de `state.batches`) são migradas
automaticamente na primeira abertura.

Gravações são agrupadas (debounce de 0,7 s) e só acontecem quando há alteração de
dados — trocar de tela não gera write.

### Regras de segurança recomendadas

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

O cadastro por e-mail/senha fica aberto na tela de acesso. Para restringir a equipe,
desative "Criar conta" no console do Firebase (Authentication → Sign-in method) ou
remova o botão em `SysContábil.html`.

## Desenvolvimento local

Os módulos ES não carregam via `file://`; sirva a pasta do site por HTTP
(ex.: `python -m http.server` na raiz do repositório) e abra `SysContábil.html`.
No console do navegador, `__syscontabil.state` dá acesso ao estado carregado.
