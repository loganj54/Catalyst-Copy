// ============================================================================
// ERROR WRAPPER WITH SELF-HEALING
// ============================================================================
// Wraps function handlers to automatically log errors and trigger self-healing
// ============================================================================

import { createSupabaseClient } from './supabase-client.ts';
import { isHealingEnabled, getSelfHealingMode } from './self-healing-config.ts';
import type { ErrorContext } from './types.ts';

/**
 * Wrap a function handler with self-healing error handling
 * 
 * Usage:
 * ```typescript
 * serve(withSelfHealing('function-name', async (input) => {
 *   // Your function logic here
 * }));
 * ```
 */
export function withSelfHealing<TInput, TOutput>(
  functionName: string,
  handler: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    try {
      return await handler(input);
    } catch (error) {
      const config = await getSelfHealingMode();
      
      // Log error to database
      const errorId = await logError({
        function_name: functionName,
        error_message: error.message || String(error),
        error_stack: error.stack || '',
        input_data: input,
        timestamp: new Date().toISOString(),
      });
      
      // Development mode: Attempt self-healing
      if (await isHealingEnabled()) {
        console.log(`[${functionName}] 🔧 Development mode: Attempting self-heal...`);
        
        // Run self-healing in background (don't block error response)
        attemptSelfHeal({
          function_name: functionName,
          error_id: errorId,
          error_message: error.message || String(error),
          error_stack: error.stack || '',
          input_data: input,
          timestamp: new Date().toISOString(),
        }).catch(healError => {
          console.error(`[${functionName}] Self-healing failed:`, healError);
        });
      } else {
        // Production mode: Log only, alert admin
        console.log(`[${functionName}] 🔒 Production mode: Error logged, no healing attempted`);
        
        await alertAdmin({
          function: functionName,
          error: error.message || String(error),
          error_id: errorId,
          timestamp: new Date().toISOString(),
        });
      }
      
      // Re-throw original error to caller
      throw error;
    }
  };
}

/**
 * Log error to the function_errors table
 */
async function logError(context: ErrorContext): Promise<string> {
  const supabase = createSupabaseClient();
  const config = await getSelfHealingMode();
  
  try {
    const { data, error } = await supabase
      .from('function_errors')
      .insert({
        function_name: context.function_name,
        error_message: context.error_message,
        error_stack: context.error_stack,
        input_data: context.input_data,
        error_code: extractErrorCode(context.error_message),
        timestamp: new Date().toISOString(),
        healing_mode: config.mode,
        auto_fix_attempted: false,
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('[error-wrapper] Failed to log error:', error);
      return '';
    }
    
    return data?.id || '';
  } catch (error) {
    console.error('[error-wrapper] Exception logging error:', error);
    return '';
  }
}

/**
 * Attempt self-healing (runs in background)
 */
async function attemptSelfHeal(context: ErrorContext): Promise<void> {
  console.log(`[self-heal] Starting self-heal for ${context.function_name}...`);
  
  try {
    // Import self-healing agent (lazy load to avoid circular deps)
    const { healFunction } = await import('./self-healing-agent.ts');
    
    const result = await healFunction(context);
    
    if (result.success) {
      console.log(`[self-heal] ✅ Successfully healed ${context.function_name}`);
      
      // Update error log with fix info
      if (context.error_id) {
        const supabase = createSupabaseClient();
        await supabase
          .from('function_errors')
          .update({
            auto_fix_attempted: true,
            auto_fix_successful: true,
            fix_description: result.fix_description,
            fix_committed_at: new Date().toISOString(),
          })
          .eq('id', context.error_id);
      }
    } else {
      console.error(`[self-heal] ❌ Failed to heal ${context.function_name}`);
      
      // Update error log
      if (context.error_id) {
        const supabase = createSupabaseClient();
        await supabase
          .from('function_errors')
          .update({
            auto_fix_attempted: true,
            auto_fix_successful: false,
            fix_description: result.fix_description || 'Self-healing failed',
          })
          .eq('id', context.error_id);
      }
    }
  } catch (healError) {
    console.error('[self-heal] Exception during self-heal:', healError);
  }
}

/**
 * Alert admin about an error
 */
async function alertAdmin(params: {
  function: string;
  error: string;
  error_id: string;
  timestamp: string;
}): Promise<void> {
  console.error(`[alert] 🚨 PRODUCTION ERROR in ${params.function}:`);
  console.error(`[alert] Error: ${params.error}`);
  console.error(`[alert] Error ID: ${params.error_id}`);
  console.error(`[alert] Time: ${params.timestamp}`);
  
  // Mark as admin notified in database
  const supabase = createSupabaseClient();
  await supabase
    .from('function_errors')
    .update({
      admin_notified: true,
      notification_sent_at: new Date().toISOString(),
    })
    .eq('id', params.error_id);
  
  // In real implementation, send email/Slack notification here
  // For now, console logging is sufficient
}

/**
 * Extract error code from error message
 */
function extractErrorCode(message: string): string | null {
  // Common patterns
  if (message.includes('API key')) return 'MISSING_API_KEY';
  if (message.includes('timeout') || message.includes('TIMEOUT')) return 'TIMEOUT';
  if (message.includes('rate limit') || message.includes('429')) return 'RATE_LIMITED';
  if (message.includes('database') || message.includes('DB')) return 'DATABASE_ERROR';
  if (message.includes('not found') || message.includes('404')) return 'NOT_FOUND';
  if (message.includes('invalid') || message.includes('validation')) return 'INVALID_INPUT';
  
  return null;
}

