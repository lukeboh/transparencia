'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Filter, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { rotuloPerfil } from '@/lib/perfis-fiscalizacao';

/** Papel sintético para servidores que nunca aparecem como fiscal/gestor de
 * contrato (ServidorFuncoes.zeroFiscal). Entra na lista de papéis como se
 * fosse mais um, para virar um toggle no filtro. Nenhum papel real da fonte
 * tem esse nome. */
export const NAO_FISCAL = 'Não-Fiscal';

interface FuncoesFilterProps {
  /** Níveis de função ("CJ-1"…"FC-6"). */
  niveis: string[];
  niveisSelecionados: string[];
  onNiveisChange: (novos: string[]) => void;
  /** Papéis de atuação em contratos + NAO_FISCAL, já ordenados. */
  papeis: string[];
  papeisSelecionados: string[];
  onPapeisChange: (novos: string[]) => void;
  /** Toggle "Vigente": restringe a quem tem função vigente hoje. */
  vigente: boolean;
  onVigenteChange: (ativo: boolean) => void;
  className?: string;
}

function Chip({
  rotulo,
  selecionado,
  onClick,
}: {
  rotulo: string;
  selecionado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selecionado}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all focus-visible:outline-2 focus-visible:outline-ring',
        selecionado
          ? 'bg-primary text-primary-foreground shadow-2xs'
          : 'bg-muted/60 text-muted-foreground line-through opacity-60 hover:bg-muted hover:text-foreground',
      )}
    >
      {selecionado && <Check className="h-3 w-3 shrink-0" aria-hidden />}
      {rotulo}
    </button>
  );
}

export function FuncoesFilter({
  niveis,
  niveisSelecionados,
  onNiveisChange,
  papeis,
  papeisSelecionados,
  onPapeisChange,
  vigente,
  onVigenteChange,
  className = '',
}: FuncoesFilterProps) {
  const [aberto, setAberto] = useState(true);

  const totalOpcoes = niveis.length + papeis.length;
  const totalSelecionado = niveisSelecionados.length + papeisSelecionados.length;
  const todosSelecionados = totalSelecionado === totalOpcoes;
  const nenhumSelecionado = totalSelecionado === 0;

  function toggle(lista: string[], onChange: (v: string[]) => void, valor: string) {
    onChange(lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);
  }

  function selecionarTudo() {
    onNiveisChange([...niveis]);
    onPapeisChange([...papeis]);
  }

  function limpar() {
    onNiveisChange([]);
    onPapeisChange([]);
  }

  return (
    <div className={cn('rounded-lg border border-border bg-card p-3 shadow-xs', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">Filtro:</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
            {todosSelecionados
              ? 'Tudo'
              : nenhumSelecionado
              ? 'Nada selecionado'
              : `${totalSelecionado} de ${totalOpcoes}`}
          </span>
          <button
            type="button"
            onClick={() => onVigenteChange(!vigente)}
            aria-pressed={vigente}
            title="Mostrar apenas quem tem função vigente hoje"
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-ring',
              vigente
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {vigente && <Check className="h-3 w-3 shrink-0" aria-hidden />}
            Vigente
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!todosSelecionados && (
            <button
              type="button"
              onClick={selecionarTudo}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <RotateCcw className="h-3 w-3" /> Selecionar tudo
            </button>
          )}
          {!nenhumSelecionado && (
            <button
              type="button"
              onClick={limpar}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Limpar
            </button>
          )}
          <button
            type="button"
            onClick={() => setAberto(!aberto)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {aberto ? 'Recolher' : 'Expandir opções'}
            {aberto ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      <div className={cn('mt-3 space-y-3 transition-all', !aberto && 'relative max-h-16 overflow-hidden')}>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Função comissionada</div>
          <div className="flex flex-wrap gap-1.5">
            {niveis.map((n) => (
              <Chip
                key={n}
                rotulo={n}
                selecionado={niveisSelecionados.includes(n)}
                onClick={() => toggle(niveisSelecionados, onNiveisChange, n)}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Atuação em contratos</div>
          <div className="flex flex-wrap gap-1.5">
            {papeis.map((p) => (
              <Chip
                key={p}
                rotulo={rotuloPerfil(p)}
                selecionado={papeisSelecionados.includes(p)}
                onClick={() => toggle(papeisSelecionados, onPapeisChange, p)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
