'use client';

import { useState } from 'react';
import { Coins, Check, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORIAS_VALOR, descricaoFaixa, type CategoriaValorId } from '@/lib/categorias-valor';

interface CategoriaValorFilterProps {
  categoriasSelecionadas: CategoriaValorId[];
  onChange: (novasCategorias: CategoriaValorId[]) => void;
  className?: string;
}

/** Mesmo padrão visual de PapeisFilter, com chips coloridos por faixa em vez de texto puro. */
export function CategoriaValorFilter({
  categoriasSelecionadas,
  onChange,
  className = '',
}: CategoriaValorFilterProps) {
  const [aberto, setAberto] = useState(false);

  const todasSelecionadas = categoriasSelecionadas.length === CATEGORIAS_VALOR.length;
  const nenhumaSelecionada = categoriasSelecionadas.length === 0;

  function toggleCategoria(id: CategoriaValorId) {
    if (categoriasSelecionadas.includes(id)) {
      onChange(categoriasSelecionadas.filter((c) => c !== id));
    } else {
      onChange([...categoriasSelecionadas, id]);
    }
  }

  function selecionarTodas() {
    onChange(CATEGORIAS_VALOR.map((c) => c.id));
  }

  function limparSelecao() {
    onChange([]);
  }

  return (
    <div className={cn('rounded-lg border border-border bg-card p-3 shadow-xs', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">Filtrar por faixa de valor:</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground font-semibold">
            {todasSelecionadas
              ? 'Todas as faixas'
              : nenhumaSelecionada
              ? 'Nenhuma faixa selecionada'
              : `${categoriasSelecionadas.length} de ${CATEGORIAS_VALOR.length} faixas`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!todasSelecionadas && (
            <button
              type="button"
              onClick={selecionarTodas}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
            >
              <RotateCcw className="h-3 w-3" /> Selecionar Todas
            </button>
          )}
          {!nenhumaSelecionada && (
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
        {CATEGORIAS_VALOR.map((categoria) => {
          const selecionada = categoriasSelecionadas.includes(categoria.id);
          return (
            <button
              key={categoria.id}
              type="button"
              onClick={() => toggleCategoria(categoria.id)}
              title={`${categoria.nome} — ${descricaoFaixa(categoria)}`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all focus-visible:outline-2 focus-visible:outline-ring',
                selecionada
                  ? 'text-primary-foreground shadow-2xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground line-through opacity-60',
              )}
              style={selecionada ? { backgroundColor: categoria.cor } : undefined}
            >
              {selecionada && <Check className="h-3 w-3 shrink-0" />}
              <span className="font-semibold">{categoria.simbolo}</span>
              {categoria.nome}
            </button>
          );
        })}
      </div>
    </div>
  );
}
