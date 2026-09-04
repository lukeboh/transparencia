'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

const TEMAS = [
  {
    id: 'neutro',
    nome: 'Neutro',
    descricao: 'Cinzas clássicos',
    amostra: ['#1a1a19', '#e5e5e5', '#3987e5'],
  },
  {
    id: 'institucional',
    nome: 'Institucional',
    descricao: 'Azul-marinho sóbrio',
    amostra: ['#111927', '#9dbce2', '#1e3a5f'],
  },
  {
    id: 'esmeralda',
    nome: 'Esmeralda',
    descricao: 'Verdes suaves',
    amostra: ['#131c17', '#8fd6b5', '#1a6b4f'],
  },
  {
    id: 'violeta',
    nome: 'Violeta',
    descricao: 'Gradiente índigo',
    amostra: ['#1d1c5a', '#9c9bf7', '#4a49d8'],
  },
  {
    id: 'lagoa',
    nome: 'Lagoa',
    descricao: 'Gradiente turquesa',
    amostra: ['#0d2422', '#63d6c2', '#0e7f70'],
  },
  {
    id: 'ardosia',
    nome: 'Ardósia',
    descricao: 'Flat carvão e teal',
    amostra: ['#21242e', '#45c4b5', '#2b3040'],
  },
  {
    id: 'tse',
    nome: 'TSE',
    descricao: 'Azul e dourado oficiais',
    amostra: ['#10203a', '#6fa8f5', '#103a74'],
  },
  {
    id: 'tse-xt',
    nome: 'TSE XT',
    descricao: 'Vidro, gradiente azul→ciano',
    amostra: ['#0077ff', '#00c6ff', '#ec4899'],
  },
] as const;

type TemaId = (typeof TEMAS)[number]['id'];

function aplicarTema(id: TemaId) {
  const root = document.documentElement;
  if (id === 'neutro') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = id;
  }
  try {
    localStorage.setItem('tema', id);
  } catch {
    // sem localStorage a escolha só não persiste entre visitas
  }
}

export function ThemePicker() {
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState<TemaId>('neutro');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sincroniza com o tema aplicado pelo script de init do layout.
  useEffect(() => {
    const atual = document.documentElement.dataset.theme as TemaId | undefined;
    setAtivo(atual ?? 'neutro');
  }, []);

  useEffect(() => {
    if (!aberto) return;
    function fechar(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('pointerdown', fechar);
    return () => document.removeEventListener('pointerdown', fechar);
  }, [aberto]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-label="Escolher tema"
        aria-expanded={aberto}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Palette className="h-4 w-4" aria-hidden />
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {TEMAS.map((tema) => (
            <button
              key={tema.id}
              type="button"
              role="menuitemradio"
              aria-checked={ativo === tema.id}
              onClick={() => {
                aplicarTema(tema.id);
                setAtivo(tema.id);
                setAberto(false);
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left text-sm transition-colors hover:bg-accent',
                ativo === tema.id && 'bg-accent/60',
              )}
            >
              <span className="flex shrink-0 -space-x-1" aria-hidden>
                {tema.amostra.map((cor) => (
                  <span
                    key={cor}
                    className="h-4 w-4 rounded-full border border-border"
                    style={{ backgroundColor: cor }}
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{tema.nome}</span>
                <span className="block text-xs text-muted-foreground">
                  {tema.descricao}
                </span>
              </span>
              {ativo === tema.id && (
                <Check className="h-4 w-4 shrink-0 text-foreground" aria-hidden />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
