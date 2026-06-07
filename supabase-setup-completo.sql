-- ============================================================
-- SETUP COMPLETO DO BANCO — Concursos Contábeis
-- Seguro para rodar múltiplas vezes (idempotente)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ── 1. Cache dos concursos scrapeados ────────────────────────
CREATE TABLE IF NOT EXISTS cache_concursos (
  chave       TEXT PRIMARY KEY,
  dados       JSONB        NOT NULL,
  atualizado  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 2. Histórico de posts publicados ─────────────────────────
CREATE TABLE IF NOT EXISTS historico_posts (
  id          BIGSERIAL    PRIMARY KEY,
  concurso_id TEXT         NOT NULL,
  cargo       TEXT         NOT NULL,
  orgao       TEXT         NOT NULL,
  estado      TEXT         NOT NULL,
  posted_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historico_concurso_id
  ON historico_posts (concurso_id, posted_at DESC);

-- ── 3. Favoritos ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favoritos (
  id          BIGSERIAL    PRIMARY KEY,
  concurso_id TEXT         NOT NULL UNIQUE,
  cargo       TEXT         NOT NULL,
  orgao       TEXT         NOT NULL,
  estado      TEXT         NOT NULL,
  nota        TEXT,
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 4. Notificações por e-mail ───────────────────────────────
CREATE TABLE IF NOT EXISTS notificacoes_enviadas (
  id          BIGSERIAL    PRIMARY KEY,
  tipo        TEXT         NOT NULL,
  concurso_id TEXT,
  enviado_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_tipo_data
  ON notificacoes_enviadas (tipo, enviado_em DESC);

CREATE INDEX IF NOT EXISTS idx_notif_concurso
  ON notificacoes_enviadas (concurso_id);

-- ── 5. Agendamentos de publicação ────────────────────────────
CREATE TABLE IF NOT EXISTS agendamentos_posts (
  id               BIGSERIAL    PRIMARY KEY,
  concurso_id      TEXT         NOT NULL,
  cargo            TEXT         NOT NULL,
  orgao            TEXT         NOT NULL,
  estado           TEXT         NOT NULL,
  modo             TEXT         NOT NULL CHECK (modo IN ('feed','stories','ambos')),
  agendado_para    TIMESTAMPTZ  NOT NULL,
  -- Imagens geradas no navegador (limpas após publicação)
  feed_base64      TEXT,
  stories_base64   TEXT,
  legenda          TEXT,
  -- Resultado
  publicado        BOOLEAN      NOT NULL DEFAULT false,
  publicado_em     TIMESTAMPTZ,
  post_id_feed     TEXT,
  post_id_stories  TEXT,
  tentativas       INT          NOT NULL DEFAULT 0,
  criado_em        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Adiciona colunas se a tabela já existia sem elas
ALTER TABLE agendamentos_posts ADD COLUMN IF NOT EXISTS feed_base64     TEXT;
ALTER TABLE agendamentos_posts ADD COLUMN IF NOT EXISTS stories_base64  TEXT;
ALTER TABLE agendamentos_posts ADD COLUMN IF NOT EXISTS legenda         TEXT;
ALTER TABLE agendamentos_posts ADD COLUMN IF NOT EXISTS tentativas     INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_agendamentos_data
  ON agendamentos_posts (agendado_para);

CREATE INDEX IF NOT EXISTS idx_agendamentos_publicado
  ON agendamentos_posts (publicado);

-- ── 6. Row Level Security ────────────────────────────────────
ALTER TABLE cache_concursos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE favoritos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes_enviadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos_posts    ENABLE ROW LEVEL SECURITY;

-- Nega acesso anônimo
DROP POLICY IF EXISTS "deny anon cache"      ON cache_concursos;
DROP POLICY IF EXISTS "deny anon historico"  ON historico_posts;
DROP POLICY IF EXISTS "deny anon favoritos"  ON favoritos;
DROP POLICY IF EXISTS "deny anon notif"      ON notificacoes_enviadas;

CREATE POLICY "deny anon cache"     ON cache_concursos       FOR ALL TO anon USING (false);
CREATE POLICY "deny anon historico" ON historico_posts        FOR ALL TO anon USING (false);
CREATE POLICY "deny anon favoritos" ON favoritos              FOR ALL TO anon USING (false);
CREATE POLICY "deny anon notif"     ON notificacoes_enviadas  FOR ALL TO anon USING (false);

-- Permite acesso total pelo service_role (usado pelo Vercel)
DROP POLICY IF EXISTS "service role full access agendamentos" ON agendamentos_posts;
CREATE POLICY "service role full access agendamentos"
  ON agendamentos_posts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Colunas cidade e uf (adicionadas para filtro e exibição) ─────────────────
-- Execute após o setup inicial se a tabela já existia
ALTER TABLE historico_posts ADD COLUMN IF NOT EXISTS cidade TEXT NOT NULL DEFAULT '';
ALTER TABLE historico_posts ADD COLUMN IF NOT EXISTS uf     TEXT NOT NULL DEFAULT '';

ALTER TABLE favoritos ADD COLUMN IF NOT EXISTS cidade TEXT NOT NULL DEFAULT '';
ALTER TABLE favoritos ADD COLUMN IF NOT EXISTS uf     TEXT NOT NULL DEFAULT '';

ALTER TABLE agendamentos_posts ADD COLUMN IF NOT EXISTS cidade TEXT NOT NULL DEFAULT '';
ALTER TABLE agendamentos_posts ADD COLUMN IF NOT EXISTS uf     TEXT NOT NULL DEFAULT '';

-- Índice para filtro por UF/cidade
CREATE INDEX IF NOT EXISTS idx_historico_estado ON historico_posts (estado);
CREATE INDEX IF NOT EXISTS idx_favoritos_estado  ON favoritos (estado);
