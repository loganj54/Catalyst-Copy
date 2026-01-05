// ============================================================================
// PRODUCTION LOCK SYSTEM
// ============================================================================
// Creates immutable snapshots of DIRECTIVES.md files and verifies integrity
// ============================================================================

import { createSupabaseClient } from './supabase-client.ts';
import { getSelfHealingMode } from './self-healing-config.ts';
import type { DirectiveSnapshot } from './types.ts';

/**
 * Create a production snapshot of all DIRECTIVES.md files
 * Returns the total hash for integrity verification
 */
export async function createProductionSnapshot(): Promise<string> {
  console.log('[production-lock] Creating production snapshot...');
  
  const snapshots: DirectiveSnapshot[] = [];
  const functionsDir = 'supabase/functions';
  
  try {
    // Walk through all function directories
    for await (const entry of Deno.readDir(functionsDir)) {
      if (entry.isDirectory && !entry.name.startsWith('_')) {
        const directivePath = `${functionsDir}/${entry.name}/DIRECTIVES.md`;
        
        try {
          const content = await Deno.readTextFile(directivePath);
          const hash = await hashString(content);
          
          snapshots.push({
            function_name: entry.name,
            file_path: directivePath,
            content: content,
            hash: hash,
          });
          
          console.log(`[production-lock] ✓ Snapshotted: ${entry.name}`);
        } catch (error) {
          // DIRECTIVES.md doesn't exist for this function yet - skip
          console.log(`[production-lock] ⚠ No DIRECTIVES.md for ${entry.name}`);
        }
      }
    }
    
    if (snapshots.length === 0) {
      console.warn('[production-lock] No DIRECTIVES.md files found!');
      return '';
    }
    
    // Create total hash from all snapshots
    const totalHash = await hashString(JSON.stringify(snapshots));
    
    // Store snapshot in database
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from('directive_snapshots')
      .insert({
        snapshot_date: new Date().toISOString(),
        snapshots: snapshots,
        total_hash: totalHash,
        notes: `Production lock created with ${snapshots.length} directives`,
      });
    
    if (error) {
      console.error('[production-lock] Error storing snapshot:', error);
      throw new Error(`Failed to store snapshot: ${error.message}`);
    }
    
    console.log(`[production-lock] ✅ Snapshot created: ${totalHash}`);
    console.log(`[production-lock] Total directives locked: ${snapshots.length}`);
    
    return totalHash;
  } catch (error) {
    console.error('[production-lock] Error creating snapshot:', error);
    throw error;
  }
}

/**
 * Verify production integrity by comparing current directives to snapshot
 * Returns true if all directives match the snapshot
 */
export async function verifyProductionIntegrity(): Promise<boolean> {
  const config = await getSelfHealingMode();
  
  if (!config.snapshot_hash) {
    console.warn('[production-lock] No snapshot hash found');
    return false;
  }
  
  console.log('[production-lock] Verifying production integrity...');
  
  try {
    // Get current directive hashes
    const currentSnapshots = await getCurrentDirectiveHashes();
    const currentHash = await hashString(JSON.stringify(currentSnapshots));
    
    const isIntact = currentHash === config.snapshot_hash;
    
    if (isIntact) {
      console.log('[production-lock] ✅ Integrity check PASSED');
    } else {
      console.error('[production-lock] ⚠️ INTEGRITY CHECK FAILED!');
      console.error('[production-lock] Expected hash:', config.snapshot_hash);
      console.error('[production-lock] Current hash:', currentHash);
    }
    
    return isIntact;
  } catch (error) {
    console.error('[production-lock] Error verifying integrity:', error);
    return false;
  }
}

/**
 * Get current hashes of all DIRECTIVES.md files
 */
async function getCurrentDirectiveHashes(): Promise<DirectiveSnapshot[]> {
  const snapshots: DirectiveSnapshot[] = [];
  const functionsDir = 'supabase/functions';
  
  for await (const entry of Deno.readDir(functionsDir)) {
    if (entry.isDirectory && !entry.name.startsWith('_')) {
      const directivePath = `${functionsDir}/${entry.name}/DIRECTIVES.md`;
      
      try {
        const content = await Deno.readTextFile(directivePath);
        const hash = await hashString(content);
        
        snapshots.push({
          function_name: entry.name,
          file_path: directivePath,
          content: content,
          hash: hash,
        });
      } catch {
        // File doesn't exist - skip
      }
    }
  }
  
  // Sort by function name for consistent hashing
  return snapshots.sort((a, b) => a.function_name.localeCompare(b.function_name));
}

/**
 * Hash a string using SHA-256
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Alert admin about integrity failure
 */
export async function alertIntegrityFailure(): Promise<void> {
  console.error('[production-lock] 🚨 CRITICAL: Production directives have been tampered with!');
  
  const supabase = createSupabaseClient();
  
  // Log to function_errors table
  await supabase.from('function_errors').insert({
    function_name: 'production-integrity-check',
    error_message: 'Production directive integrity check FAILED - files have been modified',
    error_code: 'INTEGRITY_ERROR',
    healing_mode: 'production',
    auto_fix_attempted: false,
    admin_notified: true,
    notification_sent_at: new Date().toISOString(),
  });
  
  // In a real implementation, send email/Slack notification here
  // For now, just log the critical error
}

