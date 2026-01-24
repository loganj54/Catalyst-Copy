-- ============================================================================
-- CREATE DEEP DIVE SOLUTIONS TABLE
-- ============================================================================
-- Stores generated Deep Dive Guide solutions for blueprint units
-- so they persist across page refreshes

CREATE TABLE IF NOT EXISTS blueprint_deep_dive_solutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  solution_markdown TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blueprint_id, unit_id)
);

-- Enable RLS
ALTER TABLE blueprint_deep_dive_solutions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view solutions for their own blueprints
CREATE POLICY "Users can view their own deep dive solutions"
  ON blueprint_deep_dive_solutions FOR SELECT
  USING (
    blueprint_id IN (
      SELECT id FROM blueprints WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert solutions for their own blueprints
CREATE POLICY "Users can insert deep dive solutions"
  ON blueprint_deep_dive_solutions FOR INSERT
  WITH CHECK (
    blueprint_id IN (
      SELECT id FROM blueprints WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update solutions for their own blueprints
CREATE POLICY "Users can update deep dive solutions"
  ON blueprint_deep_dive_solutions FOR UPDATE
  USING (
    blueprint_id IN (
      SELECT id FROM blueprints WHERE user_id = auth.uid()
    )
  );

-- Index for faster lookups
CREATE INDEX idx_deep_dive_blueprint_unit ON blueprint_deep_dive_solutions(blueprint_id, unit_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_deep_dive_solutions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_deep_dive_solutions_timestamp
  BEFORE UPDATE ON blueprint_deep_dive_solutions
  FOR EACH ROW
  EXECUTE FUNCTION update_deep_dive_solutions_updated_at();
