// Transforma os dados brutos de cada fonte em TABELAS planas e consultáveis
// (uma linha = um fato), reaproveitando a lógica de agregação/cruzamento de
// src/tse/. Cada tabela é memoizada pela versão (obtidoEm) dos dados de que
// depende — recalcula só quando alguma fonte foi atualizada.
import { rankResponsaveis, normalizeNome } from '../../src/tse/rankResponsaveis.js';
import { aplicarExcecoes } from '../../src/tse/excecoes.js';
import { construirMandatos } from '../../src/tse/agregarFuncoes.js';
import { agregarTerceirizados } from '../../src/tse/agregarTerceirizados.js';
import { agregarHorasExtras } from '../../src/tse/agregarHorasExtras.js';
import { tetoMensalPorCompetencia, cicloEleitoralDe } from '../../src/tse/horasExtras.js';
import { normalizeUnidade } from '../../src/tse/agregarUnidades.js';
import { canonicalContrato, carregarExcecoesTerceirizados, _resetExcecoesTerceirizados } from '../../src/tse/nomesTerceirizados.js';
import { diasEntre } from '../../src/tse/agregarTeletrabalho.js';
import { paraDataISO, anoDe } from '../../src/tse/datas.js';
import { urlTeletrabalho } from '../../src/tse/scrapeTeletrabalho.js';

const URL_CONTRATO = (id) => `https://contratos.comprasnet.gov.br/transparencia/contratos/${id}`;
const hojeISO = () => new Date().toISOString().slice(0, 10);

/** Descrição de cada tabela consultável — exposta à IA em tse_fontes / tse_consultar. */
export const TABELAS = {
  contratos: {
    descricao: 'Um contrato do TSE por linha (Compras.gov.br), com valores, vigência e responsáveis.',
    depende: ['contratos', 'excecoesContratos'],
    campos: {
      id: 'id no Compras.gov.br', numero: 'número/ano', processo: 'processo SEI', objeto: 'objeto',
      modalidade: 'modalidade da compra', tipo: 'Contrato, Empenho, Termo aditivo…', categoria: 'categoria',
      fornecedor: 'CNPJ - razão social', fornecedorCnpj: 'CNPJ/CPF', fornecedorNome: 'razão social',
      valorGlobal: 'R$', valorEmpenhado: 'R$ (soma dos empenhos)', valorPago: 'R$ (pago + RP pago)',
      vigenciaInicio: 'AAAA-MM-DD', vigenciaFim: 'AAAA-MM-DD', ano: 'ano de início da vigência',
      vigente: 'vigência termina hoje ou depois', 'responsaveis.nome': 'fiscais/gestores',
      'responsaveis.papel': 'papel (Gestor, Fiscal Técnico, … Substituto)', 'responsaveis.cpf': 'CPF mascarado',
      quantidadeResponsaveis: 'nº', correcoes: 'correções manuais aplicadas (auditáveis)', url: 'link oficial',
    },
  },
  responsabilidades: {
    descricao: 'Uma linha por (contrato × responsável): quem fiscaliza/gere qual contrato, em qual papel.',
    depende: ['contratos', 'excecoesContratos'],
    campos: {
      nome: 'responsável', cpf: 'CPF mascarado', papel: 'papel', substituto: 'papel é de substituto',
      contratoId: 'id', numero: 'nº contrato', objeto: 'objeto', fornecedorNome: 'fornecedor', categoria: 'categoria',
      valorGlobal: 'R$', valorPago: 'R$', vigente: 'contrato vigente', ano: 'ano de início', vigenciaFim: 'AAAA-MM-DD',
    },
  },
  agentes: {
    descricao: 'Relação atual de agentes públicos (servidores) do TSE, com cargo, função comissionada vigente e lotação.',
    depende: ['agentes', 'unidades'],
    campos: {
      nome: 'nome', matricula: 'matrícula', cargo: 'cargo efetivo', funcao: 'ex.: FC-6, CJ-3 (null = sem função)',
      funcaoTipo: 'FC|CJ', funcaoNivel: 'número', funcaoTitulo: 'título do cargo/função', lotacao: 'unidade por extenso',
      lotacaoSigla: 'sigla da unidade', lotacaoCaminho: 'siglas da unidade até a secretaria (ex.: SETOT / CSELE / STI)',
      secretaria: 'sigla da secretaria/órgão de topo', atoProvimento: 'portaria de provimento', dataPublicacao: 'AAAA-MM-DD',
    },
  },
  unidades: {
    descricao: 'Organograma do TSE achatado: uma unidade por linha, com hierarquia e contagem de agentes lotados.',
    depende: ['unidades', 'agentes'],
    campos: {
      id: 'id', sigla: 'sigla', nome: 'nome', nivel: '0 = TSE', paiSigla: 'sigla do pai', caminho: 'siglas da raiz até a unidade',
      secretaria: 'sigla da secretaria de topo', filhos: 'nº de subunidades diretas',
      agentesDiretos: 'lotados diretamente', agentesConsolidados: 'lotados na subárvore', comFuncaoDiretos: 'com FC/CJ lotados direto',
    },
  },
  teletrabalho: {
    descricao: 'Períodos de teletrabalho autorizados (um período por linha).',
    depende: ['teletrabalho'],
    campos: {
      nome: 'servidor', unidade: 'lotação por extenso no período', unidadeNiveis: 'níveis da lotação, do menor ao maior',
      dataInicio: 'AAAA-MM-DD', dataFim: 'AAAA-MM-DD (null = em aberto)', dias: 'dias corridos (até hoje se em aberto)',
      vigente: 'período cobre hoje', ano: 'ano de início',
    },
  },
  funcoes_movimentos: {
    descricao: 'Designações e dispensas de funções comissionadas/cargos em comissão lidas das portarias (histórico desde ~2006).',
    depende: ['funcoes'],
    campos: {
      nome: 'servidor', movimento: 'designacao|dispensa', funcao: 'FC-n / CJ-n', tipo: 'FC|CJ', nivel: 'n',
      cargoTitulo: 'título', unidade: 'unidade citada na portaria', data: 'AAAA-MM-DD (publicação no DOU)', ano: 'ano',
      portaria: 'nº/ano', portariaUrl: 'link da portaria',
    },
  },
  funcoes_mandatos: {
    descricao: 'Períodos em que cada servidor ocupou cada função (pareando designação → dispensa das portarias).',
    depende: ['funcoes', 'agentes'],
    campos: {
      nome: 'servidor', funcao: 'FC-n / CJ-n', tipo: 'FC|CJ', nivel: 'n', cargoTitulo: 'título', unidade: 'unidade',
      inicio: 'AAAA-MM-DD', fim: 'AAAA-MM-DD', vigente: 'aberto segundo as portarias', dias: 'duração',
      funcaoAtualOficial: 'função hoje segundo a relação de agentes públicos (fonte primária)',
      portariaInicioUrl: 'link', portariaFimUrl: 'link',
    },
  },
  terceirizados: {
    descricao: 'Profissionais terceirizados (um por pessoa), com lotação, contrato de cessão, mês de início/fim.',
    depende: ['terceirizados', 'unidades', 'contratos', 'excecoesTerceirizados'],
    campos: {
      nome: 'nome', ativo: 'consta na competência mais recente', lotacaoAlocacao: 'alocação como veio do PDF',
      lotacaoCaminho: 'siglas resolvidas na árvore', contrato: 'nº contrato de cessão atual', contratoId: 'id Compras.gov.br',
      contratosHistorico: 'contratos por que passou', empresa: 'empresa', posto: 'posto de trabalho',
      mesInicio: 'AAAA-MM', mesFim: 'AAAA-MM (null = ainda ativo)', competencias: 'nº de meses em que aparece',
    },
  },
  terceirizados_postos: {
    descricao: 'Linhas cruas dos PDFs mensais (competência × profissional), para séries históricas.',
    depende: ['terceirizados'],
    campos: {
      competencia: 'AAAA-MM', contrato: 'nº canônico', empresa: 'empresa', cnpj: 'CNPJ', empregado: 'nome como no PDF',
      posto: 'posto de trabalho', alocacao: 'alocação (siglas)',
    },
  },
  horas_extras: {
    descricao: 'Horas extras ESTIMADAS por servidor e mês de referência (limite superior; ver metodologia).',
    depende: ['horasExtras'],
    campos: {
      nome: 'servidor', unidade: 'unidade na folha', competencia: 'AAAA-MM (mês de referência)', ano: 'ano',
      horas: 'horas estimadas (fator 1,5 — limite superior)', ciclo: 'ano de eleição ordinária ou null', cicloRotulo: 'rótulo',
      acimaDoTeto: 'estimativa do mês acima do teto legal',
    },
  },
};

function dividirFornecedor(fornecedor) {
  const m = /^\s*([\d./-]{11,20})\s*-\s*(.+)$/.exec(fornecedor ?? '');
  return m ? { fornecedorCnpj: m[1], fornecedorNome: m[2].trim() } : { fornecedorCnpj: null, fornecedorNome: fornecedor ?? null };
}

/** Índice do organograma: nós com caminho, resolução por nome/sigla. */
export function indexarUnidades(arvore) {
  const porId = new Map();
  const idPorNome = new Map();
  const idPorSigla = new Map();
  (function visitar(no, pai, nivel, caminho) {
    if (!no) return;
    const id = String(no.id);
    const sigla = (no.name ?? '').trim();
    const nome = (no.nome ?? '').trim();
    const meuCaminho = [...caminho, sigla];
    porId.set(id, { id, sigla, nome, nivel, paiId: pai, caminho: meuCaminho, filhos: (no.children ?? []).map((f) => String(f.id)) });
    const kNome = normalizeUnidade(nome);
    if (kNome && !idPorNome.has(kNome)) idPorNome.set(kNome, id);
    const kSigla = normalizeUnidade(sigla);
    if (kSigla && !idPorSigla.has(kSigla)) idPorSigla.set(kSigla, id);
    for (const f of no.children ?? []) visitar(f, id, nivel + 1, meuCaminho);
  })(arvore, null, 0, []);

  const ehGuardaChuva = (n) => n.sigla === 'SEC' || normalizeUnidade(n.nome) === 'SECRETARIA DO TRIBUNAL';
  const ehSecretaria = (n) => /^SECRETARIA[ -]/.test(normalizeUnidade(n.nome));

  /** Mesma regra da UI: até `max` siglas, para na secretaria, nunca mostra SEC/TSE. */
  function caminhoExibicao(id, max = 3) {
    const out = [];
    let n = porId.get(id);
    while (n && n.paiId !== null && out.length < max) {
      if (ehGuardaChuva(n)) break;
      if (n.sigla) out.push(n.sigla);
      if (ehSecretaria(n)) break;
      n = porId.get(n.paiId);
    }
    return out;
  }
  /** Secretaria (ou órgão equivalente de topo) a que a unidade pertence. */
  function secretariaDe(id) {
    const c = caminhoExibicao(id, Infinity);
    return c.length ? c[c.length - 1] : null;
  }
  const resolverNome = (nome) => idPorNome.get(normalizeUnidade(nome)) ?? null;
  const resolverSigla = (sigla) => idPorSigla.get(normalizeUnidade(sigla)) ?? null;
  return { porId, resolverNome, resolverSigla, caminhoExibicao, secretariaDe };
}

export class Dominio {
  constructor(repositorio) {
    this.repo = repositorio;
    this.memo = new Map(); // tabela -> { versao, valor }
  }

  async #versao(deps) {
    const regs = await Promise.all(deps.map((d) => this.repo.obter(d)));
    return { regs, versao: regs.map((r) => r.meta?.obtidoEm ?? '').join('|') };
  }

  async #memo(nome, deps, construir) {
    const { regs, versao } = await this.#versao(deps);
    const m = this.memo.get(nome);
    if (m && m.versao === versao) return m.valor;
    const valor = await construir(...regs.map((r) => r.dados));
    this.memo.set(nome, { versao, valor });
    return valor;
  }

  /** Metadados de origem (ao vivo / snapshot, quando) das fontes de uma tabela. */
  async origens(deps) {
    const regs = await Promise.all(deps.map((d) => this.repo.obter(d)));
    return Object.fromEntries(
      deps
        .map((d, i) => [d, regs[i].meta])
        .filter(([d, m]) => !d.startsWith('excecoes') || m.origem !== 'vazio')
        .map(([d, m]) => [d, { origem: m.origem, obtidoEm: m.obtidoEm ?? null, ...(m.expirado ? { expirado: true } : {}), ...(m.avisos?.length ? { avisos: m.avisos } : {}) }]),
    );
  }

  contratosBrutos() {
    return this.#memo('_contratosBrutos', ['contratos', 'excecoesContratos'], (contratos, excecoes) =>
      aplicarExcecoes(contratos, Array.isArray(excecoes) ? excecoes : []),
    );
  }

  unidadesIndice() {
    return this.#memo('_unidadesIndice', ['unidades'], (arvore) => indexarUnidades(arvore));
  }

  async tabela(nome) {
    const def = TABELAS[nome];
    if (!def) throw new Error(`tabela desconhecida: ${nome} (disponíveis: ${Object.keys(TABELAS).join(', ')})`);
    return this.#memo(nome, def.depende, () => this.#construir(nome));
  }

  async #construir(nome) {
    const hoje = hojeISO();
    switch (nome) {
      case 'contratos': {
        const brutos = await this.contratosBrutos();
        return brutos.map((c) => ({
          id: c.id,
          numero: c.numero,
          processo: c.processo,
          objeto: c.objeto,
          modalidade: c.modalidade,
          tipo: c.tipo,
          categoria: c.categoria || 'Não informada',
          fornecedor: c.fornecedor,
          ...dividirFornecedor(c.fornecedor),
          valorGlobal: c.valorGlobal || 0,
          valorEmpenhado: c.valorEmpenhado || 0,
          valorPago: c.valorPago || 0,
          vigenciaInicio: paraDataISO(c.vigenciaInicio) ?? null,
          vigenciaFim: paraDataISO(c.vigenciaFim) ?? null,
          ano: anoDe(c.vigenciaInicio) ?? null,
          vigente: (paraDataISO(c.vigenciaFim) ?? '') >= hoje,
          responsaveis: (c.responsaveis ?? []).map((r) => ({ nome: r.nome, papel: r.papel, cpf: r.matricula || null })),
          quantidadeResponsaveis: (c.responsaveis ?? []).length,
          ...(c._correcoes?.length ? { correcoes: c._correcoes } : {}),
          url: c.id ? URL_CONTRATO(c.id) : null,
        }));
      }
      case 'responsabilidades': {
        const contratos = await this.tabela('contratos');
        return contratos.flatMap((c) =>
          c.responsaveis.map((r) => ({
            nome: r.nome,
            cpf: r.cpf,
            papel: r.papel,
            substituto: /substitut/i.test(r.papel ?? ''),
            contratoId: c.id,
            numero: c.numero,
            objeto: c.objeto,
            fornecedorNome: c.fornecedorNome,
            categoria: c.categoria,
            valorGlobal: c.valorGlobal,
            valorPago: c.valorPago,
            vigente: c.vigente,
            ano: c.ano,
            vigenciaFim: c.vigenciaFim,
          })),
        );
      }
      case 'agentes': {
        const [agentes, idx] = [await this.repo.dados('agentes'), await this.unidadesIndice()];
        return agentes.map((a) => {
          const uid = idx.resolverNome(a.lotacao);
          const no = uid ? idx.porId.get(uid) : null;
          return {
            nome: a.nome,
            matricula: a.matricula,
            cargo: a.cargo,
            funcao: a.funcao ? `${a.funcao.tipo}-${a.funcao.nivel}` : null,
            funcaoTipo: a.funcao?.tipo ?? null,
            funcaoNivel: a.funcao?.nivel ?? null,
            funcaoTitulo: a.funcao?.cargoTitulo ?? null,
            lotacao: a.lotacao,
            lotacaoSigla: no?.sigla ?? null,
            lotacaoCaminho: uid ? idx.caminhoExibicao(uid).join(' / ') : null,
            secretaria: uid ? idx.secretariaDe(uid) : null,
            atoProvimento: a.atoProvimento,
            dataPublicacao: paraDataISO(a.dataPublicacao) ?? a.dataPublicacao ?? null,
            ...(a.observacoes?.length ? { observacoes: a.observacoes } : {}),
          };
        });
      }
      case 'unidades': {
        const [idx, agentes] = [await this.unidadesIndice(), await this.repo.dados('agentes')];
        const diretos = new Map();
        const comFuncao = new Map();
        for (const a of agentes) {
          const uid = idx.resolverNome(a.lotacao);
          if (!uid) continue;
          diretos.set(uid, (diretos.get(uid) ?? 0) + 1);
          if (a.funcao) comFuncao.set(uid, (comFuncao.get(uid) ?? 0) + 1);
        }
        const consolidado = (id) => {
          const n = idx.porId.get(id);
          return (diretos.get(id) ?? 0) + n.filhos.reduce((s, f) => s + consolidado(f), 0);
        };
        return [...idx.porId.values()].map((n) => ({
          id: n.id,
          sigla: n.sigla,
          nome: n.nome,
          nivel: n.nivel,
          paiSigla: n.paiId ? idx.porId.get(n.paiId)?.sigla ?? null : null,
          caminho: n.caminho.join(' > '),
          secretaria: idx.secretariaDe(n.id),
          filhos: n.filhos.length,
          agentesDiretos: diretos.get(n.id) ?? 0,
          agentesConsolidados: consolidado(n.id),
          comFuncaoDiretos: comFuncao.get(n.id) ?? 0,
        }));
      }
      case 'teletrabalho': {
        const registros = await this.repo.dados('teletrabalho');
        return registros.map((r) => {
          const ini = paraDataISO(r.dataInicio) ?? null;
          const fim = r.dataFim ? paraDataISO(r.dataFim) ?? null : null;
          return {
            nome: r.nome,
            unidade: r.unidade,
            unidadeNiveis: r.unidadeNiveis,
            dataInicio: ini,
            dataFim: fim,
            dias: ini ? diasEntre(ini, fim ?? hoje) : 0,
            vigente: Boolean(ini && ini <= hoje && (!fim || fim >= hoje)),
            ano: ini ? Number(ini.slice(0, 4)) : null,
          };
        });
      }
      case 'funcoes_movimentos': {
        const movs = await this.repo.dados('funcoes');
        return movs.map((m) => ({
          nome: m.nome,
          movimento: m.tipo === 'inicio' ? 'designacao' : 'dispensa',
          funcao: `${m.func}-${m.nivel}`,
          tipo: m.func,
          nivel: m.nivel,
          cargoTitulo: m.cargoTitulo,
          unidade: m.unidade,
          data: m.dataEfetiva,
          ano: m.dataEfetiva ? Number(m.dataEfetiva.slice(0, 4)) : null,
          portaria: m.portaria?.numero ? `${m.portaria.numero}/${m.portaria.ano}` : null,
          portariaUrl: m.portaria?.url ?? null,
        }));
      }
      case 'funcoes_mandatos': {
        const [movs, agentes] = [await this.repo.dados('funcoes'), await this.repo.dados('agentes')];
        const atual = new Map(agentes.map((a) => [normalizeNome(a.nome), a.funcao ? `${a.funcao.tipo}-${a.funcao.nivel}` : null]));
        const porPessoa = new Map();
        for (const m of movs) {
          const k = normalizeNome(m.nome);
          if (!porPessoa.has(k)) porPessoa.set(k, { nome: m.nome, movs: [] });
          porPessoa.get(k).movs.push(m);
        }
        const linhas = [];
        for (const [k, { nome, movs: lista }] of porPessoa) {
          for (const md of construirMandatos(lista)) {
            linhas.push({
              nome,
              funcao: `${md.tipo}-${md.nivel}`,
              tipo: md.tipo,
              nivel: md.nivel,
              cargoTitulo: md.cargoTitulo,
              unidade: md.unidade,
              inicio: md.nomeacaoData,
              fim: md.exoneracaoData,
              vigente: md.vigente,
              dias: md.nomeacaoData ? diasEntre(md.nomeacaoData, md.exoneracaoData ?? hoje) : null,
              funcaoAtualOficial: atual.has(k) ? atual.get(k) : 'não consta na relação atual',
              portariaInicioUrl: md.nomeacaoPortaria?.url ?? null,
              portariaFimUrl: md.exoneracaoPortaria?.url ?? null,
            });
          }
        }
        return linhas;
      }
      case 'terceirizados': {
        const ag = await this.terceirizadosAgregado();
        return ag.pessoas.map((p) => ({
          nome: p.nome,
          ativo: p.ativo,
          lotacaoAlocacao: p.lotacaoAlocacao,
          lotacaoCaminho: p.lotacaoSiglas.join(' / ') || null,
          contrato: p.contrato,
          contratoId: p.contratoId,
          contratosHistorico: p.contratosHistorico,
          empresa: p.empresa,
          posto: p.posto,
          mesInicio: p.mesInicio,
          mesFim: p.mesFim,
          competencias: p.competencias,
        }));
      }
      case 'terceirizados_postos': {
        const bruto = await this.repo.dados('terceirizados');
        return Object.entries(bruto.porCompetencia ?? {}).flatMap(([competencia, linhas]) =>
          linhas.map((r) => ({
            competencia,
            contrato: canonicalContrato(r.contrato),
            empresa: r.empresa,
            cnpj: r.cnpj,
            empregado: r.empregado,
            posto: r.posto,
            alocacao: r.alocacao,
          })),
        );
      }
      case 'horas_extras': {
        const ag = await this.horasExtrasAgregado();
        return ag.ocorrencias.map((o) => {
          const ci = cicloEleitoralDe(o.chave);
          return {
            nome: o.nome,
            unidade: o.unidade,
            competencia: o.chave,
            ano: Number(o.chave.slice(0, 4)),
            horas: Math.round(o.horas * 10) / 10,
            ciclo: ci?.ciclo ?? null,
            cicloRotulo: ci?.rotulo ?? 'Outros meses',
            acimaDoTeto: o.horas > tetoMensalPorCompetencia(o.chave),
          };
        });
      }
      default:
        throw new Error(`tabela sem construtor: ${nome}`);
    }
  }

  /** Agregado completo de src/tse/agregarTerceirizados.js (pessoas, porContrato, falhas). */
  terceirizadosAgregado() {
    return this.#memo(
      '_terceirizados',
      ['terceirizados', 'unidades', 'contratos', 'excecoesContratos', 'excecoesTerceirizados'],
      async (bruto, arvore, _c, _e, excTerc) => {
        // O agregador lê as correções manuais de <raiz>/data/…; aponta para o
        // diretório de cache, onde a camada de dados acabou de gravá-las.
        _resetExcecoesTerceirizados();
        const temExcecoes = excTerc && !Array.isArray(excTerc) && Object.keys(excTerc).length > 0;
        carregarExcecoesTerceirizados(temExcecoes ? this.repo.config.diretorioCache : '/nao-existe');
        return agregarTerceirizados(bruto, arvore, await this.tabela('contratos'));
      },
    );
  }

  horasExtrasAgregado() {
    return this.#memo('_horasExtras', ['horasExtras'], (bruto) => agregarHorasExtras(bruto));
  }

  /** Ranking de responsáveis (reaproveita rankResponsaveis de src/tse). */
  async ranking({ somenteVigentes = false, papeis, incluirSubstitutos = true } = {}) {
    let contratos = await this.contratosBrutos();
    const hoje = hojeISO();
    if (somenteVigentes) contratos = contratos.filter((c) => (paraDataISO(c.vigenciaFim) ?? '') >= hoje);
    if (!incluirSubstitutos) {
      contratos = contratos.map((c) => ({ ...c, responsaveis: (c.responsaveis ?? []).filter((r) => !/substitut/i.test(r.papel ?? '')) }));
    }
    let papeisFiltro;
    if (papeis?.length) {
      const todos = new Set(contratos.flatMap((c) => (c.responsaveis ?? []).map((r) => r.papel)));
      const alvo = papeis.map(normalizeNome);
      papeisFiltro = [...todos].filter((p) => alvo.some((a) => normalizeNome(p).includes(a)));
    }
    return rankResponsaveis(contratos, papeisFiltro ? { papeis: papeisFiltro } : {});
  }

  /** Localiza pessoas por nome em todas as fontes de pessoal. */
  async localizarPessoa(consulta) {
    const alvo = normalizeNome(consulta);
    const tokens = alvo.split(' ').filter((t) => t.length > 1);
    const candidatos = new Map(); // nomeNorm -> { nome, fontes:Set }
    const add = (nome, fonte) => {
      if (!nome) return;
      const k = normalizeNome(nome);
      if (!(k === alvo || tokens.every((t) => k.split(' ').includes(t) || k.includes(t)))) return;
      if (!candidatos.has(k)) candidatos.set(k, { nome, fontes: new Set() });
      candidatos.get(k).fontes.add(fonte);
    };
    const fontes = [
      ['agentes', 'agentes', (r) => r.nome],
      ['responsabilidades', 'contratos', (r) => r.nome],
      ['teletrabalho', 'teletrabalho', (r) => r.nome],
      ['funcoes_movimentos', 'portarias', (r) => r.nome],
      ['horas_extras', 'horas_extras', (r) => r.nome],
    ];
    for (const [tabela, rotulo, nomeDe] of fontes) {
      try {
        for (const r of await this.tabela(tabela)) add(nomeDe(r), rotulo);
      } catch {
        // fonte indisponível: segue com as outras
      }
    }
    return [...candidatos.entries()]
      .map(([k, c]) => ({ nome: c.nome, chave: k, exato: k === alvo, fontes: [...c.fontes] }))
      .sort((a, b) => Number(b.exato) - Number(a.exato) || b.fontes.length - a.fontes.length || a.nome.localeCompare(b.nome));
  }

  /** Dossiê de uma pessoa: cruza todas as fontes pelo nome normalizado. */
  async perfil(nomeExato) {
    const k = normalizeNome(nomeExato);
    const doNome = (r) => normalizeNome(r.nome) === k;
    const seguro = async (fn) => {
      try {
        return await fn();
      } catch (err) {
        return { indisponivel: err instanceof Error ? err.message : String(err) };
      }
    };
    const agente = await seguro(async () => (await this.tabela('agentes')).find(doNome) ?? null);
    const responsabilidades = await seguro(async () => (await this.tabela('responsabilidades')).filter(doNome));
    const teletrabalho = await seguro(async () => (await this.tabela('teletrabalho')).filter(doNome));
    const mandatos = await seguro(async () => (await this.tabela('funcoes_mandatos')).filter(doNome));
    const horas = await seguro(async () => {
      const ag = await this.horasExtrasAgregado();
      const r = ag.ranking.find(doNome);
      if (!r) return null;
      const arred = (n) => Math.round(n * 10) / 10;
      return {
        horasConsolidadas: arred(r.horasConsolidadas),
        horasConsolidadasMin: arred(r.horasConsolidadasMin),
        mesesComHorasExtras: r.mesesComHE,
        mediaMensal: arred(r.mediaMensal),
        ultimaCompetencia: r.ultimaCompetencia,
        mesesAcimaDoTeto: r.flags.acimaDoTeto,
        porCiclo: r.porCiclo.map((c) => ({ ...c, horas: arred(c.horas) })),
        porMes: r.porCompetencia.map((c) => ({ competencia: c.chave, horas: arred(c.horas), acimaDoTeto: c.acimaDoTeto })),
      };
    });

    const resumoContratos = Array.isArray(responsabilidades)
      ? (() => {
          const porContrato = new Map();
          for (const r of responsabilidades) {
            const c = porContrato.get(r.contratoId) ?? { ...r, papeis: [] };
            c.papeis.push(r.papel);
            porContrato.set(r.contratoId, c);
          }
          const curto = (t) => (t && t.length > 160 ? `${t.slice(0, 159)}…` : t);
          const lista = [...porContrato.values()].map(({ nome, cpf, papel, substituto, objeto, ...c }) => ({ ...c, objeto: curto(objeto) }));
          lista.sort((a, b) => b.valorGlobal - a.valorGlobal);
          return {
            quantidade: lista.length,
            vigentes: lista.filter((c) => c.vigente).length,
            valorGlobalConsolidado: lista.reduce((s, c) => s + c.valorGlobal, 0),
            valorGlobalVigente: lista.filter((c) => c.vigente).reduce((s, c) => s + c.valorGlobal, 0),
            papeis: [...new Set(responsabilidades.map((r) => r.papel))].sort(),
            contratos: lista,
          };
        })()
      : responsabilidades;

    const resumoTele = Array.isArray(teletrabalho)
      ? {
          periodos: teletrabalho.length,
          diasConsolidados: teletrabalho.reduce((s, p) => s + p.dias, 0),
          vigenteHoje: teletrabalho.some((p) => p.vigente),
          consultaOficial: urlTeletrabalho({ nomeServidor: nomeExato }),
          lista: [...teletrabalho].sort((a, b) => (b.dataInicio ?? '').localeCompare(a.dataInicio ?? '')),
        }
      : teletrabalho;

    return {
      nome: agente?.nome ?? nomeExato,
      agentePublicoAtual: agente,
      funcoesComissionadas: Array.isArray(mandatos)
        ? { funcaoAtualOficial: agente?.funcao ?? null, historicoPelasPortarias: mandatos }
        : mandatos,
      contratosComoResponsavel: resumoContratos,
      teletrabalho: resumoTele,
      horasExtrasEstimadas: horas,
      aviso:
        'Cruzamento por nome normalizado (sem acento/caixa): as fontes não compartilham CPF/matrícula, então homônimos ou grafias divergentes podem misturar ou separar registros.',
    };
  }
}
