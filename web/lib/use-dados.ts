'use client';

import { useEffect, useRef, useState } from 'react';
import { dashboardData, type DashboardData } from '@/lib/dashboard-data';

interface StatusApi {
  atualizando: boolean;
  progresso: { feitos: number; total: number } | null;
  erro: string | null;
  geradoEm: string | null;
}

export interface EstadoDados {
  dados: DashboardData;
  /** 'embutido' = snapshot do build; 'fonte' = atualizado em runtime pela API. */
  origem: 'embutido' | 'fonte';
  atualizando: boolean;
  progresso: { feitos: number; total: number } | null;
}

const INTERVALO_POLL_MS = 2500;

/**
 * Carga inicial automática: renderiza na hora com o snapshot embutido e, em
 * paralelo, pede à rota /api/tse/dados que atualize da fonte (scrape roda no
 * servidor do app — o navegador não alcança a fonte por CORS). Enquanto o
 * scrape anda, expõe progresso; ao terminar, troca para os dados frescos.
 */
export function useDadosDashboard(): EstadoDados {
  const [dados, setDados] = useState<DashboardData>(dashboardData);
  const [origem, setOrigem] = useState<'embutido' | 'fonte'>('embutido');
  const [atualizando, setAtualizando] = useState(false);
  const [progresso, setProgresso] = useState<EstadoDados['progresso']>(null);
  const geradoEmRef = useRef(dashboardData.geradoEm);

  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function buscarDadosCompletos() {
      const resp = await fetch('/api/tse/dados');
      const corpo = (await resp.json()) as StatusApi & { dados: DashboardData | null };
      if (!vivo || !corpo.dados) return;
      if (corpo.dados.geradoEm > geradoEmRef.current) {
        geradoEmRef.current = corpo.dados.geradoEm;
        setDados(corpo.dados);
        setOrigem('fonte');
      }
    }

    async function verificar(primeira = false) {
      try {
        const resp = await fetch(
          `/api/tse/dados?somente=status${primeira ? '&atualizar=1' : ''}`,
        );
        const status = (await resp.json()) as StatusApi;
        if (!vivo) return;
        setAtualizando(status.atualizando);
        setProgresso(status.progresso);
        if (status.geradoEm && status.geradoEm > geradoEmRef.current) {
          await buscarDadosCompletos();
        }
        if (status.atualizando) {
          timer = setTimeout(() => void verificar(), INTERVALO_POLL_MS);
        }
      } catch {
        // rota indisponível (ex.: build estático servido sem Node): segue com o snapshot
      }
    }

    void verificar(true);
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, []);

  return { dados, origem, atualizando, progresso };
}
