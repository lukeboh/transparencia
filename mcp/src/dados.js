// Camada de dados do servidor MCP: obtém cada conjunto de dados do TSE sob
// demanda, reaproveitando os scrapers de src/tse/ (o know-how de como chegar
// em cada fonte oficial mora lá — aqui só orquestramos).
//
// Estratégia por conjunto (modo "auto", o padrão):
//   1. memória / disco, se ainda dentro do TTL;
//   2. fonte oficial AO VIVO (scraper de src/tse/), incremental sobre o que já
//      temos quando o scraper suporta;
//   3. se a fonte oficial falhar (WAF do TSE, rede, layout mudou), o SNAPSHOT
//      versionado no repositório (data/*.json no GitHub, atualizado pelo
//      pipeline do projeto);
//   4. em último caso, o cache em disco mesmo expirado.
//
// Toda resposta carrega `origem` + `obtidoEm`, para a IA dizer ao usuário de
// onde e de quando é o dado.
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { scrapeContratos } from '../../src/tse/scrapeContratos.js';
import { scrapeAgentesPublicos } from '../../src/tse/scrapeAgentesPublicos.js';
import { scrapeUnidades } from '../../src/tse/scrapeUnidades.js';
import { scrapeTeletrabalho } from '../../src/tse/scrapeTeletrabalho.js';
import { scrapeFuncoes, listarPortariasDoAno } from '../../src/tse/scrapeFuncoes.js';

const REPO_SNAPSHOT = 'https://raw.githubusercontent.com/lukeboh/transparencia/main/data';
const URL_TERCEIRIZADOS =
  'https://www.tse.jus.br/transparencia-e-prestacao-de-contas/pessoal/profissionais-terceirizados-contratos-com-cessao-de-mao-de-obra';

const MODOS = ['auto', 'snapshot', 'ao-vivo'];
const HORA = 60 * 60 * 1000;
// Depois de uma falha ao vivo, não insiste na fonte oficial por um tempo — o
// WAF do TSE costuma bloquear em rajada e cada tentativa custa segundos.
const ESPERA_APOS_FALHA = 30 * 60 * 1000;

export function configuracao(env = process.env) {
  const modo = MODOS.includes(env.TSE_MCP_MODO) ? env.TSE_MCP_MODO : 'auto';
  return {
    modo,
    diretorioCache: env.TSE_MCP_CACHE_DIR || diretorioCachePadrao(),
    snapshotUrl: (env.TSE_MCP_SNAPSHOT_URL || REPO_SNAPSHOT).replace(/\/+$/, ''),
    snapshotDir: env.TSE_MCP_SNAPSHOT_DIR || null,
    ttlMultiplicador: Number(env.TSE_MCP_TTL_MULTIPLICADOR) > 0 ? Number(env.TSE_MCP_TTL_MULTIPLICADOR) : 1,
  };
}

function diretorioCachePadrao() {
  const casa = os.homedir();
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(casa, 'AppData', 'Local'), 'tse-transparencia-mcp');
  }
  if (process.platform === 'darwin') return path.join(casa, 'Library', 'Caches', 'tse-transparencia-mcp');
  return path.join(process.env.XDG_CACHE_HOME || path.join(casa, '.cache'), 'tse-transparencia-mcp');
}

/** Ano corrente e o anterior: portarias publicadas com atraso no DOU ainda caem no ano anterior. */
const anoInicioIncremental = () => new Date().getFullYear() - 1;

/**
 * Catálogo dos conjuntos de dados. `aoVivo(base)` recebe o dado anterior
 * (cache ou snapshot) para permitir extração incremental; `null` = só snapshot.
 */
export const CONJUNTOS = {
  contratos: {
    titulo: 'Contratos do TSE (Compras.gov.br)',
    arquivo: 'tse_contratos.json',
    fonteOficial: 'https://contratos.comprasnet.gov.br/transparencia/contratos?unidade=TSE',
    ttlHoras: 6,
    aoVivo: (base) => scrapeContratos('TSE', { cacheContratos: Array.isArray(base) ? base : undefined }),
  },
  agentes: {
    titulo: 'Relação de agentes públicos do TSE (Anexo V, Res. CNJ 102/2009)',
    arquivo: 'tse_agentes.json',
    fonteOficial:
      'https://transparencia.tse.jus.br/transparenciaDadosServidores/smvc/relatorios/servidor/relacao-agentes-publicos',
    ttlHoras: 6,
    aoVivo: () => scrapeAgentesPublicos(),
  },
  unidades: {
    titulo: 'Árvore de unidades (organograma oficial)',
    arquivo: 'tse_unidades.json',
    fonteOficial:
      'https://transparencia.tse.jus.br/transparenciaDadosServidores/smvc/relatorios/lotacao-geral/sem-assinatura/agrupamento-por-unidade',
    ttlHoras: 24,
    aoVivo: () => scrapeUnidades(),
  },
  teletrabalho: {
    titulo: 'Servidores em regime de teletrabalho (períodos)',
    arquivo: 'tse_teletrabalho.json',
    fonteOficial:
      'https://www.tse.jus.br/transparencia-e-prestacao-de-contas/pessoal/cargos-e-funcoes/servidores-em-regime-de-teletrabalho',
    ttlHoras: 6,
    aoVivo: () => scrapeTeletrabalho(),
  },
  funcoes: {
    titulo: 'Histórico de funções comissionadas FC/CJ (portarias da legislação compilada)',
    arquivo: 'tse_funcoes.json',
    fonteOficial: 'https://www.tse.jus.br/legislacao/compilada/prt',
    ttlHoras: 24,
    // O backfill completo (2000→hoje) leva dezenas de minutos: a base é sempre
    // o snapshot/cache e só os dois últimos anos são reconsultados.
    precisaBase: true,
    aoVivo: async (base) => {
      if (!Array.isArray(base) || !base.length) throw new Error('sem base histórica para extração incremental');
      // scrapeFuncoes engole falha de índice anual (para não derrubar o pipeline
      // do site) e devolveria a base intacta como se fosse "ao vivo". Sonda o ano
      // corrente antes: se a fonte bloquear, falha de verdade e cai no snapshot.
      await listarPortariasDoAno(new Date().getFullYear());
      return scrapeFuncoes({ anoInicio: anoInicioIncremental(), cacheMovimentos: base });
    },
  },
  terceirizados: {
    titulo: 'Profissionais terceirizados (PDFs mensais de postos de trabalho)',
    arquivo: 'tse_terceirizados.json',
    fonteOficial: URL_TERCEIRIZADOS,
    ttlHoras: 24,
    precisaBase: true,
    aoVivo: (base) => atualizarTerceirizados(base),
  },
  horasExtras: {
    titulo: 'Horas extras — valores da rubrica no Anexo VIII da folha (para estimativa de horas)',
    arquivo: 'tse_horas_extras.json',
    fonteOficial: 'https://transparencia.tse.jus.br/transparenciaDadosServidores/infoServidores?acao=Anexo_VIII',
    ttlHoras: 24,
    // A extração exige navegador real (WAF do Anexo VIII) e ~1 contracheque por
    // servidor por mês — inviável sob demanda. Só snapshot.
    aoVivo: null,
  },
  excecoesContratos: {
    titulo: 'Correções manuais auditáveis de contratos',
    arquivo: 'tse_excecoes.json',
    ttlHoras: 24,
    aoVivo: null,
    vazio: () => [],
  },
  excecoesTerceirizados: {
    titulo: 'Correções manuais de nomes de terceirizados (OCR)',
    arquivo: 'tse_terceirizados_excecoes.json',
    ttlHoras: 24,
    aoVivo: null,
    vazio: () => ({}),
  },
};

/** Baixa só as competências que faltam na base (PDF mensal → linhas). */
async function atualizarTerceirizados(base) {
  // Import tardio: o leitor de PDF (pdfjs-dist) só é carregado quando há PDF para ler.
  const { descobrirArquivos, parsePdfTerceirizados } = await import('../../src/tse/scrapeTerceirizados.js');
  const res = await fetch(URL_TERCEIRIZADOS);
  if (!res.ok) throw new Error(`listagem de terceirizados indisponível (status ${res.status})`);
  const arquivos = descobrirArquivos(await res.text());
  if (arquivos.length === 0) throw new Error('nenhuma competência reconhecida na listagem de terceirizados');

  const porCompetencia = { ...(base?.porCompetencia ?? {}) };
  const meta = new Map((base?.competencias ?? []).map((c) => [c.chave, c]));
  for (const { href, competencia } of arquivos) {
    if (Array.isArray(porCompetencia[competencia.chave]) && porCompetencia[competencia.chave].length) continue;
    const pdf = await fetch(href, { redirect: 'follow' });
    if (!pdf.ok) continue;
    const buffer = new Uint8Array(await pdf.arrayBuffer());
    let registros;
    try {
      registros = await parsePdfTerceirizados(buffer);
    } catch {
      continue;
    }
    porCompetencia[competencia.chave] = registros;
    meta.set(competencia.chave, {
      ...competencia,
      arquivoUrl: href,
      total: registros.length,
      comAlocacao: registros.filter((r) => r.alocacao).length,
      extraidoEm: new Date().toISOString(),
    });
  }
  const competencias = [...meta.values()]
    .filter((c) => Array.isArray(porCompetencia[c.chave]))
    .sort((a, b) => a.chave.localeCompare(b.chave));
  if (!competencias.length) throw new Error('nenhuma competência de terceirizados pôde ser baixada');
  const atual = competencias[competencias.length - 1];
  return {
    geradoEm: new Date().toISOString(),
    fonte: URL_TERCEIRIZADOS,
    arquivoUrl: atual.arquivoUrl,
    competenciaAtual: { mes: atual.mes, ano: atual.ano, chave: atual.chave, rotulo: atual.rotulo },
    competencias,
    total: porCompetencia[atual.chave].length,
    registros: porCompetencia[atual.chave],
    porCompetencia,
  };
}

const msg = (err) => (err instanceof Error ? err.message : String(err));

export class RepositorioDados {
  constructor(config = configuracao(), { conjuntos = CONJUNTOS, agora = () => Date.now() } = {}) {
    this.config = config;
    this.conjuntos = conjuntos;
    this.agora = agora;
    this.memoria = new Map(); // id -> { dados, meta }
    this.emAndamento = new Map(); // id -> Promise
  }

  caminho(id, sufixo = '') {
    return path.join(this.config.diretorioCache, 'data', this.conjuntos[id].arquivo + sufixo);
  }

  ttlMs(id) {
    return this.conjuntos[id].ttlHoras * HORA * this.config.ttlMultiplicador;
  }

  fresco(meta, id) {
    return meta?.obtidoEm && this.agora() - Date.parse(meta.obtidoEm) < this.ttlMs(id);
  }

  /** Dados + metadados de origem de um conjunto. `forcar` ignora o TTL. */
  async obter(id, { forcar = false } = {}) {
    if (!this.conjuntos[id]) throw new Error(`conjunto de dados desconhecido: ${id}`);
    const chave = `${id}:${forcar}`;
    if (this.emAndamento.has(chave)) return this.emAndamento.get(chave);
    const p = this.#carregar(id, forcar).finally(() => this.emAndamento.delete(chave));
    this.emAndamento.set(chave, p);
    return p;
  }

  /** Só a parte `dados`, para quem não precisa da origem. */
  async dados(id, opcoes) {
    return (await this.obter(id, opcoes)).dados;
  }

  async #carregar(id, forcar) {
    const def = this.conjuntos[id];
    const naMemoria = this.memoria.get(id);
    if (!forcar && naMemoria && this.fresco(naMemoria.meta, id)) return naMemoria;

    const emDisco = naMemoria ?? (await this.#lerDisco(id));
    if (!forcar && emDisco && this.fresco(emDisco.meta, id)) {
      this.memoria.set(id, emDisco);
      return emDisco;
    }

    const avisos = [];
    const podeAoVivo =
      def.aoVivo &&
      this.config.modo !== 'snapshot' &&
      (forcar || !emDisco?.meta?.falhaAoVivoEm || this.agora() - Date.parse(emDisco.meta.falhaAoVivoEm) > ESPERA_APOS_FALHA);

    if (podeAoVivo) {
      try {
        let base = emDisco?.dados ?? null;
        if (!base && def.precisaBase) base = await this.#baixarSnapshot(id).catch(() => null);
        const dados = await def.aoVivo(base);
        return await this.#guardar(id, dados, { origem: 'ao-vivo', url: def.fonteOficial });
      } catch (err) {
        avisos.push(`Fonte oficial indisponível agora (${msg(err)}).`);
        if (this.config.modo === 'ao-vivo') throw new Error(`${def.titulo}: ${avisos[0]}`);
      }
    }

    try {
      const dados = await this.#baixarSnapshot(id);
      return await this.#guardar(id, dados, {
        origem: 'snapshot',
        url: this.#urlSnapshot(id),
        falhaAoVivoEm: avisos.length ? new Date(this.agora()).toISOString() : undefined,
        avisos,
      });
    } catch (err) {
      avisos.push(`Snapshot indisponível (${msg(err)}).`);
    }

    if (emDisco) {
      const r = { dados: emDisco.dados, meta: { ...emDisco.meta, expirado: true, avisos } };
      this.memoria.set(id, r);
      return r;
    }
    if (def.vazio) return { dados: def.vazio(), meta: { origem: 'vazio', avisos } };
    throw new Error(`${def.titulo}: nenhuma origem disponível. ${avisos.join(' ')}`);
  }

  #urlSnapshot(id) {
    const arq = this.conjuntos[id].arquivo;
    return this.config.snapshotDir ? path.join(this.config.snapshotDir, arq) : `${this.config.snapshotUrl}/${arq}`;
  }

  async #baixarSnapshot(id) {
    const origem = this.#urlSnapshot(id);
    if (this.config.snapshotDir) return JSON.parse(await readFile(origem, 'utf8'));
    const res = await fetch(origem);
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  }

  async #lerDisco(id) {
    const arq = this.caminho(id);
    if (!existsSync(arq)) return null;
    try {
      const [dados, meta] = await Promise.all([
        readFile(arq, 'utf8').then(JSON.parse),
        readFile(this.caminho(id, '.meta'), 'utf8').then(JSON.parse).catch(() => ({})),
      ]);
      return { dados, meta };
    } catch {
      return null;
    }
  }

  async #guardar(id, dados, meta) {
    const registro = {
      dados,
      meta: { ...meta, obtidoEm: new Date(this.agora()).toISOString(), conjunto: id },
    };
    if (!registro.meta.avisos?.length) delete registro.meta.avisos;
    if (!registro.meta.falhaAoVivoEm) delete registro.meta.falhaAoVivoEm;
    this.memoria.set(id, registro);
    try {
      await mkdir(path.dirname(this.caminho(id)), { recursive: true });
      // Grava em arquivo temporário e renomeia: um processo derrubado no meio
      // não deixa JSON truncado no cache.
      const tmp = this.caminho(id, `.${process.pid}.tmp`);
      await writeFile(tmp, JSON.stringify(dados), 'utf8');
      await rename(tmp, this.caminho(id));
      await writeFile(this.caminho(id, '.meta'), JSON.stringify(registro.meta), 'utf8');
    } catch (err) {
      console.error(`[tse-mcp] não foi possível gravar cache de ${id}: ${msg(err)}`);
    }
    return registro;
  }

  /** Situação de cada conjunto (sem baixar nada). */
  async situacao() {
    const linhas = [];
    for (const [id, def] of Object.entries(this.conjuntos)) {
      const r = this.memoria.get(id) ?? (await this.#lerDisco(id));
      linhas.push({
        conjunto: id,
        titulo: def.titulo,
        fonteOficial: def.fonteOficial ?? null,
        atualizacaoAoVivo: Boolean(def.aoVivo),
        ttlHoras: def.ttlHoras * this.config.ttlMultiplicador,
        emCache: Boolean(r),
        origem: r?.meta?.origem ?? null,
        obtidoEm: r?.meta?.obtidoEm ?? null,
        fresco: Boolean(r && this.fresco(r.meta, id)),
      });
    }
    return linhas;
  }
}
