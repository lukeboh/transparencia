'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDown,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { ContagemDonut, type FatiaContagem } from '@/components/dashboard/contagem-donut';
import { TerceirizadosTabela } from '@/components/dashboard/terceirizados-tabela';
import { TerceirizadosContratosCard } from '@/components/dashboard/terceirizados-contratos-card';
import { TerceirizadosFalhasCard } from '@/components/dashboard/terceirizados-falhas-card';
import { DetalhesContratoDialog } from '@/components/dashboard/detalhes-contrato-dialog';
import { DadosStatus } from '@/components/dashboard/dados-status';
import { DicaTermo } from '@/components/ui/dica-termo';
import { AppVersion } from '@/components/app-version';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemePicker } from '@/components/theme-picker';
import { useDadosDashboard } from '@/lib/use-dados';
import { useSincronizarUrl } from '@/lib/use-sincronizar-url';
import { bool } from '@/lib/url-filtros';
import { brlCompacto, mesAnoLongo, numero } from '@/lib/utils';
import {
  urlTerceirizados,
  type ContratoResumo,
  type ContratoTerceirizados,
  type TerceirizadoPessoa,
} from '@/lib/dashboard-data';

// Rosca "Terceirizados ativos": os N contratos de cessão mais volumosos, o
// resto somado em "Outros".
const MAX_FATIAS_CONTRATO = 10;

/** Nome da contratada para a legenda: prefere o do PDF; senão o do Comprasnet sem o CNPJ na frente. */
function nomeEmpresa(c: ContratoTerceirizados) {
  const doComprasnet = (c.fornecedor ?? '').replace(/^\s*[\d./-]+\s*-\s*/, '').trim();
  return c.empresa || doComprasnet || '—';
}

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

  const [modal, setModal] = useState<ModalContrato | null>(null);
  // Filtro Vigente da tabela de terceirizados, controlado aqui para o KPI
  // "Terceirizados ativos" poder garantir que ele fique LIGADO ao rolar até a
  // tabela. Regra do projeto: começa ligado (ver README).
  const [vigenteTerc, setVigenteTerc] = useState(true);

  useSincronizarUrl(
    { vig: bool.escrever(vigenteTerc, true) },
    (sp) => setVigenteTerc(bool.ler(sp.get('vig'), true)),
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

  // Rosca do KPI "Terceirizados ativos": ativos agrupados por contrato de
  // cessão, os 10 mais volumosos + "Outros". Cada fatia leva o objeto do
  // contrato em `meta` para abrir o modal "Detalhes do Contrato" no clique.
  const fatiasAtivosPorContrato = useMemo<FatiaContagem[]>(() => {
    const comAtivos = t.porContrato
      .filter((c) => c.ativos > 0)
      .sort((a, b) => b.ativos - a.ativos);
    const fatias: FatiaContagem[] = comAtivos
      .slice(0, MAX_FATIAS_CONTRATO)
      .map((c) => ({ rotulo: c.contrato, quantidade: c.ativos, sub: nomeEmpresa(c), meta: c }));
    const resto = comAtivos.slice(MAX_FATIAS_CONTRATO);
    if (resto.length) {
      fatias.push({
        rotulo: 'Outros',
        quantidade: resto.reduce((s, c) => s + c.ativos, 0),
        sub: `${resto.length} contrato${resto.length === 1 ? '' : 's'}`,
      });
    }
    return fatias;
  }, [t.porContrato]);

  // Rosca do KPI "Contratos de cessão": os 10 contratos de maior valor global
  // + "Outros". Mesma mecânica de clique → modal "Detalhes do Contrato".
  const fatiasValorPorContrato = useMemo<FatiaContagem[]>(() => {
    const comValor = t.porContrato
      .filter((c) => (c.valorGlobal ?? 0) > 0)
      .sort((a, b) => (b.valorGlobal ?? 0) - (a.valorGlobal ?? 0));
    const fatias: FatiaContagem[] = comValor
      .slice(0, MAX_FATIAS_CONTRATO)
      .map((c) => ({ rotulo: c.contrato, quantidade: c.valorGlobal ?? 0, sub: nomeEmpresa(c), meta: c }));
    const resto = comValor.slice(MAX_FATIAS_CONTRATO);
    if (resto.length) {
      fatias.push({
        rotulo: 'Outros',
        quantidade: resto.reduce((s, c) => s + (c.valorGlobal ?? 0), 0),
        sub: `${resto.length} contrato${resto.length === 1 ? '' : 's'}`,
      });
    }
    return fatias;
  }, [t.porContrato]);

  const contratosComAtivos = t.porContrato.filter((c) => c.ativos > 0).length;
  const semHistoricoUtil = t.historicoMeses <= 1;

  function irParaTabela() {
    setVigenteTerc(true);
    requestAnimationFrame(() =>
      document.getElementById('tabela-terceirizados')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  function irParaContratos() {
    document.getElementById('contratos-cessao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function abrirContratoDePessoa(p: TerceirizadoPessoa) {
    setModal({
      numero: p.contrato,
      contrato: p.contratoId ? contratoPorId.get(p.contratoId) ?? null : null,
      empresa: p.empresa,
      qtde: qtdePorContrato.get(p.contrato) ?? 0,
    });
  }

  function abrirModalContrato(c: ContratoTerceirizados) {
    setModal({
      numero: c.contrato,
      contrato: c.contratoId ? contratoPorId.get(c.contratoId) ?? null : null,
      empresa: c.empresa || c.fornecedor || '',
      qtde: c.total,
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Card className="transition-colors duration-200 sm:col-span-2 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-muted-foreground">Terceirizados ativos</CardTitle>
              <HardHat className="h-4 w-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-1">
              {fatiasAtivosPorContrato.length > 0 ? (
                <ContagemDonut
                  fatias={fatiasAtivosPorContrato}
                  unidadeSingular="terceirizado"
                  unidadePlural="terceirizados"
                  onSelecionar={(f) => {
                    const c = f.meta as ContratoTerceirizados | undefined;
                    if (c) abrirModalContrato(c);
                  }}
                />
              ) : (
                <div className="py-4 text-center">
                  <div className="text-3xl font-semibold tabular-nums">{numero(t.ativos)}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.competenciaAtual ? `na listagem de ${rotuloCompetencia}` : 'sem histórico disponível'}
                  </p>
                </div>
              )}
              <p className="text-center text-xs text-muted-foreground">
                por contrato de cessão{t.competenciaAtual ? ` · ${rotuloCompetencia}` : ''}
              </p>
              <button
                type="button"
                onClick={irParaTabela}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Ver na tabela (Vigente) <ArrowDown className="h-3 w-3" aria-hidden />
              </button>
            </CardContent>
          </Card>

          <Card className="transition-colors duration-200 sm:col-span-2 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-muted-foreground">Contratos de cessão</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-1">
              {fatiasValorPorContrato.length > 0 ? (
                <ContagemDonut
                  fatias={fatiasValorPorContrato}
                  unidadeSingular="valor global"
                  unidadePlural="valor global"
                  formatar={brlCompacto}
                  onSelecionar={(f) => {
                    const c = f.meta as ContratoTerceirizados | undefined;
                    if (c) abrirModalContrato(c);
                  }}
                />
              ) : (
                <div className="py-4 text-center">
                  <div className="text-3xl font-semibold tabular-nums">{numero(t.contratos)}</div>
                  <p className="mt-1 text-xs text-muted-foreground">contratos de cessão</p>
                </div>
              )}
              <p className="text-center text-xs text-muted-foreground">
                {numero(t.contratos)} contratos · {numero(contratosComAtivos)} com terceirizado ativo
              </p>
              <button
                type="button"
                onClick={irParaContratos}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Ver a lista de contratos <ArrowDown className="h-3 w-3" aria-hidden />
              </button>
            </CardContent>
          </Card>

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

        {t.competenciasDescartadas.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t.competenciasDescartadas.length} competência
            {t.competenciasDescartadas.length === 1 ? '' : 's'} descartada
            {t.competenciasDescartadas.length === 1 ? '' : 's'} por falha de extração do PDF (colunas
            mapeadas errado no OCR): {t.competenciasDescartadas.map((c) => c.rotulo).join(', ')}. Não
            entram no cálculo de mês de início/fim.
          </p>
        )}

        <TerceirizadosContratosCard contratos={t.porContrato} onVerContrato={abrirModalContrato} />

        <TerceirizadosTabela
          pessoas={t.pessoas}
          vigente={vigenteTerc}
          onVigenteChange={setVigenteTerc}
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
