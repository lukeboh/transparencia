# Atualização automática e painel interno

Duas peças, pensadas para rodar no servidor real onde o site fica no ar (não
tem efeito dentro de um ambiente de desenvolvimento/sessão isolada — precisam
ser instaladas por quem administra a máquina):

1. **Atualização automática** (`scripts/atualizar-app.mjs`): pelo menos 1x/dia,
   puxa do git tudo que é novo e **versionado** (código + os JSON de dados
   versionados em `data/`) e não toca no que **não é versionado**
   (`node_modules/`, `web/.next/`, `web/.cache/`, `logs/`, `.env*`,
   `data/discovery/`) — isso é garantia natural do `git merge --ff-only`, que só
   mexe em arquivo rastreado. Nunca força/reescreve histórico, e aborta sem
   mexer em nada se houver alteração local não commitada em arquivo
   versionado (nunca descarta trabalho) ou se o HEAD local divergiu do
   remoto (nesses dois casos, registra o motivo no log e espera intervenção
   manual).
2. **Painel interno** (`/painel/[chave]`): consulta os logs de scraping,
   atualização e erros da aplicação — ver seção própria abaixo.

## 1. Atualização automática

### Passo a passo do script

`git fetch` → aborta se já está em dia, se há alteração local não commitada,
ou se divergiu do remoto → `git merge --ff-only` → `npm install` (raiz e/ou
`web/`, só se `package.json`/`package-lock.json` mudou em cada um) → `npm run
build` em `web/` → reinicia o processo do site, **se** `ATUALIZAR_APP_RESTART_CMD`
estiver configurado (senão só builda e avisa no log — o processo antigo
continua no ar até alguém reiniciar à mão).

Tudo fica registrado em `logs/app.log` (categoria `atualizacao`), consultável
no painel interno.

### Configuração

O reinício do processo depende de como o site roda no seu servidor — o script
não assume nenhum gerenciador específico. Configure `ATUALIZAR_APP_RESTART_CMD`
com o comando que reinicia **seu** processo, por exemplo:

- PM2: `ATUALIZAR_APP_RESTART_CMD="pm2 reload transparencia-web"`
- systemd: `ATUALIZAR_APP_RESTART_CMD="systemctl restart transparencia-web"`
  (o usuário que roda o script precisa de permissão pra isso — veja `sudoers`
  com `NOPASSWD` para esse comando específico, ou prefira PM2, que reinicia
  como o próprio usuário dono do processo, sem privilégio extra)

Sem essa variável, o script builda e registra um aviso no log — o site
continua servindo o build anterior até você reiniciar manualmente.

### Instalação — opção A: cron

```bash
crontab -e
```

```cron
# Transparência TSE — atualização automática, todo dia às 5h
0 5 * * * ATUALIZAR_APP_RESTART_CMD="pm2 reload transparencia-web" /caminho/para/transparencia/scripts/atualizar-app.sh
```

(cron roda com um `PATH` mínimo — o script já resolve `node` e o próprio
diretório do repositório sozinho, então não precisa de `cd` nem de caminho
absoluto pro `node` na linha do cron.)

### Instalação — opção B: systemd timer

```bash
# ajuste WorkingDirectory, User e ATUALIZAR_APP_RESTART_CMD nos dois arquivos antes de copiar
sudo cp deploy/transparencia-atualizar.service deploy/transparencia-atualizar.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now transparencia-atualizar.timer

# testar manualmente antes de esperar o horário agendado:
sudo systemctl start transparencia-atualizar.service
journalctl -u transparencia-atualizar.service -n 50
```

## 2. Painel interno (`/painel/[chave]`)

Mostra os últimos registros de log — scraping (a atualização de dados sob
demanda que já existia, disparada pela própria página), atualização automática
(seção 1 acima) e erros da aplicação (renderização, rotas de API, exceções não
tratadas) — com filtro por categoria.

Não é linkado em nenhum lugar da navegação, e a URL exige uma chave secreta no
próprio caminho (`/painel/<chave>`); sem `PAINEL_CHAVE` configurada, ou com a
chave errada, a rota devolve 404 — indistinguível de uma rota que não existe.

### Configuração

Gere uma chave aleatória e defina em `web/.env.local` (nunca versionado —
ver `.gitignore`):

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

```bash
# web/.env.local
PAINEL_CHAVE=<a chave gerada acima>
```

Reinicie o site após definir/trocar a chave (variável lida na inicialização
do processo Next.js). A URL fica `https://seu-dominio/painel/<a chave>`.
