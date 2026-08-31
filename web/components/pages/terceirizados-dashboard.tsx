'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Briefcase,
  FileText,
  HardHat,
  Laptop,
  Network,
  Percent,
  UserMinus,
  Users,
} from 'lucide-react';
import { StatCard } from '@/components/dashboard/stat-card';
import { TerceirizadosTabela } from '@/components/dashboard/terceirizados-tabela';
import { TerceirizadosContratosCard } from '@/components/dashboard/terceirizados-contratos-card';
import { TerceirizadosFalhasCard } from '@/components/dashboard/terceirizados-falhas-card';
import { DetalhesContratoDialog } from '@/components/dashboard/detalhes-contrato-dialog';
import { DadosStatus } from '@/components/dashboard/dados-status';
import { DicaTermo } from '@/components/ui/dica-termo';
import { PillToggle } from '@/components/ui/pill-toggle';
import { AppVersion } from '@/components/app-version';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemePicker } from '@/components/theme-picker';
import { useDadosDashboard } from '@/lib/use-dados';
import { useSincronizarUrl } from '@/lib/use-sincronizar-url';
import { mesAnoLongo, numero } from '@/lib/utils';
import { urlTerceirizados, type ContratoResumo, type TerceirizadoPessoa } from '@/lib/dashboard-data';

type Situacao = 'ativos' | 'encerrados' | 'todos';

interface ModalContrato {
  numero: string;
  contrato: ContratoResumo | null;
  empresa: string;
  qtde: number;
}

const NAV = [
  { href: '/fiscais', label: 'Fiscais', Icone: Users },
  { href: '/funcoes', label: 'Funções', Icone: Briefcase },
  { href: '/teletrabalho', label: 'Teletrabalho', Icone: Laptop },
  { href: '/unidades', label: 'Unidades', Icone: Network },
  { href: '/indicadores', label: 'Indicadores', Icone: Percent },
];

export function TerceirizadosDashboard() {
  const estado = useDadosDashboard();
  const { terceirizados: t, contratos } = estado.dados;

  const [situacao, setSituacao] = useState<Situacao>('ativos');
  const [modal, setModal] = useState<ModalContrato | null>(null);

  useSincronizarUrl(
    { sit: situacao === 'ativos' ? undefined : situacao },
    (sp) => {
      const s = sp.get('sit');
      if (s === 'encerrados' || s === 'todos') setSituacao(s);
    },
  );

  const contratoPorId = useMemo(
    () => new Map(contratos.map((c) => [c.id, c])),
    [contratos],
  );
  const qtdePorContrato = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of t.porContrato) m.set(c.contrato, c.total);
    return m;
  }, [t.porContrato]);

  const pessoasFiltradas = useMemo(() => {
    if (situacao === 'ativos') return t.pessoas.filter((p) => p.ativo);
    if (situacao === 'encerrados') return t.pessoas.filter((p) => !p.ativo);
    return t.pessoas;
  }, [t.pessoas, situacao]);

  const contratosVinculados = t.porContrato.filter((c) => c.contratoId != null).length;
  const semHistoricoUtil = t.historicoMeses <= 1;

  function abrirContratoDePessoa(p: TerceirizadoPessoa) {
    setModal({
      numero: p.contrato,
      contrato: p.contratoId ? contratoPorId.get(p.contratoId) ?? null : null,
      empresa: p.empresa,
      qtde: qtdePorContrato.get(p.contrato) ?? 0,
    });
  }

  const rotuloCompetencia = mesAnoLongo(t.competenciaAtual);
  const intervalo =
    t.historicoMeses > 1
      ? `${t.competencias[0]?.rotulo} – ${t.competencias[t.competencias.length - 1]?.rotulo}`
      : rotuloCompetencia;

  return (
    <main className="max-w-none px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Contratos do TSE
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Terceirizados</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Profissionais de contratos de cessão de mão de obra <DicaTermo id="contratoCessao" alinhamento="esquerda" />{' '}
            ·{' '}
            <a
              href={urlTerceirizados()}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              fonte: PDFs mensais do TSE
            </a>{' '}
            · histórico {intervalo} · <DadosStatus estado={estado} />
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {NAV.map(({ href, label, Icone }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Icone className="h-4 w-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">{label}</span>
              <ArrowUpRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" aria-hidden />
            </Link>
          ))}
          <ThemePicker />
          <ThemeToggle />
        </div>
      </header>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            titulo="Terceirizados ativos"
            valor={numero(t.ativos)}
            detalhe={t.competenciaAtual ? `na listagem de ${rotuloCompetencia}` : 'sem histórico disponível'}
            icone={<HardHat className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            titulo={
              <span className="inline-flex items-center gap-1">
                Já deixaram o TSE <DicaTermo id="terceirizadoMesFim" />
              </span>
            }
            valor={numero(t.encerrados)}
            detalhe={semHistoricoUtil ? 'requer +1 mês de histórico' : 'com mês de fim registrado'}
            icone={<UserMinus className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            titulo="Contratos de cessão"
            valor={numero(t.contratos)}
            detalhe={`${numero(contratosVinculados)} vinculados ao Compras.gov.br`}
            icone={<FileText className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            titulo={
              <span className="inline-flex items-center gap-1">
                Falhas de cruzamento <DicaTermo id="terceirizadoFalhas" />
              </span>
            }
            valor={numero(t.falhas.length)}
            detalhe={`${numero(t.semLotacao)} sem lotação identificada`}
            icone={<AlertTriangle className="h-4 w-4" aria-hidden />}
          />
        </div>

        {semHistoricoUtil && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            Só há uma competência ({rotuloCompetencia}) no histórico local. O <strong>mês de início</strong>{' '}
            aparece como essa competência e o <strong>mês de fim</strong> fica em branco para todos até que
            haja pelo menos dois meses — rode <code className="rounded-sm bg-amber-500/15 px-1 py-0.5">npm run tse:scrape-terceirizados</code>{' '}
            para baixar o histórico completo.
          </p>
        )}

        <TerceirizadosContratosCard contratos={t.porContrato} onVerContrato={(c) =>
          setModal({
            numero: c.contrato,
            contrato: c.contratoId ? contratoPorId.get(c.contratoId) ?? null : null,
            empresa: c.empresa || c.fornecedor || '',
            qtde: c.total,
          })
        } />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Situação:</span>
          <PillToggle pressionado={situacao === 'ativos'} onClick={() => setSituacao('ativos')}>
            Ativos ({numero(t.ativos)})
          </PillToggle>
          <PillToggle pressionado={situacao === 'encerrados'} onClick={() => setSituacao('encerrados')}>
            Encerrados ({numero(t.encerrados)})
          </PillToggle>
          <PillToggle pressionado={situacao === 'todos'} onClick={() => setSituacao('todos')}>
            Todos ({numero(t.totalPessoas)})
          </PillToggle>
        </div>

        <TerceirizadosTabela
          pessoas={pessoasFiltradas}
          totalGeral={t.totalPessoas}
          onVerContrato={abrirContratoDePessoa}
        />

        <TerceirizadosFalhasCard falhas={t.falhas} />
      </div>

      <footer className="mt-8 text-xs text-muted-foreground">
        A relação de terceirizados vem dos PDFs mensais de &ldquo;postos de trabalho &ndash; contratos de
        cessão de mão de obra&rdquo; do TSE (arquivos escaneados, sem CSV/API). Cada profissional é ligado
        à unidade pela sigla da coluna &ldquo;Alocação&rdquo; e ao contrato do Compras.gov.br pelo número —
        colisões de número entre contratos de modalidades diferentes são desempatadas pela empresa. O
        cruzamento é por nome (nenhuma fonte expõe CPF), então homônimos e ruído de OCR podem gerar
        vínculos incorretos; o que não casou está em &ldquo;Registro de falhas&rdquo;. O{' '}
        <strong>mês de início</strong> é a primeira competência em que o nome aparece e o{' '}
        <strong>mês de fim</strong> só é preenchido quando a pessoa deixa de constar na listagem mais
        recente.
        <AppVersion />
      </footer>

      {modal && (
        <DetalhesContratoDialog
          open
          onClose={() => setModal(null)}
          numero={modal.numero}
          contrato={modal.contrato}
          fornecedorFallback={modal.empresa}
          qtdeTerceirizados={modal.qtde}
        />
      )}
    </main>
  );
}
