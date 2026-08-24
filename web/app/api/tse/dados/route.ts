import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
// Pipeline compartilhado com os scripts CLI (fora de web/): o scrape roda no
// servidor do app porque a fonte não envia CORS nem expõe o cookie/CSRF a
// outros domínios — o navegador não conseguiria fazê-lo diretamente.
import { scrapeContratos } from '../../../../../src/tse/scrapeContratos.js';
import { scrapeAgentesPublicos } from '../../../../../src/tse/scrapeAgentesPublicos.js';
import { scrapeFuncoes } from '../../../../../src/tse/scrapeFuncoes.js';
import { agregarDashboard } from '../../../../../src/tse/agregarDashboard.js';
import type { DashboardData } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

const TTL_MS = 6 * 60 * 60 * 1000; // idade máxima antes de re-scrape automático
const INTERVALO_ERRO_MS = 10 * 60 * 1000; // espera após falha antes de tentar de novo
const ARQUIVO_CACHE = path.join(process.cwd(), '.cache', 'tse-dados.json');

interface Progresso {
  // 'agentes' é a fonte primária (relação atual de agentes públicos) — uma
  // única página, rápida. 'funcoes' é o histórico secundário de portarias
  // (1999–hoje): a primeira execução baixa milhares de páginas e pode levar
  // dezenas de minutos; as seguintes são incrementais (só portarias novas).
  fase: 'contratos' | 'agentes' | 'funcoes';
  feitos: number;
  total: number;
}

interface CachePersistido {
  dados: DashboardData;
  // Contratos "crus" (schema completo do scraper, com `responsaveis` etc.),
  // separados de `dados.contratos` — que é só o resumo truncado para a UI e
  // não serve de entrada para um novo scrape incremental (ver iniciarAtualizacao).
  contratosBrutos: unknown[];
  // Agentes públicos "crus" (ver scrapeAgentesPublicos.js) — fonte primária,
  // sempre buscada por inteiro (é uma única página rápida, sem cache incremental).
  agentesPublicosBrutos: unknown[];
  // Movimentos "crus" de função comissionada (ver scrapeFuncoes.js),
  // persistidos para que o backfill histórico completo só precise rodar uma
  // vez — execuções seguintes só buscam portarias novas.
  movimentosFuncoesBrutos: unknown[];
}

interface EstadoCache {
  dados: DashboardData | null;
  contratosBrutos: unknown[] | null;
  agentesPublicosBrutos: unknown[] | null;
  movimentosFuncoesBrutos: unknown[] | null;
  carregouDisco: boolean;
  atualizando: boolean;
  progresso: Progresso | null;
  erro: string | null;
  ultimaTentativa: number;
}

// globalThis: em dev o módulo da rota pode ser reavaliado por request; o
// estado (inclusive a trava de scrape em andamento) precisa sobreviver a isso.
const g = globalThis as typeof globalThis & { __tseEstado?: EstadoCache };

function estado(): EstadoCache {
  g.__tseEstado ??= {
    dados: null,
    contratosBrutos: null,
    agentesPublicosBrutos: null,
    movimentosFuncoesBrutos: null,
    carregouDisco: false,
    atualizando: false,
    progresso: null,
    erro: null,
    ultimaTentativa: 0,
  };
  return g.__tseEstado;
}

async function carregarDoDisco(e: EstadoCache) {
  if (e.carregouDisco) return;
  e.carregouDisco = true;
  try {
    const bruto = JSON.parse(await fs.readFile(ARQUIVO_CACHE, 'utf8'));
    // Compatibilidade com caches gravados antes de existir `contratosBrutos`
    // (formato antigo: o próprio DashboardData na raiz do arquivo).
    if (bruto && typeof bruto === 'object' && 'dados' in bruto) {
      const persistido = bruto as CachePersistido;
      e.dados = persistido.dados;
      e.contratosBrutos = persistido.contratosBrutos ?? null;
      e.agentesPublicosBrutos = persistido.agentesPublicosBrutos ?? null;
      e.movimentosFuncoesBrutos = persistido.movimentosFuncoesBrutos ?? null;
    } else {
      e.dados = bruto as DashboardData;
      e.contratosBrutos = null;
      e.agentesPublicosBrutos = null;
      e.movimentosFuncoesBrutos = null;
    }
  } catch {
    // sem cache em disco: o cliente segue com o snapshot embutido no bundle
  }
}

function deveAtualizar(e: EstadoCache) {
  if (e.atualizando) return false;
  if (Date.now() - e.ultimaTentativa < INTERVALO_ERRO_MS) return false;
  const idade = e.dados ? Date.now() - Date.parse(e.dados.geradoEm) : Infinity;
  return idade >= TTL_MS;
}

function iniciarAtualizacao(e: EstadoCache) {
  e.atualizando = true;
  e.erro = null;
  e.progresso = { fase: 'contratos', feitos: 0, total: 0 };
  e.ultimaTentativa = Date.now();

  void (async () => {
    try {
      const contratos = await scrapeContratos('TSE', {
        cacheContratos: e.contratosBrutos ?? undefined,
        onProgress: (feitos: number, total: number) => {
          e.progresso = { fase: 'contratos', feitos, total };
        },
      });
      e.contratosBrutos = contratos;

      // Fonte PRIMÁRIA para função comissionada: relação atual de agentes
      // públicos, uma única página rápida — roda primeiro, sem cache
      // incremental (sempre busca tudo de novo, é barato).
      e.progresso = { fase: 'agentes', feitos: 0, total: 1 };
      const agentesPublicos = await scrapeAgentesPublicos();
      e.agentesPublicosBrutos = agentesPublicos;
      e.progresso = { fase: 'agentes', feitos: 1, total: 1 };

      // Fonte SECUNDÁRIA, só para histórico: portarias (1999–hoje). Roda
      // depois da primária, de propósito — a primeira execução é um
      // backfill pesado (milhares de páginas); com `movimentosFuncoesBrutos`
      // já persistido, as próximas só buscam os índices de ano (baratos) e
      // as poucas portarias novas.
      const movimentosFuncoes = await scrapeFuncoes({
        cacheMovimentos: e.movimentosFuncoesBrutos ?? undefined,
        onProgress: (feitos: number, total: number) => {
          e.progresso = { fase: 'funcoes', feitos, total };
        },
      });
      e.movimentosFuncoesBrutos = movimentosFuncoes;

      e.dados = agregarDashboard(contratos, movimentosFuncoes, agentesPublicos) as DashboardData;
      await fs.mkdir(path.dirname(ARQUIVO_CACHE), { recursive: true });
      const persistido: CachePersistido = {
        dados: e.dados,
        contratosBrutos: contratos,
        agentesPublicosBrutos: agentesPublicos,
        movimentosFuncoesBrutos: movimentosFuncoes,
      };
      await fs.writeFile(ARQUIVO_CACHE, JSON.stringify(persistido), 'utf8');
    } catch (err) {
      e.erro = err instanceof Error ? err.message : String(err);
      console.error('[tse/dados] falha na atualização:', err);
    } finally {
      e.atualizando = false;
      e.progresso = null;
    }
  })();
}

/**
 * GET /api/tse/dados            → status + dados completos (quando houver)
 * GET /api/tse/dados?somente=status → só status/progresso (barato p/ polling)
 * Com ?atualizar=1, dispara o scrape em background se o cache passou do TTL.
 */
export async function GET(request: Request) {
  const e = estado();
  await carregarDoDisco(e);

  const params = new URL(request.url).searchParams;
  if (params.get('atualizar') === '1' && deveAtualizar(e)) {
    iniciarAtualizacao(e);
  }

  const status = {
    atualizando: e.atualizando,
    progresso: e.progresso,
    erro: e.erro,
    geradoEm: e.dados?.geradoEm ?? null,
  };

  if (params.get('somente') === 'status') {
    return NextResponse.json(status);
  }
  return NextResponse.json({ ...status, dados: e.dados });
}
