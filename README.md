# Transparência

Ferramentas de transparência de órgãos públicos brasileiros. Primeira frente:
**TSE — ranking de responsáveis (fiscais/gestores) pelos maiores valores
consolidados de contratos**, a partir da fonte oficial indicada pelo próprio
TSE: [Consulta contratos, convênios e outros (Compras.gov.br)](https://contratos.comprasnet.gov.br/transparencia/contratos?unidade=TSE).

## Status

- ✅ Lógica de agregação/ranking (`src/tse/rankResponsaveis.js`) — implementada e testada.
- ✅ CLI para gerar o ranking em CSV a partir de um JSON de contratos (`src/tse/cli.js`).
- ✅ Extração real dos contratos do TSE (`src/tse/scrapeContratos.js`) — testada
  contra a API oficial, 1268 contratos extraídos com sucesso.
- ✅ Dashboard web (`web/`) — Next.js (App Router) + Tailwind CSS + componentes
  no padrão shadcn/ui + Recharts, com dados reais agregados.
- ✅ Funções comissionadas FC/CJ por servidor (`/funcoes`) — fonte primária:
  relação atual de agentes públicos (`src/tse/scrapeAgentesPublicos.js`);
  fonte secundária/histórico: portarias (`src/tse/scrapeFuncoes.js`).
  Reconciliação entre as duas com observações de inconsistência — ver seção
  própria abaixo.
- ✅ Correção manual de dados sabidamente errados via arquivo de exceções
  (`data/tse_excecoes.json`, `src/tse/excecoes.js`) — ver seção "Exceções"
  abaixo.
- ✅ Dias em regime de teletrabalho por servidor (`/teletrabalho`) —
  fonte: [Servidores em regime de Teletrabalho (TSE)](https://www.tse.jus.br/transparencia-e-prestacao-de-contas/pessoal/cargos-e-funcoes/servidores-em-regime-de-teletrabalho)
  (`src/tse/scrapeTeletrabalho.js`), com a estrutura completa da lotação de
  cada período (seção → coordenadoria → secretaria/gabinete/assessoria,
  como veio da fonte). Cruzamento com fiscais/gestores e função comissionada
  por nome normalizado (`src/tse/agregarTeletrabalho.js`), mesma limitação
  de homônimos das outras fontes sem CPF/matrícula em comum. A fonte também
  tem um botão "Detalhar" por período que aponta para um suposto
  detalhamento dia-a-dia — testado manualmente contra vários registros reais
  e ele nunca retornou dado nenhum, então não é usado aqui.
- ✅ A antiga página `/responsaveis` foi renomeada para `/fiscais` (rota e
  label) — nome interno de dados (`DashboardData.responsaveis`) não mudou.
- ✅ `/fiscais` renomeada para `/servidores` — título **Servidores (Agentes
  Públicos)** — e passou a listar **todos** os agentes públicos do TSE, não só
  fiscais/gestores (`web/app/servidores/`, `ServidoresDashboard`,
  `FiltroServidores`, `CategoriaValorServidoresCard`; nome interno de dados
  `DashboardData.responsaveis` segue igual).
  - **`DashboardData.servidores`** (`agregarDashboard.js`): uma linha por
    agente público da relação oficial de hoje, unida a quem aparece como
    fiscal/gestor em contrato sem constar nela (ex-servidor / divergência de
    grafia entre as fontes) — ~1.032 pessoas. Cada linha tem `rankingIndex`
    (índice em `responsaveis.ranking`, `null` quem não fiscaliza nada) e
    `funcoesIndex` (índice em `funcoes.servidores`, `null` quem nunca teve
    FC/CJ), resolvidos por nome normalizado no servidor.
  - No card de **Filtro** a seção **Por função** subiu para primeiro; o
    checkbox "Incluir quem não tem função vigente" virou dois chips: **SEM
    FUNÇÃO** (mesmo efeito) e **VIGENTE** (ligado por padrão = recorta só pela
    função comissionada de hoje; desligado = casa também o histórico de FC/CJ
    das portarias).
  - Em **Por contratos**: "Somente contratos vigentes" virou o chip
    **VIGENTE**; "Considerar substitutos" começa DESLIGADO.
  - Na subseção **Por papel**, um chip sintético **NÃO FISCAL** (ligado por
    padrão, mesmo termo `zeroFiscal` de `/funcoes`) mescla os servidores que
    não são fiscais/gestores de nenhum contrato — filtrados só por função, que
    é sobre a pessoa. Desligá-lo deixa só o ranking de fiscais, como a antiga
    `/fiscais`; e desmarcar todos os papéis reais mantendo o NÃO FISCAL mostra
    só os não-fiscais.
  - KPIs de valor (medianas, donut "Fiscais designados") passam a considerar
    só quem tem contrato, com rótulo "de N servidores".
  - O codec `incluidos` de `web/lib/url-filtros.ts` ganhou o sentinela `-`
    para "nenhum selecionado": em `/servidores`, "por função" ou "por papel"
    vazios são um recorte real (só quem não tem função / só os não-fiscais),
    então precisam ir para o link — antes o `escrever` devolvia `undefined`
    (igual a "tudo") e o estado se perdia ao compartilhar. Os `useEffect` de
    auto-seleção da página só disparam na transição "lista carregou pela 1ª
    vez", para não repor um "nenhum" deliberado quando os dados atualizam em
    runtime.
- ✅ Estrutura hierárquica de unidades do TSE (`/unidades`) — fonte: o
  endpoint JSON por trás do organograma oficial
  ([agrupamento por unidade](https://transparencia.tse.jus.br/transparenciaDadosServidores/smvc/relatorios/lotacao-geral/sem-assinatura/agrupamento-por-unidade),
  `src/tse/scrapeUnidades.js`). Cruzada por nome de unidade normalizado com a
  relação de agentes públicos, teletrabalho vigente e fiscais/gestores
  (`src/tse/agregarUnidades.js`) — mesma limitação de homônimos/divergência de
  grafia entre fontes das demais páginas; registros que não batem com nenhuma
  unidade da árvore (ou batem com mais de uma) ficam contabilizados à parte
  em vez de descartados. Pirâmide vertical (TSE no topo) com toggle
  "Consolidado: sim/não" por unidade (soma da subárvore vs. só quem está
  lotado ali direto), busca por sigla/nome e expandir/recolher tudo.
- ✅ Faixas de valor de contrato em `/fiscais` (`web/lib/categorias-valor.ts`) —
  6 categorias fixas por teto de "Valor Global" (irrisório 🥉 até R$100, baixo
  custo 🥈 até R$10 mil, médio custo 🥇 até R$100 mil, alto custo 🏆 até
  R$1 milhão, altíssimo custo 👑 até R$10 milhões, custo extra alto 💎
  acima disso), cada uma com um dos 6 slots de cor categórica validados do
  projeto (`--chart-1..6`). Dois KPIs novos: "Contratos por faixa de valor"
  (donut sobre todo o universo de contratos, respeitando "Somente contratos
  vigentes") e "Fiscais por faixa de valor" (barras, não donut — a mesma
  pessoa pode fiscalizar contratos de mais de uma faixa, então a contagem não
  é uma partição exclusiva; base = ranking já filtrado por papéis/vigência,
  antes do filtro de faixa, para servir de panorama estável enquanto esse
  filtro é ajustado). As faixas viraram chips coloridos no card de filtro
  unificado (`FiltroFiscais`, ver abaixo) — filtro em dois estágios:
  papéis/função/vigência primeiro, faixa de valor depois, ambos recalculando
  valor consolidado e papéis de cada linha a partir só dos contratos que
  sobrevivem aos dois filtros. Cada linha da
  tabela de ranking ganhou a coluna "Faixas", com os símbolos (badge colorido
  na cor da faixa) de todas as faixas presentes entre os contratos do
  servidor no filtro atual.
- ✅ Coluna "Lotação" na tabela de servidores com função comissionada em
  `/funcoes` (`web/lib/lotacao-hierarquia.ts`) — resolve o nome plano de
  lotação da relação de agentes públicos contra a árvore oficial de unidades
  (`/unidades`) e mostra o caminho de siglas da unidade mais específica para a
  mais alta, só os 3 primeiros níveis — ex.: `SEVIN / COTEL / STI` (suficiente
  para identificar a lotação sem arrastar secretaria/presidência em toda
  linha; a raiz TSE fica de fora; quando o nome não bate em exatamente um nó,
  cai no nome plano da fonte). Coluna filtrável por campo de texto com `datalist` das lotações
  presentes (digitar para filtrar por trecho ou escolher da lista) e
  ordenável crescente/decrescente.
- ✅ Painel de filtro genérico em `/funcoes` (`FuncoesFilter`) — `/fiscais` tem
  o seu próprio (`FiltroFiscais`, ver abaixo). Passou a se chamar só "Filtro" e
  reúne, em seções de chips: (1)
  nível de função comissionada (CJ-1…FC-6), (2) "Atuação em contratos" — um
  toggle para cada papel real do ranking de responsáveis (Fiscal Técnico,
  Fiscal Administrativo, Gestor, substitutos…) mais um toggle sintético
  "Não-Fiscal" para quem nunca aparece como responsável (antes era o checkbox
  "Somente Não-Fiscal" da tabela, agora removido), e (3) o toggle "Vigente",
  que restringe a quem tem função vigente hoje (`funcaoAtual`) e casa os
  níveis selecionados só com a função vigente. Função e atuação combinam em E;
  dentro de cada seção é OU; seção sem nada marcado não restringe.
- ✅ Responsivo em telas de celular (320px+) — testado com Playwright em
  320/375/768px nas 3 páginas. Cabeçalhos quebram para uma segunda linha em
  vez de estourar a tela (nav com só ícone abaixo de `sm:`); tabelas crescem
  além do card e rolam horizontalmente dentro do próprio container
  (`overflow-x-auto`) sem derrubar a página inteira em scroll horizontal;
  gráficos dentro de grid (`Evolução`/`Divisão por categoria`) ganharam
  `min-w-0` no Card raiz — sem isso, o item de grid não encolhe abaixo do
  conteúdo interno do gráfico, e a rosca de tema (`ThemePicker`) tinha o
  dropdown saindo da tela por causa do grupo de botões ficar alinhado à
  esquerda ao quebrar linha (trocado por `ml-auto`, que mantém alinhado à
  direita em qualquer situação).
- ✅ Representação visual dos perfis de fiscalização/gestão
  (`web/lib/perfis-fiscalizacao.ts`) — cada "papel" da fonte vira emoji +
  rótulo curto (🤴 Autoridade, 🧑‍💼 Gestor, 👮‍♂️ Fiscal, 🧑‍🔬 Técnico,
  👨‍🎓 Requisitante, 👷 Setorial, 🕵️‍♂️ Administrativo, 💂‍♂️ Responsável
  Unidade, 📜 Contratos, 🤵‍♂️ Conta Vinculada, 👨‍💻 Apoio); variantes
  "Substituto" reaproveitam emoji/rótulo do titular e ganham um 🔄 ao final.
  Aplicado em todo lugar que mostra papel (coluna "Papéis" do ranking, filtro
  de `/fiscais`, seção "Atuação em contratos" do `FuncoesFilter`, chips de
  `/unidades`, modal de contratos), sempre com o nome completo original no
  `title`. As faixas de valor de contrato trocaram os símbolos `$`/`$$$` por
  medalhas/troféus em ordem crescente: 🥉 🥈 🥇 🏆 👑 💎.
- ✅ Filtro unificado em `/fiscais` (`FiltroFiscais`, substitui `PapeisFilter`
  + `CategoriaValorFilter` + o botão "Somente vigentes"). Um card só, com a
  hierarquia: **Por contratos** (checkboxes "Somente contratos vigentes" e
  "Considerar substitutos") → sub-cards **Por papel** (chips agrupados pela
  taxonomia de `perfis-fiscalizacao.ts`: Autoridade / Gestão / Fiscalização /
  Responsáveis / Apoio, com cada substituto 🔄 pareado ao titular; clicar no
  cabeçalho do grupo alterna o grupo inteiro) e **Por valor** (as 6 faixas);
  e **Por função** — filtro NOVO que recorta o ranking pelo cargo comissionado
  vigente do servidor (FC-1…CJ-4) mais o toggle "Incluir quem não tem função
  vigente". Quando "Considerar substitutos" está desligado, os papéis 🔄 saem
  da conta e some quem só entra como substituto num contrato. Sem "gaivota" de
  seleção — o estado é só cor (sólido/tingido = dentro, riscado = fora,
  apagado = desabilitado). No celular o card colapsa num botão "Filtro (N
  ativos)" que abre o mesmo conteúdo num sheet (`Dialog`); "Limpar" volta tudo
  ao estado permissivo.
- ✅ Profissionais terceirizados (`/terceirizados`) — fonte: os PDFs mensais
  de ["postos de trabalho – contratos de cessão de mão de obra" do TSE](https://www.tse.jus.br/transparencia-e-prestacao-de-contas/pessoal/profissionais-terceirizados-contratos-com-cessao-de-mao-de-obra)
  (`src/tse/scrapeTerceirizados.js` baixa **todas** as competências listadas,
  não só a mais recente, com cache incremental por competência em
  `data/tse_terceirizados.json`). `src/tse/agregarTerceirizados.js` monta uma
  linha por pessoa com: lotação (até 3 siglas, da unidade mais específica para
  a mais alta, cruzando a coluna "Alocação" com a árvore de `/unidades`),
  **todos os contratos de cessão por que passou** (`contratosHistorico`,
  cronológico — metade das pessoas migrou de um contrato para outro quando o
  serviço foi re-licitado; a coluna lista cada contrato com o nome da empresa contratada, o atual em
  destaque, e cada um abre o modal **Detalhes do Contrato**), **mês de
  início** (primeira competência em que o nome aparece, em qualquer contrato)
  e **mês de fim** (só quando a pessoa deixa de constar na competência mais
  recente — saída definitiva; em branco = ainda contratado). Tabela de terceirizados com
  filtros por nome e por lotação e toggle **Vigente** (padrão ligado — ver
  "Regra: filtro Vigente sempre ligado por padrão", na seção Dashboard web);
  tabela de **contratos de cessão** com filtro textual por empresa, toggle
  **Vigente** (contratos com terceirizado ativo hoje) e ordenação da coluna
  Contrato quebrando "NN/AAAA" por ano→número ou número→ano (× asc/desc).
  Ambas as tabelas colapsáveis. Os **4 KPIs do topo são roscas** numa linha só
  (os 2 primeiros largos, os 2 últimos compactos — `KpiRoscaCard` sobre
  `ContagemDonut`), cada uma com uma nota e um atalho para o detalhe
  correspondente, e fatias/legenda clicáveis:
  **Terceirizados ativos** = ativos por contrato de cessão (10 maiores +
  "Outros"; clique → modal "Detalhes do Contrato"; atalho → tabela com
  Vigente ligado); **Contratos de cessão** = os 10 contratos de maior valor
  global + "Outros" (mesmo clique/atalho); **Já deixaram o TSE** = encerrados
  × ainda no TSE, sobre o total (vigentes + não vigentes); atalho liga o
  toggle **Só encerrados** da tabela (que também fica disponível no cabeçalho
  dela, ao lado do Vigente); **Falhas de cruzamento** = terceirizados
  afetados × sem falha, sobre o total; atalho rola até o "Registro de falhas"
  e o expande.
  KPI por contrato
  (terceirizados ativos e no histórico, com desempate de contratos de número
  igual entre modalidades pela empresa). O número do contrato é canonicalizado
  (`canonicalContrato` em `nomesTerceirizados.js`): "1/2025", "01/2025" e
  "00001/2025" são o mesmo contrato — também vale para espaço em volta da barra
  e ano de 2 dígitos. Um "Registro de falhas" (cada tipo com hint) reúne quem
  ficou sem lotação identificada, sem alocação no PDF, com contrato não
  vinculado ao Compras.gov.br, **sem nome** (linha do PDF que só trouxe o
  cargo) ou **possível duplicata**: outro terceirizado com nome quase idêntico
  (um "sobrenome" diferindo por 1–2 letras — "Souza"/"Sousa", "Santos"/"Antos")
  — em geral a mesma pessoa contada duas vezes por erro de OCR. A detecção
  sugere a grafia mais comum na base; as sugestões viram `renomearPessoa` em
  `data/tse_terceirizados_excecoes.json` (nome limpo → nome canônico), que o
  agregador aplica antes de agrupar por pessoa — as 40 detectadas até aqui já
  estão no arquivo (funde ~40 pares, −40 pessoas).
  Limpeza da leitura do PDF em `src/tse/nomesTerceirizados.js`: o OCR
  frequentemente gruda no fim do nome o cargo ("ABADIA CORREA CORTE Técnico
  em Secretariado…"), uma anotação de situação ("… FÉRIAS 27/11 A 26/12/23",
  "… (admitido)") ou joga o nome para dentro do campo empresa — a heurística
  corta no menor índice entre um léxico de ~120 primeiras-palavras de cargo,
  marcadores de nível/CBO/carga-horária e marcadores de anotação, e resgata
  o nome do campo empresa quando some. Competências em que isso quebra >40%
  das linhas (2023-04 e 2023-08) são **descartadas inteiras** do cálculo de
  mês de início/fim. O que sobra (erro de OCR na própria grafia do nome,
  ex.: "Pereia" por "Pereira") é corrigível à mão em
  `data/tse_terceirizados_excecoes.json` (`descartar` / `renomear`). O modal
  **Detalhes do Contrato**
  (`web/components/dashboard/detalhes-contrato-dialog.tsx`) é o padrão novo
  para detalhe de contrato: número, fornecedor, objeto em uma linha, valores
  global/empenhado/pago, vigência (chip **VIGENTE**), classificação do app e —
  para contratos de cessão — a quantidade de terceirizados, com link para o
  Compras.gov.br.

O rodapé de cada página traz um identificador de versão do app
(`web/lib/version.ts`, `APP_VERSION`) — atual: **v0.35**.

## Dashboard web

App em `web/`, com **carga automática de dados**: basta rodar o app —
nenhum script manual é necessário.

### Inicialização Rápida com Scripts de Carga

Na raiz do repositório, você pode usar os scripts que verificam dependências, atualizam todos os dados brutos e iniciam o portal:

**Windows (PowerShell):**
```powershell
.\start.ps1
```

**Linux / macOS (Bash):**
```bash
chmod +x ./start.sh
./start.sh
```

**Ou diretamente via npm na raiz:**
```bash
npm start
```

### Inicialização Manual do Web App
```bash
cd web
npm install
npm run dev                                         # http://localhost:3000
```

Como funciona a carga: a página abre instantaneamente com um snapshot
embutido no build; ao carregar, o cliente chama `/api/tse/dados?atualizar=1`
e o **servidor do app** faz o scrape da fonte em background (com cache em
disco em `web/.cache/`, TTL de 6h e trava contra execuções simultâneas),
enquanto o header mostra o progresso ("atualizando da fonte 600/1272"); ao
concluir, a UI troca para os dados frescos.

O scrape não pode rodar no navegador do usuário: a fonte não envia
cabeçalhos CORS e o fluxo exige cookie de sessão `httponly` + token CSRF,
inacessíveis cross-origin — por isso a rota de API do próprio app faz esse
papel, reutilizando o mesmo pipeline de `src/tse/`.

Os scripts CLI continuam existindo para uso avulso (gerar CSV do ranking,
atualizar o snapshot embutido):

```bash
npm run tse:scrape -- TSE data/tse_contratos.json   # extrai (raiz do repo)
npm run tse:scrape-unidades                         # extrai a árvore de unidades
npm run tse:scrape-terceirizados                    # baixa os PDFs mensais de terceirizados (todas as competências)
cd web && npm run data                              # regrava o snapshot embutido
```

Conteúdo: 3 cards de resumo (valor total contratado, contratos vigentes,
responsáveis designados), gráfico de área com a evolução anual dos gastos
(rótulo direto no pico; tooltip com crosshair) e donut com a divisão por
categoria (top 5 + "Outros"; hover sincronizado entre fatia e legenda).
Tema claro/escuro com toggle; paleta de gráficos validada para daltonismo
(CVD) nos dois modos, com "Outros" em cinza de de-ênfase.

A rota `/servidores` (linkada no header e no card "Fiscais designados")
traz o dashboard da primeira funcionalidade do projeto: a lista de **todos os
agentes públicos do TSE** (`DashboardData.servidores`, ver acima), ordenada
pelo maior valor consolidado sob responsabilidade; quem não é fiscal/gestor
de nenhum contrato aparece zerado. Cards com maior valor sob responsabilidade
e mediana por responsável (calculada só sobre quem tem contrato), e um card
"Fiscais designados" que, em vez de só um número, é um donut (mesmo
componente de `/funcoes`) com a distribuição por função comissionada (FC/CJ,
mais "Sem função") de quem está no ranking com contrato. Tabela paginada, 25
por página (papéis como badges; valor de cada contrato contado uma única vez
por pessoa). A coluna Função mostra, com o mesmo badge usado em `/funcoes`, a
função comissionada que o servidor tem hoje ou já teve — de
`funcoes.servidores` via `funcoesIndex`, "—" quando nunca teve nenhuma. A
tabela tem filtro incremental por servidor (sem distinção de acentos/caixa) e
ordenação clicável nos cabeçalhos Servidor (alfabética), Contratos e Valor
consolidado (1º clique ordena, 2º inverte, 3º volta à ordem do ranking); a
coluna # sempre mostra a posição original no ranking por valor.

Na subseção **Por papel** do filtro, além dos papéis reais há o chip sintético
**NÃO FISCAL** (ligado por padrão): mescla os servidores que não são
fiscais/gestores de contrato nenhum (`zeroFiscal`), filtrados só por função.
Desligá-lo deixa só o ranking de fiscais, reproduzindo a antiga `/fiscais`;
desmarcar todos os papéis reais mantendo o NÃO FISCAL mostra só os não-fiscais.
Os chips **VIGENTE** de "Por contratos" e "Por função" começam ligados (regra do
projeto) e, ligados, escondem quem só tem contrato encerrado / considera só a
função de hoje — por isso a lista abre com menos que o total; **Limpar** traz
todo mundo.

### Temas

Além do modo claro/escuro, o seletor de paleta (ícone 🎨 no header) oferece
sete temas: **Neutro** (cinzas clássicos), **Institucional** (azul-marinho
sóbrio, cantos mais retos), **Esmeralda** (verdes suaves, cantos mais
arredondados), **Violeta** (gradiente índigo com cartões navy), **Lagoa**
(gradiente turquesa→verde), **Ardósia** (flat carvão + teal, cantos retos) e
**TSE** (azul institucional + dourado do brasão, nas cores do site oficial
[tse.jus.br](https://www.tse.jus.br) — acento dourado em vez do teal/verde
dos demais temas de acento). Os temas mudam apenas o chrome (superfícies,
acentos, bordas, raio e, nos gradientes, o fundo da página) — os slots de
cor dos gráficos (`--chart-*`) são os mesmos em todos, porque são a paleta
de dados validada para daltonismo, com uma exceção deliberada: o tema TSE
também sobrescreve `--chart-2` (verde → amarelo-gema, `#fad43d` claro /
`#f3c920` escuro), porque o próprio sentido do tema é replicar a identidade
visual real do TSE, que não tem verde. Essa troca reduz a distância
perceptível sob daltonismo (protanopia/deuteranopia, simulação
Coblis-style) entre `--chart-2` e `--chart-3` (que já é um âmbar) de
~185-210 (verde original) para ~70-86 — ainda perceptível, mas bem menor;
o tom foi escolhido testando várias combinações de matiz/luminosidade para
maximizar essa distância sem descaracterizar o amarelo-gema. Nos demais
temas, o contraste de cada `--chart-*` contra o `--card` escuro é conferido
(razão WCAG) antes de entrar, sem alterar os valores em si. Escolhas
persistem em `localStorage` e são aplicadas antes do primeiro paint por um
script no `<head>`.

Nota de implementação: valores compactos ("R$ 17,3 bi") são formatados à mão
em vez de `Intl … notation: 'compact'` — versões diferentes de ICU (Node do
build × navegador) divergem no zero à direita, o que causava mismatch de
hidratação no React e derrubava a classe de tema do `<html>`.

### Auditabilidade

Todo dado do dashboard é auditável contra a fonte oficial:

- **Quando existe consulta equivalente no Compras.gov.br** (a consulta com
  `unidade=TSE`), o dado é um link direto que abre a consulta pronta em nova
  aba — caso do card "Valor total contratado".
- **Quando não existe filtro equivalente via URL** (responsável, ano,
  categoria, vigência — a consulta pública só aceita `unidade`), o clique abre
  um modal com a lista dos contratos que compõem aquele dado, e cada linha do
  modal abre o contrato detalhado na fonte
  (`/transparencia/contratos/{id}`) em nova aba. Vale para: linhas da tabela
  de ranking e barras do top 10 (contratos do servidor, com o papel dele em
  cada um), anos do gráfico de evolução, fatias/legenda do donut de categorias
  e o card "Contratos vigentes".

Para isso o `dashboard-data.ts` embarca a tabela normalizada dos 1268
contratos (id, número, objeto e fornecedor truncados, valor, ano, categoria,
vigência) e cada linha do ranking referencia seus contratos por índice.

### Regra: filtro "Vigente" sempre ligado por padrão

**Todo filtro "Vigente" de qualquer página começa LIGADO.** "Vigente"
significa sempre a mesma coisa: *está valendo agora — não é do passado, ainda
não acabou* (contrato dentro do prazo, função comissionada atual, período de
teletrabalho em aberto, terceirizado que ainda consta na listagem mais
recente, contrato de cessão que ainda tem terceirizado alocado). Em regra o
usuário quer ver **como está hoje**; para olhar o histórico ele **desliga o
filtro de propósito**.

Consequências para quem implementa:

- o `useState` do toggle nasce `true`; o codec de URL (`bool.escrever` /
  `bool.ler` em `web/lib/url-filtros.ts`) usa `true` como padrão, então o
  parâmetro `vig` (ou equivalente) só aparece na URL quando o filtro está
  **desligado** — link curto no caso comum e sem mudar de sentido se o padrão
  mudar;
- o controle visual padrão é `VigenteToggle`
  (`web/components/dashboard/card-controles.tsx`);
- "Limpar" / "ver tudo" de um painel de filtro pode desligar o Vigente (é uma
  ação explícita de "quero o universo inteiro") — isso não contradiz a regra,
  que é só sobre o **estado inicial**.

Páginas com filtro Vigente hoje: `/servidores` (dois: o chip **VIGENTE** de
"Por contratos" e o de "Por função"), `/funcoes`, `/teletrabalho` e
`/terceirizados` (um para a tabela de terceirizados e outro para a de
contratos de cessão).

## Como os dados são obtidos

A página `https://contratos.comprasnet.gov.br/transparencia/contratos?unidade=TSE`
é um painel Laravel/Backpack CRUD cuja tabela usa jQuery DataTables com
processamento **server-side**: o HTML inicial só define a grade de colunas: os
dados vêm de `POST /transparencia/contratos/search?unidade=TSE`, retornando
JSON no formato padrão do DataTables (`draw`, `recordsTotal`,
`recordsFiltered`, `data`), onde cada célula é um fragmento HTML igual ao
renderizado na tabela.

A coluna de índice 33 ("Responsáveis") traz uma tabela aninhada com
CPF (mascarado) / Nome / Tipo para cada fiscal/gestor do contrato — é dessa
coluna que vem a informação de responsabilidade. `scrapeContratos.js` pagina
esse endpoint (200 registros por página — pedir tudo de uma vez em `length`
alto causa timeout no servidor) e converte cada linha para o schema abaixo.

Não é necessário navegador (Playwright) para isso — é uma chamada HTTP direta
com `fetch`, mais rápida e simples. `discover.js` (Playwright) fica como
ferramenta de reconhecimento caso o layout mude no futuro; note que o Chromium
não herda `HTTPS_PROXY` automaticamente neste ambiente, por isso o proxy é
passado explicitamente em `chromium.launch()`.

```bash
npm install
npm run tse:scrape -- TSE data/tse_contratos.json   # extrai os contratos reais
npm run tse:rank -- --in data/tse_contratos.json --top 30
```

### Dados raspados versionados no repositório

Os seis JSON de saída dos scrapers ficam **versionados** em `data/`:
`tse_contratos.json`, `tse_funcoes.json`, `tse_agentes.json`,
`tse_teletrabalho.json`, `tse_unidades.json` e `tse_terceirizados.json`. Isso
garante que um clone novo já traga o estado real (o `buildDashboardData.js`
gera `web/lib/dashboard-data.ts` a partir deles) sem precisar rodar nenhum
scrape, e — para os que fazem raspagem **incremental** — que o trabalho já
acumulado não se perca.

`scrapeContratos.js` e `scrapeFuncoes.js` releem o próprio arquivo de saída
como cache (`cacheExistente`) e só buscam o que ainda não têm. O arquivo é,
portanto, um **superconjunto** da fonte viva: um contrato/portaria que a fonte
venha a remover continua no arquivo versionado (é o comportamento desejado —
preservar o que já foi raspado), e a fonte de contratos
(`contratos.comprasnet.gov.br`) é a mais frágil de re-raspar por exigir
sessão + cookie httponly + CSRF. `scrapeTerceirizados.js` também é incremental,
mas por **competência**: relê `tse_terceirizados.json` e só baixa/parseia os
PDFs mensais de competências que ainda não estão no `porCompetencia` (use
`--refazer` para ignorar o cache, `--limite N` para pegar só as N mais
recentes). `tse_agentes.json`, `tse_teletrabalho.json` e
`tse_unidades.json` não são incrementais (cada um é uma única requisição que
devolve a base inteira) — são versionados só pela conveniência do clone
pronto.

Consequências operacionais (as mesmas que `tse_funcoes.json` já tinha):

- depois de cada `npm run tse:scrape` o arquivo aparece como `modified` no
  `git status`; commite um snapshot novo quando quiser;
- cada commit que inclua um scrape novo adiciona ~2 MB ao histórico do
  `.git` (o arquivo é pretty-print com 2 espaços);
- o `.git` **não** versiona o cache de runtime do servidor
  (`web/.cache/tse-dados.json`, no `.gitignore`) nem o CSV derivado
  (`data/ranking_responsaveis.csv`) — esses continuam ignorados de propósito.

A coerência do que o app mostra não depende de os seis arquivos estarem
sincronizados entre si: ela vem de `web/lib/dashboard-data.ts` ser sempre
regenerado a partir dos seis juntos e commitado.

### Nota sobre os valores

Alguns contratos do TSE aparecem com "Valor Global" na casa dos bilhões (ex.:
aquisição de urnas eletrônicas com a Positivo, ou atas de registro de preço
envolvendo o Ministério da Defesa). Isso não é erro de extração — é o valor
exibido literalmente na página oficial (conferido campo a campo na página do
contrato). O TSE é o órgão central de compras para toda a Justiça Eleitoral em
itens como equipamentos de votação e segurança das eleições, então alguns
contratos refletem tetos nacionais, não apenas gasto do TSE isoladamente. Vale
ter isso em mente ao interpretar o ranking — ele reflete fielmente a fonte,
mas a fonte mistura escalas bem diferentes num mesmo campo.

Isso não significa que todo valor na casa dos bilhões seja legítimo — alguns
já foram checados individualmente contra o SIAC (consulta de contratos do
próprio TSE) e confirmados como erro da fonte, não teto nacional real; esses
viram exceção registrada (ver seção abaixo), não uma suposição automática.

### Exceções: correção manual de dados sabidamente errados

Diferente do caso acima (valor real, só em escala diferente da esperada), às
vezes a própria fonte tem um dado **errado de fato** — não uma peculiaridade
de como o TSE registra, mas um erro (ex.: dígito a mais por erro de
digitação). Nesses casos, em vez de alterar o dado extraído na hora do scrape
(o que apagaria o rastro de "o que a fonte disse"), a correção é registrada
em `data/tse_excecoes.json` e aplicada como uma camada por cima, com motivo e
fonte da correção preservados — mantendo a auditabilidade: o dado exibido é o
corrigido, mas o porquê da divergência com a fonte primária fica visível.

Schema de cada exceção:

```json
{
  "id": "id do contrato (mesmo campo `id` do schema de contrato)",
  "numero": "número do contrato, só para referência humana no arquivo",
  "overrides": { "campo": "novo valor" },
  "motivo": "por que o valor extraído está errado",
  "fonte": "URL da consulta que confirma o valor correto",
  "registradoEm": "AAAA-MM-DD"
}
```

`aplicarExcecoes` (`src/tse/excecoes.js`) casa por `id` e sobrescreve os
campos listados em `overrides`; é chamada por `agregarDashboard` (cobrindo o
snapshot embutido e a atualização em runtime da rota `/api/tse/dados`) e por
`tse:rank`/`cli.js`. Cada campo corrigido aparece em `ContratoResumo.correcoes`
e o dashboard mostra uma tag "corrigido" (tooltip com motivo e fonte) nos
modais de auditoria — ver `contratos-dialog.tsx`.

**Casos registrados:**

- Contrato 00031/2015 (DATAINFO, serviços de apoio à TI) aparece na fonte
  pública
  ([Compras.gov.br](https://contratos.comprasnet.gov.br/transparencia/contratos?unidade=TSE))
  com Valor Global de R$ 2.500.000.000,00 (2,5 bilhões) — incompatível com o
  objeto do contrato. O valor correto, R$ 2.500.000,00 (2,5 milhões), foi
  confirmado na consulta de contratos do próprio TSE
  ([SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00312015/CT)).
- Contrato 00090/2022 (acordo de cooperação com o Ministério da Defesa, apoio
  logístico das Forças Armadas às eleições de 2022, já encerrado) aparece com
  Valor Global de R$ 11.061.452.230,00. O valor correto é R$ 0,00, confirmado
  no
  [SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00902022/SE).

**Sobre automatizar a busca no SIAC:** cogitou-se usar o SIAC
(`https://siac-consultas.tse.jus.br/main/contratos/listar`) como fonte
adicional para achar/confirmar esse tipo de divergência automaticamente, mas a
consulta exige resolver um captcha — não dá para automatizar sem tratar essa
etapa (ex.: pedir ao usuário que resolva o captcha manualmente quando
necessário), então por ora essa fonte é só usada como referência manual ao
registrar uma exceção, não como parte do pipeline de scrape.

### Cruzamento em lote com um export do SIAC

Quando o usuário exporta manualmente (resolvendo o captcha) o CSV da consulta
`.../main/contratos/listar`, `src/tse/cruzarSiac.js` cruza esse export contra
`data/tse_contratos.json` inteiro e gera um relatório em Markdown com os
candidatos a exceção — contratos cujo valor diverge de forma suspeita entre as
duas fontes:

```bash
npm run tse:cruzar-siac -- caminho/para/export-siac.csv
# gera data/siac-divergencias.md
```

O casamento entre as duas fontes usa número/ano do contrato **e** nome do
fornecedor normalizado (número/ano sozinho não é chave única — várias
parcerias diferentes reaproveitam o mesmo par). O script **não** grava
`tse_excecoes.json` sozinho: numa rodada real, o valor `valorAtualizado` do
SIAC por vezes também estava errado (2 dos 20 candidatos encontrados tinham o
valor do SIAC implausível, não o nosso) — cada candidato do relatório precisa
de conferência manual na página de detalhe do SIAC (o relatório já traz o
link) antes de virar exceção.

## Schema intermediário de contrato

O ranking (`rankResponsaveis`) e o CLI trabalham sobre um JSON de contratos
nesse formato (ver exemplo em `data/tse_contratos.exemplo.json`):

```json
[
  {
    "id": "identificador do contrato no sistema",
    "numero": "10/2023",
    "objeto": "descrição do objeto",
    "fornecedor": "razão social do contratado",
    "valorGlobal": 1200000,
    "situacao": "Vigente",
    "responsaveis": [
      { "nome": "Maria Silva", "matricula": "111", "papel": "Fiscal Titular" },
      { "nome": "João Souza", "matricula": "222", "papel": "Gestor Titular" }
    ]
  }
]
```

Qualquer fonte (API oficial, scraping de DOM, ou até uma planilha exportada
manualmente da página) pode alimentar esse schema — o ranking não depende de
como os dados chegaram até aqui. Na extração real do TSE não há matrícula
funcional pública; `scrapeContratos.js` usa o CPF mascarado (ex.:
`***.724.491-**`) no campo `matricula`, que já é suficiente para identificar
a mesma pessoa de forma estável entre contratos.

## Uso

```bash
npm install
npm test                       # roda os testes da lógica de ranking
npm run tse:rank -- --papeis "Fiscal Titular,Fiscal Substituto"  # só fiscais, sem gestores
```

O resultado é impresso no terminal (top N) e salvo em
`data/ranking_responsaveis.csv` com: posição, nome, matrícula, papéis, valor
consolidado e quantidade de contratos.

## Regras de agregação

- A chave de identidade de uma pessoa é a **matrícula**, quando disponível;
  na ausência dela, cai para o nome normalizado (maiúsculas, sem acento,
  espaços colapsados) — nomes grafados de forma diferente para a mesma
  matrícula são tratados como a mesma pessoa.
- Se a mesma pessoa aparece em mais de um papel no mesmo contrato (ex.:
  fiscal titular de um item e gestor do contrato), o valor do contrato é
  contado **uma única vez** para essa pessoa.
- `--papeis` filtra quais papéis contam para o ranking (por padrão, todos:
  fiscais e gestores).

## Funções comissionadas (FC/CJ)

A rota `/funcoes` (linkada no header) traz **todo servidor do TSE que tem ou
já teve uma Função Comissionada (FC-1 a FC-6) ou um Cargo em Comissão (CJ-1 a
CJ-4)**, fiscalizando contrato ou não — matrícula, cargo, lotação, função
vigente e histórico de nomeação/exoneração com data e link da portaria
correspondente. Servidores que nunca aparecem como fiscal/gestor de nenhum
contrato recebem a tag **"Não-Fiscal"**. Filtro por tipo/nível de função e
busca por nome, mesmo padrão da tabela de Fiscais. Também é possível
ver, para quem fiscaliza algum contrato, a lista desses contratos
(reaproveitando o mesmo modal auditável da página de Fiscais) — e, na
própria página de Fiscais, cada contrato listado no modal de um fiscal
mostra uma tag (ex.: "FC-6") com a função que esse fiscal ocupava durante a
vigência daquele contrato específico, quando houver.

### Duas fontes: primária (estado atual) + secundária (histórico)

- **Primária — Relação de agentes públicos**
  ([`transparencia.tse.jus.br/.../relacao-agentes-publicos`](https://transparencia.tse.jus.br/transparenciaDadosServidores/smvc/relatorios/servidor/relacao-agentes-publicos),
  `src/tse/scrapeAgentesPublicos.js`): uma única página HTML estática,
  pública, sem sessão nem paginação, com todo agente público do TSE (~920
  linhas) — nome, matrícula, cargo efetivo, função/cargo em comissão atual
  (quando houver), lotação e o ato de provimento mais recente. Rápida (uma
  requisição) e é quem manda no que a UI mostra como "vigente hoje" — mas não
  tem histórico algum, só a foto de agora.
- **Secundária — Portarias do TSE**
  ([`tse.jus.br/legislacao/compilada/prt`](https://www.tse.jus.br/legislacao/compilada/prt),
  `src/tse/scrapeFuncoes.js`): usada só para reconstruir o **histórico**
  (quando cada mandato começou/terminou e por qual portaria) e enriquecer o
  que a fonte primária já disse que é verdade agora. Roda depois da
  primária — é bem mais cara (milhares de páginas desde 1999 vs. uma
  página), então a ordem de execução importa: primeiro o estado atual
  (rápido), depois o histórico (lento).

`agregarFuncoes.js` faz a reconciliação: o universo de servidores parte de
quem tem função na relação atual (primária); quem só aparece no histórico de
portarias e não está mais na relação atual entra como registro à parte,
sinalizado (`naRelacaoAtual: false`). Para cada servidor, se a função vigente
da fonte primária e o mandato "em aberto" do histórico de portarias não
baterem (ou um dos dois não existir), isso vira uma **observação** no
registro do servidor — a página exibe um ícone de alerta ao lado do nome e o
detalhe completo no histórico — em vez de decidir sozinho qual fonte está
certa.

Extração de cada portaria (texto integral, HTML estático): um ou mais
"movimentos" — "Fica(m) dispensado(s)/exonerado(s)" ou o imperativo
"Dispensar"/"Exonerar" (fim) e "Fica(m) designado(s)/nomeado(s)" ou
"Designar"/"Nomear" (início) — cada um com nome do servidor, cargo efetivo,
título da função/cargo, nível (FC-N ou CJ-N) e unidade. `agregarFuncoes.js`
pareia esses movimentos cronologicamente por pessoa em "mandatos" (início →
fim), cruzando com os contratos via `rankResponsaveis`/`normalizeNome`
(mesma chave de nome normalizado — ver "Regras de agregação" acima) para
decidir `zeroFiscal` e anexar a função correta a cada contrato fiscalizado,
por sobreposição de vigência.

**Limitações conhecidas:**

- **Cruzamento só por nome, nas duas pontas.** Nem a relação de agentes
  públicos, nem as portarias, nem os contratos (que usam CPF mascarado)
  compartilham um identificador comum — tudo é casado por nome normalizado.
  Homônimos podem gerar vínculos incorretos entre qualquer par dessas fontes.
- **Pareamento início/fim (histórico) é uma heurística FIFO por pessoa** —
  assume que ninguém acumula duas funções comissionadas ao mesmo tempo
  (regra geral no serviço público, mas não uma garantia absoluta da fonte).
- **Data efetiva** (histórico) é a da publicação no Diário Oficial da União,
  referenciada no rodapé de cada portaria (a maioria diz apenas "entra em
  vigor na data de publicação"); cláusulas de vigência retroativa por item
  não são tratadas.
- **Retificações** de portarias anteriores não são reconciliadas com o
  movimento original — cada portaria é interpretada isoladamente.
- **Cobertura do histórico é parcial** (2020–hoje, no momento) — quem foi
  dispensado antes disso pode aparecer só como "não consta na relação atual"
  sem histórico de mandato nenhum. Ver roadmap para rodar o backfill
  completo (1999–hoje).

### Rodando a extração

```bash
npm run tse:scrape-agentes                    # relação atual (rápido, ~1 requisição) em data/tse_agentes.json
npm run tse:scrape-funcoes                    # histórico completo (1999–hoje) em data/tse_funcoes.json
npm run tse:scrape-funcoes -- 2024 2026       # só um intervalo de anos, útil para testar
npm run data                                  # regrava o snapshot embutido com contratos + agentes + histórico
```

A extração da relação de agentes públicos é rápida (uma única página) e roda
a cada atualização automática do app, junto com os contratos. O histórico de
portarias é o oposto: a primeira execução completa baixa e interpreta
milhares de páginas e pode levar dezenas de minutos; execuções seguintes são
incrementais — os resultados já processados ficam em cache por URL de
portaria, então só os índices de ano (baratos) e as poucas portarias novas
são buscados de novo. O app web faz as três coisas automaticamente em
segundo plano (mesmo mecanismo de atualização dos contratos, ver acima),
nessa ordem — contratos, agentes públicos, portarias — persistindo o cache
em `web/.cache/`.

## Próximas funcionalidades (roadmap)

Este é o primeiro módulo de uma aplicação maior de transparência de órgãos
públicos. Outras ideias ficam para depois de validar esta primeira entrega:
histórico de aditivos por contrato, comparação de preços entre órgãos,
alertas de contratos perto do vencimento, etc.

### Peso de `data/tse_terceirizados.json` no histórico do `.git`

O arquivo guarda o histórico bruto **por competência** (`porCompetencia`),
hoje ~14 MB com 33 meses e ~1.300 linhas cada, pretty-print com 2 espaços —
e só cresce a cada nova competência raspada (o scraper mantém o arquivo como
superconjunto). Cada commit que inclua um scrape novo adiciona alguns MB ao
`.git`. Opções para conter isso, quando incomodar:

- gravar esse JSON **minificado** (sem os 2 espaços) — corta ~metade; hoje é
  pretty-print só por consistência com os outros `data/*.json`;
- ou mover o histórico bruto para um formato mais enxuto (NDJSON por
  competência, ou só um índice de presença `nome × competência` em vez das
  linhas completas repetidas mês a mês), deixando em `porCompetencia` apenas
  o que `agregarTerceirizados.js` realmente consome.

### Melhorias pendentes no scraper de funções (`scrapeFuncoes.js`)

- **Paralelizar também a busca dos índices de ano.** Hoje só o detalhe de
  cada portaria é buscado em lotes paralelos (`concurrency`); os índices de
  ano (`.../prt/{ano}`) são buscados um de cada vez, em sequência — dá pra
  acelerar o backfill histórico paralelizando isso também.
- **Sincronização incremental "desde a última vez".** Cada execução hoje
  reconsulta o índice de todos os anos, mesmo os já encerrados (cujas
  portarias nunca mudam depois de publicadas). Guardar quais anos já foram
  totalmente sincronizados e, numa atualização incremental, revisitar só
  o(s) ano(s) em aberto (atual e possivelmente o anterior, por causa de
  publicação tardia no DOU) evitaria esse trabalho redundante e tornaria as
  atualizações automáticas do app bem mais rápidas.
- **Persistir parciais durante a execução, não só no fim.** Hoje nada é
  gravado em disco até a extração inteira terminar — numa varredura
  histórica de dezenas de minutos, uma queda do processo no meio (falta de
  luz, reinício, etc.) perde todo o progresso. Salvar incrementalmente (ex.:
  a cada lote de portarias baixadas) permitiria que uma reinicialização
  retome de onde parou, ou pelo menos com perda mínima de esforço.
- **Melhorias menores e pontuais.**
  - **Melhorias menores e pontuais.**
  1. Cada modal deve ter um nome para ficar fácil fazer referência e 
  reutilização entre todas as funcionalidades.
  2. ✅ Rota `/fiscais` renomeada para `/servidores` (título "Servidores
  (Agentes Públicos)") e agora lista **todos** os agentes públicos, não só os
  fiscais (`DashboardData.servidores`). O filtro "Por função" ganhou o chip
  **VIGENTE** (ligado = só a função de hoje; desligado = casa também o
  histórico de FC/CJ das portarias) e a subseção "Por papel" ganhou o chip
  sintético **NÃO FISCAL** (recorta os `zeroFiscal`; desligado = só o ranking
  de fiscais). **Falta ainda:** ao clicar num servidor, o detalhamento deveria
  listar o histórico de FCs/CJs que ele já ocupou, com a função atual marcada
  com um chip VIGENTE.
  3. ✅ Onde existir o botão/chip VIGENTE como filtro, ele começa ligado — ver
  "Regra: filtro Vigente sempre ligado por padrão" acima. Os dados históricos
  só aparecem se explicitamente solicitado (desligar o VIGENTE).
- **Bug conhecido: cache incremental do servidor pode reter nomes quebrados
  de versões antigas do parser, indefinidamente.** `scrapeFuncoes()` só
  busca portarias que ainda não estão em `cacheMovimentos` — uma portaria já
  cacheada nunca é reprocessada, mesmo que o parser tenha sido corrigido
  depois. Isso é inofensivo para `data/tse_funcoes.json` (regenerado do
  zero via `npm run tse:scrape-funcoes -- 1999` quando necessário), mas é um
  problema real para `web/.cache/tse-dados.json`: esse cache do servidor em
  runtime (usado pela rota `/api/tse/dados`, ver `iniciarAtualizacao` em
  `web/app/api/tse/dados/route.ts`) só cresce por cima do que já tinha a
  cada atualização automática (TTL 6h) — se ele foi semeado em algum
  momento por uma raspagem anterior a uma correção do parser, os nomes
  quebrados daquela época ficam presos ali para sempre, mesmo com o parser
  já corrigido, porque as portarias correspondentes nunca voltam a ser
  buscadas. Foi exatamente o que aconteceu em 2026-08-25: nomes tipo "Art.
  2º Designá-la para exercer..." ou "A partir de 27 de janeiro de 2020"
  reapareceram em produção mesmo com o parser já corrigido havia tempos — a
  correção pontual foi apagar `web/.cache/tse-dados.json` e reiniciar o
  servidor (ele volta a usar o snapshot embutido, limpo, enquanto refaz o
  cache do zero em segundo plano). Solução de raiz ainda pendente: a forma
  mais simples seria o servidor reconstruir esse cache a partir do
  `data/tse_funcoes.json` versionado (fonte confiável, já reprocessada do
  zero quando o parser muda) em vez de só empilhar por cima do que já
  tinha — ou, alternativa mais barata, invalidar o cache quando uma
  "versão" do parser (ex.: hash do arquivo `scrapeFuncoes.js`) mudar em
  relação à que gerou o cache salvo.

### Bugs corrigidos no parser de nomes (`scrapeFuncoes.js`)

`extrairMovimentos` errava o campo `nome` (ou inventava um movimento que não
existiu) em várias situações reais da fonte, todas corrigidas nesta rodada:

- **Cláusula administrativa antes do nome.** O item às vezes começa com uma
  cláusula antes do nome de fato — "I - **A partir de** 27 de janeiro de
  2020, GEOFLÁVIA GUILARDUCCI DE ALVARENGA, ..." ([portaria
  61/2020](https://www.tse.jus.br/legislacao/compilada/prt/2020/portaria-no-61-de-29-de-janeiro-de-2020)),
  "I - **A pedido**, Ana Cláudia Braga Mendonça, ..." ([portaria
  718/2022](https://www.tse.jus.br/legislacao/compilada/prt/2022/portaria-no-718-de-5-de-agosto-de-2022))
  "I) **A contar de** 13 de setembro de 2012, GUSTAVO MINUCCI DE MOURA
  LEITE, ..." ([portaria
  502/2012](https://www.tse.jus.br/legislacao/compilada/prt/2012/portaria-no-502-de-13-setembro-de-2012))
  ou "Dispensar, **por solicitação do Senhor Ministro** Luis Felipe Salomão,
  KELEN COUTINHO ..." ([portaria
  143/2020](https://www.tse.jus.br/legislacao/compilada/prt/2020/portaria-no-143-de-28-de-fevereiro-de-2020)).
  Como maiúscula/minúscula sozinha não distingue cláusula de nome próprio,
  `CLAUSULA_INICIAL` em `extrairMovimentos` lista as cláusulas conhecidas a
  pular (case-insensitive): "a partir de ...", "a contar de ...", "a
  pedido", "de ofício", "por solicitação d[oa] ...", "por indicação d[oa]
  ...".
- **Nome colado direto ao verbo ou ao cargo, sem vírgula.** Bom número de
  portarias não intercala cargo efetivo/área entre o nome e a função — vai
  direto do nome para o conector: "Exonerar Adaíres Aguiar Lima **do cargo em
  comissão de** Coordenador, ..." ou "ALEXANDRE GOMES MACHADO **da função
  comissionada de** Assistente III, ..." ([portaria
  513/2014](https://www.tse.jus.br/legislacao/compilada/prt/2014/portaria-no-513-de-19-de-agosto-de-2014),
  [portaria
  874/2016](https://www.tse.jus.br/legislacao/compilada/prt/2016/portaria-no-874-de-18-de-agosto-de-2016)).
  Sem vírgula delimitando o nome, o parser antigo engolia a cláusula inteira
  como se fosse o nome. A correção determina o fim do nome pela posição do
  próprio conector ("do"/"da"/"para exercer o"/"para exercer a" logo antes de
  "cargo em comissão de"/"função comissionada de"), e só usa a primeira
  vírgula como limite quando ela aparece antes desse ponto.
- **Marcador de item em variações não reconhecidas.** Além de "N - ", a fonte
  usa parêntese fechando ("XVI)", "LI)" — [portaria
  158/2022](https://www.tse.jus.br/legislacao/compilada/prt/2022/portaria-no-158-de-22-de-fevereiro-de-2022)),
  travessão ("I – Jean Carla ..." — [portaria
  781/2024](https://www.tse.jus.br/legislacao/compilada/prt/2024/portaria-no-781-de-2-de-outubro-de-2024)),
  numeral colado direto ao verbo no mesmo parágrafo ("Dispensar: I) ..." —
  [portaria
  659/2012](https://www.tse.jus.br/legislacao/compilada/prt/2012/portaria-no-659-de-17-de-dezembro-de-2012)),
  ou, por erro de digitação da própria fonte, sem pontuação nenhuma ("XXIV
  ALEXANDRE GOMES MACHADO" — [portaria
  168/2022](https://www.tse.jus.br/legislacao/compilada/prt/2022/portaria-no-168-de-22-de-fevereiro-de-2022))
  ou numeração duplicada ("I I- Mari Matsuoka Tomikawa" — [portaria
  2/2025](https://www.tse.jus.br/legislacao/compilada/prt/2025/portaria-no-2-de-7-de-janeiro-de-2025)).
  A remoção de marcador agora cobre hífen, travessão/travessão longo,
  parêntese e (exigindo espaço, para não confundir com um nome real que por
  coincidência começa com letras romanas, tipo "LIMA") o caso sem pontuação;
  roda duas vezes seguidas para lidar com numeração duplicada.
- **Verbo com pronome oblíquo ou no presente, não reconhecido.** "Art. 2º
  **Designá-la** para exercer a função comissionada de Assistente VI, ..."
  ([portaria
  143/2020](https://www.tse.jus.br/legislacao/compilada/prt/2020/portaria-no-143-de-28-de-fevereiro-de-2020))
  retoma a pessoa do parágrafo anterior em vez de repetir o nome; sem
  reconhecer essa forma, o parser herdava o modo (início/fim) errado do
  parágrafo anterior e ainda produzia um nome-lixo. A correção reconhece as
  formas com pronome ("Designá-la/-lo", "Dispensá-la/-lo", etc.) e no
  presente ("Designa", "Nomeia", ...), e também tolera "Art ." com espaço
  antes do ponto (erro de digitação visto em portarias de 2006-2008). Como o
  nome de fato não está nesses parágrafos (só no anterior), o item é
  descartado (nenhum movimento gerado) em vez de gravar um nome errado —
  essa pessoa continua sem o registro desse evento específico até o parser
  ganhar resolução de referência entre parágrafos.
- **Itens riscados ("tornado sem efeito") tratados como válidos.** A
  legislação compilada marca com tachado HTML (`text-decoration:
  line-through`) itens anulados por portaria posterior — "III - ~~EDUARDO
  CAMARGO DOS REIS, ...~~ (Tornado sem efeito pela Portaria nº 75/2016)" ([portaria
  68/2016](https://www.tse.jus.br/legislacao/compilada/prt/2016/portaria-no-68-de-2-de-fevereiro-de-2016)).
  O parser lia esse texto normalmente, registrando uma designação que nunca
  chegou a valer. `extrairCorpoTexto` agora remove o `<span>` tachado inteiro
  antes de dividir em parágrafos.
- **Verbo duplicado por erro de digitação.** "Art. 2º **Designar Designar**
  ANDERSON VIDAL CORRÊA, ..." ([portaria
  1.102/2016](https://www.tse.jus.br/legislacao/compilada/prt/2016/portaria-no-1-102-de-31-de-outubro-de-2016)) —
  só a primeira ocorrência é consumida pelo reconhecimento de verbo, a
  segunda sobra colada ao nome; agora é removida.
- **Vírgula solta logo após o verbo, antes do marcador.** "Art. 1º
  Dispensar, I - GEORGE HENRIQUE ..." ([portaria
  385/2017](https://www.tse.jus.br/legislacao/compilada/prt/2017/portaria-no-385-de-17-de-maio-de-2017))
  usa vírgula em vez de dois-pontos depois do verbo; a limpeza de vírgula
  solta agora roda antes e depois da remoção de marcador.
- **Rede de segurança geral.** Como salvaguarda contra formas de erro ainda
  não catalogadas (tipicamente parágrafos de retificação que citam "cargo em
  comissão de"/"nível" ao corrigir outra portaria, sem ser uma designação de
  fato), qualquer candidato a nome que contenha uma referência a artigo
  ("Art. Nº") é descartado em vez de virar um registro errado.

Todos os ~1.550 movimentos já extraídos com algum desses bugs (registrados em
`data/tse_funcoes.json`) foram reprocessados com o parser corrigido — a base
inteira (todas as portarias relevantes de 1999 a hoje) foi raspada de novo do
zero para garantir que nenhum caso silenciosamente errado (como os itens
riscados, que produziam um nome com aparência normal) ficasse para trás. Os
"nomes" fantasma que antes apareciam na lista de "não consta na relação
atual" (ver seção "Funções comissionadas") não devem mais ocorrer.

### Problema operacional conhecido: erros ENOENT no `next dev`

Em uma sessão de teste apareceram erros como:

```
⨯ [Error: ENOENT: ... open '...\web\.next\prerender-manifest.json']
⨯ [Error: ENOENT: ... open '...\web\.next\server\app\api\tse\dados\route.js']
```

Não investigado a fundo, mas a hipótese mais provável é **mais de um `next
dev` rodando ao mesmo tempo apontando para a mesma pasta `web/.next`** — cada
instância trata `.next` como cache exclusivo seu, e duas escrevendo/lendo
esses manifests ao mesmo tempo pode fazer uma delas pegar um arquivo que a
outra acabou de apagar/recompilar. Se acontecer: parar os `next dev`
duplicados, apagar `web/.next` e subir de novo com um único processo.
