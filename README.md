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
- ✅ Funções comissionadas FC/CJ por servidor (`src/tse/scrapeFuncoes.js`,
  `/funcoes`) — testado contra a fonte real (ver seção própria abaixo).

O rodapé de cada página traz um identificador de versão do app
(`web/lib/version.ts`, `APP_VERSION`) — atual: **v0.2**.

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
cd web && npm run data                              # regrava o snapshot embutido
>>>>>>> origin/claude/tse-contract-transparency-sed1nw
```

Conteúdo: 3 cards de resumo (valor total contratado, contratos vigentes,
responsáveis designados), gráfico de área com a evolução anual dos gastos
(rótulo direto no pico; tooltip com crosshair) e donut com a divisão por
categoria (top 5 + "Outros"; hover sincronizado entre fatia e legenda).
Tema claro/escuro com toggle; paleta de gráficos validada para daltonismo
(CVD) nos dois modos, com "Outros" em cinza de de-ênfase.

A rota `/responsaveis` (linkada no header e no card "Responsáveis designados")
traz o dashboard da primeira funcionalidade do projeto: cards com total de
responsáveis / maior valor sob responsabilidade / mediana por responsável,
gráfico de barras horizontais com o top 10 e tabela paginada com o ranking
completo — todos os responsáveis, 25 por página (papéis como badges; valor de
cada contrato contado uma única vez por pessoa). A tabela tem filtro
incremental por servidor (sem distinção de acentos/caixa) e ordenação
clicável nos cabeçalhos Servidor (alfabética), Contratos e Valor consolidado
(1º clique ordena, 2º inverte, 3º volta à ordem do ranking); a coluna # sempre
mostra a posição original no ranking por valor.

### Temas

Além do modo claro/escuro, o seletor de paleta (ícone 🎨 no header) oferece
seis temas: **Neutro** (cinzas clássicos), **Institucional** (azul-marinho
sóbrio, cantos mais retos), **Esmeralda** (verdes suaves, cantos mais
arredondados), **Violeta** (gradiente índigo com cartões navy), **Lagoa**
(gradiente turquesa→verde) e **Ardósia** (flat carvão + teal, cantos retos).
Os temas mudam apenas o chrome (superfícies, acentos, bordas, raio e, nos
gradientes, o fundo da página) — os slots de cor dos gráficos (`--chart-*`)
são os mesmos em todos, porque são a paleta de dados validada para
daltonismo (revalidada por script contra cada superfície escura nova).
Escolhas persistem em `localStorage` e são aplicadas antes do primeiro paint
por um script no `<head>`.

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

A rota `/funcoes` (linkada no header) traz **todo servidor do TSE que já
ocupou uma Função Comissionada (FC-1 a FC-6) ou um Cargo em Comissão (CJ-1 a
CJ-4)**, fiscalizando contrato ou não — histórico completo de nomeação e
exoneração de cada função, com data e link da portaria correspondente.
Servidores que nunca aparecem como fiscal/gestor de nenhum contrato recebem a
tag **"Zero Fiscal"**. Filtro por tipo/nível de função e busca por nome,
mesmo padrão da tabela de Responsáveis. Também é possível ver, para quem
fiscaliza algum contrato, a lista desses contratos (reaproveitando o mesmo
modal auditável da página de Responsáveis) — e, na própria página de
Responsáveis, cada contrato listado no modal de um fiscal mostra uma tag
(ex.: "FC-6") com a função que esse fiscal ocupava durante a vigência
daquele contrato específico, quando houver.

### Fonte e extração

A fonte é o índice de legislação compilada do TSE:
[`https://www.tse.jus.br/legislacao/compilada/prt`](https://www.tse.jus.br/legislacao/compilada/prt),
com uma subpágina por ano (`.../prt/{ano}`) desde 1999. Cada subpágina de ano
é HTML estático com uma tabela `Portaria | Ementa/Assunto` — `scrapeFuncoes.js`
usa a ementa para pré-filtrar candidatas (`/função comissionada|cargo em
comissão/i`, excluindo `/substitu/i` — cobertura eventual de férias/licença,
que não é uma designação titular) antes de abrir cada portaria.

O texto integral de cada portaria (também HTML estático) traz um ou mais
"movimentos" — "Fica(m) dispensado(s)/exonerado(s)" (fim de uma função) e
"Fica(m) designado(s)/nomeado(s)" (início) — cada um com nome do servidor,
cargo efetivo, título da função/cargo, nível (FC-N ou CJ-N) e unidade.
`agregarFuncoes.js` pareia esses movimentos cronologicamente por pessoa em
"mandatos" (início → fim), cruzando com os contratos via
`rankResponsaveis`/`normalizeNome` (mesma chave de nome normalizado — ver
"Regras de agregação" acima) para decidir `zeroFiscal` e anexar a função
correta a cada contrato fiscalizado, por sobreposição de vigência.

**Limitações conhecidas:**

- **Cruzamento só por nome.** A fonte de portarias não expõe CPF nem
  matrícula — diferente do CPF mascarado que identifica os fiscais de
  contrato. Homônimos podem gerar vínculos incorretos entre uma portaria e um
  fiscal de contrato.
- **Pareamento início/fim é uma heurística FIFO por pessoa** — assume que
  ninguém acumula duas funções comissionadas ao mesmo tempo (regra geral no
  serviço público, mas não uma garantia absoluta da fonte).
- **Data efetiva** é a da publicação no Diário Oficial da União, referenciada
  no rodapé de cada portaria (a maioria diz apenas "entra em vigor na data de
  publicação"); cláusulas de vigência retroativa por item não são tratadas.
- **Retificações** de portarias anteriores não são reconciliadas com o
  movimento original — cada portaria é interpretada isoladamente.

### Rodando a extração

```bash
npm run tse:scrape-funcoes                    # histórico completo (1999–hoje) em data/tse_funcoes.json
npm run tse:scrape-funcoes -- 2024 2026       # só um intervalo de anos, útil para testar
npm run data                                  # regrava o snapshot embutido com contratos + funções
```

A primeira execução do histórico completo baixa e interpreta milhares de
páginas (uma por portaria relevante desde 1999) e pode levar dezenas de
minutos; execuções seguintes são incrementais — os resultados já
processados ficam em cache por URL de portaria, então só os índices de ano
(baratos) e as poucas portarias novas são buscados de novo. O app web faz
isso automaticamente em segundo plano (mesmo mecanismo de atualização dos
contratos, ver acima), persistindo o cache em `web/.cache/`.

## Próximas funcionalidades (roadmap)

Este é o primeiro módulo de uma aplicação maior de transparência de órgãos
públicos. Outras ideias ficam para depois de validar esta primeira entrega:
histórico de aditivos por contrato, comparação de preços entre órgãos,
alertas de contratos perto do vencimento, etc.

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
