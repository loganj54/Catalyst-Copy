
import { corsHeaders } from './cors.ts';

// Default to the specific model requested by user, or fallback to beta
// User requested: "Grok 4.1 Fast Reasoning Model"
// Based on existing code using "grok-4-1-fast-non-reasoning", we assume the ID is:
export const GROK_MODEL_REASONING = 'grok-4-1-fast-reasoning';
export const GROK_MODEL_VISION = 'grok-2-vision-1212'; // Best guess for vision if needed

const XAI_API_KEY = Deno.env.get('XAI_API_KEY');

export interface GrokResponse {
    content: string;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export async function callGrok(
    systemPrompt: string,
    userPrompt: string,
    options?: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
    }
): Promise<GrokResponse> {
    if (!XAI_API_KEY) {
        throw new Error('XAI_API_KEY is not set. Run: supabase secrets set XAI_API_KEY=your-key');
    }

    const model = options?.model ?? GROK_MODEL_REASONING;
    const maxTokens = options?.maxTokens ?? 4096;
    const temperature = options?.temperature ?? 0.7;

    console.log(`Calling Grok API (Model: ${model})...`);

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${XAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model,
            max_tokens: maxTokens,
            temperature: temperature,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            stream: false
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Grok API error:', response.status, errorText);
        throw new Error(`Grok API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
        throw new Error('No content returned from Grok');
    }

    // console.log('Grok response received, usage:', data.usage);

    return {
        content: content,
        usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    };
}

// Helper to call Grok and parse JSON response
export async function callGrokJSON<T = any>(
    systemPrompt: string,
    userPrompt: string,
    options?: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
    }
): Promise<T> {
    const jsonSystemPrompt = `${systemPrompt}

CRITICAL JSON INSTRUCTIONS:
1. You must respond with valid JSON only. No markdown, no explanation, just the JSON object.
2. Do not use markdown code blocks (no \`\`\`json).
3. Ensure all arrays and objects are properly closed.`;

    const response = await callGrok(jsonSystemPrompt, userPrompt, {
        ...options,
        // Grok supports response_format: { type: "json_object" } in recent versions, 
        // but not all. We'll stick to prompt engineering + parsing for safety unless confirmed.
        // actually, let's try to add response_format if likely supported, but safe to omit.
    } as any);

    try {
        let jsonStr = response.content.trim();
        // Cleanup markdown if present
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
        else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
        if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
        jsonStr = jsonStr.trim();

        return JSON.parse(jsonStr);
    } catch (parseError) {
        console.error('Failed to parse Grok JSON response:', parseError);
        console.error('Raw content:', response.content);
        throw new Error('Failed to parse Grok JSON response');
    }
}

// Vision support for Grok
// Uses Grok Vision model
export interface ImageDocument {
    base64Data: string;
    mediaType: string;
}

export async function callGrokWithImage<T = any>(
    systemPrompt: string,
    userPrompt: string,
    imageDocument: ImageDocument,
    options?: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
    }
): Promise<T> {
    if (!XAI_API_KEY) {
        throw new Error('XAI_API_KEY is not set');
    }

    const model = options?.model ?? GROK_MODEL_VISION;
    const maxTokens = options?.maxTokens ?? 4096;

    // Construct standard OpenAI-compatible vision payload
    const messages = [
        { role: 'system', content: systemPrompt },
        {
            role: 'user',
            content: [
                { type: 'text', text: userPrompt },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:${imageDocument.mediaType};base64,${imageDocument.base64Data}`
                    }
                }
            ]
        }
    ];

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${XAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: maxTokens,
            temperature: options?.temperature ?? 0.3
        })
    });

    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Grok Vision API error: ${txt}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    // Parse JSON
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

    return JSON.parse(jsonStr);
}

// File Upload Support for Grok (PDFs, etc.)
export interface GrokFile {
    id: string;
    bytes: number;
    created_at: number;
    filename: string;
    object: string;
    purpose: string;
}

export async function uploadFileToGrok(
    fileBuffer: ArrayBuffer,
    fileName: string,
    mimeType: string
): Promise<GrokFile> {
    if (!XAI_API_KEY) {
        throw new Error('XAI_API_KEY is not set');
    }

    console.log(`[grok-client] Uploading file to Grok: ${fileName} (${mimeType})`);

    const formData = new FormData();
    // Create a Blob from the buffer (Deno supports Blob and File in FormData)
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', blob, fileName);
    formData.append('purpose', 'vision'); // 'vision' or 'assistants' - typically 'vision' for multimodal analysis

    const response = await fetch('https://api.x.ai/v1/files', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${XAI_API_KEY}`,
            // Content-Type header is set automatically by fetch with FormData
        },
        body: formData
    });

    if (!response.ok) {
        const txt = await response.text();
        console.error('Grok File Upload Error:', txt);
        throw new Error(`Grok File Upload failed: ${txt}`);
    }

    const data = await response.json();
    console.log('[grok-client] File uploaded successfully:', data);
    return data;
}

// Enhanced Grok Call that can handle File IDs (or standard images)
// We abuse `imageDocument` slightly or add a new overload, but let's extend the logic.
export async function callGrokWithFile<T = any>(
    systemPrompt: string,
    userPrompt: string,
    fileId: string, // The ID returned from uploadFileToGrok (e.g. "file-123...")
    options?: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
    }
): Promise<T> {
    if (!XAI_API_KEY) {
        throw new Error('XAI_API_KEY is not set');
    }

    const model = options?.model ?? GROK_MODEL_VISION;
    const maxTokens = options?.maxTokens ?? 4096;
    const temperature = options?.temperature ?? 0.3;

    // Check if it's a File ID (doesn't start with http/data)
    const isFileId = !fileId.startsWith('http') && !fileId.startsWith('data:');

    let messages: any[] = [];

    if (isFileId) {
        // STRATEGY A: File ID Reference (for RAG/Reasoning models)
        // We inject the file ID into the context via text.
        console.log(`[grok-client] Using File ID reference strategy for ${fileId} (Model: ${model})`);

        // Note: For Grok/xAI, if using the proprietary Files API + Reasoning model, 
        // passing the file ID in the text might typically look like a specific token or just context.
        // We will try appending it clearly.
        messages = [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: `[Attached File ID: ${fileId}]\n\n${userPrompt}`
            }
        ];
    } else {
        // STRATEGY B: URL/Base64 Reference (for Vision models)
        console.log(`[grok-client] Using Image URL strategy (Model: ${model})`);
        messages = [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: [
                    { type: 'text', text: userPrompt },
                    {
                        type: 'image_url', // Using image_url for actual images
                        image_url: {
                            url: fileId
                        }
                    }
                ]
            }
        ];
    }

    console.log('[grok-client] Sending chat request...');

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${XAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: maxTokens,
            temperature: temperature
        })
    });

    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Grok API error (File Analysis): ${txt}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    // Parse JSON
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

    return JSON.parse(jsonStr);
}
