'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Dialog, DialogHeader } from '@/components/ui/dialog';
import { BotaoFonteExterna } from '@/components/dashboard/botao-fonte-externa';
import { cn, numero } from '@/lib/utils';
import { urlTerceirizados, type TerceirizadoUnidade } from '@/lib/dashboard-data';

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Lista numerada, em ordem alfabética, dos terceirizados de uma unidade —
 * seja uma folha ("só nesta unidade") ou um nó consolidado ("com as
 * subunidades"). Os itens já chegam ordenados por nome de dashboard-data.ts.
 */
export function TerceirizadosDialog({
  titulo,
  subtitulo,
  itens,
  competencia,
  open,
  onClose,
}: {
  titulo: string;
  subtitulo?: string;
  itens: TerceirizadoUnidade[];
  competencia: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    if (!termo) return itens;
    return itens.filter(
      (t) =>
        normalizar(t.nome).includes(termo) ||
        normalizar(t.posto).includes(termo) ||
        normalizar(t.empresa).includes(termo),
    );
  }, [itens, busca]);

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader
        titulo={titulo}
        descricao={
          `${numero(itens.length)} terceirizado${itens.length === 1 ? '' : 's'}` +
          (subtitulo ? ` · ${subtitulo}` : '') +
          (competencia ? ` · PDF de ${competencia}` : '')
        }
        onClose={onClose}
      />

      <div className="border-b border-border p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por nome, função ou empresa…"
            aria-label="Filtrar terceirizados"
            className={cn(
              'h-9 w-full rounded-md border border-border bg-card pl-8 pr-8 text-sm text-foreground',
              'placeholder:text-muted-foreground outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring',
              '[&::-webkit-search-cancel-button]:hidden',
            )}
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              aria-label="Limpar filtro"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          {itens.length === 0 ? 'Nenhum terceirizado localizado nesta unidade.' : 'Nada encontrado para o filtro.'}
        </p>
      ) : (
        <ol className="max-h-[60vh] list-none divide-y divide-border/40 overflow-y-auto p-2">
          {filtrados.map((t, i) => (
            <li key={`${t.nome}-${t.contrato}-${i}`} className="flex gap-3 rounded-md px-2.5 py-2">
              <span className="w-7 shrink-0 pt-0.5 text-right text-xs tabular-nums text-muted-foreground">
                {i + 1}.
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t.nome}</span>
                {(t.posto || t.empresa) && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {[t.posto, t.empresa].filter(Boolean).join(' · ')}
                    {t.contrato && <span className="text-muted-foreground/70"> · contrato {t.contrato}</span>}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-col gap-2 border-t border-border p-3 text-xs text-muted-foreground">
        Nomes conforme o PDF mensal de &ldquo;postos de trabalho &ndash; contratos de cessão de mão de
        obra&rdquo; do TSE, ligados à unidade pela coluna &ldquo;Alocação&rdquo;. Função e empresa às
        vezes vêm truncadas do arquivo escaneado.
        <BotaoFonteExterna
          href={urlTerceirizados()}
          titulo="Abre a página dos PDFs mensais de profissionais terceirizados do TSE, em nova aba"
        >
          Fonte externa — terceirizados (PDF do TSE)
        </BotaoFonteExterna>
      </div>
    </Dialog>
  );
}
