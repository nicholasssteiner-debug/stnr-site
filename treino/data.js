/* Protocolo V — conteúdo do plano (treinos, guia) e base de alimentos sem carne. */

export const TIPS = {
  lateral: 'Peso leve, cotovelo levemente dobrado, sobe até a linha do ombro e desce em 2 s. Pense em empurrar o halter para longe, não para cima.',
  puxada: 'Leve os cotovelos em direção ao bolso e o peito em direção à barra; quem puxa é a costa, não o bíceps.',
  dor: 'Pontada na articulação do ombro (não queimação muscular): corte as séries de elevação lateral pela metade até passar.'
};

// rest = descanso sugerido em segundos
export const WORKOUTS = {
  A: {
    code: 'A', name: 'Treino A', title: 'Largura', sub: 'Costas e ombro lateral', color: 'a',
    ex: [
      { id: 'a1', n: 'Barra fixa pegada aberta', s: 4, r: '6–10', obs: 'Menos de 5 reps: puxada frente aberta', home: 'Barra fixa ou negativas de 5 s', rest: 120, tip: 'puxada' },
      { id: 'a2', n: 'Pullover na polia, braço estendido', s: 3, r: '12–15', home: 'Pullover deitado com mochila', rest: 75 },
      { id: 'a3', n: 'Remada unilateral com halter', s: 3, r: '10–12', home: 'Remada australiana sob mesa firme', rest: 90 },
      { id: 'a4', n: 'Elevação lateral com halter', s: 4, r: '12–20', obs: 'Drop set na última', home: 'Garrafas de 2 L ou mochila', rest: 50, tip: 'lateral' },
      { id: 'a5', n: 'Elevação lateral na polia (cabo atrás do corpo)', s: 3, r: '15', home: 'Elevação lateral deitado de lado', rest: 50, tip: 'lateral' },
      { id: 'a6', n: 'Face pull ou crucifixo inverso', s: 3, r: '15–20', home: 'Crucifixo inverso inclinado com garrafas', rest: 60 }
    ],
    finisher: 'Pose de dorsal: 3 × 10 s no espelho — punhos na cintura, ombros para trás, cotovelos para frente, abra as costas.'
  },
  B: {
    code: 'B', name: 'Treino B', title: 'Peito superior e braços', sub: 'Peito superior, ombro e braços', color: 'b',
    ex: [
      { id: 'b1', n: 'Supino inclinado com halteres', s: 4, r: '8–10', home: 'Flexão com pés elevados', rest: 120 },
      { id: 'b2', n: 'Desenvolvimento com halteres sentado', s: 3, r: '8–12', home: 'Flexão pike', rest: 90 },
      { id: 'b3', n: 'Crossover de baixo para cima', s: 3, r: '12–15', home: 'Flexão lenta (3 s descendo)', rest: 60 },
      { id: 'b4', n: 'Elevação lateral em myo-reps', s: 1, r: '15–20 + 4×4–5', obs: '1 série perto da falha, depois 4 mini-séries de 4–5 com 5 respirações de pausa', home: 'Garrafas', rest: 60, tip: 'lateral' },
      { id: 'b5', n: 'Tríceps na polia', s: 3, r: '10–12', home: 'Flexão fechada ou mergulho no banco', rest: 60 },
      { id: 'b6', n: 'Rosca direta', s: 3, r: '10–12', home: 'Rosca com mochila', rest: 60 }
    ]
  },
  C: {
    code: 'C', name: 'Treino C', title: 'Pernas + finalizador', sub: 'Pernas e finalizador do V', color: 'c',
    ex: [
      { id: 'c1', n: 'Agachamento livre ou leg press', s: 4, r: '8–10', home: 'Agachamento búlgaro com mochila', rest: 120 },
      { id: 'c2', n: 'Stiff com halteres', s: 3, r: '10', home: 'Stiff unilateral com mochila', rest: 90 },
      { id: 'c3', n: 'Cadeira extensora ou afundo', s: 3, r: '12', home: 'Afundo andando', rest: 75 },
      { id: 'c4', n: 'Panturrilha em pé', s: 3, r: '15', home: 'Panturrilha num degrau', rest: 45 },
      { id: 'c5', n: 'Elevação lateral', s: 3, r: '20', obs: 'Rest-pause na última', home: 'Garrafas', rest: 50, tip: 'lateral' },
      { id: 'c6', n: 'Puxada frente aberta, leve', s: 3, r: '10–12', obs: 'Foco em sentir a dorsal', home: 'Barra fixa em séries fáceis', rest: 75, tip: 'puxada' }
    ]
  },
  AL: { code: 'AL', name: 'Treino A leve', title: 'Largura (leve)', sub: 'Metade das séries, sem falha', color: 'a', base: 'A', light: true },
  ARM: { code: 'ARM', name: 'Armstrong', title: 'Barra (Armstrong)', sub: 'Plano sem academia', color: 'arm' },
  LIVRE: { code: 'LIVRE', name: 'Livre', title: 'Atividade livre', sub: 'Esporte, corrida ou outro treino', color: 'livre' },
  R: { code: 'R', name: 'Descanso', title: 'Descanso', sub: 'Caminhada leve; postura e vacuum continuam', color: 'r' }
};

export const CODES = ['A', 'B', 'C', 'AL', 'ARM', 'LIVRE', 'R'];

export const ARMSTRONG = [
  'Dia 1 — 5 séries máximas de barra.',
  'Dia 2 — pirâmide: 1, 2, 3 repetições… até não completar, depois uma série máxima.',
  'Dia 3 — 9 séries de um número fixo: 3 pronada, 3 supinada e 3 aberta.',
  'Dia 4 — quantas séries conseguir do número fixo.',
  'Dia 5 — repita o dia que foi mais difícil.'
];

export const GUIDE = [
  { id: 'muda', t: 'O que muda em 15 dias', html: `
    <p>Em 15 dias dá para mudar o formato visível: ombro mais cheio, costas mais abertas, cintura mais fechada e postura reta. Não dá para mudar o esqueleto nem criar muito músculo novo, então o plano aposta em cinco alavancas, em ordem de impacto:</p>
    <ol>
      <li><b>Creatina com saturação rápida</b> — músculo mais cheio em cerca de uma semana (água dentro da fibra, não retenção sob a pele).</li>
      <li><b>Especialização em deltoide lateral e dorsal</b> — os dois músculos que alargam a parte de cima do V, treinados 2 a 3 vezes por semana, mais séries curtas diárias de barra fixa.</li>
      <li><b>Postura</b> — ombros para trás e peito aberto aumentam a largura aparente no mesmo dia.</li>
      <li><b>Cintura sem inchaço</b> — vacuum abdominal, nada de oblíquo com peso e menos gás.</li>
      <li><b>Comer o suficiente</b> — com 63 kg, o limite mais provável é caloria e proteína, não o treino.</li>
    </ol>
    <p>A largura vem do ombro e da dorsal; peito superior, braços e pernas entram em volume menor para o corpo não ficar desproporcional. Cada exercício tem uma alternativa sem academia.</p>` },
  { id: 'treinos', t: 'Como treinar', html: `
    <p>O deltoide lateral recebe cerca de 15 séries a cada três treinos e a dorsal cerca de 13 — é a especialização que abre o V. Descanse 2 min nos exercícios grandes e 45–60 s nas elevações laterais. A cada treino, tente +1 repetição ou um pouco mais de peso.</p>
    <ul>
      <li><b>Elevação lateral:</b> ${TIPS.lateral}</li>
      <li><b>Barra e puxada:</b> ${TIPS.puxada}</li>
      <li><b>Dor na articulação do ombro</b> (pontada, não queimação muscular): corte as séries de elevação lateral pela metade até passar.</li>
    </ul>
    <p>Se você nunca treinou ou está parado há meses, use o menor número de séries indicado nos dias 1 a 4 e suba depois.</p>` },
  { id: 'gtg', t: 'Grease the Groove (dias B e C)', html: `
    <p>Método popularizado por Pavel Tsatsouline, ex-instrutor das forças especiais soviéticas: muitas séries fáceis ao longo do dia, nunca até a falha.</p>
    <ol>
      <li>Use o máximo de barras testado no dia 1.</li>
      <li>Faça séries de metade desse número (máximo 8 → séries de 4).</li>
      <li>De 5 a 8 séries no dia, com pelo menos 1 h entre elas.</li>
      <li>Máximo abaixo de 3: troque por negativas — suba com ajuda de uma cadeira e desça em 5 s, 2–3 por série.</li>
    </ol>
    <p>Uma barra de porta resolve no quarto. A barra diária melhora técnica e força; o músculo cresce mesmo pelas séries pesadas dos treinos A e C.</p>` },
  { id: 'armstrong', t: 'Programa Armstrong (sem academia)', html: `
    <p>Criado pelo Major Charles Lewis Armstrong, dos Marines, para aumentar o número de barras. Cinco dias de barra por semana e dois de descanso, mais flexões todas as manhãs.</p>
    <ul><li><b>Toda manhã:</b> 3 séries máximas de flexão.</li>${ARMSTRONG.map(t => `<li>${t.replace(/^(Dia \d)/, '<b>$1</b>')}</li>`).join('')}</ul>
    <p>Nessa versão, mantenha as elevações laterais com garrafas do Treino A e as pernas do Treino C sem academia, três vezes por semana.</p>` },
  { id: 'postura', t: 'Postura, cintura e pose', html: `
    <p>É a parte que muda o formato mais rápido: resultado visível já na primeira semana, em menos de 10 minutos por dia.</p>
    <h4>Postura — 5 min ao acordar</h4>
    <ul><li>Chin tuck (puxar o queixo para trás): 2 × 10</li><li>Anjo na parede (wall slide): 2 × 10</li><li>Deitado sobre uma toalha enrolada na altura das escápulas: 1 min</li><li>Alongamento de peitoral no batente da porta: 2 × 30 s por lado</li></ul>
    <p>Durante o dia: ombros para trás e para baixo, peito levemente para cima.</p>
    <h4>Vacuum abdominal — 3 × 20–30 s por dia</h4>
    <p>Em pé ou de quatro apoios, solte todo o ar, puxe o umbigo para dentro e para cima e segure respirando curto. Não queima gordura; treina o músculo que mantém a barriga recolhida.</p>
    <h4>Cintura</h4>
    <ul><li>Nada de inclinação lateral com halter ou oblíquo pesado nesses 15 dias; vacuum e prancha bastam.</li><li>Refrigerante, chiclete e comer rápido aumentam gás e inchaço.</li><li>Mantenha feijão e salada constantes; aumentar fibra de repente incha.</li></ul>
    <h4>Pose de dorsal — fim do Treino A</h4>
    <p>3 × 10 s na frente do espelho: punhos na cintura, ombros para trás, empurre os cotovelos para frente e abra as costas.</p>` },
  { id: 'dieta', t: 'Dieta sem carne', html: `
    <p>Meta: cerca de 2.700–2.800 kcal e pelo menos 120 g de proteína por dia (cerca de 1,9 g/kg), para ganhar músculo sem engordar a cintura. O cardápio é ovolactovegetariano: a proteína vem de ovos, laticínios, leguminosas, soja e whey.</p>
    <h4>Regra do prato — almoço e jantar</h4>
    <ul>
      <li><b>Carboidrato:</b> arroz, macarrão ou batata, cerca de metade do prato.</li>
      <li><b>Leguminosa:</b> 2 conchas de feijão, lentilha ou grão-de-bico — dobre o que você costuma pegar.</li>
      <li><b>Proteína do dia:</b> ovo, omelete, queijo, tofu, PTS; repita se puder.</li>
      <li><b>Salada e legumes:</b> um punhado; à noite, sem exagero.</li>
      <li><b>Sem proteína no cardápio:</b> complete com uma dose de whey ou ovos e queijo do kit.</li>
    </ul>
    <p><b>Arroz + feijão</b> juntos fecham a proteína completa; leguminosa no almoço e no jantar é a base do plano sem carne.</p>
    <h4>Kit do quarto (sem geladeira)</h4>
    <p>Whey, creatina, leite em pó integral, aveia em flocos, pasta de amendoim, banana, amendoim ou castanhas, PTS seca e uma coqueteleira.</p>
    <h4>Refeição livre do fim de semana</h4>
    <p>Pizza, hambúrguer vegetal ou lanche com queijo contam como a proteína daquela refeição; queijo extra ajuda e a batata frita entra nas calorias. O resto do dia segue igual. Na véspera da medição final, coma a refeição livre no almoço, não à noite, para não medir inchado.</p>
    <h4>Água e ajuste</h4>
    <ul><li>3 L de água por dia; uma garrafa de 1 L enchida três vezes.</li><li>Se no dia 8 o peso não tiver subido nada, acrescente um shake extra de leite em pó, aveia e pasta de amendoim.</li></ul>` },
  { id: 'creatina', t: 'Creatina e whey', html: `
    <p>A creatina com fase de carga satura o músculo em 5–7 dias, contra cerca de 4 semanas com 3–5 g por dia. O nível final é o mesmo; só muda a velocidade.</p>
    <ul>
      <li><b>Dias 1–7:</b> 20 g/dia (cerca de 0,3 g/kg) em 4 × 5 g — café, lanche, almoço e pós-treino.</li>
      <li><b>Dia 8 em diante:</b> 5 g/dia, uma vez, com uma refeição, inclusive no descanso.</li>
      <li><b>Peso:</b> deve subir 1–2 kg na primeira semana; é água dentro do músculo.</li>
      <li><b>Estômago:</b> 20 g por dia pode dar desconforto ou fezes moles. Dividir em 4 doses e tomar com comida ajuda; se continuar, fique em 10 g por dia (2 × 5 g).</li>
      <li><b>Whey:</b> 2 doses por dia, espaçadas. O total de proteína do dia pesa mais que o horário exato.</li>
    </ul>` },
  { id: 'nao', t: 'O que não fazer', html: `
    <ul>
      <li><b>Atalhos químicos:</b> anabolizantes, termogênicos e diuréticos têm risco real à saúde. Diurético e corte de água ou sal ainda murcham o músculo.</li>
      <li><b>Falha em tudo, todo dia:</b> só a última série dos isoladores vai até a falha; o resto para 1–2 repetições antes.</li>
      <li><b>Pular refeição:</b> se o refeitório não tiver nada bom, use o kit; refeição pulada é músculo que não vem.</li>
      <li><b>Dormir menos de 7 h:</b> a recuperação de seis treinos por semana depende disso.</li>
      <li><b>Trocar o plano no meio:</b> 15 dias é pouco; ajuste os dias no calendário, mas mantenha os treinos.</li>
    </ul>` },
  { id: 'fontes', t: 'Fontes', html: `
    <ul class="links">
      <li><a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5477153/" target="_blank" rel="noopener">ISSN — posição sobre proteína e exercício (2017)</a></li>
      <li><a href="https://www.healthline.com/nutrition/creatine-loading-phase" target="_blank" rel="noopener">Healthline — fase de carga de creatina</a></li>
      <li><a href="https://www.medicalnewstoday.com/articles/creatine-loading-phase" target="_blank" rel="noopener">Medical News Today — fase de carga de creatina</a></li>
      <li><a href="https://getfitcraft.com/science/creatine-loading-vs-maintenance-research" target="_blank" rel="noopener">FitCraft — carga vs. manutenção de creatina</a></li>
      <li><a href="https://getfitcraft.com/science/greasing-the-groove" target="_blank" rel="noopener">FitCraft — Grease the Groove e hipertrofia</a></li>
      <li><a href="https://breakingmuscle.com/grease-the-groove-training/" target="_blank" rel="noopener">Breaking Muscle — Grease the Groove</a></li>
      <li><a href="https://www.insidehook.com/wellness/armstrong-pull-routine" target="_blank" rel="noopener">InsideHook — programa Armstrong</a></li>
      <li><a href="https://liftvault.com/creator/charles-lewis-armstrong/" target="_blank" rel="noopener">Lift Vault — estrutura do programa Armstrong</a></li>
      <li><a href="https://doaj.org/article/3c93be70ff61469c9cf475fb4f5360ea" target="_blank" rel="noopener">Frontiers in Physiology — elevação lateral com halter vs. polia (2025)</a></li>
      <li><a href="https://lida.sport-iat.de/ta/Record/4052540" target="_blank" rel="noopener">Journal of Sports Sciences — meta-análise de frequência de treino</a></li>
      <li><a href="https://www.nepa.unicamp.br/taco/" target="_blank" rel="noopener">TACO (Unicamp) — tabela de composição de alimentos</a></li>
      <li><a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener">Open Food Facts — busca de produtos e rótulos</a></li>
    </ul>` }
];

/* Alimentos sem carne. Valores por porção (u), aproximados da TACO/Unicamp e USDA.
   g = grupo de substituição: prot, leg, carb, gord, fruta, veg, bebida, livre. */
export const FOODS = {
  ovo:        { n: 'Ovo cozido ou mexido', u: '1 unidade (50 g)', k: 73, p: 6.6, g: 'prot' },
  omelete:    { n: 'Omelete (2 ovos)', u: '1 porção', k: 180, p: 13, g: 'prot' },
  minas:      { n: 'Queijo minas frescal', u: '1 fatia (30 g)', k: 79, p: 5.2, g: 'prot' },
  mussarela:  { n: 'Queijo muçarela', u: '2 fatias (30 g)', k: 99, p: 6.8, g: 'prot' },
  cottage:    { n: 'Queijo cottage', u: '100 g', k: 98, p: 11, g: 'prot' },
  iogurte:    { n: 'Iogurte natural integral', u: '1 pote (170 g)', k: 104, p: 7, g: 'prot' },
  tofu:       { n: 'Tofu firme', u: '100 g', k: 144, p: 17, g: 'prot' },
  pts:        { n: 'PTS (proteína texturizada de soja), seca', u: '30 g', k: 99, p: 15, g: 'prot' },
  hambveg:    { n: 'Hambúrguer vegetal', u: '1 unidade (113 g)', k: 230, p: 19, g: 'prot' },
  whey:       { n: 'Whey protein', u: '1 dose (32 g)', k: 125, p: 23, g: 'prot' },
  protveg:    { n: 'Proteína vegetal (ervilha/arroz)', u: '1 dose (30 g)', k: 115, p: 22, g: 'prot' },
  leitepo:    { n: 'Leite em pó integral', u: '2 colh. sopa (26 g)', k: 129, p: 6.6, g: 'prot' },
  leite:      { n: 'Leite integral', u: '1 copo (200 ml)', k: 122, p: 6.4, g: 'prot' },
  leitesoja:  { n: 'Bebida de soja', u: '1 copo (200 ml)', k: 80, p: 6.6, g: 'prot' },
  feijao:     { n: 'Feijão cozido', u: '1 concha (100 g)', k: 76, p: 4.8, g: 'leg' },
  lentilha:   { n: 'Lentilha cozida', u: '1 concha (100 g)', k: 93, p: 6.3, g: 'leg' },
  grao:       { n: 'Grão-de-bico cozido', u: '1 concha (100 g)', k: 164, p: 8.9, g: 'leg' },
  soja:       { n: 'Soja em grão cozida', u: '1 concha (100 g)', k: 173, p: 16.6, g: 'leg' },
  ervilha:    { n: 'Ervilha cozida', u: '1 concha (100 g)', k: 84, p: 5.4, g: 'leg' },
  arroz:      { n: 'Arroz branco cozido', u: '4 colh. sopa (100 g)', k: 128, p: 2.5, g: 'carb' },
  integral:   { n: 'Arroz integral cozido', u: '4 colh. sopa (100 g)', k: 124, p: 2.6, g: 'carb' },
  macarrao:   { n: 'Macarrão cozido', u: '1 escumadeira (100 g)', k: 157, p: 5.8, g: 'carb' },
  batata:     { n: 'Batata cozida', u: '100 g', k: 52, p: 1.2, g: 'carb' },
  batatadoce: { n: 'Batata-doce cozida', u: '100 g', k: 77, p: 0.6, g: 'carb' },
  mandioca:   { n: 'Mandioca cozida', u: '100 g', k: 125, p: 0.6, g: 'carb' },
  cuscuz:     { n: 'Cuscuz de milho', u: '100 g', k: 113, p: 2.2, g: 'carb' },
  pao:        { n: 'Pão francês', u: '1 unidade (50 g)', k: 150, p: 4, g: 'carb' },
  paoint:     { n: 'Pão integral', u: '2 fatias (50 g)', k: 127, p: 4.7, g: 'carb' },
  tapioca:    { n: 'Tapioca', u: '1 média (50 g de goma)', k: 170, p: 0, g: 'carb' },
  aveia:      { n: 'Aveia em flocos', u: '3 colh. sopa (45 g)', k: 177, p: 6.2, g: 'carb' },
  granola:    { n: 'Granola', u: '40 g', k: 170, p: 4, g: 'carb' },
  pasta:      { n: 'Pasta de amendoim', u: '2 colh. sopa (32 g)', k: 188, p: 8, g: 'gord' },
  amendoim:   { n: 'Amendoim torrado', u: '1 punhado (30 g)', k: 182, p: 6.6, g: 'gord' },
  castanha:   { n: 'Castanha-do-pará ou de caju', u: '1 punhado (20 g)', k: 120, p: 3, g: 'gord' },
  abacate:    { n: 'Abacate', u: '100 g', k: 96, p: 1.2, g: 'gord' },
  azeite:     { n: 'Azeite', u: '1 colh. sopa (10 ml)', k: 88, p: 0, g: 'gord' },
  requeijao:  { n: 'Requeijão', u: '1 colh. sopa (30 g)', k: 77, p: 2.9, g: 'gord' },
  banana:     { n: 'Banana', u: '1 unidade', k: 98, p: 1.3, g: 'fruta' },
  maca:       { n: 'Maçã', u: '1 unidade', k: 73, p: 0.3, g: 'fruta' },
  laranja:    { n: 'Laranja', u: '1 unidade', k: 67, p: 1.4, g: 'fruta' },
  mamao:      { n: 'Mamão', u: '1 fatia (150 g)', k: 60, p: 0.8, g: 'fruta' },
  manga:      { n: 'Manga', u: '1 unidade pequena (150 g)', k: 96, p: 0.6, g: 'fruta' },
  uva:        { n: 'Uva', u: '1 cacho pequeno (100 g)', k: 53, p: 0.7, g: 'fruta' },
  salada:     { n: 'Salada de folhas e tomate', u: '1 prato de sobremesa', k: 25, p: 1, g: 'veg' },
  legumes:    { n: 'Legumes cozidos', u: '100 g', k: 40, p: 1.5, g: 'veg' },
  brocolis:   { n: 'Brócolis cozido', u: '100 g', k: 25, p: 2.1, g: 'veg' },
  cafeleite:  { n: 'Café com leite', u: '1 xícara (100 ml de leite)', k: 61, p: 3.2, g: 'bebida' },
  cafe:       { n: 'Café preto', u: '1 xícara', k: 3, p: 0.2, g: 'bebida' },
  pizza:      { n: 'Pizza de muçarela', u: '1 fatia', k: 270, p: 11, g: 'livre' },
  sandqueijo: { n: 'Misto vegetariano (pão e queijo)', u: '1 unidade', k: 330, p: 15, g: 'livre' },
  fritas:     { n: 'Batata frita', u: '1 porção média (100 g)', k: 312, p: 3.4, g: 'livre' }
};

export const GROUPS = {
  prot: 'Proteína', leg: 'Leguminosa', carb: 'Carboidrato', gord: 'Gordura boa',
  fruta: 'Fruta', veg: 'Salada e legumes', bebida: 'Bebida', livre: 'Refeição livre', ext: 'Busca externa'
};

// Grupos que se trocam pela proteína; os demais pela caloria.
export const SWAP_BY_PROTEIN = ['prot', 'leg'];

// Cardápio-modelo sem carne (q = quantidade de porções)
export const MEALS = [
  { id: 'cafe', n: 'Café da manhã', h: 'refeitório', items: [['pao', 2], ['ovo', 2], ['cafeleite', 1], ['banana', 1]] },
  { id: 'lanche', n: 'Lanche da manhã', h: 'quarto · shake', items: [['whey', 1], ['leitepo', 1], ['aveia', 1]] },
  { id: 'almoco', n: 'Almoço', h: 'refeitório · regra do prato', items: [['arroz', 2], ['feijao', 2], ['omelete', 1], ['salada', 1]] },
  { id: 'pos', n: 'Pós-treino', h: 'quarto', items: [['whey', 1], ['banana', 1]] },
  { id: 'jantar', n: 'Jantar', h: 'refeitório · regra do prato', items: [['arroz', 2], ['lentilha', 2], ['minas', 2], ['legumes', 1]] },
  { id: 'ceia', n: 'Ceia', h: 'quarto', items: [['pasta', 1], ['banana', 1]] }
];
