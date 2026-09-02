'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, FileText, HardHat, UserMinus } from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import type { FatiaContagem } from '@/components/dashboard/contagem-donut';
import { KpiRoscaCard } from '@/components/dashboard/kpi-rosca-card';
import { TerceirizadosTabela } from '@/components/dashboard/terceirizados-tabela';
import { TerceirizadosContratosCard } from '@/components/dashboard/terceirizados-contratos-card';
import { TerceirizadosFalhasCard } from '@/components/dashboard/terceirizados-falhas-card';
import { DetalhesContratoDialog } from '@/components/dashboard/detalhes-contrato-dialog';
import { DadosStatus } from '@/components/dashboard/dados-status';
import { DicaTermo } from '@/components/ui/dica-termo';
import { AppVersion } from '@/components/app-version';
import { useDadosDashboard } from '@/lib/use-dados';
import { useSincronizarUrl } from '@/lib/use-sincronizar-url';
import { bool } from '@/lib/url-filtros';
import { brlCompacto, mesAnoLongo, numero, percentual } from '@/lib/utils';
import {
  urlTerceirizados,
  type ContratoResumo,
  type ContratoTerceirizados,
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

export function TerceirizadosDashboard() {
  const estado = useDadosDashboard();
  const { terceirizados: t, contratos } = estado.dados;

  const [modal, setModal] = useState<ModalContrato | null>(null);
  // Filtro Vigente da tabela de terceirizados, controlado aqui para o KPI
  // "Terceirizados ativos" poder garantir que ele fique LIGADO ao rolar até a
  // tabela. Regra do projeto: começa ligado (ver README).
  const [vigenteTerc, setVigenteTerc] = useState(true);
  // Recorte "só encerrados" da tabela, acionado pelo KPI "Já deixaram o TSE".
  const [encerradosTerc, setEncerradosTerc] = useState(false);
  // Sinal p/ o card de falhas se auto-expandir quando o KPI "Falhas" é clicado.
  const [falhasSinal, setFalhasSinal] = useState(0);

  useSincronizarUrl(
    {
      vig: bool.escrever(vigenteTerc, true),
      enc: bool.escrever(encerradosTerc, false),
    },
    (sp) => {
      setVigenteTerc(bool.ler(sp.get('vig'), true));
      setEncerradosTerc(bool.ler(sp.get('enc'), false));
    },
  );

  const contratoPorId = useMemo(
    () => new Map(contratos.map((c) => [c.id, c])),
    [contratos],
  );
  const porContratoMap = useMemo(
    () => new Map(t.porContrato.map((c) => [c.contrato, c])),
    [t.porContrato],
  );
  const empresaPorContrato = useMemo(
    () => new Map(t.porContrato.map((c) => [c.contrato, nomeEmpresa(c)])),
    [t.porContrato],
  );

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

  // Rosca "Já deixaram o TSE": encerrados × ainda no TSE, sobre o total de
  // terceirizados (vigentes + não vigentes).
  const fatiasEncerrados = useMemo<FatiaContagem[]>(
    () => [
      { rotulo: 'Já deixaram', quantidade: t.encerrados, cor: 'var(--chart-3)', meta: 'encerrados' },
      { rotulo: 'Ainda no TSE', quantidade: t.ativos, cor: '#898781', meta: 'ativos' },
    ],
    [t.encerrados, t.ativos],
  );

  // Rosca "Falhas de cruzamento": terceirizados afetados por alguma falha ×
  // sem falha, sobre o total.
  const terceirizadosComFalha = useMemo(
    () => new Set(t.falhas.filter((f) => f.nome && f.nome !== '(vazio)').map((f) => f.nome)).size,
    [t.falhas],
  );
  const fatiasFalhas = useMemo<FatiaContagem[]>(
    () => [
      { rotulo: 'Com falha', quantidade: terceirizadosComFalha, cor: 'var(--destructive)', meta: 'falhas' },
      {
        rotulo: 'Sem falha',
        quantidade: Math.max(0, t.totalPessoas - terceirizadosComFalha),
        cor: '#898781',
      },
    ],
    [terceirizadosComFalha, t.totalPessoas],
  );

  function irParaTabela() {
    setVigenteTerc(true);
    setEncerradosTerc(false);
    requestAnimationFrame(() =>
      document.getElementById('tabela-terceirizados')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  function irParaEncerrados() {
    setVigenteTerc(false);
    setEncerradosTerc(true);
    requestAnimationFrame(() =>
      document.getElementById('tabela-terceirizados')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  function irParaContratos() {
    document.getElementById('contratos-cessao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function irParaFalhas() {
    setFalhasSinal((n) => n + 1);
    requestAnimationFrame(() =>
      document.getElementById('registro-falhas')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  function abrirModalContrato(c: ContratoTerceirizados) {
    setModal({
      numero: c.contrato,
      contrato: c.contratoId ? contratoPorId.get(c.contratoId) ?? null : null,
      empresa: c.empresa || c.fornecedor || '',
      qtde: c.total,
    });
  }

  /** Abre o modal de um número de contrato (usado pela trilha de contratos na tabela). */
  function abrirContratoPorNumero(numero: string) {
    const c = porContratoMap.get(numero);
    if (c) abrirModalContrato(c);
    else setModal({ numero, contrato: null, empresa: '', qtde: 0 });
  }

  const rotuloCompetencia = mesAnoLongo(t.competenciaAtual);
  const intervalo =
    t.historicoMeses > 1
      ? `${t.competencias[0]?.rotulo} – ${t.competencias[t.competencias.length - 1]?.rotulo}`
      : rotuloCompetencia;

  return (
    <main className="max-w-none px-4 py-8 sm:px-6 lg:px-8">
      <AppHeader
        atual="terceirizados"
        titulo="Terceirizados"
        descricao={
          <>
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
          </>
        }
      />

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <KpiRoscaCard
            className="sm:col-span-2 lg:col-span-2"
            titulo="Terceirizados ativos"
            icone={<HardHat className="h-4 w-4" aria-hidden />}
            fatias={fatiasAtivosPorContrato}
            unidadeSingular="terceirizado"
            unidadePlural="terceirizados"
            onSelecionar={(f) => {
              const c = f.meta as ContratoTerceirizados | undefined;
              if (c) abrirModalContrato(c);
            }}
            nota={`por contrato de cessão${t.competenciaAtual ? ` · ${rotuloCompetencia}` : ''}`}
            acaoRotulo="Ver na tabela (Vigente)"
            onAcao={irParaTabela}
            fallbackValor={numero(t.ativos)}
            fallbackNota={
              t.competenciaAtual ? `na listagem de ${rotuloCompetencia}` : 'sem histórico disponível'
            }
          />

          <KpiRoscaCard
            className="sm:col-span-2 lg:col-span-2"
            titulo="Contratos de cessão"
            icone={<FileText className="h-4 w-4" aria-hidden />}
            fatias={fatiasValorPorContrato}
            unidadeSingular="valor global"
            unidadePlural="valor global"
            formatar={brlCompacto}
            onSelecionar={(f) => {
              const c = f.meta as ContratoTerceirizados | undefined;
              if (c) abrirModalContrato(c);
            }}
            nota={`${numero(t.contratos)} contratos · ${numero(contratosComAtivos)} com terceirizado ativo`}
            acaoRotulo="Ver a lista de contratos"
            onAcao={irParaContratos}
            fallbackValor={numero(t.contratos)}
            fallbackNota="contratos de cessão"
          />

          <KpiRoscaCard
            className="lg:col-span-1"
            compacto
            titulo={
              <span className="inline-flex items-center gap-1">
                Já deixaram o TSE <DicaTermo id="terceirizadoMesFim" />
              </span>
            }
            icone={<UserMinus className="h-4 w-4" aria-hidden />}
            fatias={fatiasEncerrados}
            unidadeSingular="terceirizado"
            unidadePlural="terceirizados"
            onSelecionar={(f) => (f.meta === 'ativos' ? irParaTabela() : irParaEncerrados())}
            nota={
              semHistoricoUtil
                ? 'requer +1 mês de histórico'
                : `${percentual(t.encerrados, t.totalPessoas)}% do total de terceirizados`
            }
            acaoRotulo="Ver encerrados na tabela"
            onAcao={irParaEncerrados}
          />

          <KpiRoscaCard
            className="lg:col-span-1"
            compacto
            titulo={
              <span className="inline-flex items-center gap-1">
                Falhas de cruzamento <DicaTermo id="terceirizadoFalhas" />
              </span>
            }
            icone={<AlertTriangle className="h-4 w-4" aria-hidden />}
            fatias={fatiasFalhas}
            unidadeSingular="terceirizado"
            unidadePlural="terceirizados"
            onSelecionar={() => irParaFalhas()}
            nota={`${numero(t.falhas.length)} registros · ${percentual(terceirizadosComFalha, t.totalPessoas)}% dos terceirizados afetados`}
            acaoRotulo="Ver registro de falhas"
            onAcao={irParaFalhas}
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
            mapeadas errado no OCR):{' '}
            {t.competenciasDescartadas.map((c, i) => (
              <span key={c.chave}>
                {i > 0 && ', '}
                {c.arquivoUrl ? (
                  <a
                    href={c.arquivoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {c.rotulo}
                  </a>
                ) : (
                  c.rotulo
                )}
              </span>
            ))}
            . Não entram no cálculo de mês de início/fim.
          </p>
        )}

        <TerceirizadosContratosCard contratos={t.porContrato} onVerContrato={abrirModalContrato} />

        <TerceirizadosTabela
          pessoas={t.pessoas}
          empresaPorContrato={empresaPorContrato}
          vigente={vigenteTerc}
          onVigenteChange={(v) => {
            setVigenteTerc(v);
            setEncerradosTerc(false);
          }}
          encerradosApenas={encerradosTerc}
          onEncerradosApenasChange={setEncerradosTerc}
          onVerContrato={abrirContratoPorNumero}
        />

        <TerceirizadosFalhasCard
          falhas={t.falhas}
          competencias={t.competencias}
          abrirSinal={falhasSinal}
        />
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
