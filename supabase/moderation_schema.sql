-- ─────────────────────────────────────────────────────────────────────────────
-- Bookie — Moderation word list
-- Run this AFTER topics_schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS moderation_words (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word       text NOT NULL UNIQUE,
  enabled    boolean NOT NULL DEFAULT true,
  added_at   timestamptz NOT NULL DEFAULT now(),
  added_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE moderation_words ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed by the comment filter)
CREATE POLICY "moderation_words_select" ON moderation_words
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only super admins can insert/update/delete
CREATE POLICY "moderation_words_insert" ON moderation_words
  FOR INSERT WITH CHECK (is_super_admin());

CREATE POLICY "moderation_words_update" ON moderation_words
  FOR UPDATE USING (is_super_admin());

CREATE POLICY "moderation_words_delete" ON moderation_words
  FOR DELETE USING (is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed default word list (duplicates are silently ignored via ON CONFLICT)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO moderation_words (word) VALUES
  ('shit'), ('shitting'), ('shitted'),
  ('fuck'), ('fucking'), ('fucked'), ('fucker'), ('fucks'),
  ('cunt'), ('cunts'),
  ('pussy'), ('pussies'),
  ('faggot'), ('faggots'), ('fag'),
  ('masturbate'), ('masturbating'), ('masturbation'),
  ('prostitute'), ('prostitutes'),
  ('penis'), ('penises'),
  ('vagina'), ('vaginas'),
  ('testicles'), ('testicle'),
  ('cum'), ('cumming'),
  ('ass'), ('asses'), ('asshole'), ('assholes'),
  ('bitch'), ('bitches'),
  ('cock'), ('cocks'),
  ('dick'), ('dicks'),
  ('whore'), ('whores'),
  ('bastard'), ('bastards'),
  ('motherfucker'), ('motherfuckers'),
  ('nigger'), ('niggers'),
  ('slut'), ('sluts'),
  ('prick'), ('pricks'),
  ('wanker'), ('wankers'),
  ('twat'), ('twats')
ON CONFLICT (word) DO NOTHING;
