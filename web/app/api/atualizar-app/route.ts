// Dispara scripts/atualizar-app.mjs sob demanda (botão "Forçar atualização
// agora" no painel interno) — mesmo script do cron/systemd timer (ver
// deploy/README.md), só que acionado na hora em vez de esperar a próxima
// janela agendada. Protegido pela mesma chave do painel (PAINEL_CHAVE):
// sem ela, ou errada, devolve 404 — nunca 401/403, que confirmariam a rota.
import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registrar } from '../../../../src/lib/logger.js';

export const dynamic = 'force-dynamic';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const SCRIPT = path.join(RAIZ, 'scripts', 'atualizar-app.mjs');

// globalThis: mesmo motivo do estado de scrape em web/app/api/tse/dados/route.ts
// — em dev o módulo pode ser reavaliado por request; a trava contra disparo
// concorrente precisa sobreviver a isso.
const g = globalThis as typeof globalThis & { __atualizarAppEmAndamento?: boolean };

function chaveConfere(fornecida: string, esperada: string): boolean {
  const a = createHash('sha256').update(fornecida).digest();
  const b = createHash('sha256').update(esperada).digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const chaveEsperada = process.env.PAINEL_CHAVE;
  if (!chaveEsperada) {
    return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });
  }

  const corpo = await request.json().catch(() => null);
  const chave = typeof corpo?.chave === 'string' ? corpo.chave : '';
  if (!chave || !chaveConfere(chave, chaveEsperada)) {
    return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });
  }

  if (g.__atualizarAppEmAndamento) {
    return NextResponse.json({ erro: 'Uma atualização já está em andamento.' }, { status: 409 });
  }

  g.__atualizarAppEmAndamento = true;
  registrar('atualizacao', 'info', 'Atualização forçada manualmente pelo painel interno.');

  // `detached` + `unref`: o processo filho sobrevive independente desta
  // requisição — inclusive se ATUALIZAR_APP_RESTART_CMD reiniciar o próprio
  // processo do servidor que o originou (pm2 reload / systemctl restart).
  const filho = spawn(process.execPath, [SCRIPT], {
    cwd: RAIZ,
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  filho.on('exit', () => {
    g.__atualizarAppEmAndamento = false;
  });
  filho.on('error', (err) => {
    g.__atualizarAppEmAndamento = false;
    registrar('atualizacao', 'erro', 'Falha ao iniciar o processo de atualização forçada.', {
      erro: err instanceof Error ? err.message : String(err),
    });
  });
  filho.unref();

  return NextResponse.json({ iniciado: true });
}
