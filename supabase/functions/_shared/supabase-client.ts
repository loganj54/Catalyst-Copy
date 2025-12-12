import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Create a Supabase client with the service role key for admin operations
export function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Create a client with the user's JWT for authenticated operations
export function createSupabaseClientWithAuth(authHeader: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ============================================================================
// CLAUDE API HELPER
// ============================================================================
// Uses Claude Haiku 3.5 for fast, cost-effective AI analysis
// ============================================================================

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_MODEL = 'claude-3-5-haiku-latest';

export interface ClaudeResponse {
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export async function callClaude(
  systemPrompt: string, 
  userPrompt: string,
  options?: {
    maxTokens?: number;
    temperature?: number;
  }
): Promise<ClaudeResponse> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set. Run: supabase secrets set ANTHROPIC_API_KEY=your-key');
  }

  const maxTokens = options?.maxTokens ?? 4096;
  const temperature = options?.temperature ?? 0.3;

  console.log('Calling Claude API...');
  console.log('Model:', CLAUDE_MODEL);
  console.log('System prompt length:', systemPrompt.length);
  console.log('User prompt length:', userPrompt.length);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      temperature: temperature,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    }),
  });

  console.log('Claude response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API error:', response.status, errorText);
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  // Extract text content from Claude's response format
  const textContent = data.content?.find((block: any) => block.type === 'text');
  if (!textContent) {
    console.error('No text content in Claude response:', JSON.stringify(data));
    throw new Error('No text content returned from Claude');
  }

  console.log('Claude response received, tokens used:', data.usage);

  return {
    content: textContent.text,
    usage: data.usage,
  };
}

// Helper to call Claude and parse JSON response
export async function callClaudeJSON<T = any>(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    maxTokens?: number;
    temperature?: number;
  }
): Promise<T> {
  // Add JSON instruction to system prompt
  const jsonSystemPrompt = `${systemPrompt}

IMPORTANT: You must respond with valid JSON only. No markdown, no explanation, just the JSON object.`;

  const response = await callClaude(jsonSystemPrompt, userPrompt, options);
  
  try {
    // Try to extract JSON from the response (handle potential markdown wrapping)
    let jsonStr = response.content.trim();
    
    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    return JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('Failed to parse Claude JSON response:', response.content.substring(0, 500));
    throw new Error(`Failed to parse Claude response as JSON: ${parseError}`);
  }
}

// ============================================================================
// CLAUDE PDF VISION API
// ============================================================================
// Uses Claude's vision capabilities to analyze PDF documents directly
// Supports images, figures, diagrams, equations, and all visual content
// ============================================================================

export interface PdfDocument {
  base64Data: string;
  mediaType: 'application/pdf';
  filename?: string;
}

export interface ImageDocument {
  base64Data: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  filename?: string;
}

// Call Claude with a PDF document using vision capabilities
export async function callClaudeWithPDF<T = any>(
  systemPrompt: string,
  userPrompt: string,
  pdfDocument: PdfDocument,
  options?: {
    maxTokens?: number;
    temperature?: number;
  }
): Promise<T> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set. Run: supabase secrets set ANTHROPIC_API_KEY=your-key');
  }

  const maxTokens = options?.maxTokens ?? 4096;
  const temperature = options?.temperature ?? 0.3;

  // Add JSON instruction to system prompt
  const jsonSystemPrompt = `${systemPrompt}

IMPORTANT: You must respond with valid JSON only. No markdown, no explanation, just the JSON object.`;

  console.log('Calling Claude API with PDF document...');
  console.log('Model:', CLAUDE_MODEL);
  console.log('PDF size (base64 chars):', pdfDocument.base64Data.length);
  console.log('Filename:', pdfDocument.filename || '(unknown)');

  // Build the message content with the PDF document
  const messageContent = [
    {
      type: 'document',
      source: {
        type: 'base64',
        media_type: pdfDocument.mediaType,
        data: pdfDocument.base64Data,
      },
      // Cache the PDF for efficiency if it's large
      ...(pdfDocument.base64Data.length > 100000 ? { cache_control: { type: 'ephemeral' } } : {}),
    },
    {
      type: 'text',
      text: userPrompt,
    },
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25', // Enable PDF support beta
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      temperature: temperature,
      system: jsonSystemPrompt,
      messages: [
        { 
          role: 'user', 
          content: messageContent,
        }
      ],
    }),
  });

  console.log('Claude response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API error:', response.status, errorText);
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  // Extract text content from Claude's response format
  const textContent = data.content?.find((block: any) => block.type === 'text');
  if (!textContent) {
    console.error('No text content in Claude response:', JSON.stringify(data));
    throw new Error('No text content returned from Claude');
  }

  console.log('Claude PDF analysis complete, tokens used:', data.usage);

  // Parse the JSON response
  try {
    let jsonStr = textContent.text.trim();
    
    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    return JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('Failed to parse Claude JSON response:', textContent.text.substring(0, 500));
    throw new Error(`Failed to parse Claude response as JSON: ${parseError}`);
  }
}

// Call Claude with PDF and additional text context
export async function callClaudeWithPDFAndText<T = any>(
  systemPrompt: string,
  userPrompt: string,
  pdfDocument: PdfDocument | null,
  additionalText: string | null,
  options?: {
    maxTokens?: number;
    temperature?: number;
  }
): Promise<T> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set. Run: supabase secrets set ANTHROPIC_API_KEY=your-key');
  }

  // If no PDF, just use regular text call
  if (!pdfDocument) {
    const fullPrompt = additionalText 
      ? `${userPrompt}\n\nADDITIONAL CONTEXT:\n${additionalText}`
      : userPrompt;
    return callClaudeJSON<T>(systemPrompt, fullPrompt, options);
  }

  const maxTokens = options?.maxTokens ?? 4096;
  const temperature = options?.temperature ?? 0.3;

  // Add JSON instruction to system prompt
  const jsonSystemPrompt = `${systemPrompt}

IMPORTANT: You must respond with valid JSON only. No markdown, no explanation, just the JSON object.`;

  console.log('Calling Claude API with PDF + text...');
  console.log('Model:', CLAUDE_MODEL);
  console.log('PDF size (base64 chars):', pdfDocument.base64Data.length);
  console.log('Additional text length:', additionalText?.length || 0);

  // Build the message content
  const messageContent: any[] = [
    {
      type: 'document',
      source: {
        type: 'base64',
        media_type: pdfDocument.mediaType,
        data: pdfDocument.base64Data,
      },
      ...(pdfDocument.base64Data.length > 100000 ? { cache_control: { type: 'ephemeral' } } : {}),
    },
  ];

  // Add the user prompt with any additional text context
  const fullPrompt = additionalText 
    ? `${userPrompt}\n\nADDITIONAL CONTEXT PROVIDED BY STUDENT:\n${additionalText}`
    : userPrompt;

  messageContent.push({
    type: 'text',
    text: fullPrompt,
  });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      temperature: temperature,
      system: jsonSystemPrompt,
      messages: [
        { 
          role: 'user', 
          content: messageContent,
        }
      ],
    }),
  });

  console.log('Claude response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API error:', response.status, errorText);
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  const textContent = data.content?.find((block: any) => block.type === 'text');
  if (!textContent) {
    console.error('No text content in Claude response:', JSON.stringify(data));
    throw new Error('No text content returned from Claude');
  }

  console.log('Claude PDF+text analysis complete, tokens used:', data.usage);

  // Parse the JSON response
  try {
    let jsonStr = textContent.text.trim();
    
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    return JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('Failed to parse Claude JSON response:', textContent.text.substring(0, 500));
    throw new Error(`Failed to parse Claude response as JSON: ${parseError}`);
  }
}

// Helper to convert ArrayBuffer to base64 string
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}


