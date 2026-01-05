-- ============================================================================
-- Self-Healing System Infrastructure
-- ============================================================================
-- Creates tables for managing self-healing mode toggle, directive snapshots,
-- error logging, and change tracking.
-- ============================================================================

-- System configuration table for self-healing mode toggle
CREATE TABLE IF NOT EXISTS system_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default self-healing configuration (development mode)
INSERT INTO system_configuration (config_key, config_value) VALUES
('self_healing', '{
  "enabled": true,
  "mode": "development",
  "last_toggled": "2026-01-05T12:00:00Z",
  "snapshot_hash": null
}'::jsonb)
ON CONFLICT (config_key) DO NOTHING;

-- Directive snapshots for production mode locking
CREATE TABLE IF NOT EXISTS directive_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshots JSONB NOT NULL, -- Array of {function_name, file_path, content, hash}
  total_hash TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Function error logging (both development and production modes)
CREATE TABLE IF NOT EXISTS function_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  input_data JSONB,
  error_code TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  healing_mode TEXT NOT NULL CHECK (healing_mode IN ('development', 'production')),
  auto_fix_attempted BOOLEAN DEFAULT false,
  auto_fix_successful BOOLEAN,
  fix_description TEXT,
  fix_committed_at TIMESTAMPTZ,
  admin_notified BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ
);

-- Indexes for efficient error querying
CREATE INDEX IF NOT EXISTS idx_errors_function ON function_errors(function_name);
CREATE INDEX IF NOT EXISTS idx_errors_mode ON function_errors(healing_mode);
CREATE INDEX IF NOT EXISTS idx_errors_timestamp ON function_errors(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_errors_auto_fix ON function_errors(auto_fix_attempted, auto_fix_successful);

-- Directive changes audit trail
CREATE TABLE IF NOT EXISTS directive_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  change_reason TEXT NOT NULL,
  old_content TEXT,
  new_content TEXT,
  changed_by TEXT, -- 'self-healing-agent' or user_id
  changed_at TIMESTAMPTZ DEFAULT now(),
  related_error_id UUID REFERENCES function_errors(id),
  git_commit_hash TEXT,
  approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ
);

-- Index for tracking changes by function
CREATE INDEX IF NOT EXISTS idx_changes_function ON directive_changes(function_name);
CREATE INDEX IF NOT EXISTS idx_changes_date ON directive_changes(changed_at DESC);

-- RLS Policies (restrict to authenticated admin users)
ALTER TABLE system_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE directive_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE function_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE directive_changes ENABLE ROW LEVEL SECURITY;

-- Only service role can access these tables
CREATE POLICY "Service role full access" ON system_configuration
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access" ON directive_snapshots
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access" ON function_errors
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access" ON directive_changes
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Helper function to update system configuration timestamp
CREATE OR REPLACE FUNCTION update_system_configuration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_configuration_timestamp
BEFORE UPDATE ON system_configuration
FOR EACH ROW EXECUTE FUNCTION update_system_configuration_timestamp();

-- Comment the tables for documentation
COMMENT ON TABLE system_configuration IS 'Stores system-wide configuration including self-healing mode toggle';
COMMENT ON TABLE directive_snapshots IS 'Immutable snapshots of all DIRECTIVES.md files for production locking';
COMMENT ON TABLE function_errors IS 'Logs all errors from atomic functions in both development and production modes';
COMMENT ON TABLE directive_changes IS 'Audit trail of all changes made to DIRECTIVES.md files by self-healing or manual edits';

