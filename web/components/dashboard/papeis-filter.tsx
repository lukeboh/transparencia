'use client';

import { useState } from 'react';
import { Filter, Check, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { rotuloPerfil } from '@/lib/perfis-fiscalizacao';

interface PapeisFilterProps {
  todosPapeis: string[];
  papeisSelecionados: string[];
  onChange: (novosPapeis: string[]) => void;
  className?: string;
}

export function PapeisFilter({
  todosPapeis,
  papeisSelecionados,
  onChange,
  className = '',
}: PapeisFilterProps) {
  const [aberto, setAberto] = useState(false);

  const todosSelecionados = papeisSelecionados.length === todosPapeis.length;
  const nenhumSelecionado = papeisSelecionados.length === 0;

  function togglePapel(papel: string) {
    if (papeisSelecionados.includes(papel)) {
      onChange(papeisSelecionados.filter((p) => p !== papel));
    } else {
      onChange([...papeisSelecionados, papel]);
    }
  }

  function selecionarTodos() {
    onChange([...todosPapeis]);
  }

  function limparSelecao() {
    onChange([]);
  }

  return (
    <div className={cn('rounded-lg border border-border bg-card p-3 shadow-xs', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">Filtrar por Papéis:</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground font-semibold">
            {todosSelecionados
              ? 'Todos os papéis'
              : nenhumSelecionado
              ? 'Nenhum papel selecionado'
              : `${papeisSelecionados.length} de ${todosPapeis.length} papéis`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!todosSelecionados && (
            <button
              type="button"
              onClick={selecionarTodos}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
            >
              <RotateCcw className="h-3 w-3" /> Selecionar Todos
            </button>
          )}
          {papeisSelecionados.length > 0 && !nenhumSelecionado && (
            <button
              type="button"
              onClick={limparSelecao}
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

      <div className={cn('mt-3 flex flex-wrap gap-1.5 transition-all', !aberto && 'max-h-16 overflow-hidden relative')}>
        {todosPapeis.map((papel) => {
          const selecionado = papeisSelecionados.includes(papel);
          return (
            <button
              key={papel}
              type="button"
              title={papel}
              onClick={() => togglePapel(papel)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all focus-visible:outline-2 focus-visible:outline-ring',
                selecionado
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground line-through opacity-60'
              )}
            >
              {selecionado && <Check className="h-3 w-3 shrink-0" />}
              {rotuloPerfil(papel)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
