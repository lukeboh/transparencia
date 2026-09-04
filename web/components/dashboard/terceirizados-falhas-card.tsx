'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ColapsarBotao } from '@/components/dashboard/card-controles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BotaoExportar } from '@/components/dashboard/botao-exportar';
import { DicaTermo } from '@/components/ui/dica-termo';
import { mesAnoCurto, numero } from '@/lib/utils';
import type { ColunaExport } from '@/lib/exportar-dados';
import type { CompetenciaTerceirizados, TerceirizadoFalha } from '@/lib/dashboard-data';

const ROTULO: Record<TerceirizadoFalha['tipo'], string> = {
  'lotacao-nao-identificada': 'Lotação não identificada',
  'sem-alocacao': 'Sem alocação no PDF',
  'contrato-nao-vinculado': 'Contrato não vinculado',
  'nome-nao-identificado': 'Nome não identificado',
  'nome-possivel-duplicata': 'Possível duplicata de nome',
};

const DESCRICAO: Record<TerceirizadoFalha['tipo'], string> = {
  'lotacao-nao-identificada':
    'A sigla da coluna "Alocação" do PDF não bateu com nenhuma unidade da estrutura do TSE — grafia diferente, sigla nova ou ruído de OCR. O terceirizado conta no total, mas não é posicionado numa unidade.',
  'sem-alocacao': 'A coluna "Alocação" do PDF veio em branco nesta linha, então não há como identificar a unidade de lotação.',
  'contrato-nao-vinculado':
    'O número do contrato citado no PDF (ex.: "31/2023") não foi encontrado na base de contratos do Compras.gov.br do TSE. Pode ser um contrato antigo fora da base raspada, um erro de digitação/OCR no número, ou uma modalidade não coberta. Sem o vínculo, o modal "Detalhes do Contrato" não mostra fornecedor, objeto nem valores.',
  'nome-nao-identificado':
    'A linha do PDF trouxe só o cargo ou uma anotação (férias, "admitido"…), sem um nome de pessoa reconhecível — em geral porque o OCR trocou as colunas. Essa linha não vira um terceirizado na tabela.',
  'nome-possivel-duplicata':
    'Existe outro terceirizado com nome quase idêntico (um "sobrenome" diferindo por 1–2 letras — "Souza"/"Sousa", "Santos"/"Antos"): quase sempre a mesma pessoa contada duas vezes por erro de digitação/OCR. A sugestão é a grafia mais comum na base. Confira e, se procede, registre em data/tse_terceirizados_excecoes.json (renomear).',
};

export function TerceirizadosFalhasCard({
  falhas,
  competencias,
  abrirSinal = 0,
}: {
  falhas: TerceirizadoFalha[];
  /** Para linkar cada falha ao PDF mensal de origem. */
  competencias: CompetenciaTerceirizados[];
  /** Quando muda (> 0), o card se auto-expande — usado pelo KPI "Falhas de cruzamento". */
  abrirSinal?: number;
}) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (abrirSinal > 0) setAberto(true);
  }, [abrirSinal]);

  const pdfPorCompetencia = useMemo(
    () => new Map(competencias.map((c) => [c.chave, c.arquivoUrl])),
    [competencias],
  );

  const colunasExport = useMemo<ColunaExport<TerceirizadoFalha>[]>(
    () => [
      { cabecalho: 'Tipo', valor: (f) => ROTULO[f.tipo] },
      { cabecalho: 'Nome', valor: (f) => f.nome },
      { cabecalho: 'Alocação (PDF)', valor: (f) => f.alocacao },
      { cabecalho: 'Contrato', valor: (f) => f.contrato },
      { cabecalho: 'Nome sugerido', valor: (f) => f.nomeSugerido ?? '' },
      { cabecalho: 'Competência mais recente', valor: (f) => mesAnoCurto(f.competenciaMaisRecente) },
      { cabecalho: 'PDF de origem', valor: (f) => pdfPorCompetencia.get(f.competenciaMaisRecente) ?? '' },
    ],
    [pdfPorCompetencia],
  );

  const porTipo = useMemo(() => {
    const m = new Map<TerceirizadoFalha['tipo'], number>();
    for (const f of falhas) m.set(f.tipo, (m.get(f.tipo) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [falhas]);

  return (
    <Card id="registro-falhas" className="scroll-mt-4">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
            Registro de falhas <DicaTermo id="terceirizadoFalhas" />
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
              {numero(falhas.length)}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {falhas.length > 0 && (
              <BotaoExportar
                linhas={falhas}
                colunas={colunasExport}
                nomeArquivo="terceirizados-falhas"
                nomeAba="Falhas"
              />
            )}
            <ColapsarBotao
              colapsado={!aberto}
              onToggle={() => setAberto((a) => !a)}
              rotulo="a lista de falhas"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {porTipo.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma falha — todos os terceirizados foram cruzados.</p>
          ) : (
            porTipo.map(([tipo, qtd]) => (
              <span
                key={tipo}
                title={DESCRICAO[tipo]}
                className="inline-flex cursor-help items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs"
              >
                {ROTULO[tipo]}
                <span className="font-semibold tabular-nums">{numero(qtd)}</span>
              </span>
            ))
          )}
        </div>

        {aberto && falhas.length > 0 && (
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Alocação (PDF)</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Competência / PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {falhas.map((f, i) => {
                  const pdf = pdfPorCompetencia.get(f.competenciaMaisRecente);
                  return (
                    <TableRow key={`${f.nome}-${f.tipo}-${i}`}>
                      <TableCell className="font-medium">
                        {f.nome}
                        {f.nomeSugerido && (
                          <span className="mt-0.5 block text-xs font-normal text-primary">
                            → {f.nomeSugerido}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          title={DESCRICAO[f.tipo]}
                          className="cursor-help rounded-sm bg-warning-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning"
                        >
                          {ROTULO[f.tipo]}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.alocacao || '—'}</TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">{f.contrato || '—'}</TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {pdf ? (
                          <a
                            href={pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                            title="Abrir o PDF mensal do TSE dessa competência, em nova aba"
                          >
                            {mesAnoCurto(f.competenciaMaisRecente)}
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">{mesAnoCurto(f.competenciaMaisRecente)}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
