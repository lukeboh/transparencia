// Atualização automática do site a partir do git — pensado para rodar 1x/dia
// via cron/systemd timer (ver deploy/README.md). Traz tudo que é NOVO e
// VERSIONADO (código + os JSON de dados versionados em data/) e não toca no
// que não é versionado (node_modules/, web/.next/, web/.cache/, logs/,
// data/discovery/, .env*) — isso já é garantia natural do git: `merge
// --ff-only` só mexe em arquivos rastreados.
//
// Passo a passo: git fetch → aborta se HEAD já está em dia ou se há
// alterações locais não commitadas em arquivo versionado (nunca descarta
// trabalho) → merge --ff-only (nunca reescreve/força histórico) → `npm
// install` só se package.json/package-lock.json mudou (raiz e/ou web/) →
// rebuild (`next build`) → reinício do processo, se ATUALIZAR_APP_RESTART_CMD
// estiver configurado (ver deploy/README.md).
//
// Uso: node scripts/atualizar-app.mjs   (ou scripts/atualizar-app.sh, wrapper
// para cron). Tudo fica registrado em logs/app.log (categoria "atualizacao"),
// consultável em /painel/[chave] — ver web/app/painel/[chave]/page.tsx.
import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registrar } from '../src/lib/logger.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRANCH_ALVO = process.env.ATUALIZAR_APP_BRANCH || 'main';
const COMANDO_REINICIO = process.env.ATUALIZAR_APP_RESTART_CMD || '';

function git(args) {
  return execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim();
}

function rodar(comando, args, cwd = RAIZ) {
  return execFileSync(comando, args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function log(nivel, mensagem, detalhes) {
  registrar('atualizacao', nivel, mensagem, detalhes);
  const prefixo = nivel === 'erro' ? '[erro]' : nivel === 'aviso' ? '[aviso]' : '[info]';
  console.log(`${prefixo} ${mensagem}`);
}

async function main() {
  const branchAtual = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branchAtual !== BRANCH_ALVO) {
    log('aviso', `HEAD está em "${branchAtual}", não em "${BRANCH_ALVO}" — atualização automática pulada.`);
    return;
  }

  const sujo = git(['status', '--porcelain', '--untracked-files=no']);
  if (sujo) {
    log(
      'erro',
      'Há alterações locais não commitadas em arquivo(s) versionado(s) — atualização abortada para não perder trabalho.',
      { arquivos: sujo.split('\n') },
    );
    return;
  }

  git(['fetch', 'origin', BRANCH_ALVO, '--quiet']);
  const localAntes = git(['rev-parse', 'HEAD']);
  const remoto = git(['rev-parse', `origin/${BRANCH_ALVO}`]);

  if (localAntes === remoto) {
    log('info', 'Nenhuma atualização disponível — já na última versão.', { commit: localAntes.slice(0, 7) });
    return;
  }

  try {
    git(['merge', '--ff-only', `origin/${BRANCH_ALVO}`]);
  } catch (err) {
    log('erro', 'HEAD divergiu de origin — merge --ff-only falhou. Requer intervenção manual.', {
      local: localAntes.slice(0, 7),
      remoto: remoto.slice(0, 7),
      erro: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  const arquivosAlterados = git(['diff', '--name-only', localAntes, remoto])
    .split('\n')
    .filter(Boolean);
  log('info', `Repositório atualizado de ${localAntes.slice(0, 7)} para ${remoto.slice(0, 7)}.`, {
    arquivos: arquivosAlterados.length,
    lista: arquivosAlterados,
  });

  const precisaNpmRaiz = arquivosAlterados.some((f) => f === 'package.json' || f === 'package-lock.json');
  const precisaNpmWeb = arquivosAlterados.some(
    (f) => f === 'web/package.json' || f === 'web/package-lock.json',
  );

  if (precisaNpmRaiz) {
    try {
      rodar('npm', ['install']);
      log('info', 'npm install (raiz) concluído.');
    } catch (err) {
      log('erro', 'npm install (raiz) falhou.', { erro: mensagemDeErro(err) });
      return;
    }
  }

  if (precisaNpmWeb) {
    try {
      rodar('npm', ['install'], path.join(RAIZ, 'web'));
      log('info', 'npm install (web/) concluído.');
    } catch (err) {
      log('erro', 'npm install (web/) falhou.', { erro: mensagemDeErro(err) });
      return;
    }
  }

  try {
    rodar('npm', ['run', 'build'], path.join(RAIZ, 'web'));
    log('info', 'Build de produção (web/) concluído.');
  } catch (err) {
    log('erro', 'Build de produção (web/) falhou — o site continua rodando com o build anterior.', {
      erro: mensagemDeErro(err),
    });
    return;
  }

  if (!COMANDO_REINICIO) {
    log(
      'aviso',
      'Build novo pronto, mas ATUALIZAR_APP_RESTART_CMD não está configurado — reinicie o processo do site manualmente para aplicar. Ver deploy/README.md.',
    );
    return;
  }

  try {
    execSync(COMANDO_REINICIO, { cwd: RAIZ, encoding: 'utf8' });
    log('info', `Processo do site reiniciado ("${COMANDO_REINICIO}").`);
  } catch (err) {
    log('erro', `Falha ao reiniciar o processo do site ("${COMANDO_REINICIO}").`, {
      erro: mensagemDeErro(err),
    });
  }
}

function mensagemDeErro(err) {
  if (err && typeof err === 'object' && 'stderr' in err && err.stderr) {
    return String(err.stderr).slice(0, 4000);
  }
  return err instanceof Error ? err.message : String(err);
}

main().catch((err) => {
  log('erro', 'Falha inesperada na atualização automática.', { erro: mensagemDeErro(err) });
  process.exitCode = 1;
});
