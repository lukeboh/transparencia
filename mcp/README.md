# Transparência TSE — servidor MCP

Servidor [MCP (Model Context Protocol)](https://modelcontextprotocol.io) que dá a
qualquer IA de desktop acesso **sob demanda** aos dados públicos de transparência
do Tribunal Superior Eleitoral — reaproveitando os extratores deste repositório
(`src/tse/`), que sabem como chegar em cada fonte oficial.

O usuário pergunta do jeito que quiser ("quem são os fiscais dos contratos de
vigilância vigentes?", "quantas pessoas da STI estão em teletrabalho hoje?",
"compare as horas extras da SJD nos ciclos de 2022 e 2024") e a IA monta a
consulta com as ferramentas abaixo.

## O que está disponível

| Ferramenta | Para quê |
|---|---|
| `tse_fontes` | Tabelas, campos, fontes oficiais, situação do cache e metodologia. Comece por aqui. |
| `tse_consultar` | **Consulta livre** sobre qualquer tabela: filtros (16 operadores), ordenação, agrupamento com contar/somar/média/mediana/min/max, projeção de campos, paginação. |
| `tse_buscar_contratos` | Contratos por texto, fornecedor, fiscal/gestor, categoria, vigência, valor, ano. |
| `tse_detalhar_contrato` | Um contrato completo (por id ou número), com responsáveis e terceirizados. |
| `tse_ranking_responsaveis` | Ranking de fiscais/gestores pelo valor sob responsabilidade. |
| `tse_buscar_servidores` | Agentes públicos por nome, lotação (sigla inclui subunidades), cargo, função FC/CJ. |
| `tse_perfil_servidor` | Dossiê de uma pessoa cruzando todas as fontes. |
| `tse_unidades` | Organograma: caminho, subunidades, servidores lotados. |
| `tse_teletrabalho` | Períodos de teletrabalho por pessoa, unidade, ano, vigência. |
| `tse_funcoes` | Histórico de funções comissionadas pelas portarias (mandatos, movimentos, resumo). |
| `tse_terceirizados` | Terceirizados: pessoas, contratos de cessão, resumo, falhas de cruzamento. |
| `tse_horas_extras` | Horas extras **estimadas** por servidor, ciclo eleitoral, mês, unidade. |
| `tse_atualizar_dados` | Força buscar de novo na fonte oficial. |

Também expõe o recurso `tse://metodologia` (como cada dado é obtido e suas
limitações) e os prompts `analisar_servidor` e `panorama_contratos`.

Tabelas da consulta livre: `contratos`, `responsabilidades`, `agentes`,
`unidades`, `teletrabalho`, `funcoes_movimentos`, `funcoes_mandatos`,
`terceirizados`, `terceirizados_postos`, `horas_extras`.

## De onde vêm os dados

No modo padrão (`auto`), cada conjunto é buscado **na fonte oficial, ao vivo**,
quando o cache local expira (6 h a 24 h, conforme o conjunto). Se a fonte não
responder — o firewall do TSE costuma bloquear redes de datacenter/VPN —, o
servidor usa o **snapshot** versionado deste repositório (`data/*.json` no
GitHub). Toda resposta traz `_fontes` dizendo a origem (`ao-vivo` / `snapshot`)
e a data, para a IA informar ao usuário.

Exceções: o histórico de funções reconsulta só os dois últimos anos de
portarias (o resto vem do snapshot), e as horas extras são sempre do snapshot
(a extração exige um navegador real e um contracheque por servidor por mês).

> As fontes não compartilham CPF/matrícula: cruzamentos entre elas são **por
> nome**, e horas extras são **estimativas** (limite superior). Ver
> `tse://metodologia`.

## Instalação

Requer **Node.js 18.17+** (exceto no Claude Desktop, que já traz o Node).

### Claude Desktop — um clique

1. Baixe o arquivo `tse-transparencia-mcp-<versão>.mcpb` da página de
   [Releases](https://github.com/lukeboh/transparencia/releases) (ou gere com
   `npm run pack:mcpb`, ver abaixo).
2. Dê dois cliques no arquivo, ou em **Configurações → Extensões → Instalar
   extensão…** escolha o `.mcpb`.
3. Opcional: na tela da extensão, ajuste o modo (`auto` / `snapshot` / `ao-vivo`)
   e a pasta de cache.

### Demais clientes (configuração JSON)

Todos os clientes abaixo iniciam o servidor como subprocesso (stdio). Use uma
das duas formas de comando:

- **Via npm** (depois de publicado): `npx -y tse-transparencia-mcp`
- **Arquivo local**: `node /caminho/para/transparencia/mcp/dist/index.js`
  (gere com `npm run build`; o `dist/index.js` sozinho já funciona — só a
  leitura ao vivo dos PDFs de terceirizados precisa do `pdfjs-dist` instalado ao
  lado, e sem ele esse conjunto usa o snapshot)

**Claude Desktop (manual)** — `claude_desktop_config.json`
(macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`):

```json
{
  "mcpServers": {
    "tse-transparencia": { "command": "npx", "args": ["-y", "tse-transparencia-mcp"] }
  }
}
```

**Claude Code**:

```bash
claude mcp add tse-transparencia -- npx -y tse-transparencia-mcp
```

**Cursor** — `~/.cursor/mcp.json` · **Windsurf** — `~/.codeium/windsurf/mcp_config.json` ·
**LM Studio** — *Program → Install → Edit mcp.json* · **Cline / Roo Code** — *MCP Servers → Configure*:

```json
{
  "mcpServers": {
    "tse-transparencia": { "command": "npx", "args": ["-y", "tse-transparencia-mcp"] }
  }
}
```

**VS Code (GitHub Copilot, modo agente)** — `.vscode/mcp.json` ou *MCP: Add Server*:

```json
{
  "servers": {
    "tse-transparencia": { "type": "stdio", "command": "npx", "args": ["-y", "tse-transparencia-mcp"] }
  }
}
```

No Windows, se o cliente não achar o `npx`, use `"command": "cmd"` e
`"args": ["/c", "npx", "-y", "tse-transparencia-mcp"]`.

### Configuração (variáveis de ambiente, todas opcionais)

| Variável | Padrão | Efeito |
|---|---|---|
| `TSE_MCP_MODO` | `auto` | `auto` (oficial → snapshot), `snapshot` (só snapshot: rápido e estável), `ao-vivo` (só fonte oficial; erro se falhar) |
| `TSE_MCP_CACHE_DIR` | pasta de cache do sistema | onde guardar os dados baixados (~35 MB com tudo) |
| `TSE_MCP_SNAPSHOT_URL` | `data/` deste repositório no GitHub | outra origem de snapshots (ex.: um fork) |
| `TSE_MCP_SNAPSHOT_DIR` | — | pasta local com os `data/*.json` (uso offline) |
| `TSE_MCP_TIMEOUT_S` | `45` | timeout por requisição HTTP |
| `TSE_MCP_TTL_MULTIPLICADOR` | `1` | multiplica os TTLs do cache (ex.: `4` = atualiza 4× menos) |

Exemplo com variáveis no JSON de configuração:

```json
"tse-transparencia": {
  "command": "npx", "args": ["-y", "tse-transparencia-mcp"],
  "env": { "TSE_MCP_MODO": "snapshot" }
}
```

## Desenvolvimento

```bash
cd mcp
npm install
npm test              # unitários + integração (cliente MCP ↔ servidor, sobre data/ local)
npm run build         # dist/index.js (bundle único com src/tse/ + SDK)
npm run pack:mcpb     # dist/tse-transparencia-mcp-<versão>.mcpb
npm run inspect       # abre o MCP Inspector contra o build
```

Estrutura:

- `src/dados.js` — obtenção de cada conjunto (fonte oficial → snapshot → cache), TTL, cache em disco.
- `src/dominio.js` — transforma os dados brutos em tabelas planas, reaproveitando os agregadores de `src/tse/`.
- `src/consulta.js` — motor de consulta genérico (filtros, agrupamento, projeção).
- `src/servidor.js` — ferramentas, recurso e prompts MCP.
- `src/metodologia.js` — o texto de metodologia/limitações exposto à IA.
- `scripts/build.mjs` — bundle com esbuild. Troca `src/lib/logger.js` por um
  stub que escreve em stderr e desliga o `main()` de CLI dos scrapers (num
  bundle, todos os módulos se achariam o programa principal).

O know-how de extração continua **só** em `src/tse/`: uma correção num scraper
vale para o site e para o MCP no próximo build.

### Publicar uma versão

1. Atualize `version` em `mcp/package.json`.
2. Crie e envie a tag `mcp-v<versão>` (ex.: `mcp-v0.1.0`).
3. O workflow `.github/workflows/mcp.yml` roda os testes, gera o `.mcpb`, cria a
   Release com o arquivo anexado e — se o segredo `NPM_TOKEN` estiver
   configurado no repositório — publica no npm, habilitando o `npx`.
