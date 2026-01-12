-- ============================================================================
-- PRACTICE PROBLEMS CACHE (METADATA ONLY - EMBEDDINGS IN PINECONE)
-- ============================================================================
-- Stores verified practice problem metadata. Embeddings stored in Pinecone.
-- Problems are verified by 3 models (Grok, Sonnet 4.5, GPT) before caching.
-- ============================================================================

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS blueprint_practice_problems CASCADE;
DROP TABLE IF EXISTS practice_problems_cache CASCADE;

-- Main cache table (NO vector column - that goes to Pinecone)
CREATE TABLE practice_problems_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Problem content
  problem_statement TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',
  given_values JSONB,
  hints TEXT[],
  
  -- Verified solution (from Grok - full step-by-step)
  solution_steps TEXT[] NOT NULL,
  final_answer TEXT NOT NULL,
  
  -- Verification metadata
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'disputed', 'pending')),
  models_agreed TEXT[] NOT NULL DEFAULT '{}',
  grok_answer TEXT NOT NULL,
  sonnet_answer TEXT,
  gpt_answer TEXT,
  
  -- Usage tracking
  times_used INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking index
CREATE INDEX idx_practice_problems_cache_times_used 
ON practice_problems_cache(times_used DESC);

-- Verification status index
CREATE INDEX idx_practice_problems_cache_status 
ON practice_problems_cache(verification_status);

-- ============================================================================
-- BLUEPRINT PRACTICE PROBLEMS LINK TABLE
-- ============================================================================

CREATE TABLE blueprint_practice_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  cached_problem_id UUID REFERENCES practice_problems_cache(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT blueprint_practice_problems_unique UNIQUE (blueprint_id, unit_id, cached_problem_id)
);

CREATE INDEX idx_blueprint_practice_problems_blueprint 
ON blueprint_practice_problems(blueprint_id);

CREATE INDEX idx_blueprint_practice_problems_unit 
ON blueprint_practice_problems(unit_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE practice_problems_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_practice_problems ENABLE ROW LEVEL SECURITY;

-- Cache is readable by all authenticated users (shared knowledge base)
CREATE POLICY "practice_problems_cache_read" ON practice_problems_cache
  FOR SELECT TO authenticated USING (true);

-- Service role can insert/update cache (via edge functions)
CREATE POLICY "practice_problems_cache_insert" ON practice_problems_cache
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "practice_problems_cache_update" ON practice_problems_cache
  FOR UPDATE TO service_role USING (true);

-- Blueprint links are scoped to user's blueprints
CREATE POLICY "blueprint_practice_problems_read" ON blueprint_practice_problems
  FOR SELECT TO authenticated
  USING (
    blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
  );

CREATE POLICY "blueprint_practice_problems_insert" ON blueprint_practice_problems
  FOR INSERT TO authenticated
  WITH CHECK (
    blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
  );

CREATE POLICY "blueprint_practice_problems_delete" ON blueprint_practice_problems
  FOR DELETE TO authenticated
  USING (
    blueprint_id IN (SELECT id FROM blueprints WHERE user_id = auth.uid())
  );
