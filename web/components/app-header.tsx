'use client';

import Link from 'next/link';
import {
  HardHat,
  Landmark,
  Laptop,
  Network,
  Percent,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { ThemePicker } from '@/components/theme-picker';
import { ThemeToggle } from '@/components/theme-toggle';

export type SecaoId = 'servidores' | 'teletrabalho' | 'unidades' | 'terceirizados' | 'indicadores';

const SECOES: { id: SecaoId; href: string; rotulo: string; Icone: LucideIcon }[] = [
  { id: 'servidores', href: '/servidores', rotulo: 'Servidores', Icone: Users },
  { id: 'teletrabalho', href: '/teletrabalho', rotulo: 'Teletrabalho', Icone: Laptop },
  { id: 'unidades', href: '/unidades', rotulo: 'Unidades', Icone: Network },
  { id: 'terceirizados', href: '/terceirizados', rotulo: 'Terceirizados', Icone: HardHat },
  { id: 'indicadores', href: '/indicadores', rotulo: 'Indicadores', Icone: Percent },
];

interface AppHeaderProps {
  /** Título grande da página (h1). */
  titulo: React.ReactNode;
  /** Linha de subtítulo logo abaixo do h1 — fonte, contagem, status da carga. */
  descricao: React.ReactNode;
  /** Seção atual: recebe destaque na navegação e deixa de ser link. Ausente na página inicial. */
  atual?: SecaoId;
}

/**
 * "Cabeçalho do App" — masthead comum a todas as telas: marca (link para a
 * inicial) + navegação entre seções + controles de tema, sobre uma hairline;
 * abaixo, o bloco de título da página. Substitui o header duplicado que cada
 * dashboard mantinha, incluindo o antigo link "← Contratos do TSE" (a marca
 * agora cumpre esse papel de volta para casa).
 */
export function AppHeader({ titulo, descricao, atual }: AppHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border pb-4">
        <Link
          href="/"
          aria-label="Transparência TSE — página inicial"
          className="group mr-auto flex items-center gap-2.5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm ring-1 ring-inset ring-white/10 transition-transform duration-200 group-hover:-translate-y-px">
            <Landmark className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight">
              Transparência <span className="text-muted-foreground">TSE</span>
            </span>
            <span className="mt-1 hidden text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:block">
              Dados públicos · Justiça Eleitoral
            </span>
          </span>
        </Link>

        <nav
          aria-label="Seções"
          className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-card p-1"
        >
          {SECOES.map(({ id, href, rotulo, Icone }) => {
            const conteudo = (
              <>
                <Icone className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden lg:inline">{rotulo}</span>
              </>
            );
            const base =
              'inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-2.5 text-sm font-medium transition-colors';
            return id === atual ? (
              <span
                key={id}
                aria-current="page"
                title={rotulo}
                className={`${base} bg-accent text-accent-foreground`}
              >
                {conteudo}
              </span>
            ) : (
              <Link
                key={id}
                href={href}
                title={rotulo}
                className={`${base} text-muted-foreground hover:bg-accent/60 hover:text-foreground`}
              >
                {conteudo}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <ThemePicker />
          <ThemeToggle />
        </div>
      </div>

      <div className="mt-6 min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
      </div>
    </header>
  );
}
