# Transparência

Ferramentas de transparência de órgãos públicos brasileiros. Primeira frente:
**TSE — ranking de responsáveis (fiscais/gestores) pelos maiores valores
consolidados de contratos**, a partir da fonte oficial indicada pelo próprio
TSE: [Consulta contratos, convênios e outros (Compras.gov.br)](https://contratos.comprasnet.gov.br/transparencia/contratos?unidade=TSE).

## Status

- ✅ Lógica de agregação/ranking (`src/tse/rankResponsaveis.js`) — implementada e testada.
- ✅ CLI para gerar o ranking em CSV a partir de um JSON de contratos (`src/tse/cli.js`).
- ⏳ Extração dos dados reais do TSE — **bloqueada nesta sessão por política de
  rede do ambiente** (egress restrito; ver abaixo). O script de reconhecimento
  (`src/tse/discover.js`) já está pronto para rodar assim que a rede for
  liberada.

## Por que ainda não há dados reais

Este ambiente remoto bloqueia acesso de saída a domínios fora de uma allowlist
(GitHub, npm, PyPI etc.) — confirmado testando `contratos.comprasnet.gov.br` e
até domínios genéricos, todos retornando 403 do proxy de egress. A página de
transparência é pública e não exige login; o bloqueio é da política de rede
deste ambiente, não do lado do TSE. Assim que a rede for liberada (nas
configurações do ambiente), o próximo passo é:

```bash
npm install
npm run tse:discover          # abre a página com Playwright, grava HAR + HTML + screenshot em data/discovery/
```

Isso vai revelar se a página expõe uma API JSON pública (mais provável, dado
que é uma SPA) ou se os dados só existem no HTML renderizado. Com esse
material eu escrevo o extrator definitivo (`src/tse/scrapeContratos.js`) e
mapeio os campos reais (número do contrato, valor consolidado, fiscal titular/
substituto, gestor titular/substituto etc.) para o schema abaixo.

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
como os dados chegaram até aqui.

## Uso

```bash
npm install
npm test                       # roda os testes da lógica de ranking

# depois que houver um data/tse_contratos.json real (via tse:discover + scrapeContratos):
npm run tse:rank -- --in data/tse_contratos.json --top 30
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
