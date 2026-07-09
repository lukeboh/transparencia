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
