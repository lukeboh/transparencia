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

## Dashboard web

App em `web/`, alimentado por agregados gerados a partir do JSON extraído
(nunca por fetch em runtime — o dado é versionável e o app é 100% estático):

```bash
npm run tse:scrape -- TSE data/tse_contratos.json   # 1. extrai (raiz do repo)
cd web && npm install
npm run data                                        # 2. gera web/lib/dashboard-data.ts
npm run dev                                         # 3. http://localhost:3000
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
três temas: **Neutro** (cinzas clássicos), **Institucional** (azul-marinho
sóbrio, cantos mais retos) e **Esmeralda** (verdes suaves, cantos mais
arredondados). Os temas mudam apenas o chrome (superfícies, acentos, bordas,
raio) — os slots de cor dos gráficos (`--chart-*`) são os mesmos nos três,
porque são a paleta de dados validada para daltonismo. Escolhas persistem em
`localStorage` e são aplicadas antes do primeiro paint por um script no
`<head>`.

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

## Próximas funcionalidades (roadmap)

Este é o primeiro módulo de uma aplicação maior de transparência de órgãos
públicos. Outras ideias ficam para depois de validar esta primeira entrega:
histórico de aditivos por contrato, comparação de preços entre órgãos,
alertas de contratos perto do vencimento, etc.
