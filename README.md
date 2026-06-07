# 📊 Concursos Contábeis

> Painel de monitoramento, geração de cards e publicação automática no Instagram para a conta **@concursos.contabeis**.

Faz scraping automático do [pciconcursos.com.br](https://pciconcursos.com.br), gera cards visuais prontos para o Instagram, agenda publicações e envia alertas por e-mail — tudo de forma automatizada.

**Deploy:** [concursos-contabeis.vercel.app](https://concursos-contabeis.vercel.app)

---

## Índice

- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Banco de Dados](#banco-de-dados)
- [API Routes](#api-routes)
- [Cron Jobs](#cron-jobs)
- [E-mails automáticos](#e-mails-automáticos)
- [Publicação no Instagram](#publicação-no-instagram)
- [Página pública /bio](#página-pública-bio)
- [Setup e Deploy](#setup-e-deploy)
- [Variáveis de Ambiente](#variáveis-de-ambiente)

---

## Funcionalidades

| Feature | Descrição |
|---|---|
| **Scraping automático** | Busca 16 URLs de cargos contábeis no PCI Concursos diariamente |
| **Cards Instagram** | Gera imagens 1:1 (feed) e 9:16 (stories) prontas para download |
| **Legenda automática** | Texto formatado com emojis, dados do concurso e hashtags |
| **Agendamento** | Agenda posts para datas futuras — o cron publica automaticamente |
| **Publicação automática** | Publica feed e stories via Instagram Graph API sem intervenção manual |
| **Alertas por e-mail** | Notifica novos concursos, prazos encerrando e resumo semanal |
| **Favoritos** | Salva concursos com notas pessoais |
| **Histórico** | Registra todos os posts publicados |
| **Estatísticas** | Gráficos de publicações por semana, top estados e top cargos |
| **Calendário** | Visualização mensal dos agendamentos |
| **Página /bio** | Página pública com os últimos concursos postados (link da bio) |
| **Filtros avançados** | Status, estado (UF), nível de escolaridade, ordenação por salário/vagas/prazo |

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| Linguagem | TypeScript |
| Banco de dados | Supabase (PostgreSQL) |
| Geração de imagens | Satori (SVG → PNG server-side) |
| Scraping | Cheerio + fetch nativo |
| E-mail | Resend |
| Extração de PDF | unpdf |
| Deploy | Vercel |
| Publicação Instagram | Meta Graph API v19.0 |
| Upload de imagens | Imgur API |

---

## Estrutura do Projeto

```
src/
├── app/
│   ├── page.tsx                          # Painel principal (lista, cards, histórico, favoritos, stats)
│   ├── layout.tsx                        # Layout raiz
│   ├── bio/
│   │   └── page.tsx                      # Página pública /bio (link da bio do Instagram)
│   ├── calendario/
│   │   └── page.tsx                      # Calendário de agendamentos
│   └── api/
│       ├── concursos/route.ts            # GET concursos (scraping + cache)
│       ├── agendamentos/route.ts         # CRUD de agendamentos
│       ├── agendamentos/[id]/
│       │   └── imagens/route.ts          # Salva cards base64 do agendamento
│       ├── bio/route.ts                  # Dados para a página /bio
│       ├── favoritos/route.ts            # CRUD de favoritos
│       ├── historico/route.ts            # Histórico de posts publicados
│       ├── stats/route.ts                # Estatísticas de publicações
│       ├── debug/route.ts                # Diagnóstico do scraping (sem auth)
│       ├── inspecionar-cache/route.ts    # Inspeciona o cache atual
│       ├── limpar-cache-antigo/route.ts  # Remove cache desatualizado
│       ├── limpar-invalidos/route.ts     # Remove concursos inválidos do cache
│       ├── scrape-lote/route.ts          # Scraping em lotes paralelos
│       └── cron/
│           ├── atualizar-concursos/      # Atualiza cache diariamente (06:00 UTC)
│           ├── notificacoes/             # Alerta de novos concursos (09:00 UTC)
│           ├── resumo-semanal/           # Resumo semanal (domingo 09:00 UTC)
│           ├── publicar-agendados/       # Publica posts agendados (09:00 UTC)
│           └── disparar/                 # Dispara publicar-agendados via POST (calendário)
├── components/
│   └── InstagramCard.tsx                 # Componente visual do card Instagram
└── lib/
    ├── scraper.ts                        # Engine de scraping (16 URLs, PDFs, bancas)
    ├── email.ts                          # Templates de e-mail (Resend)
    ├── legenda.ts                        # Gerador de legendas com hashtags
    ├── card-renderer.ts                  # Renderiza cards PNG via Satori
    ├── pdf-extractor.ts                  # Extrai dados de editais em PDF
    └── supabase.ts                       # Cliente Supabase

supabase-setup-completo.sql               # Schema completo do banco (idempotente)
vercel.json                               # Configuração dos cron jobs
```

---

## Banco de Dados

Execute `supabase-setup-completo.sql` no **SQL Editor do Supabase** — o script é idempotente (seguro para rodar múltiplas vezes).

### Tabelas

#### `cache_concursos`
Cache do scraping com TTL de 6 horas.

| Coluna | Tipo | Descrição |
|---|---|---|
| `chave` | text PK | Identificador do cache (ex: `concursos:v20`) |
| `dados` | jsonb | Array de concursos serializado |
| `atualizado` | timestamptz | Timestamp da última atualização |

#### `historico_posts`
Registro de todos os posts publicados no Instagram.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | bigserial PK | |
| `concurso_id` | text | ID do concurso |
| `cargo` | text | Cargo do concurso |
| `orgao` | text | Órgão |
| `estado` | text | UF |
| `posted_at` | timestamptz | Data de publicação |

#### `favoritos`
Concursos salvos com notas.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | bigserial PK | |
| `concurso_id` | text UNIQUE | |
| `cargo` / `orgao` / `estado` | text | |
| `nota` | text | Anotação pessoal |
| `criado_em` | timestamptz | |

#### `notificacoes_enviadas`
Controle de e-mails já enviados (evita duplicatas).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | bigserial PK | |
| `tipo` | text | `novo_concurso`, `prazo_3dias`, `resumo_semanal` |
| `concurso_id` | text | ID do concurso (null para alertas gerais) |
| `enviado_em` | timestamptz | |

#### `agendamentos_posts`
Posts agendados para publicação futura.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | bigserial PK | |
| `concurso_id` / `cargo` / `orgao` / `estado` | text | Dados do concurso |
| `modo` | text | `feed`, `stories` ou `ambos` |
| `agendado_para` | timestamptz | Data/hora de publicação |
| `feed_base64` | text | Imagem do feed em base64 (gerada no navegador) |
| `stories_base64` | text | Imagem dos stories em base64 |
| `legenda` | text | Legenda do post |
| `publicado` | boolean | Se já foi publicado |
| `publicado_em` | timestamptz | Timestamp da publicação |
| `post_id_feed` | text | ID retornado pela Graph API |
| `post_id_stories` | text | ID retornado pela Graph API |
| `tentativas` | int | Contador de tentativas de publicação |

---

## API Routes

### `GET /api/concursos`
Retorna lista de concursos contábeis. Usa cache do Supabase com TTL de 6h. Se o cache estiver expirado ou vazio, executa o scraping completo.

**Query params:**
- `force=1` — força scraping ignorando o cache

**Scraping:** busca 16 URLs de cargos no PCI Concursos, filtra por palavras-chave contábeis, extrai detalhes dos editais (incluindo PDFs), detecta banca organizadora, salva no cache.

**Cargos monitorados:**
`contador`, `contadora`, `contabilidade`, `técnico em contabilidade`, `técnico contábil`, `analista contábil`, `auditor fiscal`, `fiscal de tributos`, `contador municipal`, `contador público`, `auditor de controle interno`, `analista de controle interno`, `auditor fiscal de tributos`, `fiscal de rendas`, `analista de controle`, `sub-contador`

---

### `GET/POST/PATCH /api/agendamentos`
- **GET** — lista todos os agendamentos ordenados por data
- **POST** — cria novo agendamento com cards base64 e legenda
- **PATCH** — marca agendamento como publicado com IDs retornados pela API

### `PUT /api/agendamentos/[id]/imagens`
Atualiza os cards base64 de um agendamento existente.

---

### `GET /api/bio`
Retorna os concursos postados nos últimos 90 dias cruzados com o cache atual. Usado pela página pública `/bio`.

### `GET /api/historico`
Lista o histórico completo de posts publicados.

### `GET/POST/DELETE /api/favoritos`
CRUD de concursos favoritados.

### `GET /api/stats`
Retorna estatísticas de publicações: total geral, por semana, por estado e por cargo.

### `GET /api/debug`
Endpoint de diagnóstico — faz scraping de uma URL e retorna os dados brutos para depuração. Não requer autenticação. Útil para verificar se o parser está funcionando.

### `GET /api/inspecionar-cache`
Mostra o conteúdo atual do cache com metadados.

### `POST /api/limpar-cache-antigo` / `POST /api/limpar-invalidos`
Utilitários de manutenção do cache.

---

## Cron Jobs

Configurados em `vercel.json` — executados automaticamente pelo Vercel.

| Cron | Schedule | Horário Brasília | O que faz |
|---|---|---|---|
| `atualizar-concursos` | `0 6 * * *` | 03:00 todo dia | Executa scraping completo e atualiza o cache |
| `notificacoes` | `0 9 * * *` | 06:00 todo dia | Envia e-mail de novos concursos (máx. 5/dia) e alerta de prazos |
| `resumo-semanal` | `0 9 * * 0` | 06:00 domingos | Envia resumo semanal por e-mail |
| `publicar-agendados` | `0 9 * * *` | 06:00 todo dia | Publica posts agendados via Instagram Graph API |

**Segurança:** todos os crons verificam o header `Authorization: Bearer CRON_SECRET`. O Vercel injeta esse header automaticamente — chamadas externas sem o secret recebem 401.

**Timeout:** os crons têm `maxDuration: 300` segundos. O cron de notificações tem limite de 5 e-mails por execução para não estourar o timeout.

---

## E-mails automáticos

Configurados via **Resend** (`resend.com` — gratuito até 3.000 e-mails/mês).

### Templates disponíveis

**Novo concurso** — enviado quando um concurso novo é detectado (dentro das últimas 48h e ainda não notificado). Inclui cargo, órgão, UF, salário, vagas, datas e link do edital. Se as inscrições estiverem encerrando em até 7 dias, exibe barra de urgência.

**Alerta de prazo** — enviado quando há concursos com inscrições encerrando em até 3 dias. Enviado no máximo uma vez por dia.

**Resumo semanal** — enviado todo domingo com estatísticas da semana: total de concursos ativos, novos, posts publicados, lista dos novos, lista dos encerrando e lista de provas da semana.

### Configuração

```
FROM_EMAIL=onboarding@resend.dev   # Sandbox do Resend — funciona sem domínio próprio
NOTIFY_EMAIL=seu@email.com         # Para onde os alertas são enviados
RESEND_API_KEY=re_...              # Chave da API do Resend
```

> O `FROM_EMAIL` deve ser `onboarding@resend.dev` (sandbox) ou um domínio verificado no Resend. **Não use Gmail/Outlook** — o Resend bloqueará com erro 403.
>
> Com o sandbox, os e-mails só chegam ao e-mail cadastrado na conta Resend.

---

## Publicação no Instagram

### Fluxo de agendamento

```
1. Usuário abre o painel → seleciona o concurso
2. Clica em "Agendar" → define data/hora e modo (feed, stories ou ambos)
3. O navegador gera as imagens base64 (Satori/Canvas) e salva no banco
4. No horário agendado, o cron publicar-agendados executa:
   a. Faz upload do base64 para o Imgur (URL pública temporária)
   b. Cria container via POST /{ig_id}/media na Graph API
   c. Aguarda status FINISHED (polling)
   d. Publica via POST /{ig_id}/media_publish
   e. Salva post_id no banco e marca como publicado
```

### Publicação manual imediata

No painel, aba **Cards Instagram**:
1. Clique em **⬇️ Baixar PNG** para salvar a imagem
2. Clique em **📋 Legenda** para copiar o texto
3. Poste manualmente no Instagram ou use Buffer/Later para agendar

### Formatos de card

| Formato | Dimensão | Uso |
|---|---|---|
| Feed | 1080×1080px (1:1) | Post no feed |
| Stories | 1080×1920px (9:16) | Stories / Reels |

### Configuração da API

```
IG_ACCESS_TOKEN=EAAx...   # Token de acesso da conta Instagram Business
IG_ACCOUNT_ID=1784...     # ID da conta Instagram Business
```

> O token expira periodicamente — renove via Meta for Developers → Graph API Explorer com a página conectada selecionada.

---

## Página pública /bio

Acessível em `concursos-contabeis.vercel.app/bio` — use como link da bio do Instagram.

Exibe os concursos publicados nos últimos 90 dias, cruzados com o cache atual para mostrar se as inscrições ainda estão abertas. Ordenado por: postados hoje primeiro, depois mais recentes.

---

## Setup e Deploy

### 1. Banco de dados (Supabase)

1. Crie um projeto em [supabase.com](https://supabase.com)
2. No **SQL Editor**, execute o arquivo `supabase-setup-completo.sql`
3. Anote a **URL do projeto** e a **Service Role Key**

### 2. E-mail (Resend)

1. Crie uma conta em [resend.com](https://resend.com)
2. Anote a **API Key** (começa com `re_`)
3. O e-mail da sua conta Resend será o destinatário dos alertas

### 3. GitHub + Vercel

```bash
git init
git add .
git commit -m "feat: painel concursos contabeis"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/concursos-contabeis.git
git push -u origin main
```

No [Vercel](https://vercel.com):
1. **Add New Project** → importe o repositório
2. Adicione as variáveis de ambiente (seção abaixo)
3. Clique em **Deploy**

### 4. Desenvolvimento local

```bash
npm install
cp .env .env.local   # preencha os valores
npm run dev
```

Acesse: `http://localhost:3000`

---

## Variáveis de Ambiente

Configure em **Vercel → Settings → Environment Variables** (e em `.env.local` para desenvolvimento):

```env
# ── Supabase ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ── E-mail (Resend) ───────────────────────────────────────────────────────────
RESEND_API_KEY=re_...
NOTIFY_EMAIL=seu@email.com
FROM_EMAIL=onboarding@resend.dev

# ── Instagram Graph API ───────────────────────────────────────────────────────
IG_ACCESS_TOKEN=EAAx...
IG_ACCOUNT_ID=17841...

# ── Cron Jobs ─────────────────────────────────────────────────────────────────
CRON_SECRET=gere_com_node_crypto_randomBytes_32_hex

# ── URL do app ────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://concursos-contabeis.vercel.app
```

**Gerar CRON_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Manutenção

### Forçar atualização do cache
Acesse no navegador:
```
https://concursos-contabeis.vercel.app/api/concursos?force=1
```

### Diagnosticar scraping
```
https://concursos-contabeis.vercel.app/api/debug
https://concursos-contabeis.vercel.app/api/debug?url=/vagas/auditor-fiscal
```

### Renovar token do Instagram
O token da Graph API expira periodicamente. Para renovar:
1. Acesse [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)
2. Selecione seu app e a **Connected Page** da conta
3. Clique em **Generate Access Token**
4. Atualize `IG_ACCESS_TOKEN` nas variáveis de ambiente do Vercel

### Limpar notificações (forçar reenvio)
```sql
DELETE FROM notificacoes_enviadas;
```
> Use com cautela — na próxima execução do cron, todos os concursos das últimas 48h serão notificados novamente (máximo 5 por execução).

---

## Versão

- **App:** v1.0.0
- **Next.js:** 15.2.8
- **Meta Graph API:** v19.0
- **Deploy:** Vercel — [concursos-contabeis.vercel.app](https://concursos-contabeis.vercel.app)
- **Banco:** Supabase (`zyvdsyivhvavyndpopnb.supabase.co`)
