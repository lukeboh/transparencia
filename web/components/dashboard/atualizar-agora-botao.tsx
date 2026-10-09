'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type Estado = 'ocioso' | 'enviando' | 'ok' | 'erro';

/** Botão "Forçar atualização agora" do painel interno — dispara
 *  scripts/atualizar-app.mjs sob demanda via POST /api/atualizar-app (ver
 *  esse arquivo). A atualização em si roda em background no servidor;
 *  este botão só confirma que o disparo foi aceito, não espera terminar —
 *  acompanhe o resultado na lista de registros "Atualização automática"
 *  logo abaixo (recarregue a página depois de alguns minutos). */
export function AtualizarAgoraBotao({ chave }: { chave: string }) {
  const [estado, setEstado] = useState<Estado>('ocioso');
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function disparar() {
    setEstado('enviando');
    setMensagem(null);
    try {
      const resp = await fetch('/api/atualizar-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave }),
      });
      const corpo = await resp.json().catch(() => null);
      if (!resp.ok) {
        setEstado('erro');
        setMensagem(corpo?.erro ?? `Falha ao disparar (status ${resp.status}).`);
        return;
      }
      setEstado('ok');
      setMensagem(
        'Disparada — roda em background no servidor (git fetch, build e, se configurado, reinício do processo; pode levar alguns minutos). Acompanhe em “Atualização automática” abaixo, recarregando a página.',
      );
    } catch (err) {
      setEstado('erro');
      setMensagem(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={disparar}
        disabled={estado === 'enviando'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors',
          'hover:bg-accent disabled:pointer-events-none disabled:opacity-60',
        )}
      >
        <RefreshCw className={cn('h-3.5 w-3.5', estado === 'enviando' && 'animate-spin')} aria-hidden />
        {estado === 'enviando' ? 'Disparando…' : 'Forçar atualização agora'}
      </button>
      {mensagem && (
        <p className={cn('max-w-md text-xs', estado === 'erro' ? 'text-danger' : 'text-muted-foreground')}>
          {mensagem}
        </p>
      )}
    </div>
  );
}
