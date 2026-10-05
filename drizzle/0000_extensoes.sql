-- Extensões usadas na busca textual (palavras-chave sem acento).
CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint
-- unaccent() não é IMMUTABLE; este invólucro permite usá-la em índices e consultas.
CREATE OR REPLACE FUNCTION radar_unaccent(texto text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, texto) $$;
