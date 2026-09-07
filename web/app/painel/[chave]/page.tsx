import { createHash, timingSafeEqual } from 'node:crypto';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { lerRegistros, type RegistroLog } from '../../../../src/lib/logger.js';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Painel interno',
  robots: { index: false, follow: false },
};

const CATEGORIAS = [
  { valor: 'scraping', rotulo: 'Scraping' },
  { valor: 'atualizacao', rotulo: 'Atualização automática' },
  { valor: 'erro', rotulo: 'Erros da aplicação' },
  { valor: 'app', rotulo: 'App' },
] as const;

const NIVEL_ESTILO: Record<string, string> = {
  erro: 'bg-danger-bg text-danger',
  aviso: 'bg-warning-bg text-warning',
  info: 'bg-secondary text-secondary-foreground',
};

const FORMATADOR = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'America/Sao_Paulo',
});

/** Compara em tempo constante (via hash, pra não vazar tamanho) — evita que
 *  diferenças de timing entreguem a chave certa por tentativa e erro. */
function chaveConfere(fornecida: string, esperada: string): boolean {
  const a = createHash('sha256').update(fornecida).digest();
  const b = createHash('sha256').update(esperada).digest();
  return timingSafeEqual(a, b);
}

export default async function PainelInterno({
  params,
  searchParams,
}: {
  params: Promise<{ chave: string }>;
  searchParams: Promise<{ categoria?: string; linhas?: string }>;
}) {
  const chaveEsperada = process.env.PAINEL_CHAVE;
  const { chave } = await params;
  if (!chaveEsperada || !chave || !chaveConfere(chave, chaveEsperada)) {
    notFound();
  }

  const sp = await searchParams;
  const categoria = CATEGORIAS.some((c) => c.valor === sp.categoria) ? sp.categoria : undefined;
  const limite = Math.min(Math.max(Number(sp.linhas) || 200, 1), 2000);
  const registros: RegistroLog[] = lerRegistros({ categoria, limite });

  const linkFiltro = (valor: string | undefined) => {
    const qsParams = new URLSearchParams();
    if (valor) qsParams.set('categoria', valor);
    if (sp.linhas) qsParams.set('linhas', sp.linhas);
    const qs = qsParams.toString();
    return `/painel/${chave}${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-lg font-semibold text-foreground">Painel interno</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Logs de scraping, atualização automática do site (ver{' '}
        <code className="rounded-sm bg-muted px-1 py-0.5 text-xs">deploy/README.md</code>) e erros da
        aplicação. Mostrando {registros.length} registro{registros.length === 1 ? '' : 's'}
        {categoria ? ` em "${CATEGORIAS.find((c) => c.valor === categoria)?.rotulo}"` : ''}.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={linkFiltro(undefined)}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
            !categoria ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent',
          )}
        >
          Tudo
        </a>
        {CATEGORIAS.map((c) => (
          <a
            key={c.valor}
            href={linkFiltro(c.valor)}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              categoria === c.valor
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent',
            )}
          >
            {c.rotulo}
          </a>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {registros.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Nenhum registro ainda.
          </p>
        ) : (
          registros.map((r, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="tabular-nums text-muted-foreground">{FORMATADOR.format(new Date(r.ts))}</span>
                <span
                  className={cn(
                    'rounded-sm px-1.5 py-0.5 font-semibold uppercase tracking-wide',
                    NIVEL_ESTILO[r.nivel] ?? NIVEL_ESTILO.info,
                  )}
                >
                  {r.nivel}
                </span>
                <span className="rounded-sm bg-muted px-1.5 py-0.5 text-muted-foreground">{r.categoria}</span>
              </div>
              <p className="mt-1.5 text-sm text-foreground">{r.mensagem}</p>
              {r.detalhes !== undefined && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    detalhes
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded-sm bg-muted p-2 text-xs text-muted-foreground">
                    {JSON.stringify(r.detalhes, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
