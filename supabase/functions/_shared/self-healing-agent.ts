// ============================================================================
// SELF-HEALING AGENT
// ============================================================================
// AI-powered error analysis and automatic fix generation
// ============================================================================

import { createSupabaseClient } from './supabase-client.ts';
import type { ErrorContext, HealingResult } from './types.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_MODEL = 'claude-sonnet-4';

/**
 * Analyze an error and attempt to heal the function
 * This is the main entry point for the self-healing system
 */
export async function healFunction(context: ErrorContext): Promise<HealingResult> {
  console.log(`[healing-agent] Analyzing error in ${context.function_name}...`);
  
  if (!ANTHROPIC_API_KEY) {
    return {
      success: false,
      directives_updated: false,
      code_updated: false,
      fix_description: 'No Anthropic API key configured',
    };
  }
  
  try {
    // 1. Read current DIRECTIVES.md
    const directivesPath = `supabase/functions/${context.function_name}/DIRECTIVES.md`;
    let currentDirectives = '';
    
    try {
      currentDirectives = await Deno.readTextFile(directivesPath);
    } catch {
      console.log('[healing-agent] No DIRECTIVES.md found - will create one');
    }
    
    // 2. Read current index.ts
    const codePath = `supabase/functions/${context.function_name}/index.ts`;
    let currentCode = '';
    
    try {
      currentCode = await Deno.readTextFile(codePath);
    } catch {
      console.error('[healing-agent] No index.ts found - cannot heal');
      return {
        success: false,
        directives_updated: false,
        code_updated: false,
        fix_description: 'Function code file not found',
      };
    }
    
    // 3. Call Claude to analyze error and generate fix
    const analysis = await analyzeErrorWithClaude({
      function_name: context.function_name,
      error_message: context.error_message,
      error_stack: context.error_stack,
      input_data: context.input_data,
      current_directives: currentDirectives,
      current_code: currentCode,
    });
    
    if (!analysis.success) {
      return {
        success: false,
        directives_updated: false,
        code_updated: false,
        fix_description: analysis.reasoning || 'AI analysis failed',
      };
    }
    
    // 4. Update DIRECTIVES.md if needed
    let directivesUpdated = false;
    if (analysis.updated_directives && analysis.updated_directives !== currentDirectives) {
      console.log('[healing-agent] Updating DIRECTIVES.md...');
      
      await Deno.writeTextFile(directivesPath, analysis.updated_directives);
      directivesUpdated = true;
      
      // Log the change
      await logDirectiveChange({
        function_name: context.function_name,
        change_reason: `Auto-fix for error: ${context.error_message.substring(0, 100)}`,
        old_content: currentDirectives,
        new_content: analysis.updated_directives,
        changed_by: 'self-healing-agent',
        related_error_id: context.error_id,
      });
    }
    
    // 5. Optionally update code (TODO: implement with caution)
    // For now, we only update DIRECTIVES.md
    // Code updates would require testing before committing
    
    // 6. Git commit if changes were made
    let gitCommitHash: string | undefined;
    if (directivesUpdated) {
      gitCommitHash = await gitCommitChanges(
        context.function_name,
        `[SELF-HEAL] Fixed: ${context.error_message.substring(0, 80)}`
      );
    }
    
    return {
      success: true,
      directives_updated: directivesUpdated,
      code_updated: false,
      new_directives: analysis.updated_directives,
      fix_description: analysis.fix_summary || 'Directives updated with error handling improvements',
      git_commit_hash: gitCommitHash,
    };
  } catch (error) {
    console.error('[healing-agent] Error during healing:', error);
    return {
      success: false,
      directives_updated: false,
      code_updated: false,
      fix_description: `Healing failed: ${error.message}`,
    };
  }
}

/**
 * Call Claude to analyze the error and propose fixes
 */
async function analyzeErrorWithClaude(params: {
  function_name: string;
  error_message: string;
  error_stack: string;
  input_data: any;
  current_directives: string;
  current_code: string;
}): Promise<{
  success: boolean;
  reasoning?: string;
  updated_directives?: string;
  updated_code?: string;
  fix_summary?: string;
}> {
  const systemPrompt = `You are a self-healing code agent that fixes errors automatically.

Your job is to:
1. Analyze the error that occurred
2. Identify the root cause
3. Update the DIRECTIVES.md file to document the error and fix
4. Optionally suggest code changes (but be conservative)

CRITICAL RULES:
- Be conservative with code changes - only suggest if you're 100% sure
- Always update DIRECTIVES.md to add the error to "Known Issues & Fixes" section
- Include specific error message, cause, solution, and date in the fix documentation
- Update "Error Handling" section if this is a new type of error
- Keep all existing content in DIRECTIVES.md, just add new sections

OUTPUT FORMAT (JSON):
{
  "success": true/false,
  "reasoning": "Explanation of what happened and why",
  "updated_directives": "Full updated DIRECTIVES.md content",
  "updated_code": null (or code if safe to change),
  "fix_summary": "One sentence summary of the fix"
}`;

  const userPrompt = `Analyze this error and update the directives:

FUNCTION: ${params.function_name}

ERROR MESSAGE:
${params.error_message}

ERROR STACK:
${params.error_stack}

INPUT THAT CAUSED ERROR:
${JSON.stringify(params.input_data, null, 2)}

CURRENT DIRECTIVES.md:
${params.current_directives || '(No directives file yet)'}

CURRENT CODE (first 2000 chars):
${params.current_code.substring(0, 2000)}

Please analyze this error and generate:
1. Updated DIRECTIVES.md with the error documented in "Known Issues & Fixes"
2. Updated "Error Handling" section if this is a new error type
3. Any code fixes if absolutely necessary (be very conservative)

Return valid JSON only.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 8192,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[healing-agent] Claude API error:', response.status, errorText);
      return {
        success: false,
        reasoning: `Claude API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const textContent = data.content?.find((block: any) => block.type === 'text')?.text || '';
    
    // Extract JSON from response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[healing-agent] No JSON found in Claude response');
      return {
        success: false,
        reasoning: 'Could not parse Claude response',
      };
    }

    const result = JSON.parse(jsonMatch[0]);
    console.log('[healing-agent] Claude analysis complete');
    
    return result;
  } catch (error) {
    console.error('[healing-agent] Error calling Claude:', error);
    return {
      success: false,
      reasoning: `Failed to call Claude: ${error.message}`,
    };
  }
}

/**
 * Log a directive change to the audit trail
 */
async function logDirectiveChange(params: {
  function_name: string;
  change_reason: string;
  old_content: string;
  new_content: string;
  changed_by: string;
  related_error_id?: string;
}): Promise<void> {
  const supabase = createSupabaseClient();
  
  await supabase.from('directive_changes').insert({
    function_name: params.function_name,
    change_reason: params.change_reason,
    old_content: params.old_content,
    new_content: params.new_content,
    changed_by: params.changed_by,
    related_error_id: params.related_error_id || null,
    changed_at: new Date().toISOString(),
  });
}

/**
 * Commit changes to git with a tagged message
 */
async function gitCommitChanges(functionName: string, message: string): Promise<string | undefined> {
  try {
    // Stage the DIRECTIVES.md file
    const addProcess = new Deno.Command('git', {
      args: ['add', `supabase/functions/${functionName}/DIRECTIVES.md`],
    });
    await addProcess.output();
    
    // Commit with tagged message
    const commitProcess = new Deno.Command('git', {
      args: ['commit', '-m', message],
    });
    await commitProcess.output();
    
    // Get the commit hash
    const hashProcess = new Deno.Command('git', {
      args: ['rev-parse', '--short', 'HEAD'],
      stdout: 'piped',
    });
    const hashOutput = await hashProcess.output();
    const commitHash = new TextDecoder().decode(hashOutput.stdout).trim();
    
    console.log(`[healing-agent] ✅ Git commit created: ${commitHash}`);
    return commitHash;
  } catch (error) {
    console.error('[healing-agent] Error committing to git:', error);
    return undefined;
  }
}

