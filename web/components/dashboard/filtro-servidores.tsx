'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  CATEGORIAS_VALOR,
  descricaoFaixa,
  type CategoriaValorId,
} from '@/lib/categorias-valor';
import {
  agruparPapeis,
  ehSubstituto,
  iconePerfil,
  nomeCurtoPerfil,
} from '@/lib/perfis-fiscalizacao';

export interface FiltroServidoresProps {
  todosPapeis: string[];
  papeisSelecionados: string[];
  onPapeisChange: (v: string[]) => void;
  considerarSubstitutos: boolean;
  onConsiderarSubstitutosChange: (v: boolean) => void;
  somenteVigentes: boolean;
  onSomenteVigentesChange: (v: boolean) => void;
  categoriasSelecionadas: CategoriaValorId[];
  onCategoriasChange: (v: CategoriaValorId[]) => void;
  /** Níveis de função comissionada presentes ("FC-1"…"CJ-4"), já ordenados. */
  todasFuncoes: string[];
  funcoesSelecionadas: string[];
  onFuncoesChange: (v: string[]) => void;
  incluirSemFuncao: boolean;
  onIncluirSemFuncaoChange: (v: boolean) => void;
  /** Chip "Vigente" da seção "Por função": ligado = só a função de hoje;
   *  desligado = também o histórico de FC/CJ do servidor. */
  funcaoVigente: boolean;
  onFuncaoVigenteChange: (v: boolean) => void;
  className?: string;
}

// ── helpers de conjunto ─────────────────────────────────────────────────────
function toggle<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];
}
function comTodos<T>(lista: T[], alvos: T[]): T[] {
  const s = new Set(lista);
  for (const a of alvos) s.add(a);
  return [...s];
}
function semNenhum<T>(lista: T[], alvos: T[]): T[] {
  const rem = new Set(alvos);
  return lista.filter((x) => !rem.has(x));
}

// ── átomos visuais ──────────────────────────────────────────────────────────
/** Chip de seleção sem "gaivota" — o estado é só cor: sólido = dentro, riscado
 *  = fora, apagado sem risco = desabilitado. */
function Chip({
  ativo,
  desabilitado,
  onClick,
  title,
  cor,
  children,
}: {
  ativo: boolean;
  desabilitado?: boolean;
  onClick: () => void;
  title?: string;
  /** cor de fundo quando ativo (faixas de valor); default = primary */
  cor?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={desabilitado ? undefined : onClick}
      aria-pressed={ativo}
      disabled={desabilitado}
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all focus-visible:outline-2 focus-visible:outline-ring',
        desabilitado
          ? 'cursor-not-allowed border-transparent bg-muted/40 text-muted-foreground/50'
          : ativo
            ? cor
              ? 'border-transparent text-primary-foreground shadow-2xs'
              : 'border-primary/30 bg-primary/15 text-primary'
            : 'border-transparent bg-muted/60 text-muted-foreground line-through opacity-60 hover:bg-muted hover:text-foreground hover:no-underline hover:opacity-100',
      )}
      style={ativo && !desabilitado && cor ? { backgroundColor: cor } : undefined}
    >
      {children}
    </button>
  );
}

function Checkbox({
  marcado,
  onChange,
  children,
}: {
  marcado: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-border accent-primary"
      />
      {children}
    </label>
  );
}

/** Subcard: bloco com título e borda própria, recuável na hierarquia visual. */
function Secao({
  titulo,
  acao,
  children,
  nivel = 1,
}: {
  titulo: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
  nivel?: 1 | 2;
}) {
  return (
    <section
      className={cn(
        'rounded-lg border border-border',
        nivel === 1 ? 'bg-background p-3' : 'bg-card/60 p-2.5',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4
          className={cn(
            'font-semibold tracking-tight text-foreground',
            nivel === 1 ? 'text-sm' : 'text-xs uppercase text-muted-foreground',
          )}
        >
          {titulo}
        </h4>
        {acao}
      </div>
      {children}
    </section>
  );
}

/** "todos · nenhum" compacto para uma seção. */
function TodosNenhum({ onTodos, onNenhum }: { onTodos: () => void; onNenhum: () => void }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
      <button type="button" onClick={onTodos} className="hover:text-foreground hover:underline">
        todos
      </button>
      <span aria-hidden>·</span>
      <button type="button" onClick={onNenhum} className="hover:text-foreground hover:underline">
        nenhum
      </button>
    </span>
  );
}

// ── corpo do filtro (compartilhado entre card desktop e drawer mobile) ───────
function CorpoFiltro(props: FiltroServidoresProps) {
  const {
    todosPapeis,
    papeisSelecionados,
    onPapeisChange,
    considerarSubstitutos,
    onConsiderarSubstitutosChange,
    somenteVigentes,
    onSomenteVigentesChange,
    categoriasSelecionadas,
    onCategoriasChange,
    todasFuncoes,
    funcoesSelecionadas,
    onFuncoesChange,
    incluirSemFuncao,
    onIncluirSemFuncaoChange,
    funcaoVigente,
    onFuncaoVigenteChange,
  } = props;

  const grupos = agruparPapeis(todosPapeis);
  const substitutosPresentes = todosPapeis.filter(ehSubstituto);
  const setSel = new Set(papeisSelecionados);

  return (
    <div className="space-y-3">
      {/* ── Por função (o primeiro a ser visto) ────────────────────────── */}
      <Secao
        titulo="Por função"
        acao={
          <TodosNenhum
            onTodos={() => onFuncoesChange([...todasFuncoes])}
            onNenhum={() => onFuncoesChange([])}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-1">
          {todasFuncoes.map((f) => (
            <Chip
              key={f}
              ativo={funcoesSelecionadas.includes(f)}
              onClick={() => onFuncoesChange(toggle(funcoesSelecionadas, f))}
              title={`Função comissionada ${f}`}
            >
              {f}
            </Chip>
          ))}
          <Chip
            ativo={incluirSemFuncao}
            onClick={() => onIncluirSemFuncaoChange(!incluirSemFuncao)}
            title={
              incluirSemFuncao
                ? 'Incluindo quem não tem função comissionada no recorte atual — clique para ocultar'
                : 'Ocultando quem não tem função comissionada — clique para incluir'
            }
          >
            SEM FUNÇÃO
          </Chip>
          <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden />
          <Chip
            ativo={funcaoVigente}
            onClick={() => onFuncaoVigenteChange(!funcaoVigente)}
            title={
              funcaoVigente
                ? 'Recorta só pela função comissionada vigente hoje — clique para considerar também o histórico de FC/CJ'
                : 'Considerando também o histórico de FC/CJ já ocupados — clique para olhar só a situação atual'
            }
          >
            VIGENTE
          </Chip>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {funcaoVigente
            ? 'Recorte pela função comissionada vigente hoje.'
            : 'Inclui o histórico de funções (FC/CJ) já ocupadas por cada servidor.'}
        </p>
      </Secao>

      {/* ── Por contratos ──────────────────────────────────────────────── */}
      <div>
        <Secao titulo="Por contratos">
          <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <Chip
              ativo={somenteVigentes}
              onClick={() => onSomenteVigentesChange(!somenteVigentes)}
              title={
                somenteVigentes
                  ? 'Só contratos vigentes hoje — clique para incluir os encerrados'
                  : 'Incluindo contratos encerrados — clique para ver só os vigentes'
              }
            >
              VIGENTE
            </Chip>
            <Checkbox
              marcado={considerarSubstitutos}
              onChange={onConsiderarSubstitutosChange}
            >
              Considerar substitutos
            </Checkbox>
            {substitutosPresentes.length > 0 && !considerarSubstitutos && (
              <span className="text-[11px] text-muted-foreground">
                papéis 🔄 desativados
              </span>
            )}
          </div>

          <div className="grid items-start gap-2.5 sm:grid-cols-2">
            {/* Por papel */}
            <Secao
              titulo="Por papel"
              nivel={2}
              acao={
                <TodosNenhum
                  onTodos={() => onPapeisChange([...todosPapeis])}
                  onNenhum={() => onPapeisChange([])}
                />
              }
            >
              <div className="space-y-2">
                {grupos.map(({ grupo, pares }) => {
                  const membros = pares.flatMap((p) =>
                    p.substituto ? [p.titular, p.substituto] : [p.titular],
                  );
                  const todosNoGrupo = membros.every((m) => setSel.has(m));
                  return (
                    <div key={grupo.id}>
                      <button
                        type="button"
                        onClick={() =>
                          onPapeisChange(
                            todosNoGrupo
                              ? semNenhum(papeisSelecionados, membros)
                              : comTodos(papeisSelecionados, membros),
                          )
                        }
                        className="mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                        title={`Alternar todos de ${grupo.titulo}`}
                      >
                        <span aria-hidden>{grupo.emoji}</span>
                        {grupo.titulo}
                      </button>
                      <div className="flex flex-wrap gap-1">
                        {pares.map(({ titular, substituto }) => (
                          <span
                            key={titular}
                            className="inline-flex items-center gap-0.5 rounded-md bg-muted/30 p-0.5"
                          >
                            <Chip
                              ativo={setSel.has(titular)}
                              onClick={() => onPapeisChange(toggle(papeisSelecionados, titular))}
                              title={titular}
                            >
                              <span aria-hidden>{iconePerfil(titular)}</span>
                              <span>{nomeCurtoPerfil(titular)}</span>
                            </Chip>
                            {substituto && (
                              <Chip
                                ativo={setSel.has(substituto)}
                                desabilitado={!considerarSubstitutos}
                                onClick={() =>
                                  onPapeisChange(toggle(papeisSelecionados, substituto))
                                }
                                title={
                                  considerarSubstitutos
                                    ? substituto
                                    : `${substituto} — desmarque "Considerar substitutos" para incluir`
                                }
                              >
                                🔄
                              </Chip>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Secao>

            {/* Por valor */}
            <Secao
              titulo="Por valor"
              nivel={2}
              acao={
                <TodosNenhum
                  onTodos={() => onCategoriasChange(CATEGORIAS_VALOR.map((c) => c.id))}
                  onNenhum={() => onCategoriasChange([])}
                />
              }
            >
              <div className="flex flex-wrap gap-1">
                {CATEGORIAS_VALOR.map((c) => (
                  <Chip
                    key={c.id}
                    ativo={categoriasSelecionadas.includes(c.id)}
                    cor={c.cor}
                    onClick={() => onCategoriasChange(toggle(categoriasSelecionadas, c.id))}
                    title={`${c.nome} — ${descricaoFaixa(c)}`}
                  >
                    <span aria-hidden>{c.simbolo}</span>
                    <span>{c.nome}</span>
                  </Chip>
                ))}
              </div>
            </Secao>
          </div>
        </Secao>
      </div>
    </div>
  );
}

// ── quantos filtros estão "estreitando" o resultado ─────────────────────────
function contarAtivos(p: FiltroServidoresProps): number {
  const papeisConsiderados = p.considerarSubstitutos
    ? p.todosPapeis
    : p.todosPapeis.filter((x) => !ehSubstituto(x));
  const selConsiderados = p.papeisSelecionados.filter(
    (x) => p.considerarSubstitutos || !ehSubstituto(x),
  );
  let n = 0;
  if (p.somenteVigentes) n++;
  if (p.funcaoVigente) n++;
  if (!p.considerarSubstitutos) n++;
  if (selConsiderados.length < papeisConsiderados.length) n++;
  if (p.categoriasSelecionadas.length < CATEGORIAS_VALOR.length) n++;
  if (p.funcoesSelecionadas.length < p.todasFuncoes.length) n++;
  if (!p.incluirSemFuncao) n++;
  return n;
}

function limparTudo(p: FiltroServidoresProps) {
  p.onPapeisChange([...p.todosPapeis]);
  p.onConsiderarSubstitutosChange(true);
  p.onSomenteVigentesChange(false);
  p.onFuncaoVigenteChange(false);
  p.onCategoriasChange(CATEGORIAS_VALOR.map((c) => c.id));
  p.onFuncoesChange([...p.todasFuncoes]);
  p.onIncluirSemFuncaoChange(true);
}

// ── componente exposto ──────────────────────────────────────────────────────
export function FiltroServidores(props: FiltroServidoresProps) {
  const [aberto, setAberto] = useState(true); // card desktop expandido
  const [drawer, setDrawer] = useState(false); // sheet mobile

  const ativos = contarAtivos(props);
  const resumo =
    ativos === 0 ? 'Sem filtros' : `${ativos} filtro${ativos > 1 ? 's' : ''} ativo${ativos > 1 ? 's' : ''}`;

  const Cabecalho = (
    <div className="flex items-center gap-2">
      <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
      <span className="text-sm font-semibold">Filtro</span>
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-xs font-semibold',
          ativos === 0
            ? 'bg-secondary text-secondary-foreground'
            : 'bg-primary/15 text-primary',
        )}
      >
        {resumo}
      </span>
    </div>
  );

  return (
    <div className={props.className}>
      {/* Mobile: barra + sheet */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 shadow-xs"
        >
          {Cabecalho}
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
        </button>
        <Dialog
          open={drawer}
          onClose={() => setDrawer(false)}
          className="max-h-[85vh] max-w-lg overflow-y-auto"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-popover p-3">
            {Cabecalho}
            <div className="flex items-center gap-3">
              {ativos > 0 && (
                <button
                  type="button"
                  onClick={() => limparTudo(props)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Limpar
                </button>
              )}
              <button
                type="button"
                onClick={() => setDrawer(false)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Fechar
              </button>
            </div>
          </div>
          <div className="p-3">
            <CorpoFiltro {...props} />
          </div>
        </Dialog>
      </div>

      {/* Desktop: card único recuável */}
      <div className="hidden rounded-lg border border-border bg-card p-3 shadow-xs md:block">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {Cabecalho}
          <div className="flex items-center gap-3">
            {ativos > 0 && (
              <button
                type="button"
                onClick={() => limparTudo(props)}
                className="text-xs font-medium text-primary hover:underline"
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {aberto ? 'Recolher' : 'Expandir'}
              {aberto ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>
        {aberto && (
          <div className="mt-3">
            <CorpoFiltro {...props} />
          </div>
        )}
      </div>
    </div>
  );
}
