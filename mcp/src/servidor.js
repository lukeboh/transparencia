// Definição do servidor MCP: ferramentas, recurso de metodologia e prompts.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { RepositorioDados, configuracao, CONJUNTOS } from './dados.js';
import { Dominio, TABELAS } from './dominio.js';
import { consultar, filtrar, OPERADORES, METRICAS, LIMITE_MAXIMO, normalizarTexto } from './consulta.js';
import { METODOLOGIA } from './metodologia.js';
import { canonicalContrato } from '../../src/tse/nomesTerceirizados.js';

// Injetada no build a partir do package.json (scripts/build.mjs).
export const VERSAO = process.env.TSE_MCP_VERSAO_BUILD ?? '0.0.0-dev';

// Teto do texto devolvido por chamada: respostas enormes estouram o contexto
// da IA cliente. Acima disso, a lista é cortada e a resposta pede paginação.
const MAX_CARACTERES = 120_000;

const ANOTACOES = { readOnlyHint: true, openWorldHint: true, idempotentHint: true };

const limite = z.number().int().min(1).max(LIMITE_MAXIMO).optional().describe(`Máximo de itens (padrão 50, máx. ${LIMITE_MAXIMO}).`);
const offset = z.number().int().min(0).optional().describe('Pular N itens (paginação).');
const direcao = z.enum(['asc', 'desc']).optional();

// Somas de valores em R$ acumulam ruído de ponto flutuante (483881389.97999996).
const arredondar = (_k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v);
const serializar = (obj) => JSON.stringify(obj, arredondar);

function responder(corpo) {
  let texto = serializar(corpo);
  if (texto.length > MAX_CARACTERES && Array.isArray(corpo.itens)) {
    let n = corpo.itens.length;
    while (texto.length > MAX_CARACTERES && n > 1) {
      n = Math.floor(n / 2);
      texto = serializar({
        ...corpo,
        itens: corpo.itens.slice(0, n),
        retornados: n,
        truncado: true,
        nota: `Resposta reduzida a ${n} itens por tamanho. Use 'offset'/'limite' para paginar ou 'campos' para pedir menos colunas.`,
      });
    }
  }
  return { content: [{ type: 'text', text: texto }] };
}

function falha(err) {
  return { isError: true, content: [{ type: 'text', text: `Erro: ${err instanceof Error ? err.message : String(err)}` }] };
}

/** Envolve o handler: erros viram resultado isError (a IA vê e pode reagir). */
const seguro = (fn) => async (args) => {
  try {
    return await fn(args ?? {});
  } catch (err) {
    return falha(err);
  }
};

const f = (campo, op, valor) => ({ campo, op, valor });

/** Filtro de texto livre sobre vários campos: cada palavra precisa aparecer em algum deles. */
function filtroTextoLivre(itens, texto, campos) {
  if (!texto) return itens;
  const palavras = normalizarTexto(texto).split(' ').filter(Boolean);
  return itens.filter((it) => {
    const alvo = normalizarTexto(campos.map((c) => it[c] ?? '').join(' '));
    return palavras.every((p) => alvo.includes(p));
  });
}

/**
 * Se `termo` é sigla do organograma, devolve os nomes normalizados (por extenso)
 * e as siglas da unidade e de toda a sua subárvore; senão, null.
 */
async function subarvoreDaSigla(dom, termo) {
  const alvo = normalizarTexto(termo);
  const unidades = await dom.tabela('unidades');
  if (!unidades.some((u) => normalizarTexto(u.sigla) === alvo)) return null;
  const sub = unidades.filter((u) => u.caminho.split(' > ').some((sg) => normalizarTexto(sg) === alvo));
  return { nomes: new Set(sub.map((u) => normalizarTexto(u.nome))), siglas: new Set(sub.map((u) => normalizarTexto(u.sigla))) };
}

export function criarServidor({ config = configuracao(), repositorio, dominio } = {}) {
  const repo = repositorio ?? new RepositorioDados(config);
  const dom = dominio ?? new Dominio(repo);
  const servidor = new McpServer(
    { name: 'tse-transparencia', version: VERSAO },
    {
      instructions:
        'Dados públicos de transparência do Tribunal Superior Eleitoral (TSE): contratos e seus fiscais/gestores, ' +
        'servidores e funções comissionadas, organograma, teletrabalho, terceirizados e horas extras estimadas. ' +
        'Comece por tse_fontes para ver as tabelas e campos. Use as ferramentas específicas para perguntas comuns e ' +
        'tse_consultar para recortes livres (filtros, agrupamentos, somas). Cruzamentos entre fontes são por NOME ' +
        '(sem CPF comum) e horas extras são ESTIMATIVAS — deixe isso claro ao usuário e cite a data em _fontes.',
    },
  );

  const comFontes = async (tabelas, corpo) => {
    const deps = [...new Set(tabelas.flatMap((t) => TABELAS[t]?.depende ?? [t]))];
    return responder({ ...corpo, _fontes: await dom.origens(deps) });
  };

  // ---------------------------------------------------------------- tse_fontes
  servidor.registerTool(
    'tse_fontes',
    {
      title: 'Fontes, tabelas e campos disponíveis',
      description:
        'Lista as tabelas consultáveis (com descrição de cada campo), as fontes oficiais de onde vêm, a situação do cache ' +
        'local (origem e data) e um resumo da metodologia. Chame primeiro para saber o que dá para perguntar.',
      inputSchema: {
        incluirMetodologia: z.boolean().optional().describe('Inclui o texto completo de metodologia/limitações (padrão: false).'),
      },
      annotations: ANOTACOES,
    },
    seguro(async ({ incluirMetodologia }) =>
      responder({
        modo: config.modo,
        diretorioCache: config.diretorioCache,
        tabelas: Object.fromEntries(Object.entries(TABELAS).map(([k, v]) => [k, { descricao: v.descricao, fontes: v.depende.filter((d) => !d.startsWith('excecoes')), campos: v.campos }])),
        conjuntos: await repo.situacao(),
        operadoresFiltro: OPERADORES,
        metricasAgrupamento: METRICAS,
        ...(incluirMetodologia ? { metodologia: METODOLOGIA } : { metodologia: 'Leia o recurso tse://metodologia ou chame com incluirMetodologia=true.' }),
      }),
    ),
  );

  // ------------------------------------------------------------- tse_consultar
  servidor.registerTool(
    'tse_consultar',
    {
      title: 'Consulta livre sobre qualquer tabela',
      description:
        'Consulta genérica: filtra, ordena, agrupa (com contar/somar/média/mediana/min/max) e projeta campos de qualquer ' +
        'tabela (veja tse_fontes). Campos aninhados com ponto (ex.: "responsaveis.papel"); em campos-lista o filtro casa ' +
        'se algum elemento casar. Texto é comparado sem acento/caixa. Exemplos: contratos vigentes por categoria com soma ' +
        'de valorGlobal: {tabela:"contratos", filtros:[{campo:"vigente",op:"igual",valor:true}], agruparPor:["categoria"], ' +
        'metricas:[{op:"somar",campo:"valorGlobal"},{op:"contar"}]}.',
      inputSchema: {
        tabela: z.enum(Object.keys(TABELAS)).describe('Tabela a consultar.'),
        filtros: z
          .array(
            z.object({
              campo: z.string().describe('Campo (caminho com ponto).'),
              op: z.enum(OPERADORES).default('igual'),
              valor: z.any().optional().describe('Valor; lista para "em"/"fora_de"; [de, ate] para "entre".'),
            }),
          )
          .optional(),
        modoFiltro: z.enum(['todos', 'algum']).optional().describe('"todos" (E, padrão) ou "algum" (OU).'),
        campos: z.array(z.string()).optional().describe('Projeção: só estes campos em cada item.'),
        ordenarPor: z.array(z.object({ campo: z.string(), direcao })).optional(),
        agruparPor: z.array(z.string()).optional().describe('Campos de agrupamento.'),
        metricas: z
          .array(z.object({ op: z.enum(METRICAS), campo: z.string().optional(), como: z.string().optional().describe('Nome da coluna de saída.') }))
          .optional()
          .describe('Métricas por grupo (padrão: contar).'),
        limite,
        offset,
      },
      annotations: ANOTACOES,
    },
    seguro(async (a) => {
      const itens = await dom.tabela(a.tabela);
      return comFontes([a.tabela], { tabela: a.tabela, ...consultar(itens, a) });
    }),
  );

  // ------------------------------------------------------ tse_buscar_contratos
  servidor.registerTool(
    'tse_buscar_contratos',
    {
      title: 'Buscar contratos do TSE',
      description:
        'Busca contratos do TSE (Compras.gov.br) por texto (objeto, fornecedor, número, processo), fornecedor, responsável ' +
        '(fiscal/gestor), categoria, vigência, faixa de valor e ano. Retorna lista resumida ordenável; detalhes em tse_detalhar_contrato.',
      inputSchema: {
        texto: z.string().optional().describe('Palavras buscadas em objeto, fornecedor, número e processo.'),
        fornecedor: z.string().optional().describe('Trecho do nome ou CNPJ do fornecedor.'),
        responsavel: z.string().optional().describe('Trecho do nome de um fiscal/gestor.'),
        categoria: z.string().optional(),
        somenteVigentes: z.boolean().optional(),
        valorMinimo: z.number().optional(),
        valorMaximo: z.number().optional(),
        anoDe: z.number().int().optional().describe('Ano de início da vigência, a partir de.'),
        anoAte: z.number().int().optional(),
        ordenarPor: z.enum(['valorGlobal', 'valorPago', 'valorEmpenhado', 'vigenciaInicio', 'vigenciaFim', 'numero']).optional(),
        direcao,
        limite,
        offset,
      },
      annotations: ANOTACOES,
    },
    seguro(async (a) => {
      const filtros = [];
      if (a.fornecedor) filtros.push(f('fornecedor', 'contem', a.fornecedor));
      if (a.responsavel) filtros.push(f('responsaveis.nome', 'contem', a.responsavel));
      if (a.categoria) filtros.push(f('categoria', 'contem', a.categoria));
      if (a.somenteVigentes) filtros.push(f('vigente', 'igual', true));
      if (a.valorMinimo != null) filtros.push(f('valorGlobal', 'maior_igual', a.valorMinimo));
      if (a.valorMaximo != null) filtros.push(f('valorGlobal', 'menor_igual', a.valorMaximo));
      if (a.anoDe != null) filtros.push(f('ano', 'maior_igual', a.anoDe));
      if (a.anoAte != null) filtros.push(f('ano', 'menor_igual', a.anoAte));
      const candidatos = filtroTextoLivre(await dom.tabela('contratos'), a.texto, ['objeto', 'fornecedor', 'numero', 'processo']);
      const todos = filtrar(candidatos, filtros);
      const r = consultar(todos, {
        ordenarPor: [{ campo: a.ordenarPor ?? 'valorGlobal', direcao: a.direcao ?? 'desc' }],
        limite: a.limite,
        offset: a.offset,
      });
      r.itens = r.itens.map(({ responsaveis, correcoes, processo, fornecedorCnpj, ...c }) => ({
        ...c,
        responsaveis: responsaveis.map((x) => `${x.nome} (${x.papel})`),
        ...(correcoes ? { temCorrecaoManual: true } : {}),
      }));
      return comFontes(['contratos'], {
        ...r,
        somaValorGlobal: todos.reduce((soma, c) => soma + c.valorGlobal, 0),
        somaValorPago: todos.reduce((soma, c) => soma + c.valorPago, 0),
      });
    }),
  );

  // ----------------------------------------------------- tse_detalhar_contrato
  servidor.registerTool(
    'tse_detalhar_contrato',
    {
      title: 'Detalhar contrato',
      description:
        'Todos os dados de um contrato (valores, vigência, objeto, responsáveis com papéis, correções manuais, link oficial) ' +
        'por id do Compras.gov.br ou número ("39/2019", "00039/2019"). Para contratos de cessão de mão de obra, inclui a ' +
        'contagem de terceirizados.',
      inputSchema: {
        id: z.string().optional().describe('id no Compras.gov.br.'),
        numero: z.string().optional().describe('Número/ano; zeros à esquerda são ignorados.'),
      },
      annotations: ANOTACOES,
    },
    seguro(async ({ id, numero }) => {
      if (!id && !numero) throw new Error('informe id ou numero');
      const contratos = await dom.tabela('contratos');
      const achados = contratos.filter((c) =>
        id ? c.id === String(id) : canonicalContrato(c.numero) === canonicalContrato(numero),
      );
      let terc = null;
      try {
        terc = await dom.terceirizadosAgregado();
      } catch {
        // terceirizados indisponível: segue sem a contagem
      }
      const itens = achados.map((c) => {
        const t = terc?.porContrato?.find((p) => p.contratoId === c.id);
        return t ? { ...c, terceirizados: { ativos: t.ativos, totalHistorico: t.total } } : c;
      });
      return comFontes(['contratos'], {
        encontrados: itens.length,
        itens,
        ...(itens.length === 0 ? { dica: 'Nenhum contrato com esse id/número. Tente tse_buscar_contratos com texto.' } : {}),
        ...(itens.length > 1 ? { nota: 'Mais de um instrumento com esse número (modalidades/tipos diferentes).' } : {}),
      });
    }),
  );

  // ------------------------------------------------- tse_ranking_responsaveis
  servidor.registerTool(
    'tse_ranking_responsaveis',
    {
      title: 'Ranking de fiscais/gestores por valor sob responsabilidade',
      description:
        'Ranking dos responsáveis (gestores, fiscais técnicos/administrativos/requisitantes e substitutos) pelo valor ' +
        'consolidado dos contratos que acompanham. Cada contrato conta uma vez por pessoa.',
      inputSchema: {
        somenteVigentes: z.boolean().optional().describe('Só contratos vigentes hoje.'),
        incluirSubstitutos: z.boolean().optional().describe('Considera papéis de substituto (padrão: true).'),
        papeis: z.array(z.string()).optional().describe('Trechos de papel a considerar, ex.: ["Gestor"], ["Fiscal Técnico"].'),
        criterio: z.enum(['valorConsolidado', 'valorPagoConsolidado', 'valorEmpenhadoConsolidado', 'quantidadeContratos']).optional(),
        nome: z.string().optional().describe('Filtra o ranking por trecho do nome (mantém a posição geral).'),
        incluirContratos: z.boolean().optional().describe('Inclui a lista de contratos de cada pessoa (mais longo).'),
        limite,
        offset,
      },
      annotations: ANOTACOES,
    },
    seguro(async (a) => {
      const criterio = a.criterio ?? 'valorConsolidado';
      const ranking = (await dom.ranking(a))
        .sort((x, y) => y[criterio] - x[criterio])
        .map((p, i) => ({
          posicao: i + 1,
          nome: p.nome,
          cpf: p.matricula ?? null,
          papeis: p.papeis,
          quantidadeContratos: p.quantidadeContratos,
          valorConsolidado: p.valorConsolidado,
          valorEmpenhadoConsolidado: p.valorEmpenhadoConsolidado,
          valorPagoConsolidado: p.valorPagoConsolidado,
          ...(a.incluirContratos ? { contratos: p.contratos } : {}),
        }));
      const r = consultar(ranking, { filtros: a.nome ? [f('nome', 'contem', a.nome)] : [], limite: a.limite, offset: a.offset });
      return comFontes(['contratos'], { criterio, totalPessoas: ranking.length, ...r });
    }),
  );

  // --------------------------------------------------- tse_buscar_servidores
  servidor.registerTool(
    'tse_buscar_servidores',
    {
      title: 'Buscar servidores (agentes públicos)',
      description:
        'Busca na relação atual de agentes públicos do TSE por nome, lotação (sigla ou trecho do nome da unidade, ' +
        'inclui subunidades pelo caminho), cargo e função comissionada (ex.: "CJ", "FC-6"). Para o dossiê completo de ' +
        'uma pessoa use tse_perfil_servidor.',
      inputSchema: {
        nome: z.string().optional(),
        lotacao: z.string().optional().describe('Sigla (ex.: "STI") ou trecho do nome da unidade.'),
        cargo: z.string().optional().describe('Trecho do cargo efetivo, ex.: "ANALISTA".'),
        funcao: z.string().optional().describe('"CJ", "FC", "CJ-3", "FC-6"…'),
        somenteComFuncao: z.boolean().optional(),
        somenteSemFuncao: z.boolean().optional(),
        ordenarPor: z.enum(['nome', 'funcaoNivel', 'lotacao', 'dataPublicacao']).optional(),
        direcao,
        limite,
        offset,
      },
      annotations: ANOTACOES,
    },
    seguro(async (a) => {
      const filtros = [];
      if (a.nome) filtros.push(f('nome', 'contem', a.nome));
      if (a.cargo) filtros.push(f('cargo', 'contem', a.cargo));
      if (a.funcao) filtros.push(f('funcao', /-\d$/.test(a.funcao.trim()) ? 'igual' : 'comeca_com', a.funcao.trim().replace(/\s*-?\s*(\d)$/, '-$1')));
      if (a.somenteComFuncao) filtros.push(f('funcao', 'existe'));
      if (a.somenteSemFuncao) filtros.push(f('funcao', 'nao_existe'));
      let itens = await dom.tabela('agentes');
      if (a.lotacao) {
        // Sigla do organograma → a unidade e toda a sua subárvore; senão, trecho
        // do nome por extenso (substring de sigla daria falso positivo:
        // "STI" está dentro de "JUSTIÇA").
        const sub = await subarvoreDaSigla(dom, a.lotacao);
        const alvo = normalizarTexto(a.lotacao);
        itens = itens.filter((s) => (sub ? sub.nomes.has(normalizarTexto(s.lotacao)) : normalizarTexto(s.lotacao).includes(alvo)));
      }
      const ordem = a.ordenarPor ?? 'nome';
      const r = consultar(itens, {
        filtros,
        ordenarPor: [{ campo: ordem, direcao: a.direcao ?? (ordem === 'funcaoNivel' ? 'desc' : 'asc') }],
        limite: a.limite,
        offset: a.offset,
      });
      return comFontes(['agentes'], r);
    }),
  );

  // ----------------------------------------------------- tse_perfil_servidor
  servidor.registerTool(
    'tse_perfil_servidor',
    {
      title: 'Perfil completo de um servidor',
      description:
        'Dossiê de uma pessoa cruzando TODAS as fontes pelo nome: dados atuais (cargo, função, lotação), histórico de ' +
        'funções comissionadas pelas portarias, contratos em que é fiscal/gestor, teletrabalho e horas extras estimadas. ' +
        'Se o nome for ambíguo, devolve os candidatos para escolher.',
      inputSchema: {
        nome: z.string().min(3).describe('Nome completo ou parte dele.'),
      },
      annotations: ANOTACOES,
    },
    seguro(async ({ nome }) => {
      const candidatos = await dom.localizarPessoa(nome);
      const exatos = candidatos.filter((c) => c.exato);
      const escolhido = exatos.length === 1 ? exatos[0] : candidatos.length === 1 ? candidatos[0] : null;
      if (!escolhido) {
        return responder({
          ambiguo: candidatos.length > 1,
          encontrados: candidatos.length,
          candidatos: candidatos.slice(0, 30).map(({ chave, ...c }) => c),
          dica: candidatos.length ? 'Chame de novo com o nome exato de um candidato.' : 'Ninguém encontrado. Tente só nome e sobrenome.',
        });
      }
      const perfil = await dom.perfil(escolhido.nome);
      return comFontes(['agentes', 'responsabilidades', 'teletrabalho', 'funcoes_mandatos', 'horas_extras'], {
        encontradoEm: escolhido.fontes,
        ...perfil,
      });
    }),
  );

  // ---------------------------------------------------------- tse_unidades
  servidor.registerTool(
    'tse_unidades',
    {
      title: 'Organograma e unidades do TSE',
      description:
        'Navega o organograma oficial: busca unidade por sigla ou nome, mostra o caminho até a raiz, as subunidades ' +
        '(até a profundidade pedida) e a contagem de agentes lotados (direta e consolidada). Sem argumentos, mostra os ' +
        'dois primeiros níveis.',
      inputSchema: {
        busca: z.string().optional().describe('Sigla exata (ex.: "STI") ou trecho do nome.'),
        profundidade: z.number().int().min(0).max(6).optional().describe('Níveis de subunidades a incluir (padrão 1).'),
        incluirServidores: z.boolean().optional().describe('Lista os agentes lotados diretamente na unidade.'),
      },
      annotations: ANOTACOES,
    },
    seguro(async ({ busca, profundidade, incluirServidores }) => {
      const unidades = await dom.tabela('unidades');
      const porPai = new Map();
      for (const u of unidades) {
        const k = u.paiSigla ?? '';
        if (!porPai.has(k)) porPai.set(k, []);
        porPai.get(k).push(u);
      }
      const resumo = ({ id, sigla, nome, nivel, agentesDiretos, agentesConsolidados, comFuncaoDiretos, filhos }) => ({
        sigla, nome, nivel, agentesDiretos, agentesConsolidados, comFuncaoDiretos, subunidades: filhos,
      });
      const subarvore = (u, prof) => ({
        ...resumo(u),
        ...(prof > 0 && u.filhos ? { filhos: (porPai.get(u.sigla) ?? []).map((x) => subarvore(x, prof - 1)) } : {}),
      });
      if (!busca) {
        const raiz = unidades.find((u) => u.nivel === 0);
        return comFontes(['unidades'], { totalUnidades: unidades.length, arvore: subarvore(raiz, profundidade ?? 2) });
      }
      const alvo = normalizarTexto(busca);
      let achadas = unidades.filter((u) => normalizarTexto(u.sigla) === alvo);
      if (!achadas.length) achadas = unidades.filter((u) => normalizarTexto(u.nome).includes(alvo));
      if (!achadas.length) return comFontes(['unidades'], { encontradas: 0, dica: 'Nenhuma unidade com essa sigla/nome.' });
      if (achadas.length > 1) {
        return comFontes(['unidades'], {
          encontradas: achadas.length,
          unidades: achadas.slice(0, 50).map((u) => ({ ...resumo(u), caminho: u.caminho })),
          dica: 'Refine pela sigla para ver a subárvore.',
        });
      }
      const u = achadas[0];
      let servidores;
      if (incluirServidores) {
        servidores = (await dom.tabela('agentes'))
          .filter((s) => s.lotacaoSigla && normalizarTexto(s.lotacaoSigla) === normalizarTexto(u.sigla) && normalizarTexto(s.lotacao) === normalizarTexto(u.nome))
          .map(({ nome, cargo, funcao, funcaoTitulo }) => ({ nome, cargo, funcao, funcaoTitulo }));
      }
      return comFontes(incluirServidores ? ['unidades', 'agentes'] : ['unidades'], {
        caminho: u.caminho,
        secretaria: u.secretaria,
        unidade: subarvore(u, profundidade ?? 1),
        ...(servidores ? { servidoresLotadosDiretamente: servidores } : {}),
      });
    }),
  );

  // -------------------------------------------------------- tse_teletrabalho
  servidor.registerTool(
    'tse_teletrabalho',
    {
      title: 'Teletrabalho',
      description:
        'Períodos de teletrabalho dos servidores, filtráveis por nome, unidade (sigla ou trecho do nome, ' +
        'qualquer nível), vigência hoje e intervalo de datas. Visões: "periodos" (lista), "pessoas" (dias ' +
        'consolidados por servidor), "unidades" (servidores e dias por unidade de lotação) ou "anos".',
      inputSchema: {
        visao: z.enum(['periodos', 'pessoas', 'unidades', 'anos']).optional(),
        nome: z.string().optional(),
        unidade: z.string().optional().describe('Sigla (inclui subunidades) ou trecho do nome por extenso.'),
        somenteVigentes: z.boolean().optional().describe('Só períodos que cobrem hoje.'),
        desde: z.string().optional().describe('AAAA-MM-DD: períodos que terminam nesta data ou depois.'),
        ate: z.string().optional().describe('AAAA-MM-DD: períodos que começam até esta data.'),
        limite,
        offset,
      },
      annotations: ANOTACOES,
    },
    seguro(async (a) => {
      const filtros = [];
      if (a.nome) filtros.push(f('nome', 'contem', a.nome));
      if (a.somenteVigentes) filtros.push(f('vigente', 'igual', true));
      if (a.ate) filtros.push(f('dataInicio', 'menor_igual', a.ate));
      let itens = await dom.tabela('teletrabalho');
      if (a.unidade) {
        // A fonte só traz nomes por extenso: uma sigla vira os nomes da subárvore.
        const sub = await subarvoreDaSigla(dom, a.unidade);
        const alvo = normalizarTexto(a.unidade);
        itens = itens.filter((p) =>
          sub ? p.unidadeNiveis.some((n) => sub.nomes.has(normalizarTexto(n))) : normalizarTexto(p.unidade).includes(alvo),
        );
      }
      if (a.desde) itens = itens.filter((p) => !p.dataFim || p.dataFim >= a.desde);
      const visao = a.visao ?? 'periodos';
      const base = { filtros, limite: a.limite, offset: a.offset };
      const r =
        visao === 'pessoas'
          ? consultar(itens, { ...base, agruparPor: ['nome'], metricas: [{ op: 'somar', campo: 'dias', como: 'diasConsolidados' }, { op: 'contar', como: 'periodos' }, { op: 'max', campo: 'vigente', como: 'vigenteHoje' }] })
          : visao === 'unidades'
            ? consultar(itens, { ...base, agruparPor: ['unidade'], metricas: [{ op: 'contar_distintos', campo: 'nome', como: 'servidores' }, { op: 'somar', campo: 'dias', como: 'dias' }, { op: 'contar', como: 'periodos' }] })
            : visao === 'anos'
              ? consultar(itens, { ...base, agruparPor: ['ano'], metricas: [{ op: 'contar_distintos', campo: 'nome', como: 'servidores' }, { op: 'contar', como: 'periodosIniciados' }], ordenarPor: [{ campo: 'ano', direcao: 'asc' }] })
              : consultar(itens, { ...base, ordenarPor: [{ campo: 'dataInicio', direcao: 'desc' }] });
      return comFontes(['teletrabalho'], { visao, ...r });
    }),
  );

  // ------------------------------------------------------------ tse_funcoes
  servidor.registerTool(
    'tse_funcoes',
    {
      title: 'Funções comissionadas e cargos em comissão (histórico)',
      description:
        'Histórico de FC-1…FC-6 e CJ-1…CJ-4 pelas portarias do TSE. Visões: "mandatos" (períodos em que cada pessoa ' +
        'ocupou cada função, com a função atual oficial para comparação), "movimentos" (cada designação/dispensa com ' +
        'link da portaria) ou "resumo" (contagem por função e ano). Para a função ATUAL, prefira tse_buscar_servidores.',
      inputSchema: {
        visao: z.enum(['mandatos', 'movimentos', 'resumo']).optional(),
        nome: z.string().optional(),
        funcao: z.string().optional().describe('"CJ", "FC", "CJ-3"…'),
        unidade: z.string().optional().describe('Trecho da unidade citada na portaria.'),
        desde: z.string().optional().describe('AAAA-MM-DD'),
        ate: z.string().optional().describe('AAAA-MM-DD'),
        somenteVigentes: z.boolean().optional().describe('Mandatos ainda abertos pelas portarias.'),
        limite,
        offset,
      },
      annotations: ANOTACOES,
    },
    seguro(async (a) => {
      const visao = a.visao ?? 'mandatos';
      const tabela = visao === 'mandatos' ? 'funcoes_mandatos' : 'funcoes_movimentos';
      const campoData = visao === 'mandatos' ? 'inicio' : 'data';
      const filtros = [];
      if (a.nome) filtros.push(f('nome', 'contem', a.nome));
      if (a.funcao) {
        const fn = a.funcao.trim().toUpperCase().replace(/\s*-?\s*(\d)$/, '-$1');
        filtros.push(f('funcao', /-\d$/.test(fn) ? 'igual' : 'comeca_com', fn));
      }
      if (a.unidade) filtros.push(f('unidade', 'contem', a.unidade));
      if (a.desde) filtros.push(f(campoData, 'maior_igual', a.desde));
      if (a.ate) filtros.push(f(campoData, 'menor_igual', a.ate));
      if (a.somenteVigentes && visao === 'mandatos') filtros.push(f('vigente', 'igual', true));
      const itens = await dom.tabela(tabela);
      const r =
        visao === 'resumo'
          ? consultar(itens, { filtros: [...filtros, f('movimento', 'igual', 'designacao')], agruparPor: ['ano', 'funcao'], metricas: [{ op: 'contar', como: 'designacoes' }], ordenarPor: [{ campo: 'ano', direcao: 'desc' }, { campo: 'funcao' }], limite: a.limite ?? 200, offset: a.offset })
          : consultar(itens, { filtros, ordenarPor: [{ campo: campoData, direcao: 'desc' }], limite: a.limite, offset: a.offset });
      return comFontes([tabela], { visao, ...r });
    }),
  );

  // ------------------------------------------------------- tse_terceirizados
  servidor.registerTool(
    'tse_terceirizados',
    {
      title: 'Profissionais terceirizados',
      description:
        'Terceirizados dos contratos de cessão de mão de obra (PDFs mensais do TSE). Visões: "pessoas" (lotação, ' +
        'contrato, empresa, mês de início/fim), "contratos" (ativos e histórico por contrato, com valores), "resumo" ' +
        '(totais e competências) ou "falhas" (registros que não puderam ser cruzados — útil para auditoria).',
      inputSchema: {
        visao: z.enum(['pessoas', 'contratos', 'resumo', 'falhas']).optional(),
        nome: z.string().optional(),
        empresa: z.string().optional(),
        contrato: z.string().optional().describe('Número do contrato de cessão, ex.: "31/2023".'),
        lotacao: z.string().optional().describe('Sigla ou trecho da alocação.'),
        somenteAtivos: z.boolean().optional().describe('Só quem consta na competência mais recente.'),
        limite,
        offset,
      },
      annotations: ANOTACOES,
    },
    seguro(async (a) => {
      const visao = a.visao ?? 'pessoas';
      const ag = await dom.terceirizadosAgregado();
      const fontes = ['terceirizados'];
      if (visao === 'resumo') {
        return comFontes(fontes, {
          competenciaAtual: ag.competenciaAtual,
          competencias: ag.competencias.map((c) => c.chave),
          competenciasDescartadas: ag.competenciasDescartadas,
          totalPessoas: ag.totalPessoas,
          ativos: ag.ativos,
          encerrados: ag.encerrados,
          semLotacao: ag.semLotacao,
          contratos: ag.contratos,
          falhas: ag.falhas.length,
        });
      }
      if (visao === 'contratos') {
        const filtros = [];
        if (a.empresa) filtros.push(f('empresa', 'contem', a.empresa));
        if (a.contrato) filtros.push(f('contrato', 'igual', canonicalContrato(a.contrato)));
        if (a.somenteAtivos) filtros.push(f('ativos', 'maior', 0));
        return comFontes(fontes, consultar(ag.porContrato, { filtros, ordenarPor: [{ campo: 'ativos', direcao: 'desc' }], limite: a.limite, offset: a.offset }));
      }
      if (visao === 'falhas') {
        const filtros = a.nome ? [f('nome', 'contem', a.nome)] : [];
        return comFontes(fontes, consultar(ag.falhas, { filtros, limite: a.limite, offset: a.offset }));
      }
      const filtros = [];
      if (a.nome) filtros.push(f('nome', 'contem', a.nome));
      if (a.empresa) filtros.push(f('empresa', 'contem', a.empresa));
      if (a.contrato) filtros.push(f('contratosHistorico', 'igual', canonicalContrato(a.contrato)));
      if (a.somenteAtivos) filtros.push(f('ativo', 'igual', true));
      let itens = await dom.tabela('terceirizados');
      if (a.lotacao) {
        const sub = await subarvoreDaSigla(dom, a.lotacao);
        const alvo = normalizarTexto(a.lotacao);
        const tokens = (t) => normalizarTexto(t).split(/[\s/,]+/).filter(Boolean);
        itens = itens.filter((p) =>
          sub
            ? tokens(p.lotacaoCaminho).some((t) => sub.siglas.has(t))
            : normalizarTexto(p.lotacaoAlocacao).includes(alvo) || normalizarTexto(p.lotacaoCaminho).includes(alvo),
        );
      }
      return comFontes(fontes, consultar(itens, { filtros, ordenarPor: [{ campo: 'nome' }], limite: a.limite, offset: a.offset }));
    }),
  );

  // ------------------------------------------------------- tse_horas_extras
  servidor.registerTool(
    'tse_horas_extras',
    {
      title: 'Horas extras estimadas',
      description:
        'Horas extras ESTIMADAS a partir do valor da rubrica na folha (Anexo VIII) — limite superior, ver metodologia. ' +
        'Visões: "ranking" (por servidor), "ciclos" (por ano eleitoral), "meses" (série mensal), "unidades" (por unidade ' +
        'da folha) ou "servidor" (meses de uma pessoa; exige nome).',
      inputSchema: {
        visao: z.enum(['ranking', 'ciclos', 'meses', 'unidades', 'servidor']).optional(),
        nome: z.string().optional(),
        unidade: z.string().optional().describe('Trecho do nome da unidade na folha.'),
        desde: z.string().optional().describe('AAAA-MM'),
        ate: z.string().optional().describe('AAAA-MM'),
        ciclo: z.string().optional().describe('Ano de eleição, ex.: "2022"; "outros" para anos sem eleição ordinária.'),
        limite,
        offset,
      },
      annotations: ANOTACOES,
    },
    seguro(async (a) => {
      const visao = a.visao ?? 'ranking';
      if (visao === 'servidor' && !a.nome) throw new Error('a visão "servidor" exige o parâmetro nome');
      const filtros = [];
      if (a.nome) filtros.push(f('nome', 'contem', a.nome));
      if (a.unidade) filtros.push(f('unidade', 'contem', a.unidade));
      if (a.desde) filtros.push(f('competencia', 'maior_igual', a.desde));
      if (a.ate) filtros.push(f('competencia', 'menor_igual', a.ate));
      if (a.ciclo) filtros.push(a.ciclo === 'outros' ? f('ciclo', 'nao_existe') : f('ciclo', 'igual', a.ciclo));
      const itens = await dom.tabela('horas_extras');
      const base = { filtros, limite: a.limite, offset: a.offset };
      const somaHoras = { op: 'somar', campo: 'horas', como: 'horas' };
      const por = {
        ranking: { ...base, agruparPor: ['nome'], metricas: [somaHoras, { op: 'contar_distintos', campo: 'competencia', como: 'meses' }, { op: 'max', campo: 'competencia', como: 'ultimaCompetencia' }] },
        ciclos: { ...base, agruparPor: ['cicloRotulo'], metricas: [somaHoras, { op: 'contar_distintos', campo: 'nome', como: 'servidores' }], ordenarPor: [{ campo: 'cicloRotulo' }] },
        meses: { ...base, agruparPor: ['competencia'], metricas: [somaHoras, { op: 'contar_distintos', campo: 'nome', como: 'servidores' }], ordenarPor: [{ campo: 'competencia', direcao: 'desc' }] },
        unidades: { ...base, agruparPor: ['unidade'], metricas: [somaHoras, { op: 'contar_distintos', campo: 'nome', como: 'servidores' }] },
        servidor: { ...base, ordenarPor: [{ campo: 'competencia', direcao: 'desc' }] },
      }[visao];
      const r = consultar(itens, por);
      const arred = (x) => (typeof x.horas === 'number' ? { ...x, horas: Math.round(x.horas * 10) / 10 } : x);
      r.itens = r.itens.map(arred);
      return comFontes(['horas_extras'], {
        visao,
        aviso: 'Estimativa (limite superior) a partir do valor pago; não é registro de ponto. Ver tse://metodologia.',
        ...r,
      });
    }),
  );

  // ------------------------------------------------------ tse_atualizar_dados
  servidor.registerTool(
    'tse_atualizar_dados',
    {
      title: 'Atualizar dados agora',
      description:
        'Força nova obtenção dos conjuntos indicados (ignora o cache): tenta a fonte oficial e, se falhar, o snapshot. ' +
        'Contratos levam ~10-30 s; os demais poucos segundos. Use quando o usuário pedir dado "de agora".',
      inputSchema: {
        conjuntos: z.array(z.enum(Object.keys(CONJUNTOS))).optional().describe('Padrão: contratos, agentes, unidades, teletrabalho.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: false },
    },
    seguro(async ({ conjuntos }) => {
      const alvo = conjuntos?.length ? conjuntos : ['contratos', 'agentes', 'unidades', 'teletrabalho'];
      const resultados = await Promise.all(
        alvo.map(async (id) => {
          try {
            const r = await repo.obter(id, { forcar: true });
            return { conjunto: id, ok: true, origem: r.meta.origem, obtidoEm: r.meta.obtidoEm, ...(r.meta.avisos ? { avisos: r.meta.avisos } : {}) };
          } catch (err) {
            return { conjunto: id, ok: false, erro: err instanceof Error ? err.message : String(err) };
          }
        }),
      );
      return responder({ resultados });
    }),
  );

  // ----------------------------------------------------------- recursos
  servidor.registerResource(
    'metodologia',
    'tse://metodologia',
    { title: 'Metodologia e limitações dos dados do TSE', mimeType: 'text/markdown' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: METODOLOGIA }] }),
  );

  // ------------------------------------------------------------ prompts
  servidor.registerPrompt(
    'analisar_servidor',
    {
      title: 'Analisar um servidor',
      description: 'Monta o perfil de um servidor do TSE cruzando todas as fontes, com ressalvas metodológicas.',
      argsSchema: { nome: z.string().describe('Nome do servidor') },
    },
    ({ nome }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Use tse_perfil_servidor para "${nome}". Resuma: cargo, função e lotação atuais; histórico de funções; ` +
              'contratos sob sua responsabilidade (quantidade, valor, principais); teletrabalho; horas extras estimadas por ciclo. ' +
              'Deixe claro o que é cruzamento por nome e o que é estimativa, e cite a data dos dados (_fontes).',
          },
        },
      ],
    }),
  );

  servidor.registerPrompt(
    'panorama_contratos',
    {
      title: 'Panorama dos contratos do TSE',
      description: 'Visão geral dos contratos: vigentes, valores por categoria, maiores fornecedores e responsáveis.',
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              'Monte um panorama dos contratos do TSE: (1) com tse_consultar na tabela contratos, totais vigentes e ' +
              'valor por categoria; (2) os 10 maiores fornecedores por valorGlobal entre os vigentes (agrupe por ' +
              'fornecedorNome); (3) os 10 maiores responsáveis com tse_ranking_responsaveis (somenteVigentes, sem ' +
              'substitutos). Apresente em tabelas e cite a data dos dados.',
          },
        },
      ],
    }),
  );

  return { servidor, repositorio: repo, dominio: dom };
}
