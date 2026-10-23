/* Calendário de conteúdo do Instagram até o fim da pré-venda (10/11). Aba "Calendário" do painel. */
(function(){
const F = s => s.replace(/\[([^\]]+)\]/g, '<span class="cal-fill">[$1]</span>')
  .replace(/✕ BAIXA/g, '<span class="cal-baixa">✕ BAIXA</span>')
  .replace(/✓ MANTIDA/g, '<span class="cal-mantida">✓ MANTIDA</span>');

const DAYS = [
 { k:"2110", d:"21/10", w:"Qua", t:"stories", tag:"Só stories", title:"Apresentar a nova fase do perfil",
   slides:[["1","Mudei a bio. Agora sim: sou autor de um livro em pré-venda. (print do perfil)"],["2","Capa do livro + \"Este livro começou com quatro opiniões. Três estavam erradas.\""],["3","Enquete: \"O problema do Brasil é a carga tributária? Sim / Não\""],["4","Figurinha de link para stnr.com.br/livro"]], slidesTitle:"Sequência de stories" },
 { k:"2210", d:"22/10", w:"Qui", t:"carrossel", tag:"Carrossel", title:"Convicção 01: carga tributária",
   how:"Estilo ficha de auditoria: a convicção no topo e o carimbo \"✕ BAIXA\", igual à tabela da página de vendas.",
   slides:[["1","Eu achava que o problema do Brasil era a carga tributária."],["2","Sou analista de controladoria. Meu trabalho é ver se o número fecha."],["3","Então fiz com essa ideia o que faço com um balanço: fui conferir."],["4","✕ BAIXA. [Uma frase com a conclusão do Capítulo 6]"],["5","No livro, cada dado traz a fonte. Você refaz a conta e tira sua conclusão."],["6","O Fim do Monopólio da Virtude · pré-venda até 10/11 · link na bio"]],
   cap:`Eu achava que o problema do Brasil era a carga tributária. Fiz a conta. Tive que dar baixa. ➡️

Essa foi a primeira de três convicções que caíram enquanto eu escrevia O Fim do Monopólio da Virtude. Está no Capítulo 6, com a fonte de cada dado para você conferir.

Concorda ou discorda? Me fala nos comentários. Eu respondo todo mundo.

📕 Pré-venda até 10/11 · físico R$ 38,90 · e-book R$ 5 · link na bio

#OFimDoMonopolioDaVirtude #Economia #Impostos #PoliticaBrasileira #Contabilidade` },
 { k:"2310", d:"23/10", w:"Sex", t:"pessoal", tag:"Pessoal", title:"Sexta à tarde escrevendo",
   how:"Foto sua na mesa com o livro ou o notebook, com luz de fim de tarde. Sem link e sem preço: esse post é só para aproximar.",
   cap:`Sexta, antes do pôr do sol. [Conte o que essa hora significa para você: fechar a semana, desligar o trabalho, a última revisão antes do Shabbat.]

Boa parte desse livro foi escrita assim: depois do expediente, entre uma prova da faculdade e outra. [Acrescente um detalhe verdadeiro.]

Shabbat Shalom ✨` },
 { k:"2410", d:"24/10", w:"Sáb", t:"descanso" },
 { k:"2510", d:"25/10", w:"Dom", t:"carrossel", tag:"Carrossel", title:"Convicção 02: transferência de renda",
   how:"Misture lâminas de texto com uma foto real de uma página do Capítulo 7, com um trecho sublinhado.",
   slides:[["1","\"Transferência de renda cria dependência.\" Eu acreditava nisso."],["2","É uma frase que se repete em toda conversa de escritório. Então fui atrás dos dados."],["3","📷 Foto da página do Capítulo 7 com o trecho marcado"],["4","✕ BAIXA. [Uma frase com o achado principal do Capítulo 7]"],["5","O problema não é dar dinheiro. É como a regra é desenhada."],["6","A proposta do livro: Imposto de Renda Negativo. Cada real ganho trabalhando aumenta a renda final."],["7","Pré-venda até 10/11 · link na bio"]],
   cap:`"Transferência de renda cria dependência."
Eu acreditava nisso. Os dados me fizeram mudar de ideia. ➡️

No Capítulo 7 de O Fim do Monopólio da Virtude eu explico o que encontrei e por que a resposta não é acabar com o programa, mas redesenhar a regra.

Você acredita nessa frase? Comenta aqui 👇

📕 Pré-venda até 10/11 · link na bio

#OFimDoMonopolioDaVirtude #BolsaFamilia #Economia #PoliticaBrasileira #LiberalismoSocialPragmatico` },
 { k:"2610", d:"26/10", w:"Seg", t:"carrossel", tag:"Carrossel", title:"O modelo em 4 peças",
   slides:[["1","Nem meio-termo morno. Maximização das duas pontas."],["2","O mercado é o melhor gerador de riqueza que existe. E um distribuidor terrível. As duas frases são verdadeiras."],["3","01 · Estado guardião e árbitro. Sai da operação e entra na arbitragem: contrato, segurança jurídica, infraestrutura."],["4","02 · Motor de riqueza. Base tributária larga, alíquota baixa, abrir empresa rápido."],["5","03 · Imposto de Renda Negativo. Uma fórmula só no lugar da colcha de programas. Sem degrau, sem armadilha."],["6","04 · Vouchers de saúde e educação. A família da periferia com o mesmo poder de escolha da classe média."],["7","O Fim do Monopólio da Virtude · pré-venda até 10/11 · link na bio"]],
   cap:`Um mercado mais livre do que a direita jamais defendeu, financiando um piso social mais firme do que a esquerda jamais entregou.

Esse é o modelo do livro, em uma página. Salve para ler com calma e mande para aquele amigo que vai discordar de tudo. 😅

📕 Pré-venda até 10/11 · link na bio

#OFimDoMonopolioDaVirtude #LiberalismoSocialPragmatico #Economia #Politica #ImpostoDeRendaNegativo` },
 { k:"2710", d:"27/10", w:"Ter", t:"carrossel", tag:"Foto", title:"Por que um contador escreveu sobre política social",
   how:"Foto sua na mesa de trabalho ou segurando o livro. Pode ser uma foto já tirada.",
   cap:`Não sou economista. E foi por isso que escrevi este livro.

Trabalho com controladoria. Meu dia é conciliação, rateio de custo, apropriação de despesa. E uma pergunta: o dinheiro foi para onde disseram que iria?

Um dia resolvi fazer essa pergunta ao maior orçamento do país, o da política social brasileira. O resultado é O Fim do Monopólio da Virtude.

📕 Pré-venda até 10/11 · link na bio

#OFimDoMonopolioDaVirtude #Contabilidade #Controladoria #Economia #Livros`,
   note:"Hoje: pause o anúncio atual e turbine o carrossel de 22, 25 ou 26/10 que tiver mais salvamentos e compartilhamentos." },
 { k:"2810", d:"28/10", w:"Qua", t:"carrossel", tag:"Carrossel", title:"Convicção 03: o mercado resolve sozinho",
   slides:[["1","Venho da direita liberal. E acreditava que o mercado resolve o social sozinho."],["2","O mercado é o melhor gerador de riqueza que a humanidade já construiu. Isso continuo defendendo."],["3","Mas ele é um péssimo distribuidor."],["4","✕ BAIXA. [Uma frase com o argumento do Capítulo 8]"],["5","O livro incomoda a esquerda nos primeiros capítulos e a direita nos seguintes."],["6","Pré-venda até 10/11 · link na bio"]],
   cap:`Esta é a que mais vai incomodar meus amigos liberais. 😬 ➡️

"O mercado resolve o social sozinho." Eu acreditava nisso. Capítulo 8.

Se você terminar a Parte I satisfeito e a Parte II irritado, o livro funcionou.

📕 Pré-venda até 10/11 · link na bio

#OFimDoMonopolioDaVirtude #Liberalismo #Direita #Economia #PoliticaBrasileira` },
 { k:"2910", d:"29/10", w:"Qui", t:"pessoal", tag:"Pessoal", title:"Quem esteve do seu lado",
   how:"Foto sua com [sua noiva, família ou amigos], de preferência uma que ainda não esteja no perfil.",
   cap:`[Escreva sobre quem te apoiou enquanto você escrevia: quem aguentou você falando de Imposto de Renda Negativo no jantar, quem leu o primeiro rascunho, quem cobrou para você terminar. Só o que for verdade.]

Livro tem um nome na capa, mas nunca é escrito sozinho. ❤️` },
 { k:"3010", d:"30/10", w:"Sex", t:"carrossel", tag:"Carrossel de fotos", title:"As 90 marcas \"ONDE CONFERIR\"",
   how:"4 ou 5 closes de páginas diferentes, cada uma mostrando uma marca [ONDE CONFERIR]. Suas mãos podem aparecer segurando o livro.",
   slides:[["1","Não acredite em mim. Confira. (sobre a foto do livro fechado)"],["2–5","Fotos das páginas, cada uma com a marca circulada"],["6","São 90 marcas no livro. O órgão, a série, o período. Dado envelhece; fonte não."],["7","Pré-venda até 10/11 · link na bio"]],
   cap:`Não peça para acreditar. Traga o número.

São 90 marcas no livro mostrando onde cada dado mora, para você conferir, atualizar e discordar com base.

📕 Físico R$ 38,90 · e-book R$ 5 · pré-venda até 10/11 · link na bio

#OFimDoMonopolioDaVirtude #Dados #Economia #Livros #Leitura` },
 { k:"3110", d:"31/10", w:"Sáb", t:"descanso" },
 { k:"0111", d:"01/11", w:"Dom", t:"carrossel", tag:"Carrossel", title:"Balanço final: 3 baixas, 1 mantida",
   how:"A tabela da página de vendas, em formato de balanço contábil.",
   slides:[["1","Comecei este livro com 4 convicções. Só uma sobreviveu."],["2","01 · O problema do Brasil é a carga tributária → ✕ BAIXA"],["3","02 · Transferência de renda cria dependência → ✕ BAIXA"],["4","03 · O mercado resolve o social sozinho → ✕ BAIXA"],["5","04 · Quem defende gasto social não fez a conta → ✓ MANTIDA"],["6","Saldo: 3 baixas · 1 mantida. Faltam 9 dias para a pré-venda acabar."]],
   cap:`3 baixas. 1 mantida.

"Quem defende gasto social não fez a conta." Essa passou na auditoria. E é por isso que o livro inteiro é feito de contas.

⏳ Faltam 9 dias · pré-venda até 10/11 · link na bio

#OFimDoMonopolioDaVirtude #Economia #PoliticaBrasileira #LiberalismoSocialPragmatico` },
 { k:"0211", d:"02/11", w:"Seg", t:"carrossel", tag:"Carrossel", title:"Tribunal do Modelo",
   how:"Hoje é Finados: nada de \"compre agora\". É um post de ideias.",
   slides:[["1","Coloquei meu próprio modelo no banco dos réus."],["2","12 objeções. Placar honesto. Algumas eu perdi."],["3–5","[Escolha 3 objeções do Tribunal do Modelo: uma por lâmina, cada uma com uma frase de resposta]"],["6","As outras 9 estão no livro."]],
   cap:`O jeito mais fácil de defender uma ideia é nunca enfrentar a melhor crítica a ela.

No livro, coloquei o modelo no Tribunal: 12 objeções, com placar honesto. Qual dessas você faria? 👇

#OFimDoMonopolioDaVirtude #Debate #Economia #Politica` },
 { k:"0311", d:"03/11", w:"Ter", t:"reels", tag:"Reels 1", title:"Primeiro vídeo: quem eu sou e o que é o livro",
   how:"Com o celular novo. Grave sentado, celular apoiado na altura dos olhos, de frente para uma janela. Grave cada trecho separado e junte no editor do Instagram. Assumir que é o primeiro vídeo aproxima as pessoas.",
   script:[["0–3s","Primeira vez que eu gravo um vídeo falando. Então, paciência comigo."],["3–15s","Sou o Nicholas, analista de controladoria. Meu trabalho é ver se o número fecha."],["15–30s","Escrevi um livro auditando quatro convicções que eu tinha sobre Estado, mercado e pobreza. Três não passaram."],["30–40s","Ele se chama O Fim do Monopólio da Virtude, e a pré-venda vai até dia 10. Link na bio."]],
   cap:`Primeiro vídeo. Mãos suando. 😅

Mas se eu escrevi um livro pedindo para as pessoas enfrentarem as próprias convicções, eu podia enfrentar uma câmera.

⏳ Faltam 7 dias · pré-venda até 10/11 · link na bio

#OFimDoMonopolioDaVirtude #Escritor #Livros #Economia` },
 { k:"0411", d:"04/11", w:"Qua", t:"pessoal", tag:"Pessoal", title:"A rotina: trabalho, faculdade e livro",
   how:"Carrossel com 3 ou 4 fotos reais do dia: trabalho, faculdade, a mesa do livro, um momento com [quem você quiser].",
   cap:`Analista de controladoria de dia. Contabilidade (6/8) e Gestão Financeira (3/4) à noite. Livro nos intervalos.

[Conte uma coisa verdadeira sobre conciliar tudo isso: o que sacrificou, o que aprendeu, quem ajudou.]

Não sou economista nem político. Sou uma pessoa comum que resolveu fazer a conta.`,
   note:"Hoje: se o Reels 1 tiver mais compartilhamentos que o carrossel turbinado, troque o anúncio para ele." },
 { k:"0511", d:"05/11", w:"Qui", t:"reels", tag:"Reels 2", title:"Respondendo a pergunta de um seguidor",
   how:"Use \"Responder com Reels\" a um comentário ou à melhor pergunta da caixinha.",
   script:[["0–3s","Me perguntaram: [pergunta]."],["3–35s","Resposta curta e direta, com um dado ou um capítulo do livro."],["35–45s","Faltam 5 dias para a pré-venda acabar. Link na bio."]],
   cap:`Melhor pergunta da semana. 👆 Manda a sua nos comentários que eu respondo no próximo.

⏳ Faltam 5 dias · link na bio

#OFimDoMonopolioDaVirtude #Economia #Politica` },
 { k:"0611", d:"06/11", w:"Sex", t:"reels", tag:"Reels 3", title:"Faltam 4 dias: o preço vai subir",
   how:"Você segurando o livro físico.",
   script:[["0–3s","Faltam 4 dias para a pré-venda acabar."],["3–15s","Até 10 de novembro, o livro físico sai por R$ 38,90. Depois, volta para R$ 57,20."],["15–25s","O e-book está R$ 5. Cinco reais. Menos que um café."],["25–35s","E quem compra agora está na frente da fila de produção. Link na bio."]],
   cap:`⏳ Faltam 4 dias.

📕 Físico: R$ 38,90 (depois R$ 57,20)
📱 E-book: R$ 5, na hora

Quem reserva agora recebe primeiro. Link na bio.

Shabbat Shalom ✨

#OFimDoMonopolioDaVirtude #PreVenda #Livros #Economia` },
 { k:"0711", d:"07/11", w:"Sáb", t:"descanso" },
 { k:"0811", d:"08/11", w:"Dom", t:"carrossel", tag:"Carrossel", title:"Perguntas frequentes",
   slides:[["1","Antes de reservar: as 5 perguntas que mais recebi"],["2","Preciso entender de economia? [sua resposta]"],["3","É um livro de direita ou de esquerda? Ataca os dois, nessa ordem."],["4","Qual a diferença entre o físico e o e-book? [sua resposta]"],["5","Quando recebo? A produção começa em 10/11. [prazo de envio]"],["6","Quanto custa? Físico R$ 38,90 + R$ 5 de frete · e-book R$ 5"],["7","Faltam 2 dias. Link na bio."]],
   cap:`Respondi tudo o que vocês me perguntaram nas últimas semanas. Ficou alguma dúvida? Comenta que eu respondo.

⏳ Faltam 2 dias · link na bio

#OFimDoMonopolioDaVirtude #PreVenda #Livros` },
 { k:"0911", d:"09/11", w:"Seg", t:"reels", tag:"Reels 4", title:"Último dia é amanhã",
   how:"Tom pessoal, olhando para a câmera, sem roteiro decorado.",
   script:[["0–3s","Amanhã acaba a pré-venda do meu livro."],["3–25s","[Agradeça de verdade: quantas pessoas já reservaram, quem compartilhou, o que significa para você.]"],["25–40s","Se você estava esperando, é até amanhã. Depois o preço muda. Link na bio."]],
   cap:`Amanhã as primeiras cópias de O Fim do Monopólio da Virtude entram em produção.

[Uma frase de agradecimento verdadeira.]

Último dia de pré-venda: amanhã. Link na bio. 📕

#OFimDoMonopolioDaVirtude #PreVenda #Livros` },
 { k:"1011", d:"10/11", w:"Ter", t:"pessoal", tag:"Post final", title:"Hoje começa a produção",
   how:"Foto sua com o livro. Nos stories, ao longo do dia: contagem regressiva das horas, prints de mensagens de leitores (com autorização) e, à noite, \"Encerrado. Obrigado.\"",
   cap:`Hoje começa a produção.

"Não é preciso odiar a riqueza para combater a pobreza. Basta ter o pragmatismo de usar a primeira como combustível para exterminar a segunda."

Obrigado a cada pessoa que reservou. A pré-venda termina hoje. Link na bio.` }
];

  const WEEKS = { "2110":"Semana 1 · sem vídeo", "2610":"Semana 2 · sem vídeo", "0211":"Semana 3 · celular novo, entram os Reels", "0911":"Reta final" };
  const POSTS = DAYS.filter(d => d.t !== "descanso");
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let done = {}, obs = {}, filtro = "todos";
  try {
    const s = JSON.parse(localStorage.getItem("calendario-estado") || "null");
    if (s) { done = s.done || {}; obs = s.obs || {}; }
    else done = JSON.parse(localStorage.getItem("calendario-postados") || "{}") || {};
  } catch(e){}
  const guardarLocal = () => { try { localStorage.setItem("calendario-estado", JSON.stringify({ done, obs })); } catch(e){} };

  /* ---------- sincronização: Firestore do projeto relatorio-do-poco, coleção própria "calendario-livro" ---------- */
  const FIREBASE = { apiKey: "AIzaSyB4HfH6sI65OD_zPHxsj5DedJjunD1fwyw", authDomain: "relatorio-do-poco.firebaseapp.com", projectId: "relatorio-do-poco" };
  let fs = null, ref = null, timer = null, pendente = 0;
  const status = t => { const el = $("cal-sync"); if (el) el.textContent = t; };
  const OFFLINE = "Sem conexão com a nuvem: salvo só neste navegador.";
  function salvar(){
    guardarLocal();
    if (!ref) return;
    status("Salvando…");
    clearTimeout(timer);
    pendente++;
    timer = setTimeout(() => fs.setDoc(ref, { done, obs, atualizado: fs.serverTimestamp() })
      .then(() => status("Marcações e observações sincronizadas entre seus aparelhos."), () => status(OFFLINE))
      .finally(() => { pendente = 0; }), 700);
  }
  (async () => {
    try {
      const [{ initializeApp }, f] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js")
      ]);
      fs = f;
      ref = f.doc(f.getFirestore(initializeApp(FIREBASE, "calendario")), "calendario-livro", "estado");
      f.onSnapshot(ref, snap => {
        // enquanto houver alteração local ainda não salva, a versão da nuvem está atrasada: não sobrescreve
        if (snap.metadata.hasPendingWrites || pendente) return;
        if (!snap.exists()) { salvar(); return; } // primeira vez: sobe o que já estava neste navegador
        const d = snap.data();
        done = d.done || {}; obs = d.obs || {};
        guardarLocal(); render();
        status("Marcações e observações sincronizadas entre seus aparelhos.");
      }, () => status(OFFLINE));
    } catch(e) { status(OFFLINE); }
  })();
  const hojeKey = () => { const n = new Date(); return String(n.getDate()).padStart(2,"0") + String(n.getMonth()+1).padStart(2,"0"); };

  function contagem(){
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const dias = Math.round((new Date(2026,10,10) - hoje) / 864e5);
    if (dias > 0){ $("cal-faltam").textContent = dias; $("cal-faltam-sub").textContent = dias === 1 ? "dia para o fim" : "dias para o fim"; }
    else if (dias === 0){ $("cal-faltam").textContent = "Hoje"; $("cal-faltam-sub").textContent = "último dia"; }
    else { $("cal-faltam").textContent = "✓"; $("cal-faltam-sub").textContent = "pré-venda encerrada"; }
  }

  function render(){
    const hk = hojeKey();
    const box = $("cal-days");
    // guarda o que está aberto e onde o cursor está, para uma atualização vinda da nuvem não atrapalhar quem está digitando
    const abertos = new Set([...box.querySelectorAll("details.cal-day[open]")].map(el => el.dataset.k));
    const primeira = !box.children.length;
    const foco = document.activeElement && document.activeElement.classList.contains("cal-obs") ? document.activeElement : null;
    const fk = foco && foco.dataset.k, sel = foco ? [foco.selectionStart, foco.selectionEnd] : null;
    let html = "";
    DAYS.forEach(d => {
      if (WEEKS[d.k] && filtro === "todos") html += '<div class="cal-week">' + WEEKS[d.k] + '</div>';
      if (d.t === "descanso"){
        if (filtro === "todos") html += '<div class="cal-rest"><span class="cal-date">' + d.d + '</span><span>' + d.w + ' · descanso, sem post de venda</span></div>';
        return;
      }
      if (filtro === "pendentes" && done[d.k]) return;
      if (["carrossel","reels","pessoal"].includes(filtro) && d.t !== filtro) return;
      let body = "";
      if (d.how) body += '<div><h4>Formato</h4><p>' + F(esc(d.how)) + '</p></div>';
      if (d.slides) body += '<div><h4>' + (d.slidesTitle || "Lâminas") + '</h4><ol class="cal-list">' + d.slides.map(s => '<li><span>' + s[0] + '</span><div>' + F(esc(s[1])) + '</div></li>').join("") + '</ol></div>';
      if (d.script) body += '<div><h4>Roteiro</h4><ol class="cal-list cal-script">' + d.script.map(s => '<li><span>' + s[0] + '</span><div>' + F(esc(s[1])) + '</div></li>').join("") + '</ol></div>';
      if (d.cap) body += '<div><h4>Legenda</h4><div class="cal-cap" id="cal-cap-' + d.k + '">' + F(esc(d.cap)) + '</div></div><button type="button" class="cal-copy" data-k="' + d.k + '">Copiar legenda</button>';
      if (d.note) body += '<p class="cal-note">' + esc(d.note) + '</p>';
      body += '<div><h4>Observações</h4><textarea class="cal-obs" data-k="' + d.k + '" rows="3" placeholder="Como foi? Números, comentários, o que mudar…"></textarea></div>';
      const aberto = primeira ? d.k === hk : abertos.has(d.k);
      html += '<details class="cal-day' + (d.k === hk ? " is-today" : "") + (done[d.k] ? " is-done" : "") + '" data-k="' + d.k + '"' + (aberto ? " open" : "") + '>' +
        '<summary><span class="cal-date">' + d.d + '<small>' + d.w + '</small></span>' +
        '<span class="cal-what"><span class="cal-tag t-' + d.t + '">' + d.tag + '</span><strong>' + esc(d.title) + '</strong>' + (d.k === hk ? '<span class="cal-hoje">Hoje</span>' : "") + (obs[d.k] ? '<span class="has-obs">✎ com observação</span>' : "") + '</span>' +
        '<input type="checkbox" id="cal-ck-' + d.k + '" data-k="' + d.k + '"' + (done[d.k] ? " checked" : "") + ' aria-label="Publicado em ' + d.d + '"></summary>' +
        '<div class="cal-body">' + body + '</div></details>';
    });
    box.innerHTML = html;
    box.querySelectorAll(".cal-obs").forEach(t => { t.value = obs[t.dataset.k] || ""; });
    const geral = $("cal-obs-geral");
    if (geral && geral !== foco) geral.value = obs.geral || "";
    if (fk && fk !== "geral") {
      const t = box.querySelector('.cal-obs[data-k="' + fk + '"]');
      if (t) { t.value = foco.value; t.focus(); t.setSelectionRange(sel[0], sel[1]); }
    }
    const n = POSTS.filter(d => done[d.k]).length;
    $("cal-feitos").textContent = n + "/" + POSTS.length;
    $("cal-feitos-sub").textContent = n === POSTS.length ? "tudo publicado" : (POSTS.length - n) + " pendentes";
    $("cal-bar").style.width = (100 * n / POSTS.length) + "%";
  }

  // observações: salvam sozinhas enquanto você digita, sem redesenhar a lista
  document.addEventListener("input", e => {
    const t = e.target; if (!t.classList || !t.classList.contains("cal-obs")) return;
    const v = t.value.trim();
    if (v) obs[t.dataset.k] = t.value; else delete obs[t.dataset.k];
    salvar();
  });

  $("cal-days").addEventListener("change", e => {
    if (e.target.type !== "checkbox") return;
    const k = e.target.dataset.k; if (!k) return;
    if (e.target.checked) done[k] = true; else delete done[k];
    salvar(); render();
  });
  $("cal-days").addEventListener("click", e => {
    const btn = e.target.closest(".cal-copy"); if (!btn) return;
    const d = DAYS.find(x => x.k === btn.dataset.k);
    const ok = () => { btn.textContent = "Copiada"; setTimeout(() => btn.textContent = "Copiar legenda", 1800); };
    const fallback = () => { const r = document.createRange(); r.selectNodeContents($("cal-cap-" + d.k)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = "Texto selecionado: copie"; };
    try { navigator.clipboard.writeText(d.cap).then(ok, fallback); } catch(err) { fallback(); }
  });
  $("cal-filtros").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    filtro = b.dataset.f;
    $("cal-filtros").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    render();
  });

  contagem();
  render();
})();
