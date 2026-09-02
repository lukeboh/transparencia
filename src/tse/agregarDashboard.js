// Agregação pura: contratos extraídos → objeto DashboardData consumido pelo
// app web. Usada tanto pelo gerador de snapshot (buildDashboardData.js) quanto
// pela rota de API do app (web/app/api/tse/dados), que atualiza os dados em
// runtime a partir da fonte.
import { rankResponsaveis, normalizeNome } from './rankResponsaveis.js';
import { agregarFuncoes } from './agregarFuncoes.js';
import { agregarTeletrabalho } from './agregarTeletrabalho.js';
import { agregarUnidades } from './agregarUnidades.js';
import { agregarTerceirizados } from './agregarTerceirizados.js';
import { agregarHorasExtras } from './agregarHorasExtras.js';
import { canonicalContrato } from './nomesTerceirizados.js';
import { anoDe, paraDataISO } from './datas.js';
import { aplicarExcecoes } from './excecoes.js';

const MAX_FATIAS = 5; // demais categorias somadas em "Outros"

function agregarDashboard(contratos, movimentosFuncoes = [], agentesPublicos = [], excecoes = [], movimentosTeletrabalho = [], arvoreUnidades = null, terceirizados = [], horasExtras = []) {
  contratos = aplicarExcecoes(contratos, excecoes);
  // `terceirizados` pode chegar como o objeto novo de scrapeTerceirizados.js
  // (com histórico `porCompetencia`) ou como o array cru legado. A contagem por
  // unidade (agregarUnidades) só quer a foto mais recente; o histórico completo
  // vai para agregarTerceirizados.
  const terceirizadosRegistros = Array.isArray(terceirizados)
    ? terceirizados
    : (terceirizados?.registros ?? []);
  const hoje = new Date().toISOString().slice(0, 10);

  const totalContratado = contratos.reduce((s, c) => s + (c.valorGlobal || 0), 0);
  const totalEmpenhado = contratos.reduce((s, c) => s + (c.valorEmpenhado || 0), 0);
  const totalPago = contratos.reduce((s, c) => s + (c.valorPago || 0), 0);

  const vigentes = contratos.filter((c) => (paraDataISO(c.vigenciaFim) ?? '') >= hoje);
  // Contratos vindos de um cache incompleto (ex.: resumo truncado, sem a
  // coluna de responsáveis) podem chegar sem esse campo — trata como vazio
  // em vez de estourar.
  const responsaveis = new Set(
    contratos.flatMap((c) => (c.responsaveis ?? []).map((r) => r.matricula || r.nome)),
  );

  const porAno = new Map();
  for (const c of contratos) {
    const ano = anoDe(c.vigenciaInicio);
    if (!ano) continue;
    const acc = porAno.get(ano) ?? { ano, valor: 0, valorEmpenhado: 0, valorPago: 0, contratos: 0 };
    acc.valor += (c.valorGlobal || 0);
    acc.valorEmpenhado += (c.valorEmpenhado || 0);
    acc.valorPago += (c.valorPago || 0);
    acc.contratos += 1;
    porAno.set(ano, acc);
  }
  const ordenadoPorAno = [...porAno.values()].sort((a, b) => a.ano - b.ano);
  const primeiroRelevante = ordenadoPorAno.findIndex((p) => p.valor >= 10_000 || p.valorEmpenhado >= 10_000);
  const evolucao = primeiroRelevante === -1 ? ordenadoPorAno : ordenadoPorAno.slice(primeiroRelevante);

  const porCategoria = new Map();
  for (const c of contratos) {
    const nome = c.categoria || 'Não informada';
    const acc = porCategoria.get(nome) ?? { categoria: nome, valor: 0, valorEmpenhado: 0, valorPago: 0, contratos: 0 };
    acc.valor += (c.valorGlobal || 0);
    acc.valorEmpenhado += (c.valorEmpenhado || 0);
    acc.valorPago += (c.valorPago || 0);
    acc.contratos += 1;
    porCategoria.set(nome, acc);
  }
  const ordenadas = [...porCategoria.values()].sort((a, b) => b.valor - a.valor);
  const principais = ordenadas.slice(0, MAX_FATIAS);
  const resto = ordenadas.slice(MAX_FATIAS);
  const categorias = resto.length
    ? [...principais, {
        categoria: 'Outros',
        valor: resto.reduce((s, c) => s + c.valor, 0),
        valorEmpenhado: resto.reduce((s, c) => s + c.valorEmpenhado, 0),
        valorPago: resto.reduce((s, c) => s + c.valorPago, 0),
        contratos: resto.reduce((s, c) => s + c.contratos, 0),
      }]
    : principais;

  const truncar = (texto, max) =>
    (texto ?? '').length > max ? `${texto.slice(0, max - 1)}…` : (texto ?? '');
  const contratosResumo = contratos.map((c) => ({
    id: c.id,
    numero: c.numero,
    objeto: truncar(c.objeto, 140),
    fornecedor: truncar(c.fornecedor, 80),
    valorGlobal: c.valorGlobal || 0,
    valorEmpenhado: c.valorEmpenhado || 0,
    valorPago: c.valorPago || 0,
    ano: anoDe(c.vigenciaInicio) ?? null,
    categoria: c.categoria || 'Não informada',
    vigente: (paraDataISO(c.vigenciaFim) ?? '') >= hoje,
    correcoes: c._correcoes ?? [],
  }));
  const indicePorId = new Map(contratos.map((c, i) => [c.id, i]));

  const rankingCompleto = rankResponsaveis(contratos);
  // /unidades é uma foto do momento atual: "Fiscais vigentes" por unidade deve
  // contar só quem responde por contrato vigente hoje, não o histórico de
  // contratos já encerrados.
  const rankingVigentes = rankResponsaveis(vigentes);
  const { servidores: servidoresFuncoes, rankingComFuncao } = agregarFuncoes(agentesPublicos, movimentosFuncoes, contratos);
  const teletrabalho = agregarTeletrabalho(movimentosTeletrabalho, rankingCompleto, hoje);
  // Horas extras (serviço extraordinário) estimadas a partir do valor pago na
  // rubrica "HORAS EXTRAS" do Anexo VIII — ver agregarHorasExtras.js. As
  // ocorrências (uma por servidor/mês) alimentam a contagem por unidade abaixo;
  // não vão para o snapshot enviado ao navegador.
  const horasExtrasAgg = agregarHorasExtras(horasExtras);
  const { ocorrencias: horasExtrasOcorrencias, ...horasExtrasResumo } = horasExtrasAgg;

  // Cruza o número do contrato de cessão de mão de obra ("13/2022") com a base
  // do Comprasnet para linkar cada terceirizado ao detalhe do contrato.
  const normContrato = canonicalContrato;
  const idPorNumeroContrato = new Map();
  for (const c of contratosResumo) {
    const k = normContrato(c.numero);
    if (k && !idPorNumeroContrato.has(k)) idPorNumeroContrato.set(k, c.id);
  }

  const unidades = arvoreUnidades
    ? agregarUnidades(arvoreUnidades, agentesPublicos, teletrabalho, rankingVigentes, terceirizadosRegistros, horasExtrasOcorrencias)
    : {
        arvore: null,
        totalServidoresTSE: 0,
        terceirizados: [],
        naoLocalizados: {
          servidores: 0,
          teletrabalho: 0,
          terceirizados: 0,
          horasExtras: 0,
          ambiguos: 0,
          exemplos: { servidores: [], teletrabalho: [], terceirizados: [] },
        },
      };
  for (const t of unidades.terceirizados ?? []) {
    t.contratoId = idPorNumeroContrato.get(normContrato(t.contrato)) ?? null;
  }

  // Terceirizados como entidade própria: uma linha por pessoa, com lotação,
  // contrato, mês de início/fim, KPI por contrato e registro de falhas.
  const terceirizadosAgregado = agregarTerceirizados(terceirizados, arvoreUnidades, contratosResumo);

  const calcMediana = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    if (s.length === 0) return 0;
    return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  const medianaValor = calcMediana(rankingCompleto.map((r) => r.valorConsolidado));
  const medianaEmpenhado = calcMediana(rankingCompleto.map((r) => r.valorEmpenhadoConsolidado || 0));
  const medianaPago = calcMediana(rankingCompleto.map((r) => r.valorPagoConsolidado || 0));

  const responsaveisVigentes = new Set(
    vigentes.flatMap((c) => (c.responsaveis ?? []).map((r) => r.matricula || r.nome)),
  );
  const ranking = rankingComFuncao.map((r) => ({
    nome: r.nome,
    papeis: r.papeis,
    valorConsolidado: r.valorConsolidado || 0,
    valorEmpenhadoConsolidado: r.valorEmpenhadoConsolidado || 0,
    valorPagoConsolidado: r.valorPagoConsolidado || 0,
    quantidadeContratos: r.quantidadeContratos,
    contratos: r.contratos
      .filter((c) => indicePorId.has(c.id))
      .map((c) => ({ i: indicePorId.get(c.id), papeis: c.papeis, funcaoNoContrato: c.funcaoNoContrato ?? null })),
  }));

  // Índice do servidor no ranking final (por nome normalizado) — permite ao
  // front-end abrir os contratos fiscalizados por ele sem recruzar dados.
  const indicePorNomeRanking = new Map(ranking.map((r, i) => [normalizeNome(r.nome), i]));
  const funcoesServidores = servidoresFuncoes.map((s) => ({
    ...s,
    responsavelRankingIndex: indicePorNomeRanking.get(normalizeNome(s.nome)) ?? null,
  }));

  // "Todos os servidores (agentes públicos)": a relação atual de agentes
  // públicos do TSE (fonte primária) unida a quem aparece como fiscal/gestor
  // em contrato sem constar nela (ex-servidor, ou divergência de grafia entre
  // as fontes). Cada linha aponta, por nome normalizado, para o índice no
  // ranking de responsáveis (null = não fiscaliza nada) e para o índice em
  // funcoes.servidores (null = nunca teve FC/CJ, nem no histórico de portarias).
  const funcoesIndexPorNome = new Map(
    funcoesServidores.map((s, i) => [normalizeNome(s.nome), i]),
  );
  const teletrabalhoIndexPorNome = new Map(
    teletrabalho.ranking.map((r, i) => [normalizeNome(r.nome), i]),
  );
  const horasExtrasIndexPorNome = new Map(
    horasExtrasResumo.ranking.map((r, i) => [normalizeNome(r.nome), i]),
  );
  const servidoresLista = [];
  const vistosServidores = new Set();
  for (const ap of agentesPublicos) {
    if (!ap.nome) continue;
    const chave = normalizeNome(ap.nome);
    if (vistosServidores.has(chave)) continue;
    vistosServidores.add(chave);
    servidoresLista.push({
      nome: ap.nome,
      matricula: ap.matricula ?? null,
      cargo: ap.cargo ?? null,
      lotacao: ap.lotacao ?? null,
      naRelacaoAtual: true,
      funcaoAtual: ap.funcao ?? null,
      rankingIndex: indicePorNomeRanking.get(chave) ?? null,
      funcoesIndex: funcoesIndexPorNome.get(chave) ?? null,
      teletrabalhoIndex: teletrabalhoIndexPorNome.get(chave) ?? null,
      horasExtrasIndex: horasExtrasIndexPorNome.get(chave) ?? null,
    });
  }
  for (let i = 0; i < ranking.length; i++) {
    const chave = normalizeNome(ranking[i].nome);
    if (vistosServidores.has(chave)) continue;
    vistosServidores.add(chave);
    const fi = funcoesIndexPorNome.get(chave) ?? null;
    servidoresLista.push({
      nome: ranking[i].nome,
      matricula: fi !== null ? funcoesServidores[fi].matricula ?? null : null,
      cargo: fi !== null ? funcoesServidores[fi].cargo ?? null : null,
      lotacao: fi !== null ? funcoesServidores[fi].lotacao ?? null : null,
      naRelacaoAtual: false,
      funcaoAtual: fi !== null ? funcoesServidores[fi].funcaoAtual ?? null : null,
      rankingIndex: i,
      funcoesIndex: fi,
      teletrabalhoIndex: teletrabalhoIndexPorNome.get(chave) ?? null,
      horasExtrasIndex: horasExtrasIndexPorNome.get(chave) ?? null,
    });
  }
  servidoresLista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return {
    geradoEm: new Date().toISOString(),
    fonte: 'https://contratos.comprasnet.gov.br/transparencia/contratos?unidade=TSE',
    resumo: {
      totalContratado,
      totalEmpenhado,
      totalPago,
      totalContratos: contratos.length,
      contratosVigentes: vigentes.length,
      valorVigente: vigentes.reduce((s, c) => s + (c.valorGlobal || 0), 0),
      valorVigenteEmpenhado: vigentes.reduce((s, c) => s + (c.valorEmpenhado || 0), 0),
      valorVigentePago: vigentes.reduce((s, c) => s + (c.valorPago || 0), 0),
      totalResponsaveis: responsaveis.size,
      // Tamanho da relação atual de agentes públicos do TSE (fonte primária,
      // ver scrapeAgentesPublicos.js) — usado como proxy do quantitativo
      // total de servidores/agentes públicos "no momento", para comparar com
      // quem está em teletrabalho agora.
      totalAgentesPublicos: agentesPublicos.length,
    },
    evolucao,
    categorias,
    contratos: contratosResumo,
    responsaveis: {
      total: rankingCompleto.length,
      emContratosVigentes: responsaveisVigentes.size,
      medianaValor,
      medianaEmpenhado,
      medianaPago,
      ranking,
    },
    funcoes: {
      total: funcoesServidores.length,
      zeroFiscal: funcoesServidores.filter((s) => s.zeroFiscal).length,
      // "Vigente" aqui é o que a relação atual de agentes públicos diz — a
      // fonte primária e mais confiável para o estado de hoje (ver
      // agregarFuncoes.js); o histórico de portarias entra só como
      // enriquecimento/checagem, refletido nas observações de cada servidor.
      vigentes: funcoesServidores.filter((s) => s.funcaoAtual !== null).length,
      servidores: funcoesServidores,
    },
    servidores: {
      total: servidoresLista.length,
      comContrato: servidoresLista.filter((s) => s.rankingIndex !== null).length,
      semContrato: servidoresLista.filter((s) => s.rankingIndex === null).length,
      lista: servidoresLista,
    },
    teletrabalho,
    horasExtras: horasExtrasResumo,
    unidades,
    terceirizados: terceirizadosAgregado,
  };
}

export { agregarDashboard };
