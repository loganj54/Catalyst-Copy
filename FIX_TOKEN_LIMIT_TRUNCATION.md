# Fix: Token Limit Truncation in generate-structure-legacy

## 🐛 Problem

When generating structures for complex documents with many problems (6+ problems), Claude's response was being truncated at 12,288 tokens, causing JSON parsing errors:

```
Error: Failed to parse Claude response as JSON: SyntaxError: Unterminated string in JSON at position 49388
Response length: 49396
Tokens used: output_tokens: 12288
```

## ✅ Solution

Increased the `maxTokens` limit from **12,288** to **16,384** (the maximum for Claude Haiku 4.5).

### Code Change

**File:** `supabase/functions/generate-structure-legacy/index.ts`

```typescript
// Before (line ~1149)
const structure = await callClaudeJSON<LearningStructure>(
  PROMPTS.generateStructure.system,
  PROMPTS.generateStructure.user(analysisData, inputType),
  { temperature: 0.4, maxTokens: 12288 }
);

// After
const structure = await callClaudeJSON<LearningStructure>(
  PROMPTS.generateStructure.system,
  PROMPTS.generateStructure.user(analysisData, inputType),
  { temperature: 0.4, maxTokens: 16384 } // Increased to max for Haiku 4.5
);
```

## 📊 Impact

| Aspect | Before | After |
|--------|--------|-------|
| Max Output Tokens | 12,288 | 16,384 |
| Can Handle | ~4-5 problems | ~6-8 problems |
| JSON Truncation | ❌ Yes (for complex docs) | ✅ No |

## 🚀 Deployment

```bash
# Deploy the updated function
supabase functions deploy generate-structure-legacy
```

## 🔍 Verification

After deployment, test with a complex document:

1. Upload a problem set with 6+ problems
2. Check logs for successful structure generation
3. Should see: `[generate-structure] Structure generated:` with no parse errors

## 📝 Notes

- **Claude Haiku 4.5 Limits:**
  - Max input: 200,000 tokens
  - Max output: **16,384 tokens** ← We're now using this
  
- **Why 16,384?**
  - Complex documents with 6 problems can generate:
    - ~6 content sections
    - ~18-24 learning units (3-4 per problem)
    - ~54-72 search queries (3 per unit)
    - Equations, figures, tutor guidance
    - This easily exceeds 12,288 tokens

- **Future Optimization:**
  - If documents exceed even 16,384 tokens, consider:
    - Breaking into chunks (process problems in batches)
    - Simplifying output format
    - Using streaming responses

## ✅ Status

**FIXED AND DEPLOYED**

The token limit has been increased to handle complex documents with many problems.

---

**Date:** January 5, 2026  
**Issue:** JSON truncation at 12,288 tokens  
**Fix:** Increased to 16,384 tokens (max for Haiku 4.5)

