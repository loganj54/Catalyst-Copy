// ============================================================================
// SELF-HEALING CONFIGURATION
// ============================================================================
// Manages self-healing mode detection and configuration
// ============================================================================

import { createSupabaseClient } from './supabase-client.ts';
import type { HealingMode, SelfHealingConfig } from './types.ts';

/**
 * Get the current self-healing configuration from the database
 */
export async function getSelfHealingMode(): Promise<SelfHealingConfig> {
  const supabase = createSupabaseClient();
  
  try {
    const { data, error } = await supabase
      .from('system_configuration')
      .select('config_value')
      .eq('config_key', 'self_healing')
      .single();
    
    if (error) {
      console.error('[self-healing-config] Error fetching config:', error);
      // Default to development mode if config not found
      return {
        enabled: true,
        mode: 'development',
        last_toggled: new Date().toISOString(),
        snapshot_hash: null,
      };
    }
    
    return data.config_value as SelfHealingConfig;
  } catch (error) {
    console.error('[self-healing-config] Exception fetching config:', error);
    // Default to development mode on error
    return {
      enabled: true,
      mode: 'development',
      last_toggled: new Date().toISOString(),
      snapshot_hash: null,
    };
  }
}

/**
 * Check if self-healing is currently enabled
 * Returns true only in development mode
 */
export async function isHealingEnabled(): Promise<boolean> {
  const config = await getSelfHealingMode();
  return config.enabled && config.mode === 'development';
}

/**
 * Check if system is in production mode
 */
export async function isProductionMode(): Promise<boolean> {
  const config = await getSelfHealingMode();
  return config.mode === 'production';
}

/**
 * Update self-healing configuration
 */
export async function updateSelfHealingConfig(
  newConfig: Partial<SelfHealingConfig>,
  updatedBy?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseClient();
  
  try {
    const currentConfig = await getSelfHealingMode();
    const updatedConfig = { ...currentConfig, ...newConfig };
    
    const { error } = await supabase
      .from('system_configuration')
      .update({
        config_value: updatedConfig,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || null,
      })
      .eq('config_key', 'self_healing');
    
    if (error) {
      console.error('[self-healing-config] Error updating config:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[self-healing-config] Configuration updated:', updatedConfig);
    return { success: true };
  } catch (error) {
    console.error('[self-healing-config] Exception updating config:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Toggle between development and production mode
 */
export async function toggleHealingMode(
  newMode: HealingMode,
  updatedBy?: string
): Promise<{ success: boolean; error?: string; snapshot_hash?: string }> {
  const config = await getSelfHealingMode();
  
  if (config.mode === newMode) {
    return { success: true, error: `Already in ${newMode} mode` };
  }
  
  console.log(`[self-healing-config] Toggling from ${config.mode} to ${newMode}`);
  
  if (newMode === 'production') {
    // Switching to production: create snapshot
    const { createProductionSnapshot } = await import('./production-lock.ts');
    const snapshotHash = await createProductionSnapshot();
    
    const result = await updateSelfHealingConfig({
      enabled: false,
      mode: 'production',
      last_toggled: new Date().toISOString(),
      snapshot_hash: snapshotHash,
    }, updatedBy);
    
    if (result.success) {
      console.log('[self-healing-config] ✅ Production mode enabled, snapshot created');
      return { ...result, snapshot_hash: snapshotHash };
    }
    return result;
  } else {
    // Switching to development: enable healing
    const result = await updateSelfHealingConfig({
      enabled: true,
      mode: 'development',
      last_toggled: new Date().toISOString(),
      // Keep snapshot_hash for reference
    }, updatedBy);
    
    if (result.success) {
      console.log('[self-healing-config] ✅ Development mode enabled');
    }
    return result;
  }
}

