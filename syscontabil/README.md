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
    chartReligioso.js     Plano de Contas Religioso (gerado do AASI da ANP; não editar à mão)
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
- Lançamento só em conta de **7 dígitos** (padrão 0.0.00.000, `isPostingAccount`): grupos
  (1, 1.1, 1.1.01) e a conta automática de resultado ficam fora da lista "Conta" do lançamento.
  Se a conta de 7 dígitos tiver subcontas, a subconta é obrigatória. Não se cria conta com mais
  de 7 dígitos (para detalhar, use subconta) e subconta só em conta de 7 dígitos.
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
- Plano de Contas Religioso (`chartReligioso.js`, escolhido no modal "Nova atividade"): plano da ANP
  no AASI (papel "Associação Religiosa", entidade 1611, só contas ativas + as movimentadas no último ano),
  sem subcontas e departamentos — 1.457 contas, 1.210 analíticas. O código segue a hierarquia do AASI em
  pontos: a analítica mantém os 7 dígitos (1135001 → 1.1.3.5.001) e a totalizadora fica com menos de 7
  (1135000 → 1.1.3.5), então não aceita lançamento, pela mesma regra do plano padrão. Cada conta traz a
  natureza D/C do AASI (`nature`), que prevalece sobre a convenção do "(-)". Grupos 5 (controle) e 6
  (transferências) entram no resultado, como no AASI. A atividade guarda `chartId` ('padrao' | 'religioso')
  e o "Importar plano" completa a partir do plano dela. Para regerar: `Projetos\Plano de Contas Religioso\`
  (`extrair_plano_aasi.py` e depois `gerar_chart_religioso.py`).
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

## Integração DRACMA (`dracma.js`)

Liga o `DRACMA Treinamento.html` ao SysContábil pelo **mesmo usuário** do Firebase. Entidade fixa: STNR.

1. No DRACMA → Integração, o usuário entra e clica em "Solicitar vínculo": grava
   `users/{uid}/integrations/dracma` (pedido de vínculo).
2. Aqui, Configurações → Integração DRACMA → "Vincular": cria (ou reaproveita) a atividade
   **STNR - DRACMA** com o plano de contas e os centros de custo padrão deste sistema, e grava
   `status: 'vinculado'` e `wsId`. O DRACMA usa exatamente esse plano (mesmos códigos; no CSV a conta
   sai só com os números, 4.2.02.003 → 4202003).
3. Daí em diante a atividade é a fonte: o botão Sincronizar do DRACMA lê `users/{uid}/workspaces/{wsId}`
   e puxa contas, subcontas e centros de custo. Pessoas do DRACMA vão como subcontas
   (fornecedores em 2.1.01.002, funcionários em 2.1.07.001) no campo `subcontas` do pedido.
4. Lotes exportados no DRACMA ficam em `users/{uid}/integrations/dracma/lotes/{id}` e são importados
   (ids `DRACMA-PG...`) ao abrir a atividade, no "Sincronizar agora" ou ao vincular. Lote com conta ou
   centro de custo inexistente não é importado e recebe `erroImportacao`.

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
