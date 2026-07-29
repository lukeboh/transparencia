import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
// Pipeline compartilhado com os scripts CLI (fora de web/): o scrape roda no
// servidor do app porque a fonte não envia CORS nem expõe o cookie/CSRF a
// outros domínios — o navegador não conseguiria fazê-lo diretamente.
import { scrapeContratos } from '../../../../../src/tse/scrapeContratos.js';
import { agregarDashboard } from '../../../../../src/tse/agregarDashboard.js';
import type { DashboardData } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

const TTL_MS = 6 * 60 * 60 * 1000; // idade máxima antes de re-scrape automático
const INTERVALO_ERRO_MS = 10 * 60 * 1000; // espera após falha antes de tentar de novo
const ARQUIVO_CACHE = path.join(process.cwd(), '.cache', 'tse-dados.json');

interface Progresso {
  feitos: number;
  total: number;
}

interface EstadoCache {
  dados: DashboardData | null;
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
    e.dados = JSON.parse(await fs.readFile(ARQUIVO_CACHE, 'utf8')) as DashboardData;
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
  e.progresso = { feitos: 0, total: 0 };
  e.ultimaTentativa = Date.now();

  void (async () => {
    try {
      const contratos = await scrapeContratos('TSE', {
        cacheContratos: e.dados?.contratos,
        onProgress: (feitos: number, total: number) => {
          e.progresso = { feitos, total };
        },
      });
      e.dados = agregarDashboard(contratos) as DashboardData;
      await fs.mkdir(path.dirname(ARQUIVO_CACHE), { recursive: true });
      await fs.writeFile(ARQUIVO_CACHE, JSON.stringify(e.dados), 'utf8');
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
