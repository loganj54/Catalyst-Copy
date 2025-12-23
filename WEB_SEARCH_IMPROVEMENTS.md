# Web Search Improvements - Fix for Irrelevant Results

## Problem Summary

The web search feature was returning completely irrelevant results. For example:
- **Query**: "Planck's Distribution and Spectral Fractions" (physics/heat transfer topic)
- **Expected**: Videos about blackbody radiation, Planck's law, spectral radiance
- **Actual**: Videos about kindergarten-level fractions (1/2 + 1/3)

## Root Causes Identified

### 1. **Overly Complex Search Queries**
The system was using full academic topic names as search queries without simplification:
- ❌ "Planck's Distribution and Spectral Radiance Calculations youtube"
- ❌ "Thermodynamic Cycle Efficiency Optimization youtube"

These complex queries often return **ZERO results** on YouTube, causing the system to return unrelated content.

### 2. **No Query Simplification Logic**
The YouTube API search was using generic patterns like:
```typescript
`${topic} tutorial`
`${topic} explained`
```

For complex topics, this creates unsearchable queries that YouTube can't match to real video titles.

### 3. **Weak AI Prompt Instructions**
The AI generating search queries didn't have strong enough guidance about:
- Breaking down complex technical terms
- Using common educational terminology instead of academic jargon
- Keeping queries short and searchable

### 4. **No Query Validation or Refinement**
There was no mechanism to detect when a search returned poor results and automatically try simpler queries.

## Solutions Implemented

### 1. **Query Simplification Function** (`simplifyTopicForSearch`)

Added intelligent query simplification in both `search-resources` and `search-problem-walkthroughs`:

```typescript
function simplifyTopicForSearch(topic: string): string {
  // Remove problematic words
  const wordsToRemove = [
    'calculations?', 'analysis', 'applications?', 'methods?', 
    'optimization', 'numerical', 'computational', 'advanced'
  ];
  
  // Apply common term replacements
  const replacements = {
    'spectral radiance': 'blackbody radiation',
    'spectral fractions': 'blackbody radiation',
    "planck's distribution": "planck's law",
    // ... more replacements
  };
  
  // Limit to 4-6 words max
  // Clean up and return simplified query
}
```

**Examples:**
- "Planck's Distribution and Spectral Radiance Calculations" → "Planck's law blackbody radiation"
- "Navier-Stokes Equation Turbulent Flow Analysis" → "Navier Stokes equation"
- "Heat Exchanger Effectiveness-NTU Method Analysis" → "heat exchanger NTU method"

### 2. **Improved YouTube API Search Priority**

Changed the search query priority order in `search-resources/index.ts`:

**Before:**
```typescript
const queriesToTry = [
  `${topic} tutorial`,  // Often too complex
  `${topic} explained`, // Often too complex
  ...searchQueries
];
```

**After:**
```typescript
// PRIORITY 1: Use AI-generated queries (should be well-crafted)
searchQueries.slice(0, 3).forEach(q => queriesToTry.push(q.query));

// PRIORITY 2: Simplified fallbacks
const simplifiedTopic = simplifyTopicForSearch(topic);
queriesToTry.push(`${simplifiedTopic} tutorial youtube`);
queriesToTry.push(`${simplifiedTopic} explained youtube`);
```

### 3. **Enhanced AI Prompt Instructions**

Updated `prompts.ts` with extensive guidance on query simplification:

**New sections added:**
- **"CRITICAL: SIMPLIFY TECHNICAL TERMS FOR SEARCHABILITY"** - with 15+ examples
- **"SIMPLIFICATION RULES"** - concrete rules for breaking down complex terms
- **Physics/Engineering-specific examples** showing good vs bad queries
- **Mental test**: "Would this appear in a YouTube video title?"

**Key improvements:**
```typescript
PHYSICS EXAMPLES:
❌ BAD: "Planck's Distribution and Spectral Radiance Calculations youtube"
✅ GOOD: "Planck's law blackbody radiation youtube tutorial"
✅ GOOD: "spectral radiance physics explained youtube"

SIMPLIFICATION RULES:
1. Break compound topics: "A and B" → search "A" OR "B" separately
2. Remove calculation words: "calculations", "analysis", "optimization"
3. Use common names: "Planck's law" not "Planck's distribution function"
4. Keep under 6 words (excluding "youtube")
5. Use terms from video TITLES, not academic papers
```

### 4. **Improved Claude Web Search Fallback**

Enhanced the Claude web search prompt with better simplification instructions:

**Before:**
```
"If no results: simplify! Remove technical jargon, use common terms"
```

**After:**
```
SEARCH STRATEGY - START SIMPLE, NOT COMPLEX:
Complex academic terms often return ZERO results. You MUST simplify FIRST.

SIMPLIFICATION EXAMPLES:
❌ DON'T search: "Planck's Distribution and Spectral Radiance Calculations"
✅ DO search: "Planck's law blackbody radiation"
✅ DO search: "spectral radiance explained"

SEARCH PROGRESSION (try in order):
1. "[simplified core concept] explained youtube"
2. "[simplified core concept] tutorial youtube"
3. "[related broader topic] youtube"
4. "[subject area] [key term] youtube"
```

### 5. **Problem Walkthrough Search Improvements**

Applied the same simplification logic to `search-problem-walkthroughs/index.ts`:

```typescript
// Simplify AI-generated queries before using them
const aiQueries = problemSolvingQueries.map(q => {
  const simplified = simplifyTopicForSearch(q.query);
  // ... enhance with problem context
  return simplified;
});

// Add fallback simplified queries
const simplifiedTopic = simplifyTopicForSearch(topic);
queriesToTry.push(`${simplifiedTopic} example problem solved youtube`);
queriesToTry.push(`${simplifiedTopic} homework problem walkthrough youtube`);
```

## Expected Improvements

### For "Planck's Distribution and Spectral Fractions":

**Before (broken):**
- Search: "Planck's Distribution and Spectral Fractions tutorial"
- Results: Kindergarten fraction videos (1/2 + 1/3)

**After (fixed):**
- Search 1: "Planck's law blackbody radiation youtube tutorial"
- Search 2: "spectral radiance explained youtube"
- Search 3: "blackbody radiation example problems youtube"
- Results: Relevant physics videos about Planck's law, blackbody radiation, spectral radiance

### For other complex topics:

| Original Topic | Simplified Queries |
|---------------|-------------------|
| "Navier-Stokes Equation Turbulent Flow Analysis" | "Navier Stokes equation explained youtube"<br>"turbulent flow basics youtube" |
| "Fourier Transform Signal Processing Applications" | "Fourier transform explained youtube"<br>"signal processing basics youtube" |
| "Heat Exchanger Effectiveness-NTU Method" | "heat exchanger NTU method youtube"<br>"NTU method example problems youtube" |

## Testing Recommendations

1. **Test with the original failing case:**
   - Create a blueprint with "Planck's Distribution and Spectral Fractions"
   - Verify it returns physics videos, not kindergarten math

2. **Test with other complex topics:**
   - "Navier-Stokes Equation Turbulent Flow"
   - "Finite Element Analysis Stress Concentration"
   - "Thermodynamic Cycle Efficiency Optimization"

3. **Verify query diversity:**
   - Check that 3 different query types are used (introduction, tutorial, example)
   - Confirm all results are YouTube videos

4. **Check problem walkthroughs:**
   - Verify problem-solving queries are specific enough
   - Confirm they find worked examples, not just theory videos

## Files Modified

1. **`supabase/functions/_shared/prompts.ts`**
   - Added extensive simplification guidance (lines 291-327)
   - Added 15+ examples of good vs bad queries
   - Added simplification rules and mental tests

2. **`supabase/functions/search-resources/index.ts`**
   - Added `simplifyTopicForSearch()` function (lines 101-145)
   - Changed query priority to use AI queries first (lines 139-162)
   - Improved Claude web search prompt (lines 250-290)
   - Updated user prompt with simplified terms (lines 276-313)

3. **`supabase/functions/search-problem-walkthroughs/index.ts`**
   - Added `simplifyTopicForSearch()` function (lines 103-147)
   - Applied simplification to AI-generated queries (lines 170-188)
   - Added fallback simplified queries (lines 190-194)

## Key Takeaways

1. **Academic terminology ≠ YouTube search terms**
   - YouTube videos use common educational language
   - Academic jargon often returns zero results

2. **Shorter is better**
   - Keep queries under 6 words (excluding "youtube")
   - Break compound topics into separate searches

3. **Progressive simplification**
   - Start with AI-generated queries
   - Fall back to simplified topic-based queries
   - Use core concepts as last resort

4. **Context matters**
   - Add subject area: "physics", "engineering", "calculus"
   - Include learning keywords: "explained", "tutorial", "example"

5. **Validation through mental testing**
   - "Would this appear in a YouTube video title?"
   - If no, simplify more

## Future Enhancements

1. **Query result validation**: Check if search returns relevant results, auto-retry with simpler queries
2. **User feedback loop**: Learn from which queries work best for specific topics
3. **Domain-specific dictionaries**: Expand the replacements map with more field-specific terms
4. **A/B testing**: Track which query patterns yield the best engagement
5. **Semantic similarity**: Use embeddings to validate result relevance before returning to user

