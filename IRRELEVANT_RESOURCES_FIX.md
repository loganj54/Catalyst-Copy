# Irrelevant Resources Fix

## Problem
Web search was returning irrelevant resources (e.g., skincare products, JavaScript tutorials) for technical topics like "Fourier's law of heat conduction". The resources had explanations saying "This resource does not contain relevant content" but were still being displayed to users.

## Root Cause
The `generateResourceExplanations()` function in `search-resources` was generating explanations that identified irrelevant resources, but there was no filtering logic to remove them before display. The irrelevant resources were:
1. Being stored in the database
2. Being returned from the API
3. Being displayed in the UI

## Approach
We use a **conservative filtering approach**:
- Only filter resources that are **explicitly** marked as completely irrelevant (e.g., skincare for physics)
- Be generous - if a resource is even partially related, keep it and explain the connection
- This prevents over-filtering while still removing obviously wrong results

## Solution Implemented

### 1. Backend Changes (`supabase/functions/search-resources/index.ts`)

**Updated the explanation generation prompt** to be conservative:
- Added `is_relevant` boolean field to the output format
- Instructed Claude to ONLY mark completely off-topic resources as irrelevant (e.g., cooking for math)
- Emphasized being generous - if even partially related, mark as relevant
- Made the prompt clear about when to use `"NOT_RELEVANT"`

**Added filtering logic after explanation generation** (conservative approach):
```typescript
// Filter out ONLY explicitly irrelevant resources
const relevantResources: ResourceResult[] = [];
let filteredCount = 0;

for (const resource of resources) {
  const matchingExplanation = explanations.find(e => e.url === resource.url);
  
  // Only filter if EXPLICITLY marked as not relevant
  // Be conservative - when in doubt, keep the resource
  if (matchingExplanation) {
    const explanation = matchingExplanation.explanation || '';
    const isExplicitlyIrrelevant = 
      matchingExplanation.is_relevant === false && 
      (explanation === 'NOT_RELEVANT' || 
       explanation.toLowerCase().includes('does not contain relevant content') ||
       explanation.toLowerCase().includes('not actually relevant'));
    
    if (isExplicitlyIrrelevant) {
      console.log(`[search-resources] Filtering out explicitly irrelevant resource: ${resource.title}`);
      filteredCount++;
      continue; // Skip this resource
    }
    
    resource.resource_explanation = matchingExplanation.explanation;
  }
  
  relevantResources.push(resource);
}

return relevantResources; // Only return relevant resources
```

### 2. Frontend Safety Net (`src/pages/Blueprint.jsx`)

Added filtering in two places as additional safety:

**A. In `fetchBlueprint()` when loading from database:**
```javascript
// Filter out ONLY explicitly irrelevant resources
const explanation = r.resource_explanation?.toLowerCase() || '';
const isExplicitlyIrrelevant = 
  explanation === 'not_relevant' ||
  explanation.includes('does not contain relevant content') ||
  explanation.includes('not actually relevant to');

if (!isExplicitlyIrrelevant) {
  resourcesMap[r.unit_id].push({...});
}
```

**B. In `handleFindResources()` when receiving fresh search results:**
```javascript
// Filter out ONLY explicitly irrelevant resources (safety check)
const relevantResources = data.resources.filter(resource => {
  const explanation = resource.resource_explanation?.toLowerCase() || '';
  const isExplicitlyIrrelevant = 
    explanation === 'not_relevant' ||
    explanation.includes('does not contain relevant content') ||
    explanation.includes('not actually relevant to');
  
  if (isExplicitlyIrrelevant) {
    console.log('[Blueprint] Filtered out explicitly irrelevant resource:', resource.title);
    return false;
  }
  return true;
});

// Show alert if all resources were filtered out
if (relevantResources.length === 0) {
  alert('No relevant resources found. The search results were not related to your learning objective.');
  return;
}
```

## How It Works Now

1. **Web Search**: Claude searches for videos using the web search tool
2. **Explanation Generation**: Claude evaluates each found resource for relevance (being generous - only marking completely off-topic ones as irrelevant)
3. **Backend Filtering**: Only explicitly irrelevant resources (skincare for physics, etc.) are filtered out before being stored
4. **Frontend Safety**: If any explicitly irrelevant resources slip through, they're caught and filtered in the UI
5. **User Experience**: Students see helpful resources, and only completely off-topic results are hidden

## Key Design Decision: Conservative Filtering

We use **conservative filtering** to balance removing junk while keeping useful resources:
- ✅ **Keep**: Partially related content that might help (e.g., general heat transfer for Fourier's law)
- ✅ **Keep**: Foundational content (e.g., calculus review for a physics problem)
- ❌ **Filter**: Completely unrelated content (e.g., skincare for engineering, JavaScript for thermodynamics)

This approach errs on the side of showing more rather than less, preventing the "no resources found" issue.

## Testing

To test the fix:

1. Deploy the changes (see Deployment section below)
2. Search for a technical topic (e.g., "Fourier's law of heat conduction")
3. Verify that:
   - Only relevant resources are displayed
   - All displayed resources have meaningful explanations
   - No resources with "does not contain relevant content" messages appear
   - If no relevant resources are found, a clear message is shown

## Deployment

### 1. Deploy Edge Function
```bash
# Deploy the updated search-resources function
npx supabase functions deploy search-resources

# Or deploy all functions
npx supabase functions deploy
```

### 2. Deploy Frontend
```bash
# Build the updated frontend
npm run build

# Deploy to your hosting service (Netlify, Vercel, etc.)
# Example for manual deployment:
# - Upload contents of dist/ folder to your hosting
```

### 3. Verify
- Open the app in your browser
- Do a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Test a web search for a technical topic
- Verify irrelevant resources are not displayed

## Impact

### Positive
- ✅ Users don't see completely off-topic resources (no skincare for physics)
- ✅ Improved learning experience with better resource quality
- ✅ Reduced confusion from obviously wrong results
- ✅ Conservative approach prevents over-filtering
- ✅ Students still get results even for niche topics

### Trade-offs
- Some marginally related results may still appear (this is intentional and better than showing nothing)
- If all web search results are bad, users will get a clear message instead of showing junk
- Conservative filtering means fewer false positives (resources incorrectly removed)

## Related Files
- `supabase/functions/search-resources/index.ts` - Main search logic and filtering
- `src/pages/Blueprint.jsx` - Frontend display and safety filtering
- `supabase/functions/_shared/content-analyzer.ts` - Content analysis (no changes needed)

## Future Improvements
- Consider adding a "Report Irrelevant Resource" button for user feedback
- Track filtering metrics to tune the relevance threshold
- Improve the web search prompt to reduce irrelevant results upfront
- Add more specific search queries based on topic type (equations, concepts, etc.)

