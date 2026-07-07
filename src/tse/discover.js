// Script de reconhecimento: abre a página pública de transparência de contratos
// do TSE, grava um HAR completo (todas as requisições/respostas de rede) e
// salva o HTML renderizado + um screenshot. Isso é usado uma única vez para
// descobrir a API/DOM reais por trás da página antes de escrever o scraper
// definitivo (src/tse/scrapeContratos.js).
//
// Uso: node src/tse/discover.js [unidade]
import { chromium } from 'playwright';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const unidade = process.argv[2] ?? 'TSE';
const url = `https://contratos.comprasnet.gov.br/transparencia/contratos?unidade=${encodeURIComponent(unidade)}`;
const outDir = path.resolve('data/discovery');

// O pacote npm "playwright" instalado localmente às vezes espera uma build de
// browser mais nova do que a pré-instalada neste ambiente. Em vez de baixar
// (rede restrita), aponta para o Chromium já disponível em PLAYWRIGHT_BROWSERS_PATH.
async function encontrarChromiumInstalado() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const entradas = await readdir(base).catch(() => []);
  const dir = entradas.find((e) => e.startsWith('chromium-') && !e.includes('headless'));
  return dir ? path.join(base, dir, 'chrome-linux', 'chrome') : undefined;
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const executablePath = await encontrarChromiumInstalado();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const context = await browser.newContext({
    recordHar: { path: path.join(outDir, `transparencia-${unidade}.har`), content: 'embed' },
  });
  const page = await context.newPage();

  const jsonCalls = [];
  page.on('response', async (response) => {
    const contentType = response.headers()['content-type'] ?? '';
    if (contentType.includes('application/json')) {
      try {
        const body = await response.json();
        jsonCalls.push({
          url: response.url(),
          status: response.status(),
          request: { method: response.request().method(), postData: response.request().postData() },
          bodyPreview: JSON.stringify(body).slice(0, 2000),
        });
      } catch {
        // corpo não-JSON válido apesar do content-type; ignora
      }
    }
  });

  console.log(`Abrindo ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(outDir, `page-${unidade}.png`), fullPage: true });
  const html = await page.content();
  await writeFile(path.join(outDir, `page-${unidade}.html`), html, 'utf8');
  await writeFile(
    path.join(outDir, `json-calls-${unidade}.json`),
    JSON.stringify(jsonCalls, null, 2),
    'utf8',
  );

  await context.close();
  await browser.close();

  console.log(`Concluído. Verifique data/discovery/ (HAR, screenshot, HTML e ${jsonCalls.length} chamadas JSON capturadas).`);
}

main().catch((err) => {
  console.error('Falha na descoberta:', err);
  process.exit(1);
});
