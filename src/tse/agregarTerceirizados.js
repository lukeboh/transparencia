// Agregação pura dos profissionais terceirizados (postos de trabalho de
// contratos de cessão de mão de obra) do TSE, a partir do histórico mês a mês
// raspado por scrapeTerceirizados.js.
//
// O que sai daqui (consumido pela tela /terceirizados):
//  • uma linha por PESSOA, com a lotação (até 3 siglas, da unidade mais
//    específica para a mais alta), o contrato atual, e o mês de início/fim:
//      - mês de início: primeira competência em que o nome aparece;
//      - mês de fim: última competência em que aparece, SÓ quando ele já não
//        consta na competência mais recente (saída definitiva). Continua na
//        última listagem ⇒ mês de fim vazio (ainda contratado).
//  • KPI por contrato de cessão (quantos terceirizados ativos / no total).
//  • registro de falhas: terceirizados cuja lotação não casou com a árvore de
//    unidades, sem alocação na fonte, ou cujo contrato não foi vinculado ao
//    Compras.gov.br.
//
// O cruzamento da "Alocação" (caminho de siglas, ex.: "Setot/CSEle/STI/TSE")
// com a árvore oficial é por SIGLA, com a mesma heurística de
// agregarUnidades.js (gabinetes de ministro caem todos no nó "MIN").
import { normalizeNome } from './rankResponsaveis.js';
import { normalizeUnidade } from './agregarUnidades.js';
import {
  separarNomePosto,
  carregarExcecoesTerceirizados,
  canonicalContrato,
} from './nomesTerceirizados.js';

const MAX_NIVEIS_LOTACAO = 3;
// Competência com mais que isso de linhas sem nome recuperável é uma falha
// estrutural de extração do PDF daquele mês (o parser mapeou as colunas
// errado) — melhor descartá-la inteira do que injetar milhares de "pessoas"
// fantasmas e saídas/entradas falsas. Ver README.
const LIMIAR_DESCARTE_COMPETENCIA = 0.4;
const ALIAS_SIGLA = { CCJE: 'ACCJE', CONJULEG: 'COJULEG' };
const CONECTIVOS = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);

/** "ACASSIO EVANGELISTA DOS SANTOS" / "acassio..." → "Acassio Evangelista dos Santos". */
function tituloNome(bruto) {
  return String(bruto ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && CONECTIVOS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

/** Limpa a coluna "Posto": ruído puro (só código CBO / dígitos) vira ''. */
function limparPosto(bruto) {
  const s = String(bruto ?? '').replace(/\s+/g, ' ').trim();
  if (!s || /^[\d\s.,;:/\-]+$/.test(s)) return '';
  return s;
}

/** Limpa a coluna "Empresa": tira o CNPJ grudado e pontuação solta no fim. */
function limparEmpresa(bruto) {
  return String(bruto ?? '')
    .replace(/\d{2}[.,]\d{3}[.,]\d{3,4}\/\d{3,4}-\d{2,3}/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s.,-]+$/, '')
    .trim();
}

/** Identificador único de contrato (tira zeros à esquerda, etc.) — ver canonicalContrato. */
const normContrato = canonicalContrato;

const semAcentoUpper = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/** Teto de itens no registro de falhas — evita listão em cenários degradados. */
const MAX_FALHAS = 4000;

const GENERICOS_FORNECEDOR = new Set([
  'ltda', 'me', 'epp', 'eireli', 'sa', 's/a', 'servicos', 'serviços', 'comercio',
  'comércio', 'tecnologia', 'engenharia', 'de', 'da', 'do', 'e', 'em', 'the',
]);
const OBJETO_MAO_DE_OBRA =
  /m[ãa]o\s+de\s+obra|cess[ãa]o\s+de\s+m|posto[s]?\s+de\s+trabalho|terceiriz|vigil[âa]nc|limpeza|conserva|copeir|brigad|recepc|motorist|apoio\s+administrativo/i;

const tokensSignificativos = (texto) =>
  new Set(
    String(texto ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4 && !GENERICOS_FORNECEDOR.has(t)),
  );

/**
 * O número de contrato do Comprasnet ("31/2023") se repete entre modalidades
 * (um contrato de cessão de mão de obra e um de cessão de imóvel podem ter o
 * mesmo número). Dado o número e a empresa que veio no PDF, escolhe o contrato
 * mais plausível: empresa em comum, categoria de serviço, objeto de mão de obra
 * e vigência somam pontos.
 */
function escolherContrato(candidatos, empresaPdf) {
  if (!candidatos || candidatos.length === 0) return null;
  if (candidatos.length === 1) return candidatos[0];
  const tokEmpresa = tokensSignificativos(empresaPdf);
  let melhor = candidatos[0];
  let melhorPontos = -Infinity;
  for (const c of candidatos) {
    let pontos = 0;
    const tokForn = tokensSignificativos(c.fornecedor);
    if ([...tokEmpresa].some((t) => tokForn.has(t))) pontos += 4;
    if (/servi[çc]o/i.test(c.categoria ?? '')) pontos += 2;
    if (OBJETO_MAO_DE_OBRA.test(c.objeto ?? '')) pontos += 2;
    if (c.vigente) pontos += 1;
    if (pontos > melhorPontos) {
      melhorPontos = pontos;
      melhor = c;
    }
  }
  return melhor;
}

/**
 * Indexa a árvore CRUA de unidades (scrapeUnidades.js) por sigla e por id, e
 * devolve helpers para resolver a "Alocação" de um terceirizado num nó e para
 * montar o caminho de siglas desse nó.
 */
function indexarSiglas(arvoreBruta) {
  const porId = new Map();
  const idPorSigla = new Map();

  (function visitar(no) {
    if (!no) return;
    const id = String(no.id);
    const parentId = no.parentidAsString != null ? String(no.parentidAsString) : null;
    porId.set(id, { sigla: no.name ?? '', nome: no.nome ?? '', parentId });
    const sig = normalizeUnidade(no.name);
    if (sig && !idPorSigla.has(sig)) idPorSigla.set(sig, id);
    for (const filho of no.children ?? []) visitar(filho);
  })(arvoreBruta);

  function resolver(alocacao) {
    if (!alocacao) return null;
    const bruto = String(alocacao).trim();
    if (
      /\bMINISTR[OA]\b/i.test(bruto) ||
      /\bGAB[.\- ]?[A-Z]{2,3}\b/i.test(bruto) ||
      /\s[-–]\s[A-Z]{2,3}$/.test(bruto)
    ) {
      return idPorSigla.get('MIN') ?? null;
    }
    const tokens = bruto
      .split(/[/,]|\s+[eE]\s+|\s+/)
      .map((t) => normalizeUnidade(t).replace(/\.+$/, ''))
      .filter(Boolean);
    for (let tok of tokens) {
      if (ALIAS_SIGLA[tok]) tok = ALIAS_SIGLA[tok];
      const id = idPorSigla.get(tok);
      if (id) return id;
    }
    return null;
  }

  function caminhoSiglas(id) {
    const caminho = [];
    let atual = id ? porId.get(id) : undefined;
    while (atual && atual.parentId !== null && caminho.length < MAX_NIVEIS_LOTACAO) {
      if (atual.sigla) caminho.push(atual.sigla);
      atual = porId.get(atual.parentId);
    }
    return caminho;
  }

  return { porId, resolver, caminhoSiglas };
}

/** Aceita o objeto novo ({ porCompetencia, competencias, ... }) ou o array cru
 *  legado (uma foto só, sem histórico) e devolve sempre a forma nova. */
const CHAVE_SINTETICA = '__atual__';

function normalizarEntrada(entrada) {
  if (Array.isArray(entrada)) {
    // Sem datas: uma foto só. Ainda montamos as pessoas, mas sem mês de
    // início/fim (historicoMeses = 0 sinaliza "sem histórico observável").
    return {
      porCompetencia: { [CHAVE_SINTETICA]: entrada },
      competencias: [],
      competenciaAtual: CHAVE_SINTETICA,
      registros: entrada,
    };
  }
  const porCompetencia = { ...(entrada?.porCompetencia ?? {}) };
  let competencias = Array.isArray(entrada?.competencias) ? [...entrada.competencias] : [];
  // Fallback: só a foto mais recente (formato antigo do arquivo) — sintetiza
  // uma competência única para o "mês de início" já sair preenchido.
  if (competencias.length === 0 && entrada?.competencia && Array.isArray(entrada?.registros)) {
    const c = entrada.competencia;
    const chave = c.chave ?? `${c.ano}-${String(c.mes).padStart(2, '0')}`;
    competencias = [{ ...c, chave }];
    porCompetencia[chave] = entrada.registros;
  }
  competencias.sort((a, b) => String(a.chave).localeCompare(String(b.chave)));
  const competenciaAtual =
    entrada?.competenciaAtual?.chave ??
    (competencias.length ? competencias[competencias.length - 1].chave : null);
  return { porCompetencia, competencias, competenciaAtual, registros: entrada?.registros ?? [] };
}

/**
 * @param {object|Array} entradaTerceirizados objeto de scrapeTerceirizados.js
 *   (com `porCompetencia`), ou o array cru legado.
 * @param {object|null} arvoreUnidades árvore crua de scrapeUnidades.js.
 * @param {Array} contratosResumo `DashboardData.contratos` já montado (para o
 *   número do contrato de cessão virar link/id do Comprasnet).
 */
function agregarTerceirizados(entradaTerceirizados, arvoreUnidades = null, contratosResumo = []) {
  const { porCompetencia, competencias, competenciaAtual } = normalizarEntrada(entradaTerceirizados);
  const { resolver, caminhoSiglas } = indexarSiglas(arvoreUnidades ?? { id: 'raiz', children: [] });

  const candidatosPorNumero = new Map();
  for (const c of contratosResumo) {
    const k = normContrato(c.numero);
    if (!k) continue;
    const lista = candidatosPorNumero.get(k) ?? [];
    lista.push(c);
    candidatosPorNumero.set(k, lista);
  }
  const resolverContrato = (numero, empresaPdf) =>
    escolherContrato(candidatosPorNumero.get(normContrato(numero)), empresaPdf);

  // --- Uma entrada por pessoa, varrendo as competências da mais antiga p/ a mais nova ---
  const semHistorico = competencias.length === 0;
  const chavesOrdenadas = semHistorico
    ? Object.keys(porCompetencia).sort()
    : competencias.map((c) => c.chave);

  const excecoes = carregarExcecoesTerceirizados();
  const chaveExc = (s) => semAcentoUpper(s).replace(/\s+/g, ' ').trim();

  // Limpa "NOME + cargo" grudados e resgata nome do campo empresa (competências
  // ruins de 2023). Devolve { nome, posto } limpos + `semNome` para as linhas
  // que são só cargo.
  function limparRegistro(r) {
    const kRaw = chaveExc(r.empregado);
    if (excecoes.descartar.has(kRaw)) return { descartar: true };
    const renomear = excecoes.renomear.get(kRaw);
    if (renomear) return { nome: renomear, posto: limparPosto(r.posto), semNome: false };
    return separarNomePosto(r.empregado ?? r.nome ?? '', r.posto ?? '', r.empresa ?? '');
  }

  // 1ª passada: taxa de linhas sem nome por competência → descarta as
  // estruturalmente quebradas.
  const competenciasDescartadas = [];
  const chavesUsadas = chavesOrdenadas.filter((chave) => {
    const regs = porCompetencia[chave] ?? [];
    if (regs.length === 0) return true; // competência real, só vazia
    let semNome = 0;
    for (const r of regs) {
      const c = limparRegistro(r);
      if (c.descartar || c.semNome) semNome += 1;
    }
    if (semNome / regs.length > LIMIAR_DESCARTE_COMPETENCIA) {
      competenciasDescartadas.push(chave);
      return false;
    }
    return true;
  });
  const competenciaAtualUsada = chavesUsadas[chavesUsadas.length - 1] ?? competenciaAtual;

  const falhas = [];
  const pessoasMap = new Map();
  for (const chave of chavesUsadas) {
    for (const r of porCompetencia[chave] ?? []) {
      const limpo = limparRegistro(r);
      if (limpo.descartar) continue;
      if (limpo.semNome) {
        if (falhas.length < MAX_FALHAS) {
          falhas.push({
            tipo: 'nome-nao-identificado',
            nome: String(r.empregado ?? '').replace(/\s+/g, ' ').trim() || '(vazio)',
            alocacao: String(r.alocacao ?? '').trim(),
            contrato: canonicalContrato(r.contrato),
            competenciaMaisRecente: chave,
          });
        }
        continue;
      }
      const kPessoa = normalizeNome(limpo.nome);
      if (!kPessoa) continue;
      let p = pessoasMap.get(kPessoa);
      if (!p) {
        p = { nome: tituloNome(limpo.nome), competenciasPresente: [], ocorrencias: [] };
        pessoasMap.set(kPessoa, p);
      }
      if (p.competenciasPresente[p.competenciasPresente.length - 1] !== chave) {
        p.competenciasPresente.push(chave);
      }
      p.ocorrencias.push({
        chave,
        contrato: canonicalContrato(r.contrato),
        empresa: limparEmpresa(r.empresa),
        posto: limpo.posto || limparPosto(r.posto),
        alocacao: String(r.alocacao ?? '').trim(),
      });
    }
  }

  const pessoas = [];
  for (const p of pessoasMap.values()) {
    const ultima = p.ocorrencias[p.ocorrencias.length - 1];
    const presente = p.competenciasPresente;
    const mesInicio = semHistorico ? null : (presente[0] ?? null);
    const aindaConsta = competenciaAtualUsada != null && presente.includes(competenciaAtualUsada);
    const mesFim = semHistorico || aindaConsta ? null : (presente[presente.length - 1] ?? null);

    const unidadeId = resolver(ultima.alocacao);
    const lotacaoSiglas = unidadeId ? caminhoSiglas(unidadeId) : [];
    const contratoResumo = resolverContrato(ultima.contrato, ultima.empresa);
    const contratosHistorico = [];
    for (const o of p.ocorrencias) {
      if (o.contrato && contratosHistorico[contratosHistorico.length - 1] !== o.contrato) {
        if (!contratosHistorico.includes(o.contrato)) contratosHistorico.push(o.contrato);
      }
    }

    pessoas.push({
      nome: p.nome,
      lotacaoSiglas,
      lotacaoAlocacao: ultima.alocacao,
      contrato: ultima.contrato,
      contratoId: contratoResumo?.id ?? null,
      contratosHistorico,
      empresa: ultima.empresa,
      posto: ultima.posto,
      mesInicio,
      mesFim,
      ativo: mesFim === null,
      competencias: presente.length,
    });

    if (!ultima.alocacao) {
      falhas.push(criarFalha('sem-alocacao', p.nome, ultima));
    } else if (lotacaoSiglas.length === 0) {
      falhas.push(criarFalha('lotacao-nao-identificada', p.nome, ultima));
    }
    if (ultima.contrato && !contratoResumo) {
      falhas.push(criarFalha('contrato-nao-vinculado', p.nome, ultima));
    }
  }
  pessoas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  falhas.sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome, 'pt-BR'));

  // --- KPI por contrato de cessão ---
  // Uma empresa representativa por número (a de quem está atualmente no
  // contrato) desempata contratos de número igual entre modalidades.
  const empresaPorNumero = new Map();
  for (const p of pessoas) {
    if (p.contrato && p.empresa && !empresaPorNumero.has(p.contrato)) {
      empresaPorNumero.set(p.contrato, p.empresa);
    }
  }
  const contratoMap = new Map();
  for (const p of pessoas) {
    for (const numero of p.contratosHistorico.length ? p.contratosHistorico : (p.contrato ? [p.contrato] : [])) {
      let c = contratoMap.get(numero);
      if (!c) {
        const resumo = resolverContrato(numero, empresaPorNumero.get(numero) ?? p.empresa);
        c = {
          contrato: numero,
          contratoId: resumo?.id ?? null,
          empresa: '',
          ativos: 0,
          total: 0,
          valorGlobal: resumo?.valorGlobal ?? null,
          valorEmpenhado: resumo?.valorEmpenhado ?? null,
          valorPago: resumo?.valorPago ?? null,
          vigente: resumo ? resumo.vigente : null,
          fornecedor: resumo?.fornecedor ?? null,
          objeto: resumo?.objeto ?? null,
          categoria: resumo?.categoria ?? null,
        };
        contratoMap.set(numero, c);
      }
      c.total += 1;
      if (p.contrato === numero) {
        if (!c.empresa && p.empresa) c.empresa = p.empresa;
        if (p.ativo) c.ativos += 1;
      }
    }
  }
  const porContrato = [...contratoMap.values()].sort(
    (a, b) => b.ativos - a.ativos || b.total - a.total || a.contrato.localeCompare(b.contrato, 'pt-BR'),
  );

  const ativos = pessoas.filter((p) => p.ativo).length;
  const usadas = new Set(chavesUsadas);
  const rotuloPorChave = new Map(competencias.map((c) => [c.chave, c.rotulo ?? c.chave]));
  const descOrdenadas = [...competenciasDescartadas].sort();
  return {
    competencias: competencias
      .filter((c) => usadas.has(c.chave))
      .map((c) => ({ chave: c.chave, rotulo: c.rotulo ?? c.chave, mes: c.mes ?? null, ano: c.ano ?? null })),
    competenciaAtual: competenciaAtualUsada,
    historicoMeses: semHistorico ? 0 : chavesUsadas.length,
    /** Competências ignoradas por falha estrutural de extração do PDF (colunas mapeadas errado). */
    competenciasDescartadas: descOrdenadas.map((chave) => ({
      chave,
      rotulo: rotuloPorChave.get(chave) ?? chave,
    })),
    totalPessoas: pessoas.length,
    ativos,
    encerrados: pessoas.length - ativos,
    semLotacao: pessoas.filter((p) => p.lotacaoSiglas.length === 0).length,
    contratos: porContrato.length,
    pessoas,
    porContrato,
    falhas,
  };
}

function criarFalha(tipo, nome, ocorrencia) {
  return {
    tipo,
    nome,
    alocacao: ocorrencia.alocacao,
    contrato: ocorrencia.contrato,
    competenciaMaisRecente: ocorrencia.chave,
  };
}

export { agregarTerceirizados };
