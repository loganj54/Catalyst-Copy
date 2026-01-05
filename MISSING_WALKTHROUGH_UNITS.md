# Missing Walkthrough Units - Problem Sections

## The Issue

The structure is rendering, but each problem section is missing the final "Problem Walkthrough" unit that should show the step-by-step solution.

## Expected Structure

For each **problem** section, there should be:
1. Concept units (2-4 units teaching the concepts)
2. **Walkthrough unit** (final unit showing the complete solution)

Example:
```
Problem 1: Plane Wall Heat Conduction
  ├─ Unit 1: Steady-State 1D Heat Conduction (concept)
  ├─ Unit 2: Boundary Conditions (concept)
  ├─ Unit 3: Temperature Distribution (concept)
  └─ Unit 4: Problem 1 Walkthrough (walkthrough) ← MISSING
```

## Why This Happens

Claude is hitting the token limit before generating the walkthrough units. With 50,000 tokens and 6 problems, it's generating:
- Summary
- Prerequisites
- 6 problem sections × 3-4 concept units each = ~20-24 units
- Then runs out of tokens before adding the 6 walkthrough units

## Check if Walkthroughs Exist

Run this SQL to check:

```sql
SELECT 
  section->>'section_id' as section_id,
  jsonb_array_length(section->'learning_units') as num_units,
  (section->'learning_units'->-1)->>'unit_type' as last_unit_type,
  (section->'learning_units'->-1)->>'topic' as last_unit_topic
FROM blueprint_structures,
     jsonb_array_elements(structure->'learning_structure'->'content_sections') as section
WHERE blueprint_id = '5ced0531-3b5c-4786-8d20-53e49366d26c';
```

**Expected:** `last_unit_type` should be `'walkthrough'` for problem sections  
**If you see:** `last_unit_type` = `'topic'` → Walkthroughs are missing

## Solutions

### Option 1: Increase Token Limit (Quick Fix)

Increase from 50k to 100k tokens:

**File:** `supabase/functions/generate-structure-legacy/index.ts`

```typescript
// Line ~1081
const structure = await callClaudeJSON<LearningStructure>(
  PROMPTS.generateStructure.system,
  PROMPTS.generateStructure.user(analysisData, inputType),
  { temperature: 0.4, maxTokens: 100000 } // Increased from 50000
);
```

Then redeploy:
```bash
npx supabase functions deploy generate-structure-legacy
```

### Option 2: Modify Prompt to Prioritize Walkthroughs

Update the prompt to generate walkthroughs first, then fill in concept units:

**File:** `supabase/functions/_shared/prompts.ts`

Find line ~315 and update:

```typescript
OUTPUT: JSON with summary, prerequisites_section (learning_units array), content_sections array. 

CRITICAL PRIORITY ORDER:
1. Generate ALL walkthrough units FIRST (one per problem section at the end)
2. Then fill in concept units for each section
3. If approaching token limit, reduce concept units but ALWAYS include the walkthrough

Each unit needs: unit_id, unit_type, topic, tutor_guidance (2-3 sentences), target_resource_profile, search_queries (exactly 3), equations (when applicable), suggested_figures (0-2 max). For problems: MUST have walkthrough unit at end with problem_solving_queries.
```

### Option 3: Generate Walkthroughs Separately (Advanced)

Create a separate function that generates just the walkthrough units after the main structure is complete.

## Quick Test After Fix

After increasing token limit or updating prompt:

1. Regenerate a blueprint
2. Check the last unit of each problem section
3. It should be `unit_type: "walkthrough"`
4. The topic should be like "Problem 1 Complete Solution" or "Problem 1 Walkthrough"

## Recommended: Option 1 (Increase Token Limit)

**Pros:**
- Simplest fix
- Takes 30 seconds
- Claude Haiku 4.5 supports up to 200k tokens
- Cost increase is minimal (~$0.20 more per large document)

**Cons:**
- Slightly higher cost per generation

**Cost Comparison:**
- 50k tokens: ~$0.20 per generation
- 100k tokens: ~$0.40 per generation
- Still very cheap with Haiku 4.5!

---

**Action:** Increase token limit to 100k  
**File:** `generate-structure-legacy/index.ts` line 1081  
**Deploy:** `npx supabase functions deploy generate-structure-legacy`  
**Result:** Walkthrough units will be generated! 🎉

