'use client';

export type TipoMetrica = 'global' | 'empenhado' | 'pago';

export interface MetricaSelectorProps {
  valor: TipoMetrica;
  onChange: (novaMetrica: TipoMetrica) => void;
  className?: string;
}

export const LABELS_METRICA: Record<TipoMetrica, { nome: string; sigla: string; descricao: string }> = {
  global: {
    nome: 'Valor Global',
    sigla: 'Global',
    descricao: 'Valor total contratado',
  },
  empenhado: {
    nome: 'Valor Empenhado',
    sigla: 'Empenhado (Emp.)',
    descricao: 'Recursos reservados do orçamento',
  },
  pago: {
    nome: 'Valor Pago',
    sigla: 'Pago (Pg)',
    descricao: 'Recursos efetivamente desembolsados',
  },
};

export function MetricaSelector({ valor, onChange, className = '' }: MetricaSelectorProps) {
  const opcoes: TipoMetrica[] = ['global', 'empenhado', 'pago'];

  return (
    <div className={`inline-flex items-center rounded-lg border border-border bg-card p-1 text-xs shadow-xs ${className}`}>
      <span className="mr-2 ml-1 hidden text-muted-foreground sm:inline font-medium">Métrica:</span>
      {opcoes.map((opcao) => {
        const ativa = valor === opcao;
        return (
          <button
            key={opcao}
            type="button"
            onClick={() => onChange(opcao)}
            title={LABELS_METRICA[opcao].descricao}
            className={`rounded-md px-2.5 py-1 font-medium transition-all focus-visible:outline-2 focus-visible:outline-ring ${
              ativa
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {LABELS_METRICA[opcao].sigla}
          </button>
        );
      })}
    </div>
  );
}
